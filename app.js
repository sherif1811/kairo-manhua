/* ----------------------------------------------------
   KAIRO/منهوا - MAIN APPLICATION JS CONTROLLER (PRO UPGRADE)
   VERSION: 2.5
------------------------------------------------------- */

// ==========================================
// 1. قاعدة البيانات والبيانات الافتراضية (IndexedDB & State)
// ==========================================

const APP_VERSION = '2.5';
const DB_NAME = 'kairo_manhua_offline';
const DB_VERSION = 1;
const STORE_NAME = 'downloaded_chapters';
const DEFAULT_COVER_URL = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500&auto=format&fit=crop&q=60';
const GENERIC_BANNER_MARKERS = [
    'images.unsplash.com/photo-1607604276583-eef5d076aa5f',
    'images.unsplash.com/photo-1534447677768-be436bb09401',
    'images.unsplash.com/photo-1518709268805-4e9042af9f23'
];
const BOOKMARK_STATUS_META = {
    '': {
        label: '\u0625\u0636\u0627\u0641\u0629 \u0644\u0644\u0645\u0641\u0636\u0644\u0629',
        icon: 'fa-regular fa-bookmark',
        tone: 'neutral'
    },
    reading: {
        label: '\u0623\u0642\u0631\u0623\u0647 \u062d\u0627\u0644\u064a\u0627\u064b',
        icon: 'fa-solid fa-book-open-reader',
        tone: 'cyan'
    },
    plan: {
        label: '\u0623\u0631\u063a\u0628 \u0641\u064a \u0642\u0631\u0627\u0621\u062a\u0647',
        icon: 'fa-solid fa-bookmark',
        tone: 'violet'
    },
    completed: {
        label: '\u0645\u0643\u062a\u0645\u0644',
        icon: 'fa-solid fa-circle-check',
        tone: 'green'
    }
};
const BOOKMARK_STATUS_ORDER = ['', 'reading', 'plan', 'completed'];

// معرفات التطبيقات لتسجيل الدخول الاجتماعي (تُحمّل من قاعدة البيانات)
let GOOGLE_CLIENT_ID = '';
let FACEBOOK_APP_ID = '';

function isUsableGoogleClientId(clientId = GOOGLE_CLIENT_ID) {
    const value = (clientId || '').trim();
    return value && value.endsWith('.apps.googleusercontent.com');
}

function isUsableFacebookAppId(appId = FACEBOOK_APP_ID) {
    const value = (appId || '').trim();
    return value && value.length >= 8;
}

function getDisplayCover(manga) {
    const cover = manga && typeof manga.cover === 'string' ? manga.cover.trim() : '';
    return cover || DEFAULT_COVER_URL;
}

function getMangaBanner(manga) {
    const cover = getDisplayCover(manga);
    const banner = manga && typeof manga.banner === 'string' ? manga.banner.trim() : '';
    if (!banner) return cover;
    if (GENERIC_BANNER_MARKERS.some(marker => banner.includes(marker))) return cover;
    return banner;
}

function normalizeMangaAssets(manga) {
    if (!manga || typeof manga !== 'object') return manga;
    manga.cover = getDisplayCover(manga);
    manga.banner = getMangaBanner(manga);
    if (typeof manga.genres === 'string') {
        manga.genres = manga.genres.split(/[,\u060C]+/).map(g => g.trim()).filter(g => g !== '');
    }
    if (!Array.isArray(manga.genres)) manga.genres = [];
    return manga;
}

function cssImageUrl(url) {
    return `url('${String(url || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')`;
}

function getBookmarkStatusMeta(status) {
    return BOOKMARK_STATUS_META[status] || BOOKMARK_STATUS_META[''];
}

function setBookmarkStatus(mangaId, status) {
    if (!mangaId) return;
    if (status) {
        state.bookmarks[mangaId] = status;
    } else {
        delete state.bookmarks[mangaId];
    }
    state.saveBookmarks();
}

function getUserHandle(email) {
    return String(email || '').split('@')[0] || '\u062d\u0633\u0627\u0628\u064a';
}

function getUserInitial(email) {
    return getUserHandle(email).charAt(0).toUpperCase();
}

// تهيئة قاعدة بيانات IndexedDB لحفظ الفصول للقراءة دون اتصال
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

// حفظ الفصل في IndexedDB (القراءة دون اتصال)
async function saveChapterOffline(mangaId, chapterId, images) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const item = {
            id: `${mangaId}_${chapterId}`,
            mangaId,
            chapterId,
            images,
            downloadedAt: new Date().toISOString()
        };
        const request = store.put(item);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
}

// جلب الفصل المحفوظ من IndexedDB
async function getChapterOffline(mangaId, chapterId) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(`${mangaId}_${chapterId}`);
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = () => reject(e.target.error);
    });
}

// جلب كافة الفصول المحملة
async function getAllDownloadsOffline() {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = () => reject(e.target.error);
    });
}

// حذف فصل محمل
async function deleteChapterOffline(mangaId, chapterId) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(`${mangaId}_${chapterId}`);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
}

// إنتاج صفحات مانجا تجريبية مميزة بتصميم متجه (SVG Pages) لتعمل أوفلاين 100% وبسرعة فائقة
function generateMockPages(mangaTitle, chapNum, count = 5) {
    const pages = [];
    for (let i = 1; i <= count; i++) {
        const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200" viewBox="0 0 800 1200">
            <rect width="100%" height="100%" fill="#0c0d14"/>
            <defs>
                <linearGradient id="g_${chapNum}_${i}" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#8a2be2" stop-opacity="0.15"/>
                    <stop offset="50%" stop-color="#161924" stop-opacity="0.9"/>
                    <stop offset="100%" stop-color="#00f0ff" stop-opacity="0.1"/>
                </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#g_${chapNum}_${i})"/>
            <!-- إطار جمالي -->
            <rect x="20" y="20" width="760" height="1160" rx="15" fill="none" stroke="#222638" stroke-width="2"/>
            <circle cx="400" cy="550" r="140" fill="#161924" stroke="#8a2be2" stroke-width="3" stroke-dasharray="12 6"/>
            
            <!-- نص محتوى الصفحة -->
            <text x="400" y="520" fill="#ffffff" font-family="'Cairo', sans-serif" font-size="28" font-weight="bold" text-anchor="middle">KAIRO / منهوا</text>
            <text x="400" y="570" fill="#00f0ff" font-family="'Cairo', sans-serif" font-size="24" font-weight="600" text-anchor="middle">${mangaTitle}</text>
            <text x="400" y="620" fill="#ff007f" font-family="'Cairo', sans-serif" font-size="20" text-anchor="middle">الفصل ${chapNum} - الصفحة ${i}</text>
            
            <!-- لوحة المانجا الزخرفية -->
            <path d="M 300 800 L 500 800 L 450 950 L 350 950 Z" fill="#8a2be2" fill-opacity="0.1" stroke="#8a2be2" stroke-width="1"/>
            <line x1="50" y1="1100" x2="750" y2="1100" stroke="#222638" stroke-width="1"/>
            
            <text x="400" y="1130" fill="#62667d" font-family="'Cairo', sans-serif" font-size="14" text-anchor="middle">استمتع بالقراءة السلسة والمحملة على جهازك</text>
        </svg>
        `;
        const encoded = btoa(unescape(encodeURIComponent(svg)));
        pages.push(`data:image/svg+xml;base64,${encoded}`);
    }
    return pages;
}

// إنتاج صفحات مانجا ملونة وحصرية لـ Kingdom تحمل علامة مائية لـ KAIRO/منهوا
function generateKingdomMockPages(mangaTitle, chapNum, count = 5) {
    const pages = [];
    for (let i = 1; i <= count; i++) {
        const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200" viewBox="0 0 800 1200">
            <rect width="100%" height="100%" fill="#11131c"/>
            <defs>
                <linearGradient id="gk_${chapNum}_${i}" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#cc0022" stop-opacity="0.25"/>
                    <stop offset="50%" stop-color="#161924" stop-opacity="0.95"/>
                    <stop offset="100%" stop-color="#ff9900" stop-opacity="0.15"/>
                </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#gk_${chapNum}_${i})"/>
            
            <!-- إطار عسكري زخرفي -->
            <rect x="25" y="25" width="750" height="1150" rx="10" fill="none" stroke="#ff9900" stroke-width="2" stroke-opacity="0.4"/>
            <rect x="35" y="35" width="730" height="1130" rx="6" fill="none" stroke="#22263b" stroke-width="1"/>
            
            <!-- لوحات مانجا ملونة (Manga Panels Mockup) -->
            <!-- لوحة 1: مشهد حواري -->
            <rect x="60" y="80" width="680" height="300" rx="8" fill="#161924" stroke="#cc0022" stroke-width="2"/>
            <path d="M 60 80 L 740 380" stroke="#cc0022" stroke-width="1" stroke-opacity="0.1"/>
            <text x="400" y="200" fill="#f8f9fa" font-family="'Cairo', sans-serif" font-size="24" font-weight="bold" text-anchor="middle">موقعة توحيد المقاطعات الكبرى</text>
            <text x="400" y="240" fill="#ff9900" font-family="'Cairo', sans-serif" font-size="18" font-weight="700" text-anchor="middle">شين: "سأكون أعظم جنرال تحت هذه السماء!"</text>
            
            <!-- لوحة 2: لوحة تعبيرية للقتال -->
            <rect x="60" y="410" width="320" height="400" rx="8" fill="#241a22" stroke="#8a2be2" stroke-width="1"/>
            <text x="220" y="600" fill="#ff007f" font-family="'Cairo', sans-serif" font-size="22" font-weight="800" text-anchor="middle">صوت السيوف! *كلاش*</text>
            
            <!-- لوحة 3: وجه شين الغاضب -->
            <rect x="420" y="410" width="320" height="400" rx="8" fill="#162029" stroke="#00f0ff" stroke-width="1"/>
            <text x="580" y="600" fill="#00f0ff" font-family="'Cairo', sans-serif" font-size="22" font-weight="800" text-anchor="middle">هجوم كتيبة الهي شين!</text>
            
            <!-- لوحة 4: مشهد استراتيجي -->
            <rect x="60" y="840" width="680" height="250" rx="8" fill="#161924" stroke="#ff9900" stroke-width="1"/>
            <text x="400" y="965" fill="#9ba0b4" font-family="'Cairo', sans-serif" font-size="18" text-anchor="middle">خريطة التقدم التكتيكي لجيش تشين</text>

            <!-- العلامة المائية الحصرية الكبيرة (Glowing Neon Watermark) -->
            <g transform="rotate(-30 400 600)" opacity="0.12">
                <rect x="100" y="540" width="600" height="120" fill="#cc0022" rx="15"/>
                <text x="400" y="615" fill="#ffffff" font-family="'Cairo', sans-serif" font-size="40" font-weight="900" text-anchor="middle" letter-spacing="2">KAIRO / منهوا - حصري</text>
            </g>
            
            <!-- علامة مائية صغيرة ثابتة بالأسفل -->
            <text x="400" y="1125" fill="#ff9900" font-family="'Cairo', sans-serif" font-size="16" font-weight="bold" text-anchor="middle">حصري ومترجم لـ KAIRO/منهوا - الفصل ${chapNum} - الصفحة ${i}</text>
        </svg>
        `;
        const encoded = btoa(unescape(encodeURIComponent(svg)));
        pages.push(`data:image/svg+xml;base64,${encoded}`);
    }
    return pages;
}

// مولد الفصول التلقائي التفاعلي لتقليل حجم الكود البرمجي وتوفير قاعدة بيانات كاملة
function populateDefaultChapters(maxChapters, isKingdom = false) {
    const chapters = [];
    for (let i = maxChapters; i >= 1; i--) {
        chapters.push({
            id: String(i),
            title: `الفصل ${i}: ${isKingdom ? 'موقعة توحيد الصين العظمى' : 'بداية المغامرة والقتال'} ${isKingdom ? '(ملون وحصري)' : ''}`,
            date: new Date(Date.now() - (maxChapters - i) * 8 * 60 * 60 * 1000).toISOString().split('T')[0], // تواريخ واقعية متسلسلة
            images: [] // مصفوفة فارغة سيتم توليد صورها ديناميكياً على الطاير في القارئ
        });
    }
    return chapters;
}

// البيانات الافتراضية للموقع
const DEFAULT_MANGAS = [
    {
        id: "1",
        title: "سولو ليفيلينغ (Solo Leveling)",
        alternative: "Na Honjaman Level Up",
        author: "Chugong",
        cover: "solo_leveling_cover.jpg",
        banner: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1200&auto=format&fit=crop&q=80",
        rating: 4.9,
        status: "مكتمل",
        type: "منهوا",
        views: 0,
        genres: ["أكشن", "مغامرة", "خيال", "قوى خارقة"],
        synopsis: "في عالم يربط فيه بوابة غامضة عالم البشر بعالم الوحوش، يكتشف الصياد الأضعف سونغ جين وو نظاماً غامضاً يمنحه القدرة الفريدة على رفع مستواه بلا حدود.",
        chapters: populateDefaultChapters(200, false)
    }
];

// ==========================================
// 2. إدارة الحالة العامة والتخزين (State Management)
// ==========================================

class AppState {
    safeParse(str, fallback) {
        try {
            return str ? JSON.parse(str) : fallback;
        } catch (e) {
            console.error("Safe JSON parse failed:", e);
            return fallback;
        }
    }

    constructor() {
        this.loadUserProfile();
        this.loadMangas();
        this.loadBookmarks();
        this.loadReadingProgress();
        this.loadHistory();
        this.loadComments();
        this.loadLikes();
        this.loadReaderSettings();
        
        this.currentView = 'home';
        this.activeMangaId = null;
        this.activeChapterId = null;
        
        this.activePageIndex = 0;
        this.searchQuery = '';
        this.showSearchSuggestions = false;
        this.chapterSearchQuery = '';
        this.activeGenre = 'الكل';
        this.downloadProgress = {};
        this.showAuthModal = false;
        this.authModalTab = 'login';
        this.showSettingsModal = false;
        this.editMangaId = null;
        this.adminStats = null;
        this.adminStatsLoading = false;
        this.adminDateFrom = '';
        this.adminDateTo = '';
        this.loadScrapedMangas();
        
        if (this.sessionToken) {
            this.fetchAndMergeSettings();
            this.fetchUserProfile();
        }
    }

    loadMangas() {
        this.deletedIds = new Set(JSON.parse(localStorage.getItem('kairo_deleted_ids') || '[]'));
        const stored = localStorage.getItem('kairo_mangas');
        if (stored) {
            try {
                this.mangas = JSON.parse(stored);
            } catch (e) {
                console.error("Failed to parse kairo_mangas:", e);
                this.mangas = DEFAULT_MANGAS;
            }
        } else {
            this.mangas = JSON.parse(JSON.stringify(DEFAULT_MANGAS));
            this.saveMangas();
        }
        this.mangas = this.mangas.map(manga => normalizeMangaAssets(manga));
        // Strict Blacklist Filter
        if (this.deletedIds && this.deletedIds.size > 0) {
            this.mangas = this.mangas.filter(m => !this.deletedIds.has(m.id));
        }
        this.saveMangas();
    }

    async loadScrapedMangas() {
        try {
            const response = await fetch('./scraped_mangas.json');
            if (response.ok) {
                const scraped = await response.json();
                if (Array.isArray(scraped)) {
                    scraped.forEach(scManga => {
                        if (this.deletedIds && this.deletedIds.has(scManga.id)) return;
                        normalizeMangaAssets(scManga);
                        const existsIdx = this.mangas.findIndex(m => m.id === scManga.id || m.title === scManga.title);
                        if (existsIdx === -1) {
                            this.mangas.push(scManga);
                        } else {
                            const match = this.mangas[existsIdx];
                            if (scManga.chapters && scManga.chapters.length > 0) {
                                match.chapters = scManga.chapters;
                            }
                            match.cover = scManga.cover || match.cover;
                            match.banner = scManga.banner || getMangaBanner(match);
                            match.alternative = scManga.alternative || match.alternative;
                            match.synopsis = scManga.synopsis || match.synopsis;
                            match.genres = scManga.genres || match.genres;
                            normalizeMangaAssets(match);
                        }
                    });
                    this.saveMangas();
                    renderApp();
                }
            }
        } catch (e) {
            console.log("No scraped_mangas.json found or failed to load. Skipping.");
        }
    }

    saveMangas() {
        // Deep copy mangas, but strip images from Solo Leveling (manga.id === "1") to save space
        const mangasToSave = this.mangas.map(m => {
            if (m.id === "1") {
                const chaptersCopy = m.chapters.map(ch => {
                    return {
                        id: ch.id,
                        title: ch.title,
                        date: ch.date
                        // Do NOT save the images array for Solo Leveling
                    };
                });
                return {
                    ...m,
                    chapters: chaptersCopy
                };
            }
            return m;
        });
        try {
            localStorage.setItem('kairo_mangas', JSON.stringify(mangasToSave));
        } catch (e) {
            console.error("Failed to save mangas to localStorage:", e);
        }
    }

    async syncSettings() {
        if (!this.sessionToken) return;
        
        const settingsPayload = {
            bookmarks: this.bookmarks,
            history: this.history,
            progress: this.progress,
            likes: this.likes,
            comments: this.comments,
            userProfile: this.userProfile
        };
        
        try {
            await fetch('/api/sync_settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.sessionToken}`
                },
                body: JSON.stringify({ settings: settingsPayload })
            });
        } catch (e) {
            console.error("[-] Sync error:", e);
        }
    }

    async fetchAndMergeSettings() {
        if (!this.sessionToken) return;
        
        try {
            const response = await fetch('/api/get_settings', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.sessionToken}`
                }
            });
            if (response.ok) {
                const settings = await response.json();
                if (settings && Object.keys(settings).length > 0) {
                    if (settings.bookmarks) this.bookmarks = { ...this.bookmarks, ...settings.bookmarks };
                    if (settings.likes) this.likes = { ...this.likes, ...settings.likes };
                    if (settings.comments) this.comments = { ...this.comments, ...settings.comments };
                    if (settings.userProfile) {
                        this.userProfile.username = settings.userProfile.username || this.userProfile.username;
                        this.userProfile.points = Math.max(this.userProfile.points, settings.userProfile.points || 0);
                        if (settings.userProfile.level) this.userProfile.level = Math.max(this.userProfile.level || 1, settings.userProfile.level);
                    }
                    
                    if (settings.history && Array.isArray(settings.history)) {
                        const historyMap = new Map();
                        this.history.forEach(h => historyMap.set(h.mangaId, h));
                        settings.history.forEach(h => {
                            if (!historyMap.has(h.mangaId) || new Date(h.updatedAt) > new Date(historyMap.get(h.mangaId).updatedAt)) {
                                historyMap.set(h.mangaId, h);
                            }
                        });
                        this.history = Array.from(historyMap.values()).sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 30);
                    }
                    
                    if (settings.progress) {
                        for (let mangaId in settings.progress) {
                            if (!this.progress[mangaId] || new Date(settings.progress[mangaId].updatedAt) > new Date(this.progress[mangaId].updatedAt)) {
                                this.progress[mangaId] = settings.progress[mangaId];
                            }
                        }
                    }
                    
                    this.saveBookmarks();
                    this.saveHistory();
                    localStorage.setItem('kairo_progress', JSON.stringify(this.progress));
                    localStorage.setItem('kairo_likes', JSON.stringify(this.likes));
                    localStorage.setItem('kairo_comments', JSON.stringify(this.comments));
                    this.saveUserProfile();
                    renderApp();
                }
            }
        } catch (e) {
            console.error("[-] Fetch sync settings error:", e);
        }
    }

    loadBookmarks() {
        const stored = localStorage.getItem('kairo_bookmarks');
        this.bookmarks = this.safeParse(stored, {});
    }

    saveBookmarks() {
        localStorage.setItem('kairo_bookmarks', JSON.stringify(this.bookmarks));
        this.syncSettings();
    }

    loadHistory() {
        const stored = localStorage.getItem('kairo_history');
        this.history = this.safeParse(stored, []);
    }

    saveHistory() {
        localStorage.setItem('kairo_history', JSON.stringify(this.history));
        this.syncSettings();
    }

    addToHistory(mangaId, chapterId, scrollY = 0, percentage = 0, pageIndex = 0) {
        // Remove existing history for this manga to avoid duplication
        this.history = this.history.filter(h => h.mangaId !== mangaId);
        this.history.unshift({
            mangaId,
            chapterId,
            scrollY,
            percentage: Math.round(percentage),
            activePageIndex: pageIndex,
            updatedAt: new Date().toISOString()
        });

        if (this.history.length > 100) {
            this.history = this.history.slice(0, 100);
        }
        
        this.saveHistory();
    }

    getOverallProgress(mangaId) {
        const manga = this.mangas.find(m => m.id === mangaId);
        if (!manga || !manga.chapters || manga.chapters.length === 0) return 0;
        const readChapters = new Set(
            this.history.filter(h => h.mangaId === mangaId).map(h => h.chapterId)
        );
        return Math.round((readChapters.size / manga.chapters.length) * 100);
    }

    loadReadingProgress() {
        const stored = localStorage.getItem('kairo_progress');
        this.progress = this.safeParse(stored, {});
    }

    saveReadingProgress(mangaId, chapterId, scrollY, percentage, pageIndex = 0) {
        if (!this.progress[mangaId]) this.progress[mangaId] = {};
        this.progress[mangaId] = { chapterId, scrollY, percentage, activePageIndex: pageIndex, updatedAt: new Date().toISOString() };
        localStorage.setItem('kairo_progress', JSON.stringify(this.progress));
        this.syncSettings();
        this.addToHistory(mangaId, chapterId, scrollY, percentage, pageIndex);
        
        if (this.sessionToken) {
            fetch('/api/user/reading-progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this.sessionToken },
                body: JSON.stringify({ manga_id: mangaId, chapter_id: chapterId, page: pageIndex + 1 })
            })
            .then(r => r.json())
            .then(data => {
                if (data.leveled_up) {
                    this.userProfile.points = data.points;
                    this.userProfile.level = data.level;
                    this.saveUserProfile();
                    this.showLevelUpToast(data.level, data.rank_name);
                } else if (data.new_points > 0) {
                    this.userProfile.points = data.points;
                    this.userProfile.level = data.level;
                    this.saveUserProfile();
                }
            })
            .catch(e => console.error("Points sync error:", e));
        }
    }

    showLevelUpToast(newLevel, rankName) {
        const existing = document.getElementById('level-up-toast');
        if (existing) existing.remove();
        
        const toast = document.createElement('div');
        toast.id = 'level-up-toast';
        toast.innerHTML = `
            <div class="level-up-content">
                <div class="level-up-icon">🎉</div>
                <div class="level-up-text">
                    <h3>تهانينا!</h3>
                    <p>لقد صعدت للمستوى <strong>${newLevel}</strong></p>
                    <p class="level-up-rank">رتبتك: ${rankName}</p>
                </div>
            </div>
        `;
        document.body.appendChild(toast);
        
        requestAnimationFrame(() => toast.classList.add('level-up-visible'));
        setTimeout(() => {
            toast.classList.remove('level-up-visible');
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    }

    loadComments() {
        const stored = localStorage.getItem('kairo_comments');
        this.comments = this.safeParse(stored, {});
    }

    addComment(mangaId, chapterId, username, text) {
        const key = `${mangaId}_${chapterId}`;
        if (!this.comments[key]) this.comments[key] = [];
        this.comments[key].push({
            user: username || 'مجهول',
            text,
            date: new Date().toLocaleDateString('ar-EG')
        });
        localStorage.setItem('kairo_comments', JSON.stringify(this.comments));
        this.syncSettings();
    }

    loadLikes() {
        const stored = localStorage.getItem('kairo_likes');
        this.likes = this.safeParse(stored, {});
    }

    toggleLike(mangaId, chapterId) {
        const key = `${mangaId}_${chapterId}`;
        this.likes[key] = !this.likes[key];
        localStorage.setItem('kairo_likes', JSON.stringify(this.likes));
        this.syncSettings();
        return this.likes[key];
    }

    loadUserProfile() {
        const stored = localStorage.getItem('kairo_user_profile');
        this.userProfile = this.safeParse(stored, {
            username: 'أوتلاينر مميز',
            points: 0,
            level: 1
        });
        this.sessionToken = localStorage.getItem('kairo_session_token') || null;
        this.userEmail = localStorage.getItem('kairo_user_email') || null;
        this.userRole = localStorage.getItem('kairo_user_role') || null;
    }

    saveUserProfile() {
        localStorage.setItem('kairo_user_profile', JSON.stringify(this.userProfile));
        if (this.sessionToken) {
            localStorage.setItem('kairo_session_token', this.sessionToken);
            localStorage.setItem('kairo_user_email', this.userEmail);
            localStorage.setItem('kairo_user_role', this.userRole);
        } else {
            localStorage.removeItem('kairo_session_token');
            localStorage.removeItem('kairo_user_email');
            localStorage.removeItem('kairo_user_role');
        }
    }

    pointsNeededForLevel(level) {
        return 50 * level * (level + 1);
    }

    calculateLevel(points) {
        if (points <= 0) return 1;
        const n = Math.floor((-1 + Math.sqrt(1 + 4 * points / 50)) / 2);
        return Math.max(1, n);
    }

    getRankName(level) {
    if (level <= 30) return 'مبتدئ';
    if (level <= 60) return 'قارئ ممتاز';
    if (level <= 99) return 'قارئ أسطوري';
    return 'مدير المشروع';
    }

    async fetchUserProfile() {
        if (!this.sessionToken) return;
        try {
            const res = await fetch('/api/user/profile', {
                headers: { 'Authorization': 'Bearer ' + this.sessionToken }
            });
            if (res.ok) {
                const data = await res.json();
                this.userProfile.points = data.points;
                this.userProfile.level = data.level;
                this.saveUserProfile();
            }
        } catch (e) {
            console.error("Failed to fetch user profile:", e);
        }
    }

    addPoints(amount) {
        if (!this.userProfile) this.userProfile = {};
        this.userProfile.points = (this.userProfile.points || 0) + amount;
        this.userProfile.level = this.calculateLevel(this.userProfile.points);
        this.saveUserProfile();
    }

    getUserLevelInfo() {
        const points = this.userProfile.points || 0;
        const level = this.userProfile.level || this.calculateLevel(points);
        const pointsForCurrent = level > 1 ? this.pointsNeededForLevel(level - 1) : 0;
        const pointsForNext = this.pointsNeededForLevel(level);
        const levelProgress = pointsForNext > pointsForCurrent ? ((points - pointsForCurrent) / (pointsForNext - pointsForCurrent)) * 100 : 100;
        const rankTitle = this.getRankName(level);

        return { level, levelProgress, rankTitle, points, pointsToNext: pointsForNext - points };
    }

    loadReaderSettings() {
        const stored = localStorage.getItem('kairo_reader_settings');
        this.readerSettings = this.safeParse(stored, {
            theme: 'dark',
            mode: 'vertical',
            width: 'medium'
        });
    }

    saveReaderSettings() {
        localStorage.setItem('kairo_reader_settings', JSON.stringify(this.readerSettings));
    }

    async addManga(title, alternative, author, cover, banner, genres, synopsis, type) {
        const cleanCover = cover && cover.trim() ? cover.trim() : DEFAULT_COVER_URL;
        const cleanBanner = banner && banner.trim() ? banner.trim() : cleanCover;
        const newManga = {
            id: `lek_${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now()}`,
            title,
            alternative,
            author,
            cover: cleanCover,
            banner: cleanBanner,
            rating: 5.0,
            status: 'مستمر',
            type: type || 'منهوا',
            views: 0,
            genres: genres.split(/[,\u060C]+/).map(g => g.trim()).filter(g => g !== ''),
            synopsis,
            chapters: []
        };
        normalizeMangaAssets(newManga);

        if (this.sessionToken && this.userRole === 'admin') {
            try {
                const response = await fetch('/api/save_manga', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.sessionToken}`
                    },
                    body: JSON.stringify(newManga)
                });
                if (response.ok) {
                    this.mangas.unshift(newManga);
                    this.saveMangas();
                    alert("تم إدراج العمل الفني على السيرفر بنجاح!");
                    navigate('home');
                } else {
                    const err = await response.json();
                    alert(`فشل الحفظ: ${err.error || 'خطأ غير معروف'}`);
                }
            } catch (e) {
                alert("خطأ في الاتصال بالخادم وحفظ المنهوا.");
            }
        } else {
            this.mangas.unshift(newManga);
            this.saveMangas();
            alert("تم حفظ المنهوا محلياً (غير مسجلة على السيرفر لأنك لست المدير).");
            navigate('home');
        }
    }

    async addChapter(mangaId, title, chapterNo, imagesStr) {
        const manga = this.mangas.find(m => m.id === mangaId);
        if (!manga) return;
        
        let images = [];
        if (imagesStr && imagesStr.trim() !== '') {
            images = imagesStr.split('\n').map(img => img.trim()).filter(img => img !== '');
        } else {
            images = generateMockPages(manga.title, chapterNo);
        }

        const newChapter = {
            id: String(chapterNo),
            title: title || `الفصل ${chapterNo}`,
            date: new Date().toISOString().split('T')[0],
            images
        };

        const originalChapters = [...manga.chapters];
        manga.chapters = manga.chapters.filter(ch => ch.id !== String(chapterNo));
        manga.chapters.unshift(newChapter);
        manga.chapters.sort((a, b) => parseFloat(b.id) - parseFloat(a.id));

        if (this.sessionToken && this.userRole === 'admin') {
            try {
                const response = await fetch('/api/save_manga', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.sessionToken}`
                    },
                    body: JSON.stringify(manga)
                });
                if (response.ok) {
                    this.saveMangas();
                    alert(`تم رفع ونشر الفصل ${chapterNo} بنجاح!`);
                    navigate('detail', mangaId);
                } else {
                    manga.chapters = originalChapters;
                    const err = await response.json();
                    alert(`فشل إضافة الفصل: ${err.error || 'خطأ غير معروف'}`);
                }
            } catch (e) {
                manga.chapters = originalChapters;
                alert("خطأ في الاتصال بالسيرفر وإضافة الفصل.");
            }
        } else {
            this.saveMangas();
            alert(`تم إضافة الفصل ${chapterNo} محلياً.`);
            navigate('detail', mangaId);
        }
    }

    async loadSoloLevelingChapters() {
        if (this.soloLevelingLoaded) return true;
        try {
            const response = await fetch('./solo_leveling_chapters.json');
            if (response.ok) {
                const data = await response.json();
                const chapArray = Object.values(data).map(ch => ({
                    id: String(ch.id),
                    title: ch.title,
                    date: ch.date || '2026-06-09',
                    images: ch.images || []
                }));
                chapArray.sort((a, b) => parseFloat(b.id) - parseFloat(a.id));
                
                const solo = this.mangas.find(m => m.id === "1");
                if (solo) {
                    solo.chapters = chapArray;
                    this.soloLevelingLoaded = true;
                    console.log("Successfully loaded Solo Leveling chapters dynamically from JSON");
                }
                return true;
            }
        } catch (e) {
            console.error("Error loading Solo Leveling chapters dynamically:", e);
        }
        return false;
    }
}

const state = new AppState();

// ==========================================
// 3. محرك التنقل والتحكم والواجهات (Routing & Views)
// ==========================================

// دالة موحدة لمقارنة وتطبيع معرفات الفصول لمنع أي تعارض في الأنواع أو التنسيقات
function normalizeChapterId(id) {
    if (id === null || id === undefined) return '';
    // إزالة أي معاملات إضافية بعد علامة الاستفهام إن وجدت (مثل ?v=1.9)
    let cleanId = String(id).split('?')[0].trim();
    // تحويل الأرقام العشرية الصافية مثل 200.0 إلى 200
    if (!isNaN(cleanId) && cleanId.includes('.')) {
        const parsed = parseFloat(cleanId);
        if (parsed % 1 === 0) {
            return String(parsed);
        }
    }
    return cleanId;
}

function navigate(view, mangaId = null, chapterId = null) {
    let hash = '';
    if (view === 'home') {
        hash = '#/';
    } else if (view === 'detail') {
        hash = `#/manga/${mangaId}`;
    } else if (view === 'reader') {
        hash = `#/reader/${mangaId}/${chapterId}`;
    } else {
        hash = `#/${view}`;
    }
    window.location.hash = hash;
}

function handleRouting() {
    // التحويل التلقائي للمسارات النظيفة (Clean URLs) إلى مسارات الهاش (Hash URLs) لمنع التوجيه الخاطئ
    const path = window.location.pathname;
    if (path.startsWith('/manga/') || path.startsWith('/reader/')) {
        window.location.replace('/#' + path + window.location.search);
        return;
    }
    
    const hash = window.location.hash || '#/';
    
    if (hash === '#/' || hash === '#/home' || hash === '') {
        state.currentView = 'home';
        state.activeMangaId = null;
        state.activeChapterId = null;
    } else if (hash.startsWith('#/manga/')) {
        const parts = hash.split('#/manga/');
        const mangaId = parts[1];
        state.currentView = 'detail';
        state.activeMangaId = mangaId;
        state.activeChapterId = null;
    } else if (hash.startsWith('#/reader/')) {
        const parts = hash.split('/');
        const mangaId = parts[2];
        const chapterId = parts[3];
        state.currentView = 'reader';
        state.activeMangaId = mangaId;
        state.activeChapterId = chapterId;
    } else if (hash.includes('reset-password')) {
        state.currentView = 'reset-password';
        const tokenMatch = hash.match(/[?&]token=([^&]+)/);
        state.resetPasswordToken = tokenMatch ? tokenMatch[1] : '';
        state.activeMangaId = null;
        state.activeChapterId = null;
    } else {
        const view = hash.replace('#/', '');
        state.currentView = view;
        state.activeMangaId = null;
        state.activeChapterId = null;
    }
    
    state.activePageIndex = 0;
    state.chapterSearchQuery = '';
    
    // SEO: تحديث meta tags ديناميكياً حسب المسار
    var seoTitle = 'KAIRO / منهوا - منصة قراءة المانجا والمنهوا الأولى';
    var seoDesc = 'منصة KAIRO/منهوا - اقرأ المانجا والمنهوا المفضلة لديك بجودة عالية وبدون إعلانات مزعجة.';
    var seoImg = '';
    
    if (state.currentView === 'detail' && state.activeMangaId) {
        var manga = state.mangas.find(function(m) { return m.id === state.activeMangaId; });
        if (manga) {
            seoTitle = manga.title + ' | KAIRO / منهوا';
            seoDesc = manga.synopsis ? manga.synopsis.substring(0, 200) : seoDesc;
            seoImg = getDisplayCover(manga);
        }
    } else if (state.currentView === 'reader' && state.activeMangaId && state.activeChapterId) {
        var mangaR = state.mangas.find(function(m) { return m.id === state.activeMangaId; });
        if (mangaR) {
            var chapter = mangaR.chapters.find(function(c) { return normalizeChapterId(c.id) === normalizeChapterId(state.activeChapterId); });
            seoTitle = mangaR.title + ' - ' + (chapter ? chapter.title : 'فصل ' + state.activeChapterId) + ' | KAIRO / منهوا';
            seoDesc = 'اقرأ ' + mangaR.title + ' الفصل ' + state.activeChapterId + ' على KAIRO/منهوا';
            seoImg = getDisplayCover(mangaR);
        }
    } else if (state.currentView === 'bookmarks') {
        seoTitle = 'المفضلة | KAIRO / منهوا';
        seoDesc = 'قائمة المانجا والمنهوا المفضلة لديك على KAIRO/منهوا';
    } else if (state.currentView === 'history') {
        seoTitle = 'سجل القراءة | KAIRO / منهوا';
        seoDesc = 'سجل قراءة المانجا والمنهوا على KAIRO/منهوا';
    } else if (state.currentView === 'downloads') {
        seoTitle = 'الفصول المحملة | KAIRO / منهوا';
        seoDesc = 'الفصول المحملة للقراءة دون اتصال على KAIRO/منهوا';
    } else if (state.currentView === 'admin') {
        seoTitle = 'لوحة الإدارة | KAIRO / منهوا';
        seoDesc = 'لوحة تحكم وإدارة موقع KAIRO/منهوا';
    } else if (state.currentView === 'reset-password') {
        seoTitle = 'استعادة كلمة المرور | KAIRO / منهوا';
        seoDesc = 'استعادة كلمة المرور لحسابك على KAIRO/منهوا';
    }
    
    updateSEOMeta(seoTitle, seoDesc, seoImg);
    
    state.isLoading = false;
    window.scrollTo(0, 0);
    renderApp();
}

// استماع لتغيرات الهاش في المتصفح للتنقل
window.addEventListener('hashchange', handleRouting);

function updateSEOMeta(title, description, image) {
    document.title = title || 'KAIRO / منهوا - منصة قراءة المانجا والمنهوا الأولى';
    let desc = description || 'منصة KAIRO/منهوا - اقرأ المانجا والمنهوا المفضلة لديك بجودة عالية وبدون إعلانات مزعجة. تدعم التحميل والقراءة دون اتصال بالإنترنت.';
    let img = image || '';
    let setMeta = function(name, value) {
        document.querySelectorAll('meta[name="' + name + '"], meta[property="' + name + '"]').forEach(function(el) { el.remove(); });
        if (!value) return;
        var meta = document.createElement('meta');
        if (name.startsWith('og:') || name.startsWith('twitter:')) {
            meta.setAttribute('property', name);
        } else {
            meta.setAttribute('name', name);
        }
        meta.setAttribute('content', value);
        document.head.appendChild(meta);
    };
    setMeta('description', desc);
    setMeta('og:title', title);
    setMeta('og:description', desc);
    setMeta('og:image', img);
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', title);
    setMeta('twitter:description', desc);
    setMeta('twitter:image', img);
}

function getProxiedImageUrl(url) {
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        return `/proxy-image?url=${encodeURIComponent(url)}`;
    }
    return url;
}

function prefetchNextChapter(images) {
    if (!images || !Array.isArray(images)) return;
    images.forEach(url => {
        const img = new Image();
        img.src = getProxiedImageUrl(url);
    });
}

// ==========================================
// 4. بناء المكونات (UI Components Rendering)
// ==========================================

// شريط التنقل العلوي
function HeaderComponent() {
    const activeView = state.currentView;
    const isAdmin = state.userRole === 'admin';
    const adminButton = isAdmin ? `<button class="admin-btn" id="nav-admin"><i class="fa-solid fa-sliders"></i> الإدارة</button>` : '';

    let accountButton = '';
    if (state.sessionToken) {
        const isAdmin = state.userRole === 'admin';
        const userHandle = getUserHandle(state.userEmail);
        const userInitial = getUserInitial(state.userEmail);
        const points = state.userProfile.points || 0;
        const level = state.userProfile.level || 1;
        const rankClass = isAdmin ? 'rank-admin' : (level <= 30 ? 'rank-bronze' : level <= 60 ? 'rank-silver' : 'rank-gold');
        accountButton = `
        <div class="user-profile-menu-container">
            <button class="profile-navbar-btn points-badge ${rankClass}" id="nav-profile-btn" title="${state.userEmail || ''}">
                <span class="profile-navbar-avatar">${userInitial}</span>
                <span class="profile-navbar-name">${userHandle}</span>
                <span class="points-badge-text">${isAdmin ? '🌟' : points + ' <i class="fa-solid fa-star" style="font-size:0.6rem;"></i>'}</span>
            </button>
            <button class="logout-navbar-btn" id="logout-btn" title="تسجيل الخروج" aria-label="Logout">
                <i class="fa-solid fa-right-from-bracket"></i>
            </button>
        </div>
        `;
    } else {
        accountButton = `
        <button class="login-navbar-btn" id="open-login-btn">
            <i class="fa-solid fa-right-to-bracket"></i>
            <span>تسجيل الدخول</span>
        </button>
        `;
    }

    let suggestionsHtml = '';
    if (state.showSearchSuggestions && state.searchQuery && state.searchQuery.trim() !== '' && state.mangas) {
        const query = state.searchQuery.toLowerCase().trim();
        const matches = state.mangas.filter(m => 
            m.title.toLowerCase().includes(query) || 
            (m.alternative && m.alternative.toLowerCase().includes(query))
        ).slice(0, 6);
        
        if (matches.length > 0) {
            suggestionsHtml = `
            <div class="search-suggestions-dropdown" id="search-suggestions">
                ${matches.map(m => `
                    <div class="suggestion-item" data-id="${m.id}">
                        <img src="${getDisplayCover(m)}" class="suggestion-cover" alt="${m.title}">
                        <div class="suggestion-info">
                            <span class="suggestion-title">${m.title}</span>
                            ${m.alternative ? `<span class="suggestion-alt">${m.alternative}</span>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
            `;
        }
    }

    return `
    <header class="header">
        <a class="header-logo" id="logo-btn">KAIRO<span>/منهوا</span></a>
        
        <nav class="header-nav">
            <span class="nav-link ${activeView === 'home' ? 'active' : ''}" id="nav-home"><i class="fa-solid fa-house-chimney"></i> الرئيسة</span>
            <span class="nav-link ${activeView === 'bookmarks' ? 'active' : ''}" id="nav-bookmarks"><i class="fa-solid fa-heart"></i> المفضلة</span>
            <span class="nav-link ${activeView === 'downloads' ? 'active' : ''}" id="nav-downloads"><i class="fa-solid fa-circle-down"></i> المحملة</span>
            <span class="nav-link ${activeView === 'history' ? 'active' : ''}" id="nav-history"><i class="fa-solid fa-clock-rotate-left"></i> السجل</span>
            <span class="nav-link" id="open-suggestions-btn"><i class="fa-solid fa-comments"></i> الاقتراحات والشكاوى</span>
            <a class="nav-link youtube-nav-link" href="https://www.youtube.com/@kairo_909" target="_blank"><i class="fa-brands fa-youtube"></i> قناة اليوتيوب</a>
        </nav>
        
        <div class="header-actions">
            <div class="search-box">
                <input type="text" placeholder="ابحث عن المانجا..." id="search-input" value="${state.searchQuery}">
                <i class="fa-solid fa-magnifying-glass"></i>
                ${suggestionsHtml}
            </div>
            ${accountButton}
            ${adminButton}
        </div>
    </header>
    `;
}

function AuthModalComponent() {
    if (!state.showAuthModal) return '';
    const isLogin = state.authModalTab === 'login';
    const isRegister = state.authModalTab === 'register';
    const isForgot = state.authModalTab === 'forgot';
    
    let bodyHtml = '';
    if (isForgot) {
        bodyHtml = `
        <form id="forgot-password-form" class="auth-form" style="text-align: right;">
            <div class="form-group" style="margin-bottom: 20px;">
                <label for="forgot-email">البريد الإلكتروني المسجل</label>
                <input type="email" id="forgot-email" required placeholder="example@gmail.com" autocomplete="email" style="background: var(--bg-surface); border: 1px solid var(--border-color); color: var(--text-main); padding: 12px; border-radius: var(--border-radius-sm); width: 100%; outline: none; margin-top: 6px;">
            </div>
            <div id="forgot-error-msg" class="auth-error-msg" style="display:none; margin-bottom: 12px; color: var(--color-accent); font-weight: 700;"></div>
            <div id="forgot-success-msg" class="auth-success-msg" style="display:none; margin-bottom: 12px; color: #00ff7f; font-weight: 700;"></div>
            <button type="submit" class="auth-submit-btn neon-pulse-hover" style="background: linear-gradient(135deg, var(--color-secondary), var(--color-primary)); color: #07080c; border: none; padding: 12px; border-radius: 30px; font-weight: 800; cursor: pointer; width: 100%;">
                <i class="fa-solid fa-paper-plane"></i> إرسال رابط الاستعادة
            </button>
            <div style="text-align: center; margin-top: 18px;">
                <a href="javascript:void(0)" id="back-to-login-btn" style="color: var(--color-secondary); font-size: 0.85rem; font-weight: 700; text-decoration: none; transition: var(--transition-fast);">العودة لتسجيل الدخول</a>
            </div>
        </form>
        `;
    } else {
        bodyHtml = `
        <form id="auth-form" class="auth-form">
            <div class="form-group">
                <label for="auth-email">البريد الإلكتروني (Gmail)</label>
                <input type="email" id="auth-email" required placeholder="example@gmail.com" autocomplete="email">
            </div>
            <div class="form-group">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <label for="auth-password" style="margin: 0;">كلمة المرور</label>
                    <a href="javascript:void(0)" id="forgot-password-trigger" style="color: var(--color-secondary); font-size: 0.8rem; font-weight: 700; text-decoration: none; transition: var(--transition-fast);">نسيت كلمة المرور؟</a>
                </div>
                <input type="password" id="auth-password" required placeholder="********" autocomplete="current-password">
            </div>
            <div id="auth-error-msg" class="auth-error-msg" style="display:none;"></div>
            <div id="auth-success-msg" class="auth-success-msg" style="display:none;"></div>
            <button type="submit" class="auth-submit-btn neon-pulse-hover">
                ${isLogin ? '<i class="fa-solid fa-right-to-bracket"></i> دخول' : '<i class="fa-solid fa-user-plus"></i> إنشاء الحساب'}
            </button>
            
            <div class="auth-divider">
                <span>أو سجّل الدخول باستخدام</span>
            </div>
            
            <div class="social-login-grid">
                <button type="button" class="social-btn google-btn" id="google-login-btn">
                    <i class="fa-brands fa-google"></i> Google
                </button>
                <button type="button" class="social-btn facebook-btn" id="facebook-login-btn">
                    <i class="fa-brands fa-facebook"></i> Facebook
                </button>
            </div>
        </form>
        `;
    }
    
    return `
    <div class="auth-modal-overlay" id="auth-modal-overlay">
        <div class="auth-modal-card glass-card">
            <button class="auth-modal-close" id="close-auth-modal">&times;</button>
            ${!isForgot ? `
            <div class="auth-modal-tabs">
                <button class="auth-tab-btn ${isLogin ? 'active' : ''}" id="auth-tab-login" data-tab="login">تسجيل الدخول</button>
                <button class="auth-tab-btn ${isRegister ? 'active' : ''}" id="auth-tab-register" data-tab="register">حساب جديد</button>
            </div>
            ` : `
            <div style="text-align: center; margin-bottom: 20px;">
                <span style="font-size: 1.25rem; font-weight: 800; color: var(--text-main); display: inline-flex; align-items: center; gap: 8px;"><i class="fa-solid fa-key" style="color: var(--color-secondary);"></i> استعادة الحساب</span>
            </div>
            `}
            
            <div class="auth-modal-body">
                ${bodyHtml}
            </div>
        </div>
    </div>
    `;
}

function SuggestionsModalComponent() {
    if (!state.showSuggestionsModal) return '';
    
    return `
    <div class="auth-modal-overlay" id="suggestions-modal-overlay">
        <div class="auth-modal-card glass-card" style="max-width: 500px;">
            <button class="auth-modal-close" id="close-suggestions-modal">&times;</button>
            <h3 style="font-size: 1.4rem; font-weight: 800; color: var(--text-main); margin-bottom: 12px; text-align: right; border-right: 4px solid var(--color-secondary); padding-right: 10px;">
                <i class="fa-solid fa-comments" style="color: var(--color-secondary);"></i> تقديم اقتراح أو شكوى
            </h3>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 20px; text-align: right; line-height: 1.6;">
                رأيك يهمنا لتطوير موقع KAIRO/منهوا. يمكنك كتابة اقتراح لتحسين الموقع أو تقديم شكوى عن أي مشكلة فنية.
            </p>
            
            <form id="suggestions-form" class="auth-form" style="display: flex; flex-direction: column; gap: 16px;">
                <div class="form-group" style="text-align: right;">
                    <label style="display: block; font-size: 0.9rem; font-weight: 700; color: var(--text-main); margin-bottom: 8px;">نوع الرسالة</label>
                    <div style="display: flex; gap: 20px; justify-content: flex-start; direction: rtl;">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text-main); font-weight: 600;">
                            <input type="radio" name="sug-type" value="suggestion" checked style="cursor: pointer; accent-color: var(--color-secondary);">
                            <span>اقتراح <i class="fa-solid fa-lightbulb" style="color: #ffb703;"></i></span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text-main); font-weight: 600;">
                            <input type="radio" name="sug-type" value="complaint" style="cursor: pointer; accent-color: var(--color-accent);">
                            <span>شكوى <i class="fa-solid fa-circle-exclamation" style="color: var(--color-accent);"></i></span>
                        </label>
                    </div>
                </div>
                <div class="form-group" style="text-align: right;">
                    <label for="sug-content" style="display: block; font-size: 0.9rem; font-weight: 700; color: var(--text-main); margin-bottom: 8px;">تفاصيل الرسالة</label>
                    <textarea id="sug-content" required rows="4" placeholder="اكتب تفاصيل اقتراحك أو شكواك هنا..." style="width: 100%; padding: 12px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); color: var(--text-main); outline: none; font-family: var(--font-family); resize: none; text-align: right;"></textarea>
                </div>
                <div id="sug-error-msg" class="auth-error-msg" style="display:none; color: #ff007f; font-size: 0.85rem; text-align: right;"></div>
                <div id="sug-success-msg" class="auth-success-msg" style="display:none; color: #00ff7f; font-size: 0.85rem; text-align: right;"></div>
                <button type="submit" class="auth-submit-btn neon-pulse-hover" style="background: linear-gradient(135deg, var(--color-secondary), #00b0ff); margin-top: 10px;">
                    إرسال الرسالة الآن <i class="fa-solid fa-paper-plane" style="margin-right: 6px;"></i>
                </button>
            </form>
        </div>
    </div>
    `;
}

function SettingsModalComponent() {
    if (!state.showSettingsModal) return '';
    const info = state.getUserLevelInfo ? state.getUserLevelInfo() : { points: 0, level: 1, rankTitle: 'مبتدئ' };
    const isAdmin = state.userRole === 'admin';
    return `
    <div class="auth-modal-overlay" id="settings-modal-overlay">
        <div class="auth-modal-card glass-card" style="max-width: 480px; position: relative;">
            <button class="settings-close-btn" id="close-settings-modal"><i class="fa-solid fa-xmark"></i></button>
            <h3 style="font-size: 1.4rem; font-weight: 800; color: var(--text-main); margin-bottom: 16px; text-align: right; border-right: 4px solid var(--color-primary); padding-right: 10px;">
                <i class="fa-solid fa-user-gear" style="color: var(--color-primary);"></i> إعدادات المستخدم
            </h3>
            <div class="settings-info-row">
                <div class="settings-info-card">
                    <span class="settings-info-label">البريد الإلكتروني</span>
                    <span class="settings-info-value" style="font-size:0.85rem;">${state.userEmail || '—'}</span>
                </div>
                <div class="settings-info-card">
                    <span class="settings-info-label">النقاط</span>
                    <span class="settings-info-value">${isAdmin ? '∞' : info.points}</span>
                </div>
                <div class="settings-info-card">
                    <span class="settings-info-label">المستوى</span>
                    <span class="settings-info-value">${isAdmin ? 'المدير' : info.level}</span>
                </div>
            </div>

            <div class="settings-section">
                <h3><i class="fa-solid fa-pen"></i> تغيير اسم المستخدم</h3>
                <div class="form-group">
                    <label>اسم المستخدم الحالي: <strong>${state.userProfile?.username || '—'}</strong></label>
                    <input type="text" id="settings-new-username" placeholder="أدخل اسم المستخدم الجديد" value="${state.userProfile?.username || ''}" style="margin-top: 6px;">
                </div>
                <button class="auth-submit-btn" id="btn-save-username" style="background: linear-gradient(135deg, var(--color-primary), var(--color-secondary)); color: #07080c; border: none; padding: 10px; border-radius: 30px; font-weight: 800; cursor: pointer; width: 100%; margin-top: 8px;">حفظ اسم المستخدم</button>
                <div id="username-msg" style="margin-top: 8px; font-size: 0.85rem; text-align: center;"></div>
            </div>

            <div class="settings-section">
                <h3><i class="fa-solid fa-lock"></i> تغيير كلمة المرور</h3>
                <div class="form-group">
                    <label>كلمة المرور الحالية</label>
                    <input type="password" id="settings-current-password" placeholder="أدخل كلمة المرور الحالية">
                </div>
                <div class="form-group">
                    <label>كلمة المرور الجديدة</label>
                    <input type="password" id="settings-new-password" placeholder="أدخل كلمة المرور الجديدة (6 أحرف على الأقل)">
                </div>
                <button class="auth-submit-btn" id="btn-save-password" style="background: linear-gradient(135deg, var(--color-secondary), var(--color-primary)); color: #07080c; border: none; padding: 10px; border-radius: 30px; font-weight: 800; cursor: pointer; width: 100%; margin-top: 8px;">تغيير كلمة المرور</button>
                <div id="password-msg" style="margin-top: 8px; font-size: 0.85rem; text-align: center;"></div>
            </div>
        </div>
    </div>
    `;
}

// السلايدر الرئيسي (Hero Slider)
let activeSlideIndex = 0;
let sliderInterval = null;

function startSliderTimer() {
    if (sliderInterval) clearInterval(sliderInterval);
    sliderInterval = setInterval(() => {
        const slides = document.querySelectorAll('.hero-slide');
        const dots = document.querySelectorAll('.slider-dot');
        if (slides.length <= 1) return;
        
        slides[activeSlideIndex].classList.remove('active');
        dots[activeSlideIndex].classList.remove('active');
        
        activeSlideIndex = (activeSlideIndex + 1) % slides.length;
        
        if (slides[activeSlideIndex] && dots[activeSlideIndex]) {
            slides[activeSlideIndex].classList.add('active');
            dots[activeSlideIndex].classList.add('active');
        }
    }, 5000);
}

function HeroSliderComponent() {
    const featured = state.mangas.slice(0, 3);
    if (featured.length === 0) return '';

    let slidesHtml = '';
    let dotsHtml = '';

    featured.forEach((manga, idx) => {
        slidesHtml += `
        <div class="hero-slide ${idx === activeSlideIndex ? 'active' : ''}" style="background-image: ${cssImageUrl(getMangaBanner(manga))}" data-id="${manga.id}">
            <div class="hero-overlay"></div>
            <div class="hero-content">
                <span class="hero-badge">${manga.type || 'منهوا'} المميزة</span>
                <h2 class="hero-title">${manga.title}</h2>
                <div class="hero-meta">
                    <span class="rating-stars"><i class="fa-solid fa-star"></i> ${manga.rating}</span>
                    <span>•</span>
                    <span>المشاهدات: ${manga.views}</span>
                </div>
                <p class="hero-desc">${manga.synopsis}</p>
                <button class="hero-btn read-now-hero" data-id="${manga.id}"><i class="fa-solid fa-book-open"></i> اقرأ الآن</button>
            </div>
        </div>
        `;
        dotsHtml += `<div class="slider-dot ${idx === activeSlideIndex ? 'active' : ''}" data-index="${idx}"></div>`;
    });

    return `
    <div class="hero-slider">
        ${slidesHtml}
        <div class="slider-dots">
            ${dotsHtml}
        </div>
    </div>
    `;
}

// كرت سجل القراءة المصغر بالرئيسية (بحد أقصى 5 عناصر)
function ReadingHistoryComponent() {
    if (state.history.length === 0) return '';

    let historyCardsHtml = '';
    state.history.slice(0, 5).forEach(hist => {
        const manga = state.mangas.find(m => m.id === hist.mangaId);
        if (!manga) return;

        const chapterIndex = manga.chapters.findIndex(c => normalizeChapterId(c.id) === normalizeChapterId(hist.chapterId));
        let overallPercentage = 0;
        if (chapterIndex !== -1 && manga.chapters.length > 0) {
            let isReversed = false;
            if (manga.chapters.length > 1) {
                let firstNum = parseFloat(String(manga.chapters[0].id).replace(/[^0-9.]/g, '')) || 0;
                let lastNum = parseFloat(String(manga.chapters[manga.chapters.length - 1].id).replace(/[^0-9.]/g, '')) || 0;
                if (firstNum > lastNum) {
                    isReversed = true;
                }
            }
            if (isReversed) {
                overallPercentage = Math.round(((manga.chapters.length - chapterIndex) / manga.chapters.length) * 100);
            } else {
                overallPercentage = Math.round(((chapterIndex + 1) / manga.chapters.length) * 100);
            }
        }
        const percentage = overallPercentage || hist.percentage || 0;
        let numClean = String(hist.chapterId).replace(/^ch_/, '').replace(/_0$/, '').replace(/_/g, '.');

        historyCardsHtml += `
        <div class="history-item-card" data-manga-id="${hist.mangaId}" data-chap-id="${hist.chapterId}" data-scroll="${hist.scrollY}" data-page="${hist.activePageIndex}">
            <div class="history-item-cover">
                <img src="${getDisplayCover(manga)}" alt="${manga.title}">
            </div>
            <div class="history-item-details">
                <h4 class="history-item-title">${manga.title}</h4>
                <span class="history-item-chapter">الفصل ${numClean}</span>
                <div style="margin-top:4px;">
                    <div class="level-progress-info" style="margin-bottom: 2px;">
                        <span class="history-item-progress-text">تقدم القراءة</span>
                        <span>${percentage}%</span>
                    </div>
                    <div class="history-progress-track">
                        <div class="history-progress-bar-fill" style="width: ${percentage}%"></div>
                    </div>
                </div>
            </div>
        </div>
        `;
    });

    return `
    <div class="history-section-wrapper">
        <div class="section-header" style="margin-bottom:12px;">
            <h3 class="section-title" style="font-size:1.2rem;border-right-color:var(--color-secondary);"><i class="fa-solid fa-clock-rotate-left" style="color:var(--color-secondary);margin-left:5px;"></i> استكمل القراءة <span>(سجل القراءة)</span></h3>
        </div>
        <div class="history-scroll">
            ${historyCardsHtml}
        </div>
    </div>
    `;
}

// صفحة سجل القراءة التفصيلي
function HistoryViewComponent() {
    if (state.history.length === 0) {
        return `
        <div class="empty-state">
            <i class="fa-solid fa-clock-rotate-left" style="color:var(--border-color)"></i>
            <h3>سجل القراءة فارغ</h3>
            <p>ابدأ بقراءة أي مانجا أو منهوا وسيتم تسجيل تقدمك هنا لتتمكن من العودة واستكمالها في أي وقت.</p>
        </div>
        `;
    }

    let listHtml = `
    <div class="chapters-section">
        <div class="chapters-header">
            <h3>سجل قراءتك لجميع الأعمال (حتى 30 منهوا/مانجا)</h3>
            <span>إجمالي الأعمال: ${state.history.length}</span>
        </div>
        <div class="chapters-list">
    `;

    state.history.forEach(hist => {
        const manga = state.mangas.find(m => m.id === hist.mangaId);
        if (!manga) return;

        const latestChapter = manga.chapters[0];
        const hasNewChapters = latestChapter && parseFloat(latestChapter.id) > parseFloat(hist.chapterId);
        const percentage = hist.percentage || 0;

        listHtml += `
        <div class="chapter-item history-item-row" data-manga-id="${hist.mangaId}" data-chap-id="${hist.chapterId}" data-scroll="${hist.scrollY}" data-page="${hist.activePageIndex}">
            <div style="display:flex; align-items:center; gap:16px; flex:1; min-width:0;">
                <img src="${getDisplayCover(manga)}" alt="${manga.title}" style="width:45px; height:65px; object-fit:cover; border-radius:var(--border-radius-sm); border:1px solid var(--border-color); flex-shrink:0;">
                <div style="min-width:0; flex:1;">
                    <h4 style="font-size:1.05rem; font-weight:700; margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--text-main);">${manga.title}</h4>
                    <span style="font-size:0.85rem; color:var(--text-muted); display:inline-block; margin-bottom:4px;">
                        الفصل الذي تقف عنده: <strong style="color:var(--color-secondary);">الفصل ${hist.chapterId}</strong> (${percentage}%)
                    </span>
                    ${hasNewChapters ? `
                        <div style="display:inline-block; margin-right:10px;">
                            <span class="badge-new-chapters" style="background:rgba(0,255,127,0.1); border:1px solid #00ff7f; color:#00ff7f; padding:2px 8px; border-radius:10px; font-size:0.75rem; font-weight:700; white-space:nowrap;">
                                <i class="fa-solid fa-bell"></i> توجد فصول جديدة! (أحدث فصل: ${latestChapter.id})
                            </span>
                        </div>
                    ` : ''}
                </div>
            </div>
            <div class="chapter-actions-inline" style="gap:10px;">
                <button class="detail-btn btn-read resume-reading-history-btn" style="padding:8px 16px; font-size:0.85rem; border-radius:20px;" data-manga-id="${hist.mangaId}" data-chap-id="${hist.chapterId}" data-scroll="${hist.scrollY}" data-page="${hist.activePageIndex}">
                    <i class="fa-solid fa-play"></i> متابعة القراءة
                </button>
                <button class="download-btn delete-history-entry-btn" data-manga-id="${hist.mangaId}" title="حذف من السجل" style="border-color:rgba(255,255,255,0.05); color:var(--text-dark);">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        </div>
        `;
    });

    listHtml += `
        </div>
    </div>
    `;

    return `
    <div>
        <div class="section-header">
            <h2 class="section-title">سجل القراءة <span>التفصيلي والمتابعة</span></h2>
        </div>
        ${listHtml}
    </div>
    `;
}

function MangaGridComponent(title, mangasFiltered) {
    if (state.isLoading) {
        let skeletons = '';
        for (let i = 0; i < 6; i++) {
            skeletons += `
            <div class="manga-card-skeleton">
                <div class="skeleton-cover"></div>
                <div class="skeleton-info">
                    <div class="skeleton-title"></div>
                    <div class="skeleton-text"></div>
                </div>
            </div>
            `;
        }
        return `
        <div class="section-header">
            <h2 class="section-title">${title}</h2>
        </div>
        <div class="manga-grid">
            ${skeletons}
        </div>
        `;
    }

    if (mangasFiltered.length === 0) {
        return `
        <div class="section-header">
            <h2 class="section-title">${title}</h2>
        </div>
        <div class="empty-state">
            <i class="fa-regular fa-folder-open"></i>
            <h3>لا توجد نتائج مطابقة</h3>
            <p>جرّب البحث بكلمة مفتاحية أخرى أو تغيير التصنيف.</p>
        </div>
        `;
    }

    let cardsHtml = '';
    mangasFiltered.forEach(manga => {
        const totalChaps = manga.chapters ? manga.chapters.length : 0;
        const chapsLabel = totalChaps > 0 ? totalChaps + ' فصل' : 'قريباً';
        const typeLabel = manga.type || 'منهوا';
        const ongoing = manga.status === 'Ongoing' || manga.status === 'مستمرة' || manga.status === 'مستمر';
        const statusText = ongoing ? 'مستمرة' : 'مكتملة';
        const statusColor = ongoing ? '#ffb703' : '#00ff7f';
        cardsHtml += `
        <div class="manga-card" data-id="${manga.id}">
            <div class="manga-card-cover">
                <img src="${getDisplayCover(manga)}" alt="${manga.title}" loading="lazy">
                <span class="card-badge">${manga.status}</span>
                <span class="card-rating"><i class="fa-solid fa-star"></i> ${manga.rating}</span>
            </div>
            <div class="manga-card-info">
                <h3 class="manga-card-title">${manga.title}</h3>
                <div class="manga-card-chapter">
                    <span>${typeLabel}</span>
                    <span class="chap-num">${chapsLabel}</span>
                </div>
                <div style="display:flex;gap:8px;font-size:0.75rem;color:var(--text-dark);margin-top:4px;align-items:center;">
                    <span style="color:${statusColor};">●</span>
                    <span>${statusText}</span>
                </div>
            </div>
        </div>
        `;
    });

    return `
    <div class="section-header">
        <h2 class="section-title">${title}</h2>
    </div>
    <div class="manga-grid">
        ${cardsHtml}
    </div>
    `;
}

// مكونات القائمة الجانبية (Sidebar)
function UserProfileWidgetComponent() {
    if (!state.sessionToken) return '';
    const info = state.getUserLevelInfo();
    const isAdmin = state.userRole === 'admin';
    const rankClass = isAdmin ? 'rank-admin' : (info.level <= 30 ? 'rank-bronze' : info.level <= 60 ? 'rank-silver' : 'rank-gold');
    return `
    <div class="sidebar-card glam-card ${isAdmin ? 'admin-card' : ''}">
        <div class="user-widget-profile">
            <div class="user-widget-avatar ${rankClass}">${state.userProfile.username.charAt(0)}</div>
            <div class="user-widget-info">
                <h4>${state.userProfile.username}</h4>
                <p class="${rankClass}">${isAdmin ? 'مدير المشروع 🌟' : info.rankTitle}</p>
            </div>
        </div>
        <div class="gamification-panel">
            <div class="level-badge ${rankClass}">${isAdmin ? 'مدير المشروع' : 'المستوى ' + info.level}</div>
            <div class="level-progress-info">
                <span>النقاط</span>
                <span class="points-display">${isAdmin ? '∞' : info.points}</span>
            </div>
            <div class="progress-bar-glam">
                <div class="progress-fill ${rankClass}" style="width: ${Math.min(info.levelProgress, 100)}%"></div>
            </div>
            <div class="level-progress-info" style="margin-top: 4px;">
                <span style="font-size:0.7rem;color:var(--text-dark);">${isAdmin ? 'أنت مدير المشروع ✨' : info.pointsToNext + ' نقطة للمستوى التالي'}</span>
            </div>
        </div>
    </div>
    `;
}

function TrendingSidebarComponent() {
    const trending = [...state.mangas].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);
    
    let listHtml = '';
    trending.forEach((manga, idx) => {
        listHtml += `
        <div class="trending-item" data-id="${manga.id}">
            <div class="trending-rank">${idx + 1}</div>
            <div class="trending-cover">
                <img src="${getDisplayCover(manga)}" alt="${manga.title}">
            </div>
            <div class="trending-details">
                <h4 class="trending-title">${manga.title}</h4>
                <div class="trending-stats">
                    <span style="margin-left: 10px;"><i class="fa-solid fa-eye"></i> ${manga.views || 0}</span>
                    <span><i class="fa-solid fa-star" style="color:#ffb703"></i> ${manga.rating}</span>
                </div>
            </div>
        </div>
        `;
    });

    return `
    <div class="sidebar-card">
        <div class="sidebar-card-title">
            <span class="title-text">الأكثر شعبية</span>
            <i class="fa-solid fa-fire"></i>
        </div>
        <div class="trending-list">
            ${listHtml}
        </div>
    </div>
    `;
}

function GenresFilterComponent() {
    const allGenres = ['الكل'];
    state.mangas.forEach(manga => {
        manga.genres.forEach(g => {
            if (!allGenres.includes(g)) allGenres.push(g);
        });
    });

    let html = '<div class="genres-list" style="margin-bottom: 30px;">';
    allGenres.forEach(genre => {
        const isActive = state.activeGenre === genre;
        html += `<span class="genre-tag ${isActive ? 'active' : ''}" style="${isActive ? 'background:var(--color-primary);color:#fff;' : ''}" data-genre="${genre}">${genre}</span>`;
    });
    html += '</div>';
    return html;
}

// صفحة التفاصيل الكاملة
async function DetailViewComponent() {
    if (state.isLoading) {
        return `
        <div style="height: 250px; background: #161924; border-radius: 20px; animation: shimmer 1.5s infinite; margin-bottom: 30px;" class="skeleton-shimmer"></div>
        <div style="display:flex; gap:30px; margin-top:-100px;">
            <div style="width:260px; height:360px; background:#161924; border-radius:14px; animation: shimmer 1.5s infinite;" class="skeleton-shimmer"></div>
            <div style="flex:1; padding-top:100px; display:flex; flex-direction:column; gap:15px;">
                <div style="height:30px; width:50%; background:#161924; border-radius:6px; animation: shimmer 1.5s infinite;" class="skeleton-shimmer"></div>
                <div style="height:15px; width:30%; background:#161924; border-radius:6px; animation: shimmer 1.5s infinite;" class="skeleton-shimmer"></div>
                <div style="height:80px; width:100%; background:#161924; border-radius:10px; animation: shimmer 1.5s infinite;" class="skeleton-shimmer"></div>
            </div>
        </div>
        `;
    }

    const manga = state.mangas.find(m => m.id === state.activeMangaId);
    if (!manga) return '<p>المانجا غير موجودة</p>';

    if (manga.id === "1" && !state.soloLevelingLoaded) {
        await state.loadSoloLevelingChapters();
    }

    const latestChapter = manga.chapters[0];
    const bookmarkStatus = state.bookmarks[manga.id] || '';
    const bookmarkMeta = getBookmarkStatusMeta(bookmarkStatus);
    const bookmarkOptionsHtml = BOOKMARK_STATUS_ORDER.map(status => {
        const meta = getBookmarkStatusMeta(status);
        const activeClass = bookmarkStatus === status ? 'active' : '';
        const checkIcon = bookmarkStatus === status ? '<i class="fa-solid fa-check bookmark-option-check"></i>' : '';
        return `
            <button type="button" class="bookmark-option ${activeClass}" data-status="${status}" role="menuitem">
                <span class="bookmark-option-icon ${meta.tone}"><i class="${meta.icon}"></i></span>
                <span>${meta.label}</span>
                ${checkIcon}
            </button>
        `;
    }).join('');
    
    // جلب الفصول المحملة للتأكد من حالة التحميل
    const localDownloads = await getAllDownloadsOffline();
    const downloadedIds = localDownloads
        .filter(d => d.mangaId === manga.id)
        .map(d => d.chapterId);

    let genresHtml = '';
    manga.genres.forEach(g => {
        genresHtml += `<span class="genre-tag clickable-genre" style="cursor: pointer;" onclick="event.stopPropagation(); state.activeGenre='${g}'; navigate('home'); window.scrollTo(0, 0);">${g}</span>`;
    });

    const searchQ = (state.chapterSearchQuery || '').trim().toLowerCase();
    const filteredChapters = manga.chapters.filter(ch => {
        if (!searchQ) return true;
        return ch.id.includes(searchQ) || ch.title.toLowerCase().includes(searchQ);
    });

    let chaptersHtml = '';
    if (filteredChapters.length === 0) {
        chaptersHtml = `<p style="padding: 20px; color: var(--text-dark); text-align: center;">${searchQ ? 'لا توجد فصول تطابق البحث.' : 'لا تتوفر أي فصول حالياً لهذه المانجا.'}</p>`;
    } else {
        filteredChapters.forEach(ch => {
            const isDownloaded = downloadedIds.includes(ch.id);
            const isDownloading = state.downloadProgress[`${manga.id}_${ch.id}`] !== undefined;
            const progress = state.downloadProgress[`${manga.id}_${ch.id}`] || 0;

            let downloadIcon = '<i class="fa-solid fa-circle-down"></i>';
            let downloadClass = '';
            if (isDownloaded) {
                downloadIcon = '<i class="fa-solid fa-circle-check"></i>';
                downloadClass = 'downloaded';
            } else if (isDownloading) {
                downloadIcon = '<i class="fa-solid fa-spinner fa-spin"></i>';
                downloadClass = 'loading';
            }

            // Parse chapter name and subtitle
            const titleParts = ch.title.split(':');
            const chNumName = titleParts[0].trim();
            const chSubtitle = titleParts.slice(1).join(':').trim();

            chaptersHtml += `
            <div class="chapter-item" data-chap-id="${ch.id}">
                <div class="chapter-item-details-left">
                    <span class="chapter-item-badge"><i class="fa-solid fa-book-open"></i> ${chNumName}</span>
                    ${chSubtitle ? `<span class="chapter-item-subtitle">${chSubtitle}</span>` : ''}
                </div>
                <div class="chapter-item-meta-right">
                    <span class="chapter-item-date"><i class="fa-regular fa-calendar"></i> ${ch.date}</span>
                    <div class="chapter-actions-inline">
                        ${isDownloading ? `<span style="font-size: 0.8rem; color: var(--color-secondary);">${progress}%</span>` : ''}
                        <button class="download-btn ${downloadClass}" data-chap-id="${ch.id}" title="${isDownloaded ? 'محمل أوفلاين (اضغط للحذف)' : 'تحميل للقراءة بدون اتصال'}">
                            ${downloadIcon}
                        </button>
                    </div>
                </div>
            </div>
            `;
        });
    }

    // جلب التقييمات والمراجعات من السيرفر
    let reviewsListHtml = '';
    let userReview = null;
    let avgRating = 5.0;
    
    try {
        const response = await fetch(`/api/manga_reviews?manga_id=${manga.id}`);
        if (response.ok) {
            const reviews = await response.json();
            if (reviews.length > 0) {
                let sum = 0;
                reviews.forEach(r => {
                    sum += r.rating;
                    if (state.userEmail && r.email.toLowerCase() === state.userEmail.toLowerCase()) {
                        userReview = r;
                    }
                    
                    const stars = '<i class="fa-solid fa-star" style="color: #ffb703;"></i>'.repeat(r.rating) +
                                  '<i class="fa-regular fa-star" style="color: var(--text-dark);"></i>'.repeat(5 - r.rating);
                    const userDisplay = r.email.split('@')[0];
                    const dateStr = new Date(r.created_at * 1000).toLocaleDateString('ar-EG');
                    
                    reviewsListHtml += `
                    <div class="review-item-card glass-card" style="padding: 16px; border-radius: var(--border-radius-md); border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 8px; background: rgba(255,255,255,0.01); text-align: right;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 0.8rem; color: var(--text-muted);"><i class="fa-regular fa-calendar"></i> ${dateStr}</span>
                            <span style="font-size: 0.95rem; font-weight: 700; color: var(--text-main);"><i class="fa-solid fa-user-circle" style="color: var(--color-secondary); margin-left: 6px;"></i> ${userDisplay}</span>
                        </div>
                        <div style="font-size: 0.85rem; display: flex; gap: 4px; justify-content: flex-end;">${stars}</div>
                        ${r.review_text ? '<p style="font-size: 0.9rem; color: var(--text-main); line-height: 1.6; margin-top: 4px;">' + r.review_text + '</p>' : ''}
                    </div>
                    `;
                });
                avgRating = (sum / reviews.length).toFixed(1);
            } else {
                reviewsListHtml = '<p style="color: var(--text-dark); text-align: center; padding: 20px;">لا توجد مراجعات لهذا العمل حالياً. كن أول من يكتب مراجعة!</p>';
            }
        }
    } catch (e) {
        console.error("Error loading reviews:", e);
        reviewsListHtml = '<p style="color: #ff007f; text-align: center; padding: 20px;">فشل تحميل مراجعات هذا العمل.</p>';
    }

    manga.rating = parseFloat(avgRating);

    // نموذج إضافة مراجعة
    let reviewFormHtml = '';
    if (state.sessionToken) {
        const userRating = userReview ? userReview.rating : 5;
        const userText = userReview ? userReview.review_text : '';
        
        let starsPickerHtml = '';
        for (let i = 1; i <= 5; i++) {
            const starClass = i <= userRating ? 'fa-solid' : 'fa-regular';
            starsPickerHtml += `<i class="${starClass} fa-star star-opt" data-rating="${i}" style="font-size: 1.5rem; color: #ffb703; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'"></i>`;
        }

        reviewFormHtml = `
        <div class="review-form-container glass-card" style="padding: 20px; border-radius: var(--border-radius-md); border: 1px solid var(--border-color); background: rgba(255, 255, 255, 0.02); display: flex; flex-direction: column; gap: 16px; text-align: right;">
            <h4 style="font-size: 1.1rem; font-weight: 800; color: var(--text-main); margin-bottom: 4px;">
                ${userReview ? '<i class="fa-solid fa-pen-to-square"></i> تعديل تقييمك ومراجعتك' : '<i class="fa-solid fa-star-half-stroke"></i> أضف تقييمك ومراجعتك للعمل'}
            </h4>
            <div style="display: flex; align-items: center; justify-content: flex-start; gap: 14px; direction: rtl;">
                <span style="font-size: 0.95rem; font-weight: 700; color: var(--text-main);">التقييم بالنجوم:</span>
                <div class="stars-picker" id="manga-stars-picker" style="display: flex; gap: 6px; direction: ltr;">
                    ${starsPickerHtml}
                </div>
                <span id="manga-selected-rating-val" style="font-size: 1.1rem; font-weight: 800; color: #ffb703;">${userRating} / 5</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <label for="manga-review-text" style="font-size: 0.95rem; font-weight: 700; color: var(--text-main);">رأيك أو مراجعتك (اختياري):</label>
                <textarea id="manga-review-text" rows="3" placeholder="اكتب رأيك أو مراجعتك النصية هنا..." style="width: 100%; padding: 12px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); color: var(--text-main); outline: none; font-family: var(--font-family); resize: none; text-align: right;">${userText}</textarea>
            </div>
            <button class="detail-btn btn-read" id="submit-manga-review-btn" style="padding: 10px 24px; font-size: 0.95rem; font-weight: 800; border-radius: 30px; width: fit-content; align-self: flex-start;">
                ${userReview ? 'تحديث المراجعة والتقييم' : 'إرسال التقييم والمراجعة'}
            </button>
        </div>
        `;
    } else {
        reviewFormHtml = `
        <div class="glass-card" style="padding: 20px; border-radius: var(--border-radius-md); border: 1px solid var(--border-color); background: rgba(255, 0, 127, 0.03); text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px;">
            <p style="font-size: 0.95rem; font-weight: 700; color: var(--text-main); margin: 0;"><i class="fa-solid fa-lock" style="color: var(--color-accent); margin-left: 6px;"></i> يجب تسجيل الدخول بالجيميل الخاص بك لتتمكن من تقييم المنهوا وترك مراجعة.</p>
            <button class="login-navbar-btn" id="review-auth-prompt-btn" style="padding: 8px 20px; font-size: 0.85rem; border-radius: 20px;"><i class="fa-solid fa-right-to-bracket"></i> تسجيل الدخول الآن</button>
        </div>
        `;
    }

    return `
    <div class="manga-detail-wrapper">
        <div class="detail-banner" style="background-image: ${cssImageUrl(getMangaBanner(manga))}">
            <div class="detail-banner-blur"></div>
        </div>
        <div class="detail-main">
            <div class="detail-sidebar">
                <div class="detail-cover">
                    <img src="${getDisplayCover(manga)}" alt="${manga.title}">
                </div>
                <div class="detail-actions">
                    ${latestChapter ? `
                        <button class="detail-btn btn-read start-reading-btn" data-chap-id="${latestChapter.id}">
                            <i class="fa-solid fa-play"></i> قراءة أول فصل
                        </button>
                    ` : ''}
                    
                    <div class="bookmark-picker" data-id="${manga.id}">
                        <button type="button" class="detail-btn btn-fav bookmark-picker-toggle ${bookmarkStatus ? 'is-selected' : ''}" aria-haspopup="true" aria-expanded="false">
                            <span class="bookmark-picker-icon ${bookmarkMeta.tone}"><i class="${bookmarkMeta.icon}"></i></span>
                            <span class="bookmark-picker-label">${bookmarkMeta.label}</span>
                            <i class="fa-solid fa-chevron-down bookmark-picker-chevron"></i>
                        </button>
                        <div class="bookmark-picker-menu" role="menu">
                            ${bookmarkOptionsHtml}
                        </div>
                    </div>
                    
                    ${state.userRole === 'admin' ? `
                        <button class="detail-btn edit-manga-btn" data-id="${manga.id}" style="margin-top:12px; background:rgba(0,255,127,0.1); border:1px solid #00ff7f; color:#00ff7f; display:flex; align-items:center; justify-content:center; gap:8px; cursor:pointer;">
                            <i class="fa-solid fa-pen-to-square"></i> تعديل هذا العمل
                        </button>
                        <button class="detail-btn delete-manga-admin-btn" data-id="${manga.id}" style="margin-top:6px; background:rgba(255,0,127,0.1); border:1px solid #ff007f; color:#ff007f; display:flex; align-items:center; justify-content:center; gap:8px; cursor:pointer;">
                            <i class="fa-solid fa-trash-can"></i> حذف هذا العمل
                        </button>
                    ` : ''}
                    
                    ${state.sessionToken ? `
                        <div class="overall-progress-container">
                            <div class="overall-progress-label"><i class="fa-solid fa-chart-simple"></i> تقدم القراءة الإجمالي: ${state.getOverallProgress(manga.id)}%</div>
                            <div class="overall-progress-track">
                                <div class="overall-progress-fill" style="width:${state.getOverallProgress(manga.id)}%"></div>
                            </div>
                        </div>
                    ` : ''}
                    ${state.progress[manga.id] ? `
                        <button class="detail-btn btn-continue continue-reading-btn" data-chap-id="${state.progress[manga.id].chapterId}">
                            <i class="fa-solid fa-arrow-rotate-right"></i> متابعة القراءة
                        </button>
                    ` : ''}
                </div>
            </div>
            <div class="detail-content">
                <h1 class="detail-title">${manga.title}</h1>
                <p class="detail-author">اسم آخر: ${manga.alternative} • المؤلف: ${manga.author}</p>
                
                <div class="detail-meta-grid">
                    <div class="meta-item"><strong>النوع:</strong> ${manga.type || 'منهوا'}</div>
                    <div class="meta-item"><strong>الحالة:</strong> ${manga.status === 'Ongoing' ? 'مستمرة' : manga.status === 'Completed' ? 'مكتملة' : manga.status}</div>
                    <div class="meta-item"><strong>المشاهدات:</strong> <i class="fa-solid fa-eye" style="color:var(--color-secondary)"></i> ${manga.views || 0}</div>
                    <div class="meta-item"><strong>التقييم:</strong> <i class="fa-solid fa-star" style="color:#ffb703"></i> ${manga.rating}</div>
                </div>
                
                <div class="genres-list">
                    ${genresHtml}
                </div>
                
                <div class="detail-synopsis">
                    <h3>القصة والوصف</h3>
                    <p>${manga.synopsis}</p>
                </div>
                
                <!-- قسم مراجعات المنهوا والتقييمات -->
                <div class="chapters-section" style="margin-top: 30px;">
                    <div class="chapters-header" style="margin-bottom: 20px;">
                        <h3>تقييمات ومراجعات المتابعين</h3>
                        <span>متوسط التقييم: <i class="fa-solid fa-star" style="color: #ffb703;"></i> ${manga.rating}</span>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 20px;">
                        ${reviewFormHtml}
                        
                        <div style="display: flex; flex-direction: column; gap: 14px; max-height: 400px; overflow-y: auto; padding-left: 6px;">
                            ${reviewsListHtml}
                        </div>
                    </div>
                </div>
                
                <div class="chapters-section">
                    <div class="chapters-header">
                        <h3>فصول المانجا المتاحة</h3>
                        <div class="chapters-search-box">
                            <input type="text" id="chapters-search-input" placeholder="ابحث عن رقم الفصل أو العنوان..." value="${state.chapterSearchQuery || ''}" autocomplete="off">
                            <i class="fa-solid fa-magnifying-glass"></i>
                        </div>
                        <span>إجمالي الفصول: ${manga.chapters.length}</span>
                    </div>
                    <div class="chapters-list">
                        ${chaptersHtml}
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;
}

// قارئ الفصول
async function ReaderViewComponent() {
    const manga = state.mangas.find(m => m.id === state.activeMangaId);
    if (!manga) return '<p>المانجا غير متوفرة</p>';

    if (manga.id === "1" && !state.soloLevelingLoaded) {
        await state.loadSoloLevelingChapters();
    }
    
    const chapterIndex = manga.chapters.findIndex(c => normalizeChapterId(c.id) === normalizeChapterId(state.activeChapterId));
    if (chapterIndex === -1) return '<p>الفصل غير متوفر</p>';
    
    const chapter = manga.chapters[chapterIndex];
    
    // زيادة المشاهدات محلياً
    manga.views = (manga.views || 0) + 1;
    state.saveMangas();
    
    // نقاط القراءة
    state.addPoints(10);

    // فحص ما إذا كان هذا الفصل محمل أوفلاين
    let pages = chapter.images;
    const offlineData = await getChapterOffline(manga.id, chapter.id);
    const isOfflineAvailable = !!offlineData;
    if (isOfflineAvailable) {
        pages = offlineData.images;
        console.log("تم تحميل صفحات الفصل المحفوظة من الـ IndexedDB محلياً.");
    }

    // التوليد الديناميكي على الطاير لتخفيف الذاكرة والملفات
    if (!pages || pages.length === 0) {
        if (manga.id === "4") {
            pages = generateKingdomMockPages(manga.title, chapter.id);
        } else {
            pages = generateMockPages(manga.title, chapter.id);
        }
    }

    // التحميل المسبق للفصل التالي
    const nextChapter = manga.chapters[chapterIndex - 1];
    if (nextChapter) {
        prefetchNextChapter(nextChapter.images);
    }

    // خيارات الفصول
    let optionsHtml = '';
    manga.chapters.forEach(ch => {
            optionsHtml += `<option value="${ch.id}" ${normalizeChapterId(ch.id) === normalizeChapterId(chapter.id) ? 'selected' : ''}>الفصل ${ch.id}</option>`;
    });

    // تفضيل الفصل
    const likeKey = `${manga.id}_${chapter.id}`;
    const isLiked = state.likes[likeKey] || false;

    // إعدادات القارئ
    const settings = state.readerSettings;
    const themeClass = `reader-theme-${settings.theme}`;
    const widthClass = `reader-width-${settings.width}`;
    const modeClass = settings.mode === 'horizontal' ? 'reader-mode-horizontal' : '';

    let imagesHtml = '';
    if (settings.mode === 'horizontal') {
        pages.forEach((pageUrl, index) => {
            const isActivePage = index === state.activePageIndex;
            const proxiedUrl = getProxiedImageUrl(pageUrl);
            imagesHtml += `
            <div class="reader-image-container ${isActivePage ? 'active-page' : ''}" data-index="${index}">
                <img src="${proxiedUrl}" alt="صفحة ${index + 1}">
            </div>
            `;
        });
    } else {
        pages.forEach((pageUrl, index) => {
            const proxiedUrl = getProxiedImageUrl(pageUrl);
            imagesHtml += `
            <div class="reader-image-container lazy-load-container" data-src="${proxiedUrl}">
                <div class="reader-image-placeholder">
                    <i class="fa-solid fa-circle-notch fa-spin" style="font-size:2.5rem;color:var(--color-primary);margin-bottom:12px;"></i>
                    <span>جاري تحميل الصفحة ${index + 1}...</span>
                </div>
            </div>
            `;
        });
    }

    // --- التحميل التلقائي للفصل التالي (Infinite Scroll) ---
    if (chapterIndex > 0 && settings.mode !== 'horizontal') {
        imagesHtml += '<div id="next-chapter-sentinel" style="height:1px;width:100%;"></div>';
    }

    // جلب تعليقات الفصل من السيرفر
    let chapterComments = [];
    let commentsListHtml = '';
    try {
        const response = await fetch(`/api/chapter_comments?manga_id=${manga.id}&chapter_id=${chapter.id}`);
        if (response.ok) {
            chapterComments = await response.json();
            if (chapterComments.length === 0) {
                commentsListHtml = '<p style="color:var(--text-dark);text-align:center;padding:20px;">كن أول من يترك تعليقاً على هذا الفصل!</p>';
            } else {
                chapterComments.forEach(comm => {
                    const userDisplay = comm.email.split('@')[0];
                    const firstLetter = userDisplay.charAt(0).toUpperCase();
                    const dateStr = new Date(comm.created_at * 1000).toLocaleDateString('ar-EG');
                    commentsListHtml += `
                    <div class="comment-item">
                        <div class="comment-avatar">${firstLetter}</div>
                        <div class="comment-body">
                            <div class="comment-header">
                                <span class="comment-username">${userDisplay}</span>
                                <span class="comment-time">${dateStr}</span>
                            </div>
                            <p class="comment-text">${comm.comment_text}</p>
                        </div>
                    </div>
                    `;
                });
            }
        }
    } catch (e) {
        console.error("Error fetching comments:", e);
        commentsListHtml = '<p style="color:#ff007f;text-align:center;padding:20px;">فشل تحميل تعليقات هذا الفصل.</p>';
    }

    // صندوق تعليق مسجل الدخول أو غير المسجل
    let commentFormHtml = '';
    if (state.sessionToken) {
        commentFormHtml = `
        <form class="comments-form" id="chapter-comment-form" style="display: flex; flex-direction: column; gap: 10px; text-align: right;">
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 6px;">
                <i class="fa-solid fa-user-check" style="color: var(--color-secondary); margin-left: 4px;"></i> التعليق باسم: <strong>${state.userEmail.split('@')[0]}</strong>
            </div>
            <div style="display: flex; gap: 12px; width: 100%;">
                <input type="text" placeholder="شاركنا رأيك حول الفصل..." id="chapter-comment-text" required style="flex: 1; padding: 12px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 30px; color: var(--text-main); outline: none; text-align: right;">
                <button type="submit" style="padding: 10px 24px; background: var(--color-primary); color: #fff; border: none; border-radius: 30px; font-weight: 700; cursor: pointer;">إرسال</button>
            </div>
        </form>
        `;
    } else {
        commentFormHtml = `
        <div class="glass-card" style="padding: 18px; border-radius: var(--border-radius-md); border: 1px solid var(--border-color); background: rgba(255, 0, 127, 0.03); text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px;">
            <p style="font-size: 0.9rem; font-weight: 700; color: var(--text-main); margin: 0;">
                <i class="fa-solid fa-lock" style="color: var(--color-accent); margin-left: 6px;"></i> يجب تسجيل الدخول بالجيميل الخاص بك لتتمكن من كتابة تعليق على هذا الفصل.
            </p>
            <button class="login-navbar-btn" id="comment-auth-prompt-btn" style="padding: 6px 18px; font-size: 0.8rem; border-radius: 20px;"><i class="fa-solid fa-right-to-bracket"></i> تسجيل الدخول الآن</button>
        </div>
        `;
    }

    // استرجاع وحفظ التقدم
    const progressPercent = settings.mode === 'horizontal' ? ((state.activePageIndex + 1) / pages.length) * 100 : 0;
    state.saveReadingProgress(manga.id, chapter.id, 0, progressPercent, state.activePageIndex);

    return `
    <div class="reader-wrapper ${themeClass} ${widthClass} ${modeClass} page-fade-in">
        <div class="reader-progress-bar" id="reading-bar" style="width: ${progressPercent}%"></div>
        
        <div class="reader-nav">
            <button class="reader-btn return-to-manga" title="العودة لصفحة المانجا"><i class="fa-solid fa-arrow-right"></i></button>
            <div class="reader-title-info">
                <h2>${manga.title}</h2>
                <p>${chapter.title} ${isOfflineAvailable ? '<span style="color:var(--color-secondary)"><i class="fa-solid fa-wifi-slash"></i> أوفلاين</span>' : ''}</p>
            </div>
            <div class="reader-controls">
                <button class="reader-btn prev-chapter-btn ${chapterIndex === manga.chapters.length - 1 ? 'disabled' : ''}" title="الفصل السابق"><i class="fa-solid fa-chevron-right"></i></button>
                
                <div class="custom-dropdown" id="chapter-dropdown">
                    <button class="dropdown-trigger">
                        <span>الفصل ${String(chapter.id).replace(/^ch_/, '').replace(/_0$/, '').replace(/_/g, '.')}</span>
                        <i class="fa-solid fa-chevron-down"></i>
                    </button>
                    <div class="dropdown-content">
                        <div class="dropdown-search-box">
                            <input type="text" id="chapter-drop-search" placeholder="ابحث عن رقم الفصل..." autocomplete="off">
                            <i class="fa-solid fa-magnifying-glass"></i>
                        </div>
                        <div class="dropdown-items-list">
                            ${manga.chapters.map(ch => {
                                let numClean = String(ch.id).replace(/^ch_/, '').replace(/_0$/, '').replace(/_/g, '.');
                                let subtitle = ch.title ? (ch.title.includes(':') ? ch.title.split(':').slice(1).join(':').trim() : ch.title) : '';
                                
                                // Prevent duplication if subtitle is exactly "الفصل X" or "chapter X"
                                if (subtitle.replace(/[^0-9.]/g, '') === numClean) {
                                    subtitle = '';
                                }

                                return `
                                    <div class="dropdown-item-opt ${normalizeChapterId(ch.id) === normalizeChapterId(chapter.id) ? 'active' : ''}" data-value="${ch.id}">
                                        <span class="opt-num">الفصل ${numClean}</span>
                                        ${subtitle ? `<span class="opt-title">${subtitle}</span>` : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>

                <button class="reader-btn next-chapter-btn ${chapterIndex === 0 ? 'disabled' : ''}" title="الفصل التالي"><i class="fa-solid fa-chevron-left"></i></button>
                ${state.sessionUser && state.sessionUser.role === 'admin' ? `
                <button class="reader-btn translate-chapter-btn" title="ترجمة هذا الفصل" data-url="${chapter.url}" data-manga-id="${manga.id}" data-chapter-id="${chapter.id}">
                    <i class="fa-solid fa-language"></i>
                </button>` : ''}
            </div>
        </div>
        
        <div class="reader-content-images">
            ${imagesHtml}
            
            ${settings.mode === 'horizontal' ? `
                <div class="horizontal-click-navigator">
                    <div class="nav-zone nav-zone-right" id="h-prev-zone" title="الصفحة السابقة"><i class="fa-solid fa-chevron-right"></i></div>
                    <div class="nav-zone nav-zone-left" id="h-next-zone" title="الصفحة التالية"><i class="fa-solid fa-chevron-left"></i></div>
                </div>
                <div class="horizontal-page-indicator">
                    صفحة ${state.activePageIndex + 1} من ${pages.length}
                </div>
            ` : ''}
        </div>

        <div class="chapter-likes-interactive">
            <button class="like-chapter-btn ${isLiked ? 'liked' : ''}" id="chapter-like-btn">
                <i class="fa-${isLiked ? 'solid' : 'regular'} fa-heart"></i>
                <span id="like-text">${isLiked ? 'أعجبني هذا الفصل!' : 'أعجبني'}</span>
            </button>
        </div>
        
        <div class="reader-bottom-nav">
            <button class="reader-btn prev-chapter-btn ${chapterIndex === manga.chapters.length - 1 ? 'disabled' : ''}" title="الفصل السابق"><i class="fa-solid fa-chevron-right"></i> الفصل السابق</button>
            <button class="reader-btn return-to-manga" title="العودة لصفحة المانهوا">رجوع إلى المانهوا</button>
            <button class="reader-btn next-chapter-btn ${chapterIndex === 0 ? 'disabled' : ''}" title="الفصل التالي">الفصل التالي <i class="fa-solid fa-chevron-left"></i></button>
        </div>
        
        <button class="reader-settings-toggle-btn" id="settings-panel-toggle" title="تخصيص القراءة"><i class="fa-solid fa-gear"></i></button>
        
        <div class="reader-settings-panel" id="settings-panel">
            <div class="setting-row">
                <label>اتجاه القراءة</label>
                <div class="setting-buttons">
                    <button class="setting-btn ${settings.mode === 'vertical' ? 'active' : ''}" data-setting="mode" data-value="vertical">طولي (Webtoon)</button>
                    <button class="setting-btn ${settings.mode === 'horizontal' ? 'active' : ''}" data-setting="mode" data-value="horizontal">أفقي (Manga)</button>
                </div>
            </div>
            <div class="setting-row">
                <label>لون الخلفية</label>
                <div class="setting-buttons">
                    <button class="setting-btn ${settings.theme === 'dark' ? 'active' : ''}" data-setting="theme" data-value="dark">داكن</button>
                    <button class="setting-btn ${settings.theme === 'gray' ? 'active' : ''}" data-setting="theme" data-value="gray">رمادي</button>
                    <button class="setting-btn ${settings.theme === 'sepia' ? 'active' : ''}" data-setting="theme" data-value="sepia">مريح للعين</button>
                </div>
            </div>
            <div class="setting-row">
                <label>عرض الصور</label>
                <div class="setting-buttons">
                    <button class="setting-btn ${settings.width === 'compact' ? 'active' : ''}" data-setting="width" data-value="compact">مضغوط</button>
                    <button class="setting-btn ${settings.width === 'medium' ? 'active' : ''}" data-setting="width" data-value="medium">متوسط</button>
                    <button class="setting-btn ${settings.width === 'full' ? 'active' : ''}" data-setting="width" data-value="full">كامل</button>
                </div>
            </div>
        </div>
        
        <div class="main-content" style="max-width: 800px; margin: 0 auto; width: 100%;">
            <div class="comments-container" style="margin-bottom: 50px;">
                <h3 class="comments-title"><i class="fa-regular fa-comments"></i> مناقشة الفصل (${chapterComments.length})</h3>
                ${commentFormHtml}
                <div class="comments-list">
                    ${commentsListHtml}
                </div>
            </div>
        </div>
    </div>
    `;
}

// لوحة الإدارة
function AdminPanelViewComponent() {
    if (!state.adminStats) {
        loadAdminStats();
    }

    let mangaOptions = '';
    state.mangas.forEach(m => {
        mangaOptions += `<option value="${m.id}">${m.title}</option>`;
    });

    const dateFrom = state.adminDateFrom || '';
    const dateTo = state.adminDateTo || '';
    const statsTitle = state.adminDateFrom && state.adminDateTo ? `إحصائيات (${state.adminDateFrom} → ${state.adminDateTo})` : 'لوحة الإحصائيات الحيوية';
    return `
    <div class="admin-container" style="position: relative;">
        <button class="settings-close-btn" id="close-admin-btn" title="خروج من لوحة الإدارة" style="position: absolute; top: 12px; left: 12px;"><i class="fa-solid fa-xmark"></i></button>
        <h2 class="admin-title">لوحة التحكم والإدارة للموقع <span>(KAIRO/منهوا)</span></h2>
        
        <!-- Date Range + Export Controls -->
        <div class="admin-controls" style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 20px; padding: 16px; border-radius: var(--border-radius-md); border: 1px solid var(--border-color); background: rgba(255,255,255,0.01);">
            <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 700;"><i class="fa-solid fa-calendar"></i> تصفية:</span>
            <input type="date" id="admin-date-from" value="${dateFrom}" style="direction: ltr; text-align: right; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); padding: 8px 12px; border-radius: var(--border-radius-sm); font-size: 0.85rem; outline: none;">
            <span style="color: var(--text-dark);">→</span>
            <input type="date" id="admin-date-to" value="${dateTo}" style="direction: ltr; text-align: right; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); padding: 8px 12px; border-radius: var(--border-radius-sm); font-size: 0.85rem; outline: none;">
            <button class="admin-control-btn" id="btn-admin-apply-filter" style="padding: 8px 20px; border-radius: var(--border-radius-sm); border: none; background: linear-gradient(135deg, var(--color-primary), var(--color-secondary)); color: #fff; font-weight: 700; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 6px;"><i class="fa-solid fa-filter"></i> تطبيق</button>
            <button class="admin-control-btn" id="btn-admin-clear-filter" style="padding: 8px 16px; border-radius: var(--border-radius-sm); border: 1px solid var(--border-color); background: transparent; color: var(--text-dark); font-weight: 600; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 6px;"><i class="fa-solid fa-xmark"></i> مسح</button>
            <span style="flex:1;"></span>
            <button class="admin-control-btn" id="btn-admin-export-csv" style="padding: 8px 20px; border-radius: var(--border-radius-sm); border: 1px solid #00ff7f44; background: rgba(0,255,127,0.05); color: #00ff7f; font-weight: 700; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 6px;"><i class="fa-solid fa-file-csv"></i> CSV</button>
            <button class="admin-control-btn" id="btn-admin-export-json" style="padding: 8px 20px; border-radius: var(--border-radius-sm); border: 1px solid #6c63ff44; background: rgba(108,99,255,0.05); color: #6c63ff; font-weight: 700; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 6px;"><i class="fa-solid fa-file-export"></i> JSON</button>
        </div>
        
        <!-- لوحة الإحصائيات الحيوية -->
        <div class="admin-stats-dashboard" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 30px;">
            ${state.adminStats ? `
                <div class="stat-card glass-card" style="padding: 16px; border-radius: var(--border-radius-md); border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 6px; background: rgba(255,255,255,0.01); text-align: right;">
                    <span style="font-size: 0.85rem; color: var(--text-muted);"><i class="fa-solid fa-eye" style="color: var(--color-secondary); margin-left: 6px;"></i> زيارات الموقع الكلية</span>
                    <strong style="font-size: 1.5rem; color: var(--text-main); font-weight: 800;">${state.adminStats.visits}</strong>
                </div>
                <div class="stat-card glass-card" style="padding: 16px; border-radius: var(--border-radius-md); border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 6px; background: rgba(255,255,255,0.01); text-align: right;">
                    <span style="font-size: 0.85rem; color: var(--text-muted);"><i class="fa-solid fa-users" style="color: var(--color-primary); margin-left: 6px;"></i> إجمالي المشتركين</span>
                    <strong style="font-size: 1.5rem; color: var(--text-main); font-weight: 800;">${state.adminStats.total_users}</strong>
                </div>
                <div class="stat-card glass-card" style="padding: 16px; border-radius: var(--border-radius-md); border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 6px; background: rgba(255,255,255,0.01); text-align: right;">
                    <span style="font-size: 0.85rem; color: var(--text-muted);"><i class="fa-brands fa-google" style="color: #ea4335; margin-left: 6px;"></i> التسجيل بـ Google</span>
                    <strong style="font-size: 1.5rem; color: var(--text-main); font-weight: 800;">${state.adminStats.google}</strong>
                </div>
                <div class="stat-card glass-card" style="padding: 16px; border-radius: var(--border-radius-md); border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 6px; background: rgba(255,255,255,0.01); text-align: right;">
                    <span style="font-size: 0.85rem; color: var(--text-muted);"><i class="fa-brands fa-facebook" style="color: #1877f2; margin-left: 6px;"></i> التسجيل بـ Facebook</span>
                    <strong style="font-size: 1.5rem; color: var(--text-main); font-weight: 800;">${state.adminStats.facebook}</strong>
                </div>
                ${state.adminStats.suggestions_in_range !== undefined ? `
                <div class="stat-card glass-card" style="padding: 16px; border-radius: var(--border-radius-md); border: 1px solid #ff007f44; display: flex; flex-direction: column; gap: 6px; background: rgba(255,0,127,0.03); text-align: right;">
                    <span style="font-size: 0.85rem; color: var(--text-muted);"><i class="fa-solid fa-message" style="color: #ff007f; margin-left: 6px;"></i> اقتراحات/شكاوى (في النطاق)</span>
                    <strong style="font-size: 1.5rem; color: #ff007f; font-weight: 800;">${state.adminStats.suggestions_in_range}</strong>
                </div>` : state.adminStats.total_suggestions !== undefined ? `
                <div class="stat-card glass-card" style="padding: 16px; border-radius: var(--border-radius-md); border: 1px solid #ff007f44; display: flex; flex-direction: column; gap: 6px; background: rgba(255,0,127,0.03); text-align: right;">
                    <span style="font-size: 0.85rem; color: var(--text-muted);"><i class="fa-solid fa-message" style="color: #ff007f; margin-left: 6px;"></i> إجمالي الاقتراحات والشكاوى</span>
                    <strong style="font-size: 1.5rem; color: #ff007f; font-weight: 800;">${state.adminStats.total_suggestions}</strong>
                </div>` : ''}
            ` : `
                <div class="stat-card glass-card skeleton-shimmer" style="height: 80px; border-radius: var(--border-radius-md); background: rgba(255,255,255,0.01); animation: shimmer 1.5s infinite;"></div>
                <div class="stat-card glass-card skeleton-shimmer" style="height: 80px; border-radius: var(--border-radius-md); background: rgba(255,255,255,0.01); animation: shimmer 1.5s infinite;"></div>
                <div class="stat-card glass-card skeleton-shimmer" style="height: 80px; border-radius: var(--border-radius-md); background: rgba(255,255,255,0.01); animation: shimmer 1.5s infinite;"></div>
                <div class="stat-card glass-card skeleton-shimmer" style="height: 80px; border-radius: var(--border-radius-md); background: rgba(255,255,255,0.01); animation: shimmer 1.5s infinite;"></div>
            `}
        </div>

        <div class="admin-tabs">
            <button class="admin-tab active" id="tab-add-manga">إضافة مانجا/منهوا جديدة</button>
            <button class="admin-tab" id="tab-add-chapter">إضافة فصل جديد</button>
            <button class="admin-tab" id="tab-edit-manga">تعديل مانجا/منهوا</button>
            <button class="admin-tab" id="tab-suggestions">الشكاوى والاقتراحات</button>
            <button class="admin-tab" id="tab-site-settings">إعدادات الموقع</button>
            <button class="admin-tab" id="tab-alt-sources">مصادر بديلة</button>
        </div>
        
        <div class="admin-form-panel" id="panel-edit-manga" style="display:none;">
            <form id="edit-manga-form">
                <div class="admin-form-group">
                    <label>اختر المانجا/المنهوا للتعديل</label>
                    <select id="edit-manga-id" required>
                        <option value="">-- اختر --</option>
                        ${mangaOptions}
                    </select>
                </div>
                <div id="edit-manga-fields" style="display:none; margin-top: 20px; border-top: 1px solid var(--border-color); padding-top: 20px;">
                    <div class="admin-form-group">
                        <label>رابط صورة الغلاف (Cover)</label>
                        <input type="url" id="edit-manga-cover" placeholder="رابط URL للغلاف">
                    </div>
                    <div class="admin-form-group">
                        <label>التصنيفات (تفصل بفاصلة)</label>
                        <input type="text" id="edit-manga-genres" placeholder="أكشن, مغامرة, خيال, عسكري">
                    </div>
                    <div class="admin-form-group">
                        <label>العنوان</label>
                        <input type="text" id="edit-manga-title" placeholder="عنوان المانجا">
                    </div>
                    <div class="admin-form-group">
                        <label>العنوان البديل</label>
                        <input type="text" id="edit-manga-alt" placeholder="العنوان بالإنجليزي أو البديل">
                    </div>
                    <div class="admin-form-group">
                        <label>المؤلف</label>
                        <input type="text" id="edit-manga-author" placeholder="اسم المؤلف أو الرسام">
                    </div>
                    <div class="admin-form-group">
                        <label>القصة (الوصف)</label>
                        <textarea id="edit-manga-synopsis" rows="4" placeholder="وصف القصة"></textarea>
                    </div>
                    <div class="admin-form-group">
                        <label>حالة العمل</label>
                        <select id="edit-manga-status">
                            <option value="مستمر">مستمر</option>
                            <option value="مكتمل">مكتمل</option>
                            <option value="متوقف">متوقف</option>
                        </select>
                    </div>
                    <button type="submit" class="admin-submit-btn"><i class="fa-solid fa-floppy-disk"></i> حفظ التعديلات</button>
                    <div id="edit-manga-msg" style="margin-top: 12px; font-size: 0.9rem; text-align: center;"></div>
                </div>
            </form>
        </div>

        <div class="admin-form-panel" id="panel-alt-sources" style="display:none;">
            <form id="alt-source-form">
                <div class="admin-form-group">
                    <label>اختر المانجا/المنهوا</label>
                    <select id="alt-manga-id" required>
                        ${mangaOptions}
                    </select>
                </div>
                <button type="submit" class="admin-submit-btn"><i class="fa-solid fa-search"></i> بحث عن مصادر بديلة</button>
            </form>
            <div id="alt-source-results" style="margin-top:20px;"></div>
        </div>
        
        <div class="admin-form-panel" id="panel-add-manga">
            <form id="add-manga-form">
                <div class="admin-form-group">
                    <label>عنوان المانجا الأصلي</label>
                    <input type="text" id="manga-title" placeholder="أدخل العنوان بالعربية، مثلاً: كينجدوم" required>
                </div>
                <div class="admin-form-group">
                    <label>العنوان البديل (اختياري)</label>
                    <input type="text" id="manga-alt" placeholder="أدخل العنوان بالإنجليزي أو الياباني">
                </div>
                <div class="admin-form-group">
                    <label>المؤلف</label>
                    <input type="text" id="manga-author" placeholder="أدخل اسم المؤلف أو الرسام" required>
                </div>
                <div class="admin-form-group">
                    <label>نوع العمل</label>
                    <select id="manga-type">
                        <option value="مانجا">مانجا (Manga)</option>
                        <option value="منهوا">منهوا (Manhua/Webtoon)</option>
                    </select>
                </div>
                <div class="admin-form-group">
                    <label>رابط صورة الغلاف (Cover)</label>
                    <input type="url" id="manga-cover" placeholder="رابط URL للغلاف، أو اتركه فارغاً لنستخدم صورة افتراضية ممتازة">
                </div>
                <div class="admin-form-group">
                    <label>رابط صورة الخلفية العريضة (Banner)</label>
                    <input type="url" id="manga-banner" placeholder="رابط URL للخلفية في صفحة التفاصيل">
                </div>
                <div class="admin-form-group">
                    <label>التصنيفات (تفصل بفاصلة)</label>
                    <input type="text" id="manga-genres" placeholder="أكشن, مغامرة, خيال, عسكري" required>
                </div>
                <div class="admin-form-group">
                    <label>قصة المانجا (الوصف)</label>
                    <textarea id="manga-synopsis" rows="5" placeholder="أكتب ملخص القصة والسيناريو الخاص بالمانجا..." required></textarea>
                </div>
                <button type="submit" class="admin-submit-btn">حفظ وإدراج العمل الجديد</button>
            </form>
        </div>

        <div class="admin-form-panel" id="panel-add-chapter" style="display:none;">
            <form id="add-chapter-form">
                <div class="admin-form-group">
                    <label>اختر المانجا/المنهوا</label>
                    <select id="chap-manga-id" required>
                        ${mangaOptions}
                    </select>
                </div>
                <div class="admin-form-group">
                    <label>رقم الفصل</label>
                    <input type="number" step="any" id="chap-number" placeholder="رقم الفصل، مثلاً: 4 أو 4.5" required>
                </div>
                <div class="admin-form-group">
                    <label>عنوان الفصل (اختياري)</label>
                    <input type="text" id="chap-title" placeholder="أدخل اسماً للفصل، مثلاً: البداية الجديدة">
                </div>
                <div class="admin-form-group">
                    <label>روابط صفحات المانجا (رابط واحد في كل سطر)</label>
                    <textarea id="chap-images" rows="8" placeholder="ضع رابط الصورة المباشر لكل صفحة، سطر تلو سطر.&#10;إذا تركته فارغاً، سنقوم بتوليد صفحات تجريبية فائقة الجمال تلقائياً لتجربة القراءة أوفلاين."></textarea>
                </div>
                <button type="submit" class="admin-submit-btn">حفظ ونشر الفصل الجديد</button>
            </form>
        </div>

        <div class="admin-form-panel" id="panel-suggestions" style="display:none; text-align: right;">
            <div id="suggestions-list-admin" style="display: flex; flex-direction: column; gap: 16px;">
                <p style="text-align:center; padding: 20px; color: var(--text-dark);"><i class="fa-solid fa-spinner fa-spin"></i> جاري تحميل الشكاوى والاقتراحات...</p>
            </div>
        </div>

        <div class="admin-form-panel" id="panel-site-settings" style="display:none; text-align: right;">
            <form id="site-settings-form">
                <div class="admin-form-group">
                    <label>معرف تطبيق جوجل (Google Client ID)</label>
                    <input type="text" id="setting-google-id" value="${state.adminConfig?.google_client_id || GOOGLE_CLIENT_ID}" placeholder="مثال: 123456789-abc123xyz.apps.googleusercontent.com" style="direction: ltr; text-align: left; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); padding: 10px; border-radius: var(--border-radius-sm); width: 100%; outline: none;" required>
                    <span style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px; display: block;">يمكنك الحصول عليه من Google Cloud Console لتفعيل تسجيل الدخول بجيميل.</span>
                </div>
                <div class="admin-form-group">
                    <label>معرف تطبيق فيسبوك (Facebook App ID)</label>
                    <input type="text" id="setting-facebook-id" value="${state.adminConfig?.facebook_app_id || FACEBOOK_APP_ID}" placeholder="مثال: 123456789012345" style="direction: ltr; text-align: left; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); padding: 10px; border-radius: var(--border-radius-sm); width: 100%; outline: none;" required>
                    <span style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px; display: block;">يمكنك الحصول عليه من Meta Developers لتفعيل تسجيل الدخول بفيسبوك.</span>
                </div>
                
                <h3 style="color: var(--text-main); margin-top: 30px; margin-bottom: 15px; border-right: 4px solid var(--color-primary); padding-right: 10px; font-size: 1.15rem; font-weight: 800;"><i class="fa-solid fa-envelope" style="color: var(--color-primary); margin-left: 6px;"></i> إعدادات خادم البريد (SMTP)</h3>
                
                <div class="admin-form-group">
                    <label>خادم SMTP (SMTP Host)</label>
                    <input type="text" id="setting-smtp-host" value="${state.adminConfig?.smtp_host || 'smtp.gmail.com'}" placeholder="smtp.gmail.com" style="direction: ltr; text-align: left; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); padding: 10px; border-radius: var(--border-radius-sm); width: 100%; outline: none;" required>
                </div>
                <div class="admin-form-group">
                    <label>منفذ SMTP (SMTP Port)</label>
                    <input type="text" id="setting-smtp-port" value="${state.adminConfig?.smtp_port || '587'}" placeholder="587" style="direction: ltr; text-align: left; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); padding: 10px; border-radius: var(--border-radius-sm); width: 100%; outline: none;" required>
                </div>
                <div class="admin-form-group">
                    <label>بريد خادم الإرسال (SMTP Username)</label>
                    <input type="text" id="setting-smtp-user" value="${state.adminConfig?.smtp_user || ''}" placeholder="example@gmail.com" style="direction: ltr; text-align: left; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); padding: 10px; border-radius: var(--border-radius-sm); width: 100%; outline: none;">
                    <span style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px; display: block;">البريد الإلكتروني الذي سيقوم الخادم باستخدامه لإرسال الرسائل (مثل حساب Gmail).</span>
                </div>
                <div class="admin-form-group">
                    <label>كلمة مرور التطبيق (SMTP Password / Gmail App Password)</label>
                    <input type="password" id="setting-smtp-pass" value="${state.adminConfig?.smtp_pass || ''}" placeholder="كلمة مرور التطبيق المكونة من 16 حرفاً" style="direction: ltr; text-align: left; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); padding: 10px; border-radius: var(--border-radius-sm); width: 100%; outline: none;">
                    <span style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px; display: block;">إذا كنت تستخدم Gmail، يرجى إنشاء كلمة مرور تطبيق (App Password) من إعدادات حساب Google الخاص بك.</span>
                </div>
                <div class="admin-form-group">
                    <label>عنوان واسم المرسل (Sender Email & Name)</label>
                    <input type="text" id="setting-smtp-sender" value="${state.adminConfig?.smtp_sender || 'KAIRO/منهوا <noreply@kairo-manhua.com>'}" placeholder="KAIRO/منهوا &lt;noreply@kairo-manhua.com&gt;" style="background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); padding: 10px; border-radius: var(--border-radius-sm); width: 100%; outline: none;" required>
                </div>
                
                <button type="submit" class="admin-submit-btn">حفظ الإعدادات وتطبيقها</button>
            </form>
        </div>
    </div>
    `;
}

// صفحة المفضلة والمتابعة (Bookmarks)
function BookmarksViewComponent() {
    const activeTab = state.activeGenre;
    const currentTab = ['reading', 'plan', 'completed', 'all'].includes(activeTab) ? activeTab : 'all';

    let mangasFiltered = [];
    state.mangas.forEach(manga => {
        const status = state.bookmarks[manga.id];
        if (status) {
            if (currentTab === 'all' || status === currentTab) {
                mangasFiltered.push(manga);
            }
        }
    });

    let listHtml = '';
    if (mangasFiltered.length === 0) {
        listHtml = `
        <div class="empty-state empty-state-glow">
            <i class="fa-solid fa-folder-open" style="font-size: 3rem; color: var(--text-muted); opacity: 0.5; margin-bottom: 15px;"></i>
            <h3>المفضلة فارغة</h3>
            <p>تصفح الأعمال وقم بإضافتها لمفضلتك لتظهر هنا وتتابعها أولاً بأول.</p>
        </div>
        `;
    } else {
        listHtml = `<div class="manga-grid">`;
        mangasFiltered.forEach(manga => {
            const status = state.bookmarks[manga.id];
            const statusText = status === 'reading' ? 'أقرأه حالياً' :
                               status === 'plan' ? 'أرغب بقراءته' : 'مكتمل';
            listHtml += `
            <div class="manga-card" data-id="${manga.id}">
                <div class="manga-card-cover">
                    <img src="${getDisplayCover(manga)}" alt="${manga.title}" loading="lazy">
                    <span class="card-badge" style="background:var(--color-primary);">${statusText}</span>
                    <span class="card-rating"><i class="fa-solid fa-star"></i> ${manga.rating}</span>
                </div>
                <div class="manga-card-info">
                    <h3 class="manga-card-title">${manga.title}</h3>
                    <div class="manga-card-chapter">
                        <span>تقدم القراءة</span>
                        <span class="chap-num">فصل ${state.progress[manga.id] ? state.progress[manga.id].chapterId : 'لم تبدأ'}</span>
                    </div>
                </div>
            </div>
            `;
        });
        listHtml += `</div>`;
    }

    return `
    <div>
        <div class="section-header">
            <h2 class="section-title">مكتبتك ومفضلتك <span>الخاصة</span></h2>
        </div>
        <div class="bookmarks-tabs">
            <button class="bookmark-tab ${currentTab === 'all' ? 'active' : ''}" data-tab="all"><i class="fa-solid fa-layer-group"></i> الكل</button>
            <button class="bookmark-tab ${currentTab === 'reading' ? 'active' : ''}" data-tab="reading"><i class="fa-solid fa-book-open-reader"></i> أقرأه حالياً</button>
            <button class="bookmark-tab ${currentTab === 'plan' ? 'active' : ''}" data-tab="plan"><i class="fa-solid fa-clock"></i> أرغب في قراءته</button>
            <button class="bookmark-tab ${currentTab === 'completed' ? 'active' : ''}" data-tab="completed"><i class="fa-solid fa-circle-check"></i> مكتمل</button>
        </div>
        ${listHtml}
    </div>
    `;
}

// صفحة التحميلات والقراءة أوفلاين (Downloads)
async function DownloadsViewComponent() {
    const localDownloads = await getAllDownloadsOffline();
    
    let listHtml = '';
    if (localDownloads.length === 0) {
        listHtml = `
        <div class="empty-state">
            <i class="fa-solid fa-circle-down" style="color:var(--border-color)"></i>
            <h3>لا توجد فصول محملة</h3>
            <p>قم بالدخول لصفحة أي مانجا واضغط على زر التحميل بجوار الفصل ليتم حفظه على جهازك للاستخدام دون إنترنت.</p>
        </div>
        `;
    } else {
        listHtml = `
        <div class="chapters-section">
            <div class="chapters-header">
                <h3>الفصول المحملة للاستخدام أوفلاين</h3>
                <span>إجمالي الفصول: ${localDownloads.length}</span>
            </div>
            <div class="chapters-list">
        `;
        
        localDownloads.forEach(d => {
            const manga = state.mangas.find(m => m.id === d.mangaId);
            const mangaTitle = manga ? manga.title : 'مانجا غير معروفة';
            listHtml += `
            <div class="chapter-item" data-manga-id="${d.mangaId}" data-chap-id="${d.chapterId}">
                <div class="chapter-info">
                    <span class="chapter-name">${mangaTitle} - الفصل ${d.chapterId}</span>
                    <span class="chapter-date" style="color:var(--color-secondary);"><i class="fa-solid fa-wifi-slash"></i> متاح دون اتصال</span>
                </div>
                <div class="chapter-actions-inline">
                    <button class="download-btn downloaded delete-download-btn" data-manga-id="${d.mangaId}" data-chap-id="${d.chapterId}" title="حذف الملفات المحملة">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
            `;
        });
        
        listHtml += `
            </div>
        </div>
        `;
    }

    return `
    <div>
        <div class="section-header">
            <h2 class="section-title">مركز التحميلات <span>أوفلاين</span></h2>
        </div>
        ${listHtml}
    </div>
    `;
}

function ResetPasswordViewComponent() {
    return `
    <div class="reset-password-wrapper" style="max-width: 450px; margin: 60px auto; padding: 30px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--border-radius-md); box-shadow: var(--shadow-lg); text-align: right; backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);">
        <h2 style="font-size: 1.6rem; font-weight: 800; color: var(--text-main); margin-bottom: 20px; border-right: 4px solid var(--color-secondary); padding-right: 12px;"><i class="fa-solid fa-lock" style="color:var(--color-secondary); margin-left: 6px;"></i> استعادة كلمة المرور</h2>
        <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 24px;">الرجاء إدخال كلمة المرور الجديدة لحسابك.</p>
        
        <form id="reset-password-form" style="display: flex; flex-direction: column; gap: 16px;">
            <div class="form-group" style="text-align: right;">
                <label style="color:var(--text-main); font-weight:700; font-size:0.9rem;">كلمة المرور الجديدة</label>
                <input type="password" id="reset-new-pass" required placeholder="********" style="background: var(--bg-surface); border: 1px solid var(--border-color); color: var(--text-main); padding: 12px; border-radius: var(--border-radius-sm); width: 100%; outline: none; margin-top: 6px;">
            </div>
            <div class="form-group" style="text-align: right;">
                <label style="color:var(--text-main); font-weight:700; font-size:0.9rem;">تأكيد كلمة المرور الجديدة</label>
                <input type="password" id="reset-confirm-pass" required placeholder="********" style="background: var(--bg-surface); border: 1px solid var(--border-color); color: var(--text-main); padding: 12px; border-radius: var(--border-radius-sm); width: 100%; outline: none; margin-top: 6px;">
            </div>
            <div id="reset-error-msg" class="auth-error-msg" style="display:none; margin-bottom: 8px; color: var(--color-accent); font-weight: 700;"></div>
            <div id="reset-success-msg" class="auth-success-msg" style="display:none; margin-bottom: 8px; color: #00ff7f; font-weight: 700;"></div>
            <button type="submit" class="auth-submit-btn neon-pulse-hover" style="background: linear-gradient(135deg, var(--color-secondary), var(--color-primary)); color: #07080c; border: none; padding: 12px; border-radius: 30px; font-weight: 800; cursor: pointer; width: 100%;">تحديث كلمة المرور</button>
        </form>
    </div>
    `;
}

// تجميع وتصيير التطبيق بالكامل
async function renderApp() {
    const root = document.getElementById('app');
    
    const loader = document.getElementById('initial-loader');
    if (loader) loader.remove();

    // 1. تصفية المانجا
    let filteredMangas = state.mangas;
    if (state.searchQuery) {
        filteredMangas = filteredMangas.filter(m => 
            m.title.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
            m.alternative.toLowerCase().includes(state.searchQuery.toLowerCase())
        );
    }
    if (state.activeGenre !== 'الكل' && state.currentView === 'home') {
        filteredMangas = filteredMangas.filter(m => m.genres.includes(state.activeGenre));
    }

    // 2. تجميع محتوى الواجهة المعنية
    let viewHtml = '';
    
    if (state.currentView === 'home') {
        const mainContentHtml = `
            ${HeroSliderComponent()}
            ${ReadingHistoryComponent()}
            ${GenresFilterComponent()}
            ${MangaGridComponent("تحديثات المانجا اليومية", filteredMangas)}
        `;
        
        const sidebarHtml = `
            ${UserProfileWidgetComponent()}
            ${TrendingSidebarComponent()}
        `;

        viewHtml = `
        <div class="homepage-layout">
            <div class="homepage-main">${mainContentHtml}</div>
            <aside class="homepage-sidebar">${sidebarHtml}</aside>
        </div>
        `;
        startSliderTimer();
    } else if (state.currentView === 'detail') {
        viewHtml = await DetailViewComponent();
        if (sliderInterval) clearInterval(sliderInterval);
    } else if (state.currentView === 'reader') {
        viewHtml = await ReaderViewComponent();
        if (sliderInterval) clearInterval(sliderInterval);
    } else if (state.currentView === 'admin') {
        viewHtml = AdminPanelViewComponent();
        if (sliderInterval) clearInterval(sliderInterval);
    } else if (state.currentView === 'bookmarks') {
        viewHtml = BookmarksViewComponent();
        if (sliderInterval) clearInterval(sliderInterval);
    } else if (state.currentView === 'downloads') {
        viewHtml = await DownloadsViewComponent();
        if (sliderInterval) clearInterval(sliderInterval);
    } else if (state.currentView === 'history') {
        viewHtml = HistoryViewComponent();
        if (sliderInterval) clearInterval(sliderInterval);
    } else if (state.currentView === 'reset-password') {
        viewHtml = ResetPasswordViewComponent();
        if (sliderInterval) clearInterval(sliderInterval);
    }

    // 3. بناء وتصيير الهيكل الأساسي للواجهة
    if (state.currentView === 'reader') {
        root.innerHTML = `<div id="app-root">${viewHtml} ${AuthModalComponent()} ${SuggestionsModalComponent()} ${SettingsModalComponent()}</div>`;
        
        if (state.readerSettings.mode !== 'horizontal') {
            initLazyLoading();
            initProgressTracker();
        }
    } else {
        root.innerHTML = `
        <div id="app-root">
            ${HeaderComponent()}
            <main class="main-content page-fade-in">
                ${viewHtml}
            </main>
            ${AuthModalComponent()}
            ${SuggestionsModalComponent()}
            ${SettingsModalComponent()}
        </div>
        `;
    }

    attachEventListeners();
}

// ==========================================
// 4.5. التوثيق الاجتماعي (Google & Facebook OAuth)
// ==========================================
let googleTokenClient = null;

async function handleGoogleLogin(response) {
    const credential = response.credential;
    try {
        const res = await fetch('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential })
        });
        const result = await res.json();
        if (res.ok) {
            state.sessionToken = result.token;
            state.userEmail = result.email;
            state.userRole = result.role;
            if (result.points !== undefined) state.userProfile.points = result.points;
            if (result.level !== undefined) state.userProfile.level = result.level;
            state.saveUserProfile();
            await state.fetchAndMergeSettings();
            state.showAuthModal = false;
            renderApp();
            alert(`أهلاً بك! تم تسجيل الدخول بنجاح عبر Google باسم ${result.email.split('@')[0]}`);
        } else {
            alert(result.error || 'فشل تسجيل الدخول بـ Google');
        }
    } catch (e) {
        console.error("Google Auth error:", e);
        alert('خطأ في الاتصال بالخادم أثناء تسجيل الدخول بـ Google');
    }
}

async function verifyGoogleAccessToken(accessToken) {
    try {
        const res = await fetch('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: accessToken })
        });
        const result = await res.json();
        if (res.ok) {
            state.sessionToken = result.token;
            state.userEmail = result.email;
            state.userRole = result.role;
            if (result.points !== undefined) state.userProfile.points = result.points;
            if (result.level !== undefined) state.userProfile.level = result.level;
            state.saveUserProfile();
            await state.fetchAndMergeSettings();
            state.showAuthModal = false;
            renderApp();
            alert(`أهلاً بك! تم تسجيل الدخول بنجاح عبر Google باسم ${result.email.split('@')[0]}`);
        } else {
            alert(result.error || 'فشل تسجيل الدخول بـ Google');
        }
    } catch (e) {
        console.error("Google access token verification error:", e);
        alert('خطأ في الاتصال بالسيرفر أثناء التحقق من حساب Google');
    }
}

async function verifyFacebookAccessToken(accessToken) {
    try {
        const res = await fetch('/api/auth/facebook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: accessToken })
        });
        const result = await res.json();
        if (res.ok) {
            state.sessionToken = result.token;
            state.userEmail = result.email;
            state.userRole = result.role;
            if (result.points !== undefined) state.userProfile.points = result.points;
            if (result.level !== undefined) state.userProfile.level = result.level;
            state.saveUserProfile();
            await state.fetchAndMergeSettings();
            state.showAuthModal = false;
            renderApp();
            alert(`أهلاً بك! تم تسجيل الدخول بنجاح عبر Facebook باسم ${result.email.split('@')[0]}`);
        } else {
            alert(result.error || 'فشل تسجيل الدخول بـ Facebook');
        }
    } catch (e) {
        console.error("Facebook access token verification error:", e);
        alert('خطأ في الاتصال بالسيرفر أثناء التحقق من حساب Facebook');
    }
}

function handleFacebookLoginClick() {
    if (typeof FB === 'undefined') {
        alert("مكتبة الفيسبوك لم يتم تحميلها بعد. يرجى المحاولة مرة أخرى.");
        return;
    }
    FB.login(function(response) {
        if (response.authResponse) {
            const accessToken = response.authResponse.accessToken;
            verifyFacebookAccessToken(accessToken);
        } else {
            console.log('User cancelled login or did not fully authorize.');
        }
    }, { scope: 'email' });
}

function initSocialAuths() {
    // 1. تهيئة Google Sign-In & One Tap
    googleTokenClient = null;
    if (isUsableGoogleClientId() && typeof google !== 'undefined') {
        try {
            google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: handleGoogleLogin,
                auto_select: false
            });
            
            // تفعيل Google One Tap تلقائياً عند فتح الموقع إذا لم يكن مسجلاً
            if (!state.sessionToken) {
                google.accounts.id.prompt();
            }
            
            // تهيئة عميل التوكن للزر المخصص
            googleTokenClient = google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: 'email profile',
                callback: async (tokenResponse) => {
                    if (tokenResponse.access_token) {
                        await verifyGoogleAccessToken(tokenResponse.access_token);
                    }
                }
            });
        } catch (err) {
            console.error("Error initializing Google Identity Services:", err);
        }
    }

    // 2. تهيئة Facebook SDK وتحميلها تلقائياً
    window.fbAsyncInit = function() {
        if (!isUsableFacebookAppId()) return;
        try {
            FB.init({
                appId      : FACEBOOK_APP_ID,
                cookie     : true,
                xfbml      : true,
                version    : 'v18.0'
            });
        } catch (e) {
            console.error("Facebook Init Error:", e);
        }
    };
    
    (function(d, s, id) {
        if (!isUsableFacebookAppId()) return;
        var js, fjs = d.getElementsByTagName(s)[0];
        if (d.getElementById(id)) return;
        js = d.createElement(s); js.id = id;
        js.src = "https://connect.facebook.net/en_US/sdk.js";
        fjs.parentNode.insertBefore(js, fjs);
    }(document, 'script', 'facebook-jssdk'));
}

// ==========================================
// 5. إدارة الأحداث والاتصال مع الـ DOM (Events Binding)
// ==========================================

function attachEventListeners() {
    // تفعيل شعار الموقع
    const logoBtn = document.getElementById('logo-btn');
    if (logoBtn) logoBtn.onclick = () => {
        state.searchQuery = '';
        state.activeGenre = 'الكل';
        navigate('home');
    };

    // روابط التنقل
    const navHome = document.getElementById('nav-home');
    if (navHome) navHome.onclick = () => {
        state.activeGenre = 'الكل';
        navigate('home');
    };

    const navBookmarks = document.getElementById('nav-bookmarks');
    if (navBookmarks) navBookmarks.onclick = () => {
        state.activeGenre = 'all';
        navigate('bookmarks');
    };

    const navDownloads = document.getElementById('nav-downloads');
    if (navDownloads) navDownloads.onclick = () => navigate('downloads');

    const navHistory = document.getElementById('nav-history');
    if (navHistory) navHistory.onclick = () => navigate('history');

    const navProfileBtn = document.getElementById('nav-profile-btn');
    if (navProfileBtn) navProfileBtn.onclick = () => {
        state.showSettingsModal = true;
        renderApp();
    };

    const closeAdminBtn = document.getElementById('close-admin-btn');
    if (closeAdminBtn) closeAdminBtn.onclick = () => navigate('home');

    const navAdmin = document.getElementById('nav-admin');
    if (navAdmin) navAdmin.onclick = () => navigate('admin');

    // شريط البحث ومقترحات البحث
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.onfocus = () => {
            if (state.searchQuery && state.searchQuery.trim() !== '' && !state.showSearchSuggestions) {
                state.showSearchSuggestions = true;
                renderApp();
                const newInput = document.getElementById('search-input');
                if (newInput) {
                    newInput.focus();
                    newInput.setSelectionRange(newInput.value.length, newInput.value.length);
                }
            }
        };

        searchInput.oninput = (e) => {
            state.searchQuery = e.target.value;
            state.showSearchSuggestions = e.target.value.trim() !== '';
            if (state.currentView !== 'home') {
                navigate('home');
            }
            renderApp();
            
            const newInput = document.getElementById('search-input');
            if (newInput) {
                newInput.focus();
                newInput.setSelectionRange(newInput.value.length, newInput.value.length);
            }
        };

        searchInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                state.showSearchSuggestions = false;
                renderApp();
            }
        };
    }

    // النقر على مقترح بحث
    const suggestionItems = document.querySelectorAll('.suggestion-item');
    suggestionItems.forEach(item => {
        item.onclick = (e) => {
            e.stopPropagation();
            const id = e.currentTarget.dataset.id;
            state.searchQuery = '';
            state.showSearchSuggestions = false;
            navigate('detail', id);
        };
    });


    // تصفية التصنيفات
    const genreTags = document.querySelectorAll('.genre-tag');
    genreTags.forEach(tag => {
        tag.onclick = (e) => {
            const genre = e.target.dataset.genre || e.target.textContent.trim();
            if (genre) {
                state.activeGenre = genre;
                if (state.currentView !== 'home') {
                    navigate('home');
                } else {
                    renderApp();
                }
                window.scrollTo(0, 0);
            }
        };
    });

    // السلايدر البانر
    const heroBtns = document.querySelectorAll('.read-now-hero');
    heroBtns.forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const id = e.target.dataset.id;
            navigate('detail', id);
        };
    });

    const dots = document.querySelectorAll('.slider-dot');
    dots.forEach(dot => {
        dot.onclick = (e) => {
            const idx = parseInt(e.target.dataset.index);
            const slides = document.querySelectorAll('.hero-slide');
            const sliderDots = document.querySelectorAll('.slider-dot');
            
            if (slides[activeSlideIndex] && sliderDots[activeSlideIndex]) {
                slides[activeSlideIndex].classList.remove('active');
                sliderDots[activeSlideIndex].classList.remove('active');
            }
            
            activeSlideIndex = idx;
            
            if (slides[activeSlideIndex] && sliderDots[activeSlideIndex]) {
                slides[activeSlideIndex].classList.add('active');
                sliderDots[activeSlideIndex].classList.add('active');
            }
            startSliderTimer();
        };
    });

    // الضغط على بطاقة مانجا لفتحها
    const mangaCards = document.querySelectorAll('.manga-card');
    mangaCards.forEach(card => {
        card.onclick = () => {
            const id = card.dataset.id;
            navigate('detail', id);
        };
    });

    // الضغط على سجلات القراءة لاستئناف القراءة
    const historyCards = document.querySelectorAll('.history-item-card');
    historyCards.forEach(card => {
        card.onclick = () => {
            const mId = card.dataset.mangaId;
            const cId = card.dataset.chapId;
            const scroll = parseFloat(card.dataset.scroll) || 0;
            const pageIdx = parseInt(card.dataset.page) || 0;

            state.activePageIndex = pageIdx;
            navigate('reader', mId, cId);
            
            setTimeout(() => {
                if (state.readerSettings.mode !== 'horizontal') {
                    window.scrollTo(0, scroll);
                }
            }, 650);
        };
    });

    // أحداث صفحة السجل التفصيلي: زر متابعة القراءة
    const resumeHistoryBtns = document.querySelectorAll('.resume-reading-history-btn');
    resumeHistoryBtns.forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const mId = btn.dataset.mangaId;
            const cId = btn.dataset.chapId;
            const scroll = parseFloat(btn.dataset.scroll) || 0;
            const pageIdx = parseInt(btn.dataset.page) || 0;

            state.activePageIndex = pageIdx;
            navigate('reader', mId, cId);
            
            setTimeout(() => {
                if (state.readerSettings.mode !== 'horizontal') {
                    window.scrollTo(0, scroll);
                }
            }, 650);
        };
    });

    // أحداث صفحة السجل التفصيلي: زر حذف عمل من السجل
    const deleteHistoryEntryBtns = document.querySelectorAll('.delete-history-entry-btn');
    deleteHistoryEntryBtns.forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const mId = btn.dataset.mangaId;
            if (confirm("هل تريد إزالة هذا العمل من سجل المشاهدة؟")) {
                state.history = state.history.filter(h => h.mangaId !== mId);
                state.saveHistory();
                renderApp();
            }
        };
    });

    // الضغط على الأكثر شعبية
    const trendingItems = document.querySelectorAll('.trending-item');
    trendingItems.forEach(item => {
        item.onclick = () => {
            const id = item.dataset.id;
            navigate('detail', id);
        };
    });

    // صفحة التفاصيل: حجز المفضلة
    const bookmarkPickers = document.querySelectorAll('.bookmark-picker');
    bookmarkPickers.forEach(picker => {
        const toggle = picker.querySelector('.bookmark-picker-toggle');
        const menu = picker.querySelector('.bookmark-picker-menu');
        if (!toggle || !menu) return;

        toggle.onclick = (e) => {
            e.stopPropagation();
            const isOpen = picker.classList.toggle('open');
            toggle.setAttribute('aria-expanded', String(isOpen));
            document.querySelectorAll('.bookmark-picker.open').forEach(other => {
                if (other !== picker) {
                    other.classList.remove('open');
                    const otherToggle = other.querySelector('.bookmark-picker-toggle');
                    if (otherToggle) otherToggle.setAttribute('aria-expanded', 'false');
                }
            });
        };

        menu.querySelectorAll('.bookmark-option').forEach(option => {
            option.onclick = (e) => {
                e.stopPropagation();
                setBookmarkStatus(picker.dataset.id, option.dataset.status || '');
                picker.classList.remove('open');
                toggle.setAttribute('aria-expanded', 'false');
                renderApp();
            };
        });
    });

    // صفحة التفاصيل: الضغط على قراءة أول فصل
    const startReadingBtn = document.querySelector('.start-reading-btn');
    if (startReadingBtn) {
        startReadingBtn.onclick = () => {
            const chapId = startReadingBtn.dataset.chapId;
            navigate('reader', state.activeMangaId, chapId);
        };
    }

    // صفحة التفاصيل: الضغط على متابعة القراءة
    const continueReadingBtn = document.querySelector('.continue-reading-btn');
    if (continueReadingBtn) {
        continueReadingBtn.onclick = () => {
            const chapId = continueReadingBtn.dataset.chapId;
            navigate('reader', state.activeMangaId, chapId);
        };
    }

    // صفحة التفاصيل: الضغط على فصل لقراءته
    const chapterItems = document.querySelectorAll('.chapter-item');
    chapterItems.forEach(item => {
        item.onclick = (e) => {
            if (e.target.closest('.download-btn') || e.target.closest('.delete-download-btn')) return;
            const chapId = item.dataset.chapId;
            const mId = item.dataset.mangaId || state.activeMangaId;
            navigate('reader', mId, chapId);
        };
    });

    // صفحة التفاصيل: البحث عن فصل
    const chaptersSearch = document.getElementById('chapters-search-input');
    if (chaptersSearch) {
        chaptersSearch.oninput = (e) => {
            state.chapterSearchQuery = e.target.value;
            renderApp();
            
            // استعادة التركيز وموضع المؤشر بعد إعادة الرندرة
            const input = document.getElementById('chapters-search-input');
            if (input) {
                input.focus();
                input.setSelectionRange(input.value.length, input.value.length);
            }
        };
    }

    // صفحة التفاصيل: زر تحميل الفصل للأوفلاين
    const downloadBtns = document.querySelectorAll('.download-btn');
    downloadBtns.forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const chapId = btn.dataset.chapId;
            const mangaId = state.activeMangaId;
            const key = `${mangaId}_${chapId}`;

            const isDownloaded = btn.classList.contains('downloaded');
            if (isDownloaded) {
                if (confirm("هل تريد إزالة هذا الفصل من قائمة التحميلات؟")) {
                    await deleteChapterOffline(mangaId, chapId);
                    renderApp();
                }
                return;
            }

            btn.classList.add('loading');
            btn.disabled = true;
            state.downloadProgress[key] = 0;
            
            const mangaObj = state.mangas.find(m => m.id === mangaId);
            const chapterObj = mangaObj.chapters.find(c => normalizeChapterId(c.id) === normalizeChapterId(chapId));

            const interval = setInterval(async () => {
                state.downloadProgress[key] += 25;
                renderApp();

                if (state.downloadProgress[key] >= 100) {
                    clearInterval(interval);
                    delete state.downloadProgress[key];
                    await saveChapterOffline(mangaId, chapId, chapterObj.images);
                    renderApp();
                }
            }, 250);
        };
    });

    // مركز التحميلات: حذف الفصل
    const deleteDownloadBtns = document.querySelectorAll('.delete-download-btn');
    deleteDownloadBtns.forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const mangaId = btn.dataset.mangaId;
            const chapId = btn.dataset.chapId;
            if (confirm("هل تريد إزالة هذا الفصل المحمل؟")) {
                await deleteChapterOffline(mangaId, chapId);
                renderApp();
            }
        };
    });

    // الإدارة: حذف منهوا (Admin Only)
    const deleteMangaBtns = document.querySelectorAll('.delete-manga-admin-btn');
    deleteMangaBtns.forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const mangaId = btn.dataset.id;
            if (!confirm("هل أنت متأكد من حذف هذه المنهوا بالكامل؟\nهذا الإجراء لا يمكن التراجع عنه.")) return;
            try {
                const response = await fetch('/api/delete_manga', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + state.sessionToken
                    },
                    body: JSON.stringify({ id: mangaId })
                });
                const result = await response.json();
                if (response.ok) {
                    state.mangas = state.mangas.filter(m => m.id !== mangaId);
                    state.deletedIds.add(mangaId);
                    localStorage.setItem('kairo_deleted_ids', JSON.stringify([...state.deletedIds]));
                    state.saveMangas();
                    navigate('home');
                } else {
                    alert(result.error || 'فشل الحذف');
                }
            } catch (err) {
                alert('خطأ في الاتصال بالخادم');
            }
        };
    });

    const editMangaBtns = document.querySelectorAll('.edit-manga-btn');
    editMangaBtns.forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const mangaId = btn.dataset.id;
            state.editMangaId = mangaId;
            navigate('admin');
            // Will be loaded when the edit panel renders
        };
    });

    // المفضلة: تبديل التبويبات
    const bookmarkTabs = document.querySelectorAll('.bookmark-tab');
    bookmarkTabs.forEach(tab => {
        tab.onclick = (e) => {
            state.activeGenre = e.target.dataset.tab;
            renderApp();
        };
    });

    // القارئ: العودة لصفحة تفاصيل المانجا
    const returnBtns = document.querySelectorAll('.return-to-manga');
    returnBtns.forEach(btn => {
        btn.onclick = () => {
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>جاري الرجوع...</span>';
            btn.style.pointerEvents = 'none';
            setTimeout(() => {
                navigate('detail', state.activeMangaId);
            }, 50);
        };
    });

    // القارئ: إدارة القائمة المنسدلة المخصصة للفصول
    const dropdown = document.getElementById('chapter-dropdown');
    const dropdownTrigger = document.querySelector('.dropdown-trigger');
    if (dropdown && dropdownTrigger) {
        dropdownTrigger.onclick = (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('open');
            const searchInput = document.getElementById('chapter-drop-search');
            if (dropdown.classList.contains('open') && searchInput) {
                searchInput.focus();
            }
        };

        // منع إغلاق القائمة عند الضغط داخل مربع البحث
        const searchInput = document.getElementById('chapter-drop-search');
        if (searchInput) {
            searchInput.onclick = (e) => e.stopPropagation();
            searchInput.oninput = (e) => {
                const query = e.target.value.trim().toLowerCase();
                const options = dropdown.querySelectorAll('.dropdown-item-opt');
                options.forEach(opt => {
                    const numText = opt.querySelector('.opt-num').textContent.toLowerCase();
                    const titleText = opt.querySelector('.opt-title') ? opt.querySelector('.opt-title').textContent.toLowerCase() : '';
                    if (numText.includes(query) || titleText.includes(query)) {
                        opt.style.display = 'flex';
                    } else {
                        opt.style.display = 'none';
                    }
                });
            };
        }

        // اختيار فصل من القائمة المخصصة
        const options = dropdown.querySelectorAll('.dropdown-item-opt');
        options.forEach(opt => {
            opt.onclick = (e) => {
                e.stopPropagation();
                const val = opt.dataset.value;
                dropdown.classList.remove('open');
                navigate('reader', state.activeMangaId, val);
            };
        });

        // إغلاق المنسدلة عند الضغط في أي مكان آخر بالصفحة
        document.addEventListener('click', (e) => {
            if (dropdown && !dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
            }
        });
    }

    // القارئ: الفصل السابق
    const prevBtns = document.querySelectorAll('.prev-chapter-btn');
    prevBtns.forEach(btn => {
        if (!btn.classList.contains('disabled')) {
            btn.onclick = () => {
                const manga = state.mangas.find(m => m.id === state.activeMangaId);
                const chapterIndex = manga.chapters.findIndex(c => normalizeChapterId(c.id) === normalizeChapterId(state.activeChapterId));
                if (chapterIndex < manga.chapters.length - 1) {
                    const prevChapId = manga.chapters[chapterIndex + 1].id;
                    navigate('reader', state.activeMangaId, prevChapId);
                    window.scrollTo(0, 0);
                }
            };
        }
    });

    // القارئ: الفصل التالي
    const nextBtns = document.querySelectorAll('.next-chapter-btn');
    nextBtns.forEach(btn => {
        if (!btn.classList.contains('disabled')) {
            btn.onclick = () => {
                const manga = state.mangas.find(m => m.id === state.activeMangaId);
                const chapterIndex = manga.chapters.findIndex(c => normalizeChapterId(c.id) === normalizeChapterId(state.activeChapterId));
                if (chapterIndex > 0) {
                    const nextChapId = manga.chapters[chapterIndex - 1].id;
                    navigate('reader', state.activeMangaId, nextChapId);
                    window.scrollTo(0, 0);
                }
            };
        }
    });

    // القارئ: ترجمة الفصل
    document.querySelectorAll('.translate-chapter-btn').forEach(btn => {
        btn.onclick = async function() {
            const url = this.dataset.url;
            const mangaId = this.dataset.mangaId;
            const chapterId = this.dataset.chapterId;
            this.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            this.disabled = true;
            try {
                const res = await fetch('/api/admin/auto-translate', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({url, manga_id: mangaId, chapter_id: chapterId})
                });
                const data = await res.json();
                if (data.status === 'queued') {
                    alert('تمت إضافة الفصل لطابور الترجمة');
                } else {
                    alert(data.error || 'فشلت الترجمة');
                }
            } catch (e) {
                alert('خطأ في الاتصال بالخادم');
            }
            this.innerHTML = '<i class="fa-solid fa-language"></i>';
            this.disabled = false;
        };
    });

    // --- التحميل التلقائي للفصل التالي عند التمرير (Infinite Scroll) ---
    var sentinel = document.getElementById('next-chapter-sentinel');
    if (sentinel && 'IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    observer.disconnect();
                    var manga = state.mangas.find(function(m) { return m.id === state.activeMangaId; });
                    if (!manga) return;
                    var chapterIndex = manga.chapters.findIndex(function(c) { return normalizeChapterId(c.id) === normalizeChapterId(state.activeChapterId); });
                    if (chapterIndex <= 0) return;
                    var nextChapId = manga.chapters[chapterIndex - 1].id;
                    navigate('reader', state.activeMangaId, nextChapId);
                }
            });
        }, { rootMargin: '400px' });
        observer.observe(sentinel);
    }

    // القارئ: فتح/إغلاق لوحة الإعدادات العائمة للتخصيص
    const settingsToggle = document.getElementById('settings-panel-toggle');
    const settingsPanel = document.getElementById('settings-panel');
    if (settingsToggle && settingsPanel) {
        settingsToggle.onclick = (e) => {
            e.stopPropagation();
            const isOpened = settingsPanel.style.display === 'flex';
            settingsPanel.style.display = isOpened ? 'none' : 'flex';
        };

        document.body.onclick = () => {
            settingsPanel.style.display = 'none';
        };
        settingsPanel.onclick = (e) => e.stopPropagation();
    }

    // القارئ: الضغط على خيارات التخصيص
    const settingPanelBtns = document.querySelectorAll('.setting-btn');
    settingPanelBtns.forEach(btn => {
        btn.onclick = (e) => {
            const settingName = btn.dataset.setting;
            const settingVal = btn.dataset.value;

            state.readerSettings[settingName] = settingVal;
            state.saveReaderSettings();
            
            if (settingName === 'mode') {
                state.activePageIndex = 0;
            }

            renderApp();
        };
    });

    // القارئ الأفقي: التنقل بين الصفحات
    const hPrevZone = document.getElementById('h-prev-zone');
    const hNextZone = document.getElementById('h-next-zone');
    if (hPrevZone && hNextZone) {
        const manga = state.mangas.find(m => m.id === state.activeMangaId);
        const chapter = manga.chapters.find(c => normalizeChapterId(c.id) === normalizeChapterId(state.activeChapterId));
        const totalPages = chapter.images.length;

        hPrevZone.onclick = (e) => {
            e.stopPropagation();
            if (state.activePageIndex > 0) {
                state.activePageIndex--;
                renderApp();
            } else {
                const chapterIndex = manga.chapters.findIndex(c => normalizeChapterId(c.id) === normalizeChapterId(state.activeChapterId));
                if (chapterIndex < manga.chapters.length - 1) {
                    const prevChapId = manga.chapters[chapterIndex + 1].id;
                    state.activePageIndex = 0;
                    navigate('reader', state.activeMangaId, prevChapId);
                } else {
                    alert("أنت في أول صفحة في أول فصل!");
                }
            }
        };

        hNextZone.onclick = (e) => {
            e.stopPropagation();
            if (state.activePageIndex < totalPages - 1) {
                state.activePageIndex++;
                renderApp();
            } else {
                const chapterIndex = manga.chapters.findIndex(c => normalizeChapterId(c.id) === normalizeChapterId(state.activeChapterId));
                if (chapterIndex > 0) {
                    const nextChapId = manga.chapters[chapterIndex - 1].id;
                    state.activePageIndex = 0;
                    navigate('reader', state.activeMangaId, nextChapId);
                } else {
                    alert("لقد وصلت لآخر صفحة في آخر فصل متاح!");
                }
            }
        };
    }

    // القارئ: زر الإعجاب بالفصل
    const chapterLikeBtn = document.getElementById('chapter-like-btn');
    if (chapterLikeBtn) {
        chapterLikeBtn.onclick = () => {
            const isLiked = state.toggleLike(state.activeMangaId, state.activeChapterId);
            const icon = chapterLikeBtn.querySelector('i');
            const text = document.getElementById('like-text');

            if (isLiked) {
                chapterLikeBtn.classList.add('liked');
                icon.className = 'fa-solid fa-heart';
                text.innerText = 'أعجبني هذا الفصل!';
            } else {
                chapterLikeBtn.classList.remove('liked');
                icon.className = 'fa-regular fa-heart';
                text.innerText = 'أعجبني';
            }
        };
    }

    // الإدارة: تبديل التبويبات وتفعيل التبويب المختار
    const tabAddManga = document.getElementById('tab-add-manga');
    const tabAddChapter = document.getElementById('tab-add-chapter');
    const tabEditManga = document.getElementById('tab-edit-manga');
    const tabSuggestions = document.getElementById('tab-suggestions');
    const tabSiteSettings = document.getElementById('tab-site-settings');
    const tabAltSources = document.getElementById('tab-alt-sources');

    const panelManga = document.getElementById('panel-add-manga');
    const panelChapter = document.getElementById('panel-add-chapter');
    const panelEditManga = document.getElementById('panel-edit-manga');
    const panelSuggestions = document.getElementById('panel-suggestions');
    const panelSiteSettings = document.getElementById('panel-site-settings');
    const panelAltSources = document.getElementById('panel-alt-sources');

    function hideAllAdminPanels() {
        if (panelManga) panelManga.style.display = 'none';
        if (panelChapter) panelChapter.style.display = 'none';
        if (panelEditManga) panelEditManga.style.display = 'none';
        if (panelSuggestions) panelSuggestions.style.display = 'none';
        if (panelSiteSettings) panelSiteSettings.style.display = 'none';
        if (panelAltSources) panelAltSources.style.display = 'none';
        if (tabAddManga) tabAddManga.classList.remove('active');
        if (tabAddChapter) tabAddChapter.classList.remove('active');
        if (tabEditManga) tabEditManga.classList.remove('active');
        if (tabSuggestions) tabSuggestions.classList.remove('active');
        if (tabSiteSettings) tabSiteSettings.classList.remove('active');
        if (tabAltSources) tabAltSources.classList.remove('active');
    }

    if (tabAddManga) {
        tabAddManga.onclick = () => {
            hideAllAdminPanels();
            tabAddManga.classList.add('active');
            if (panelManga) panelManga.style.display = 'block';
        };
    }

    if (tabAddChapter) {
        tabAddChapter.onclick = () => {
            hideAllAdminPanels();
            tabAddChapter.classList.add('active');
            if (panelChapter) panelChapter.style.display = 'block';
        };
    }

    if (tabEditManga) {
        tabEditManga.onclick = () => {
            hideAllAdminPanels();
            tabEditManga.classList.add('active');
            if (panelEditManga) panelEditManga.style.display = 'block';
            loadEditMangaData();
        };
    }

    if (tabSuggestions) {
        tabSuggestions.onclick = () => {
            hideAllAdminPanels();
            tabSuggestions.classList.add('active');
            if (panelSuggestions) panelSuggestions.style.display = 'block';
            loadAdminSuggestions();
        };
    }

    if (tabSiteSettings) {
        tabSiteSettings.onclick = () => {
            hideAllAdminPanels();
            tabSiteSettings.classList.add('active');
            if (panelSiteSettings) panelSiteSettings.style.display = 'block';
            loadAdminConfig();
        };
    }

    if (tabAltSources) {
        tabAltSources.onclick = () => {
            hideAllAdminPanels();
            tabAltSources.classList.add('active');
            if (panelAltSources) panelAltSources.style.display = 'block';
        };
    }

    // Admin: Date filter buttons
    const btnApplyFilter = document.getElementById('btn-admin-apply-filter');
    const btnClearFilter = document.getElementById('btn-admin-clear-filter');
    const btnExportCsv = document.getElementById('btn-admin-export-csv');
    const btnExportJson = document.getElementById('btn-admin-export-json');
    
    if (btnApplyFilter) {
        btnApplyFilter.onclick = () => {
            const from = document.getElementById('admin-date-from').value;
            const to = document.getElementById('admin-date-to').value;
            if (!from || !to) return;
            state.adminDateFrom = from;
            state.adminDateTo = to;
            state.adminStats = null;
            loadAdminStats();
        };
    }
    
    if (btnClearFilter) {
        btnClearFilter.onclick = () => {
            state.adminDateFrom = '';
            state.adminDateTo = '';
            state.adminStats = null;
            loadAdminStats();
        };
    }
    
    if (btnExportCsv) {
        btnExportCsv.onclick = () => {
            const token = state.sessionToken;
            if (!token) return;
            const a = document.createElement('a');
            a.href = '/api/admin/stats/export?format=csv';
            a.download = 'kairo_stats_export.csv';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };
    }
    
    if (btnExportJson) {
        btnExportJson.onclick = () => {
            const token = state.sessionToken;
            if (!token) return;
            const a = document.createElement('a');
            a.href = '/api/admin/stats/export?format=json';
            a.download = 'kairo_stats_export.json';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };
    }

    // الإدارة: إرسال نموذج مانجا
    const addMangaForm = document.getElementById('add-manga-form');
    if (addMangaForm) {
        addMangaForm.onsubmit = (e) => {
            e.preventDefault();
            const title = document.getElementById('manga-title').value;
            const alt = document.getElementById('manga-alt').value;
            const author = document.getElementById('manga-author').value;
            const cover = document.getElementById('manga-cover').value;
            const banner = document.getElementById('manga-banner').value;
            const genres = document.getElementById('manga-genres').value;
            const synopsis = document.getElementById('manga-synopsis').value;
            const type = document.getElementById('manga-type').value;

            state.addManga(title, alt, author, cover, banner, genres, synopsis, type);
            alert("تم إدراج العمل الفني بنجاح!");
            addMangaForm.reset();
            navigate('home');
        };
    }

    // الإدارة: إرسال نموذج فصل
    const addChapterForm = document.getElementById('add-chapter-form');
    if (addChapterForm) {
        addChapterForm.onsubmit = (e) => {
            e.preventDefault();
            const mangaId = document.getElementById('chap-manga-id').value;
            const chapterNo = document.getElementById('chap-number').value;
            const title = document.getElementById('chap-title').value;
            const images = document.getElementById('chap-images').value;

            state.addChapter(mangaId, title, chapterNo, images);
            alert(`تم رفع ونشر الفصل ${chapterNo} بنجاح!`);
            addChapterForm.reset();
            navigate('detail', mangaId);
        };
    }

    // الشكاوى والاقتراحات: فتح وإغلاق النافذة
    const openSuggestionsBtn = document.getElementById('open-suggestions-btn');
    if (openSuggestionsBtn) {
        openSuggestionsBtn.onclick = () => {
            if (!state.sessionToken) {
                alert("الرجاء تسجيل الدخول أولاً لتتمكن من تقديم اقتراح أو شكوى.");
                state.showAuthModal = true;
                state.authModalTab = 'login';
                renderApp();
            } else {
                state.showSuggestionsModal = true;
                state.suggestionsError = '';
                state.suggestionsSuccess = '';
                renderApp();
            }
        };
    }

    const closeSuggestionsBtn = document.getElementById('close-suggestions-modal');
    if (closeSuggestionsBtn) {
        closeSuggestionsBtn.onclick = () => {
            state.showSuggestionsModal = false;
            renderApp();
        };
    }

    // الشكاوى والاقتراحات: نموذج الإرسال
    const suggestionsForm = document.getElementById('suggestions-form');
    if (suggestionsForm) {
        suggestionsForm.onsubmit = async (e) => {
            e.preventDefault();
            const sugType = suggestionsForm.querySelector('input[name="sug-type"]:checked').value;
            const content = document.getElementById('sug-content').value;
            const errorMsg = document.getElementById('sug-error-msg');
            const successMsg = document.getElementById('sug-success-msg');
            
            errorMsg.style.display = 'none';
            successMsg.style.display = 'none';
            
            try {
                const response = await fetch('/api/suggestions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${state.sessionToken}`
                    },
                    body: JSON.stringify({ type: sugType, content: content })
                });
                const result = await response.json();
                if (response.ok) {
                    successMsg.innerText = result.message;
                    successMsg.style.display = 'block';
                    suggestionsForm.reset();
                    setTimeout(() => {
                        state.showSuggestionsModal = false;
                        renderApp();
                    }, 1500);
                } else {
                    errorMsg.innerText = result.error || 'حدث خطأ ما';
                    errorMsg.style.display = 'block';
                }
            } catch (err) {
                errorMsg.innerText = 'خطأ في الاتصال بالخادم';
                errorMsg.style.display = 'block';
            }
        };
    }

    // التوثيق: فتح النافذة المنبثقة
    const openLoginBtn = document.getElementById('open-login-btn');
    if (openLoginBtn) {
        openLoginBtn.onclick = () => {
            state.showAuthModal = true;
            state.authModalTab = 'login';
            renderApp();
        };
    }
    
    const reviewsLoginBtn = document.getElementById('review-auth-prompt-btn');
    if (reviewsLoginBtn) {
        reviewsLoginBtn.onclick = () => {
            state.showAuthModal = true;
            state.authModalTab = 'login';
            renderApp();
        };
    }
    
    const commentsLoginBtn = document.getElementById('comment-auth-prompt-btn');
    if (commentsLoginBtn) {
        commentsLoginBtn.onclick = () => {
            state.showAuthModal = true;
            state.authModalTab = 'login';
            renderApp();
        };
    }

    // التوثيق: تبديل التبويبات
    const authTabLogin = document.getElementById('auth-tab-login');
    const authTabRegister = document.getElementById('auth-tab-register');
    if (authTabLogin) {
        authTabLogin.onclick = () => {
            state.authModalTab = 'login';
            renderApp();
        };
    }
    if (authTabRegister) {
        authTabRegister.onclick = () => {
            state.authModalTab = 'register';
            renderApp();
        };
    }

    // التوثيق: إغلاق النافذة
    const closeAuthBtn = document.getElementById('close-auth-modal');
    if (closeAuthBtn) {
        closeAuthBtn.onclick = () => {
            state.showAuthModal = false;
            renderApp();
        };
    }
    
    const authOverlay = document.getElementById('auth-modal-overlay');
    if (authOverlay) {
        authOverlay.onclick = (e) => {
            if (e.target === authOverlay) {
                state.showAuthModal = false;
                renderApp();
            }
        };
    }
    
    // التوثيق: تسجيل الدخول الاجتماعي عبر الأزرار
    const googleLoginBtn = document.getElementById('google-login-btn');
    if (googleLoginBtn) {
        googleLoginBtn.onclick = () => {
            if (!isUsableGoogleClientId()) {
                alert("⚠️ لم يتم تكوين Google Client ID بعد.\n\nيرجى تسجيل الدخول كمسؤول ثم الذهاب إلى (لوحة الإدارة ← إعدادات الموقع) لتحديث المعرّف الفعلي لتفعيل تسجيل الدخول بجوجل.");
                return;
            }
            if (typeof google !== 'undefined' && googleTokenClient) {
                googleTokenClient.requestAccessToken();
            } else {
                alert("مكتبة جوجل لم يتم تحميلها بعد أو المعرّف غير صحيح. يرجى المحاولة لاحقاً.");
            }
        };
    }

    const facebookLoginBtn = document.getElementById('facebook-login-btn');
    if (facebookLoginBtn) {
        facebookLoginBtn.onclick = () => {
            if (!isUsableFacebookAppId()) {
                alert("⚠️ لم يتم تكوين Facebook App ID بعد.\n\nيرجى تسجيل الدخول كمسؤول ثم الذهاب إلى (لوحة الإدارة ← إعدادات الموقع) لتحديث المعرّف الفعلي لتفعيل تسجيل الدخول بفيسبوك.");
                return;
            }
            handleFacebookLoginClick();
        };
    }
    
    const sugOverlay = document.getElementById('suggestions-modal-overlay');
    if (sugOverlay) {
        sugOverlay.onclick = (e) => {
            if (e.target === sugOverlay) {
                state.showSuggestionsModal = false;
                renderApp();
            }
        };
    }

    const closeSettingsBtn = document.getElementById('close-settings-modal');
    if (closeSettingsBtn) {
        closeSettingsBtn.onclick = () => {
            state.showSettingsModal = false;
            renderApp();
        };
    }

    const settingsOverlay = document.getElementById('settings-modal-overlay');
    if (settingsOverlay) {
        settingsOverlay.onclick = (e) => {
            if (e.target === settingsOverlay) {
                state.showSettingsModal = false;
                renderApp();
            }
        };
    }

    const forgotTrigger = document.getElementById('forgot-password-trigger');
    if (forgotTrigger) {
        forgotTrigger.onclick = () => {
            state.authModalTab = 'forgot';
            renderApp();
        };
    }

    const backToLoginBtn = document.getElementById('back-to-login-btn');
    if (backToLoginBtn) {
        backToLoginBtn.onclick = () => {
            state.authModalTab = 'login';
            renderApp();
        };
    }

    const forgotPasswordForm = document.getElementById('forgot-password-form');
    if (forgotPasswordForm) {
        forgotPasswordForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('forgot-email').value;
            const errorMsg = document.getElementById('forgot-error-msg');
            const successMsg = document.getElementById('forgot-success-msg');
            
            errorMsg.style.display = 'none';
            successMsg.style.display = 'none';
            
            try {
                const response = await fetch('/api/auth/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const result = await response.json();
                if (response.ok) {
                    successMsg.innerText = result.message || 'تم إرسال رابط استعادة كلمة المرور!';
                    successMsg.style.display = 'block';
                } else {
                    errorMsg.innerText = result.error || 'فشل إرسال الطلب';
                    errorMsg.style.display = 'block';
                }
            } catch (err) {
                errorMsg.innerText = 'خطأ في الاتصال بالخادم';
                errorMsg.style.display = 'block';
            }
        };
    }

    const resetPasswordForm = document.getElementById('reset-password-form');
    if (resetPasswordForm) {
        resetPasswordForm.onsubmit = async (e) => {
            e.preventDefault();
            const newPass = document.getElementById('reset-new-pass').value;
            const confirmPass = document.getElementById('reset-confirm-pass').value;
            const errorMsg = document.getElementById('reset-error-msg');
            const successMsg = document.getElementById('reset-success-msg');
            
            errorMsg.style.display = 'none';
            successMsg.style.display = 'none';
            
            if (newPass.length < 6) {
                errorMsg.innerText = 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل';
                errorMsg.style.display = 'block';
                return;
            }
            if (newPass !== confirmPass) {
                errorMsg.innerText = 'كلمتا المرور غير متطابقتين';
                errorMsg.style.display = 'block';
                return;
            }
            
            try {
                const response = await fetch('/api/auth/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token: state.resetPasswordToken,
                        password: newPass
                    })
                });
                const result = await response.json();
                if (response.ok) {
                    successMsg.innerText = 'تم تحديث كلمة المرور بنجاح! سيتم توجيهك الآن لتسجيل الدخول.';
                    successMsg.style.display = 'block';
                    setTimeout(() => {
                        state.showAuthModal = true;
                        state.authModalTab = 'login';
                        navigate('home');
                    }, 2000);
                } else {
                    errorMsg.innerText = result.error || 'فشل تحديث كلمة المرور';
                    errorMsg.style.display = 'block';
                }
            } catch (err) {
                errorMsg.innerText = 'خطأ في الاتصال بالخادم';
                errorMsg.style.display = 'block';
            }
        };
    }

    // التوثيق: إرسال نموذج الدخول/التسجيل
    const authForm = document.getElementById('auth-form');
    if (authForm) {
        authForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('auth-email').value;
            const password = document.getElementById('auth-password').value;
            const errorMsg = document.getElementById('auth-error-msg');
            const successMsg = document.getElementById('auth-success-msg');
            
            errorMsg.style.display = 'none';
            successMsg.style.display = 'none';
            
            const endpoint = state.authModalTab === 'login' ? '/api/login' : '/api/register';
            try {
                const response = await fetch(`${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const result = await response.json();
                if (response.ok) {
                    if (state.authModalTab === 'login') {
                        state.sessionToken = result.token;
                        state.userEmail = result.email;
                        state.userRole = result.role;
                        if (result.points !== undefined) state.userProfile.points = result.points;
                        if (result.level !== undefined) state.userProfile.level = result.level;
                        state.saveUserProfile();
                        successMsg.innerText = 'تم تسجيل الدخول بنجاح!';
                        successMsg.style.display = 'block';
                        await state.fetchAndMergeSettings();
                        setTimeout(() => {
                            state.showAuthModal = false;
                            renderApp();
                        }, 1200);
                    } else {
                        if (result.token) {
                            state.sessionToken = result.token;
                            state.userEmail = result.email;
                            state.userRole = result.role;
                            if (result.points !== undefined) state.userProfile.points = result.points;
                            if (result.level !== undefined) state.userProfile.level = result.level;
                            state.saveUserProfile();
                            successMsg.innerText = 'تم إنشاء الحساب بنجاح! جاري تسجيل الدخول...';
                            successMsg.style.display = 'block';
                            setTimeout(async () => {
                                await state.fetchAndMergeSettings();
                                state.showAuthModal = false;
                                renderApp();
                            }, 1200);
                        } else {
                            successMsg.innerText = result.message || 'تم إنشاء الحساب بنجاح، يمكنك الآن تسجيل الدخول';
                            successMsg.style.display = 'block';
                            setTimeout(() => {
                                state.authModalTab = 'login';
                                renderApp();
                            }, 1500);
                        }
                    }
                } else {
                    errorMsg.innerText = result.error || 'حدث خطأ ما';
                    errorMsg.style.display = 'block';
                }
            } catch (err) {
                errorMsg.innerText = 'خطأ في الاتصال بالسيرفر';
                errorMsg.style.display = 'block';
            }
        };
    }

    // التوثيق: تسجيل الخروج
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            if (confirm("هل تريد تسجيل الخروج؟")) {
                try {
                    await fetch('/api/logout', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${state.sessionToken}` }
                    });
                } catch(e){}
                state.sessionToken = null;
                state.userEmail = null;
                state.userRole = null;
                state.saveUserProfile();
                localStorage.removeItem('kairo_bookmarks');
                localStorage.removeItem('kairo_history');
                localStorage.removeItem('kairo_progress');
                localStorage.removeItem('kairo_likes');
                localStorage.removeItem('kairo_comments');
                location.reload();
            }
        };
    }

    // مراجعات المنهوا: النجوم التفاعلية وإرسال المراجعة
    const starOpts = document.querySelectorAll('.star-opt');
    let chosenRating = 5;
    if (starOpts.length > 0) {
        const currentRatingVal = document.getElementById('manga-selected-rating-val');
        if (currentRatingVal) {
            chosenRating = parseInt(currentRatingVal.innerText.split(' ')[0]) || 5;
        }
        
        starOpts.forEach(star => {
            star.onclick = () => {
                const rating = parseInt(star.dataset.rating);
                chosenRating = rating;
                document.getElementById('manga-selected-rating-val').innerText = `${rating} / 5`;
                starOpts.forEach((s, idx) => {
                    if (idx < rating) {
                        s.className = 'fa-solid fa-star star-opt';
                    } else {
                        s.className = 'fa-regular fa-star star-opt';
                    }
                });
            };
        });
    }
    
    const submitReviewBtn = document.getElementById('submit-manga-review-btn');
    if (submitReviewBtn) {
        submitReviewBtn.onclick = async () => {
            const reviewText = document.getElementById('manga-review-text').value;
            try {
                const response = await fetch('/api/manga_reviews', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${state.sessionToken}`
                    },
                    body: JSON.stringify({
                        manga_id: state.activeMangaId,
                        rating: chosenRating,
                        review_text: reviewText
                    })
                });
                const result = await response.json();
                if (response.ok) {
                    alert(result.message);
                    renderApp();
                } else {
                    alert(result.error);
                }
            } catch (err) {
                alert("خطأ في الاتصال بالخادم");
            }
        };
    }

    // التعليق على الفصول: إرسال التعليق للسيرفر
    const chapterCommentForm = document.getElementById('chapter-comment-form');
    if (chapterCommentForm) {
        chapterCommentForm.onsubmit = async (e) => {
            e.preventDefault();
            const text = document.getElementById('chapter-comment-text').value;
            try {
                const response = await fetch('/api/chapter_comments', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${state.sessionToken}`
                    },
                    body: JSON.stringify({
                        manga_id: state.activeMangaId,
                        chapter_id: state.activeChapterId,
                        comment_text: text
                    })
                });
                const result = await response.json();
                if (response.ok) {
                    document.getElementById('chapter-comment-text').value = '';
                    renderApp();
                } else {
                    alert(result.error);
                }
            } catch (err) {
                alert("خطأ في الاتصال بالخادم");
            }
        };
    }

    // الإدارة: حفظ إعدادات الموقع ديناميكياً
    const siteSettingsForm = document.getElementById('site-settings-form');
    if (siteSettingsForm) {
        siteSettingsForm.onsubmit = async (e) => {
            e.preventDefault();
            const googleId = document.getElementById('setting-google-id')?.value.trim() || '';
            const facebookId = document.getElementById('setting-facebook-id')?.value.trim() || '';
            const smtpHost = document.getElementById('setting-smtp-host')?.value.trim() || '';
            const smtpPort = document.getElementById('setting-smtp-port')?.value.trim() || '';
            const smtpUser = document.getElementById('setting-smtp-user')?.value.trim() || '';
            const smtpPass = document.getElementById('setting-smtp-pass')?.value.trim() || '';
            const smtpSender = document.getElementById('setting-smtp-sender')?.value.trim() || '';
            
            try {
                const response = await fetch('/api/admin/config', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${state.sessionToken}`
                    },
                    body: JSON.stringify({
                        google_client_id: googleId,
                        facebook_app_id: facebookId,
                        smtp_host: smtpHost,
                        smtp_port: smtpPort,
                        smtp_user: smtpUser,
                        smtp_pass: smtpPass,
                        smtp_sender: smtpSender
                    })
                });
                const result = await response.json();
                if (response.ok) {
                    GOOGLE_CLIENT_ID = googleId;
                    FACEBOOK_APP_ID = facebookId;
                    state.adminConfig = {
                        google_client_id: googleId,
                        facebook_app_id: facebookId,
                        smtp_host: smtpHost,
                        smtp_port: smtpPort,
                        smtp_user: smtpUser,
                        smtp_pass: smtpPass,
                        smtp_sender: smtpSender
                    };
                    alert("تم حفظ إعدادات الموقع بنجاح!");
                    initSocialAuths();
                    renderApp();
                } else {
                    alert(result.error || "فشل حفظ الإعدادات");
                }
            } catch (err) {
                alert("خطأ في الاتصال بالخادم أثناء حفظ الإعدادات");
            }
        };
    }

    // الإدارة: البحث عن مصادر بديلة
    const altSourceForm = document.getElementById('alt-source-form');
    if (altSourceForm) {
        altSourceForm.onsubmit = async (e) => {
            e.preventDefault();
            const mangaId = document.getElementById('alt-manga-id')?.value;
            if (!mangaId) return;
            const resultsDiv = document.getElementById('alt-source-results');
            if (resultsDiv) resultsDiv.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-dark);"><i class="fa-solid fa-spinner fa-spin"></i> جاري البحث...</p>';
            try {
                const resp = await fetch('/api/admin/find-alternative-sources', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${state.sessionToken}`},
                    body: JSON.stringify({manga_id: mangaId})
                });
                const data = await resp.json();
                if (!resp.ok || !data.results || data.results.length === 0) {
                    if (resultsDiv) resultsDiv.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-dark);">لم نعثر على مصادر بديلة.</p>';
                    return;
                }
                let html = '<h3 style="color:var(--text-main);margin-bottom:16px;">المصادر البديلة المتاحة:</h3>';
                data.results.forEach(r => {
                    html += `
                    <div style="padding:16px;border:1px solid var(--border-color);border-radius:var(--border-radius-md);margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <strong style="color:var(--text-main);">${r.title}</strong>
                            <span style="display:block;font-size:0.85rem;color:var(--text-dark);">المصدر: ${r.source} • ${r.chapters ? r.chapters.length + ' فصل' : ''}</span>
                        </div>
                        <button class="admin-submit-btn link-alt-source-btn" style="padding:8px 16px;font-size:0.85rem;" data-manga-id="${mangaId}" data-source="${r.source}" data-url="${r.url}">
                            <i class="fa-solid fa-link"></i> ربط
                        </button>
                    </div>`;
                });
                if (resultsDiv) resultsDiv.innerHTML = html;
                // Attach link buttons
                document.querySelectorAll('.link-alt-source-btn').forEach(btn => {
                    btn.onclick = async () => {
                        const mid = btn.dataset.mangaId;
                        const src = btn.dataset.source;
                        const url = btn.dataset.url;
                        try {
                            const lresp = await fetch('/api/admin/link-alternative-source', {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${state.sessionToken}`},
                                body: JSON.stringify({manga_id: mid, source: src, source_url: url})
                            });
                            const ldata = await lresp.json();
                            alert(ldata.error || 'تم ربط المصدر البديل بنجاح!');
                            if (lresp.ok) btn.disabled = true;
                        } catch (err) {
                            alert('خطأ في الاتصال');
                        }
                    };
                });
            } catch (err) {
                if (resultsDiv) resultsDiv.innerHTML = '<p style="text-align:center;padding:20px;color:#ff007f;">خطأ في الاتصال بالخادم.</p>';
            }
        };
    }

    // إعدادات المستخدم: حفظ اسم المستخدم
    const btnSaveUsername = document.getElementById('btn-save-username');
    if (btnSaveUsername) {
        btnSaveUsername.onclick = async () => {
            const input = document.getElementById('settings-new-username');
            const msg = document.getElementById('username-msg');
            const username = input.value.trim();
            if (!username || username.length < 2) {
                msg.innerHTML = '<span style="color:#ff007f;">اسم المستخدم يجب أن يكون حرفين على الأقل</span>';
                return;
            }
            msg.innerHTML = '<span style="color:var(--text-muted);">جاري الحفظ...</span>';
            try {
                const res = await fetch('/api/auth/change-username', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${state.sessionToken}`},
                    body: JSON.stringify({ username })
                });
                const data = await res.json();
                if (res.ok) {
                    state.userProfile.username = username;
                    state.saveUserProfile();
                    msg.innerHTML = '<span style="color:#00ff7f;">تم تحديث اسم المستخدم بنجاح</span>';
                } else {
                    msg.innerHTML = `<span style="color:#ff007f;">${data.error || 'فشل التحديث'}</span>`;
                }
            } catch (err) {
                msg.innerHTML = '<span style="color:#ff007f;">خطأ في الاتصال بالخادم</span>';
            }
        };
    }

    // إعدادات المستخدم: تغيير كلمة المرور
    const btnSavePassword = document.getElementById('btn-save-password');
    if (btnSavePassword) {
        btnSavePassword.onclick = async () => {
            const currentPass = document.getElementById('settings-current-password');
            const newPass = document.getElementById('settings-new-password');
            const msg = document.getElementById('password-msg');
            if (!currentPass.value) {
                msg.innerHTML = '<span style="color:#ff007f;">الرجاء إدخال كلمة المرور الحالية</span>';
                return;
            }
            if (!newPass.value || newPass.value.length < 6) {
                msg.innerHTML = '<span style="color:#ff007f;">كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل</span>';
                return;
            }
            msg.innerHTML = '<span style="color:var(--text-muted);">جاري الحفظ...</span>';
            try {
                const res = await fetch('/api/auth/change-password', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${state.sessionToken}`},
                    body: JSON.stringify({ current_password: currentPass.value, new_password: newPass.value })
                });
                const data = await res.json();
                if (res.ok) {
                    msg.innerHTML = '<span style="color:#00ff7f;">تم تغيير كلمة المرور بنجاح</span>';
                    currentPass.value = '';
                    newPass.value = '';
                } else {
                    msg.innerHTML = `<span style="color:#ff007f;">${data.error || 'فشل التغيير'}</span>`;
                }
            } catch (err) {
                msg.innerHTML = '<span style="color:#ff007f;">خطأ في الاتصال بالخادم</span>';
            }
        };
    }

    // الإدارة: تحميل بيانات المنهوا في نموذج التعديل عند اختيارها
    const editMangaSelect = document.getElementById('edit-manga-id');
    if (editMangaSelect) {
        editMangaSelect.onchange = () => {
            const mangaId = editMangaSelect.value;
            if (!mangaId) {
                document.getElementById('edit-manga-fields').style.display = 'none';
                return;
            }
            const manga = state.mangas.find(m => m.id === mangaId);
            if (!manga) return;
            document.getElementById('edit-manga-cover').value = manga.cover || '';
            document.getElementById('edit-manga-genres').value = (Array.isArray(manga.genres) ? manga.genres.join('، ') : manga.genres || '');
            document.getElementById('edit-manga-title').value = manga.title || '';
            document.getElementById('edit-manga-alt').value = manga.alternative || '';
            document.getElementById('edit-manga-author').value = manga.author || '';
            document.getElementById('edit-manga-synopsis').value = manga.synopsis || '';
            const statusMap = { 'Ongoing': 'مستمر', 'مستمر': 'مستمر', 'Completed': 'مكتمل', 'مكتمل': 'مكتمل', 'متوقف': 'متوقف' };
            const statusSelect = document.getElementById('edit-manga-status');
            statusSelect.value = statusMap[manga.status] || 'مستمر';
            document.getElementById('edit-manga-fields').style.display = 'block';
            document.getElementById('edit-manga-msg').innerHTML = '';
        };
    }

    // الإدارة: حفظ تعديلات المنهوا
    const editMangaForm = document.getElementById('edit-manga-form');
    if (editMangaForm) {
        editMangaForm.onsubmit = async (e) => {
            e.preventDefault();
            const mangaId = document.getElementById('edit-manga-id').value;
            if (!mangaId) return;
            const msg = document.getElementById('edit-manga-msg');
            msg.innerHTML = '<span style="color:var(--text-muted);">جاري الحفظ...</span>';
            try {
                const manga = state.mangas.find(m => m.id === mangaId);
                if (!manga) {
                    msg.innerHTML = '<span style="color:#ff007f;">المنهوا غير موجودة</span>';
                    return;
                }
                const updated = { ...manga };
                updated.cover = document.getElementById('edit-manga-cover').value || manga.cover;
                const genresRaw = document.getElementById('edit-manga-genres').value;
                updated.genres = genresRaw ? genresRaw.split(/[,\u060C]+/).map(g => g.trim()).filter(g => g) : manga.genres;
                updated.title = document.getElementById('edit-manga-title').value || manga.title;
                updated.alternative = document.getElementById('edit-manga-alt').value || manga.alternative || '';
                updated.author = document.getElementById('edit-manga-author').value || manga.author;
                updated.synopsis = document.getElementById('edit-manga-synopsis').value || manga.synopsis || '';
                const statusSelect = document.getElementById('edit-manga-status');
                const statusMapRev = { 'مستمر': 'Ongoing', 'مكتمل': 'Completed', 'متوقف': 'Hiatus' };
                updated.status = statusMapRev[statusSelect.value] || manga.status;

                const res = await fetch('/api/save_manga', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${state.sessionToken}`},
                    body: JSON.stringify(updated)
                });
                if (res.ok) {
                    msg.innerHTML = '<span style="color:#00ff7f;">تم حفظ التعديلات بنجاح! سيتم التحديث بعد إعادة تحميل الصفحة.</span>';
                    const idx = state.mangas.findIndex(m => m.id === mangaId);
                    if (idx !== -1) state.mangas[idx] = updated;
                    state.saveMangas();
                } else {
                    const errData = await res.json();
                    msg.innerHTML = `<span style="color:#ff007f;">${errData.error || 'فشل الحفظ'}</span>`;
                }
            } catch (err) {
                msg.innerHTML = '<span style="color:#ff007f;">خطأ في الاتصال بالخادم</span>';
            }
        };
    }
}

// ==========================================
// 5.5. دوال مساعدة للإدارة
// ==========================================

function loadEditMangaData() {
    const select = document.getElementById('edit-manga-id');
    if (!select) return;
    if (state.editMangaId) {
        select.value = state.editMangaId;
        select.dispatchEvent(new Event('change'));
        state.editMangaId = null;
    } else if (select.value) {
        // Already selected, re-trigger load
        select.dispatchEvent(new Event('change'));
    }
}

// ==========================================
// 6. تشغيل القارئ والتحميل الكسول
// ==========================================

function loadSingleImage(container, src) {
    var retries = parseInt(container.dataset.retries || '0', 10);
    if (retries >= 2) {
        showImageError(container, src, true);
        return;
    }
    var img = document.createElement('img');
    img.src = src;
    img.onload = function() {
        container.innerHTML = '';
        container.appendChild(img);
    };
    img.onerror = function() {
        container.dataset.retries = String(retries + 1);
        if (src && src.startsWith('/proxy-image?url=')) {
            var originalUrl = decodeURIComponent(src.split('?url=')[1]);
            loadSingleImage(container, originalUrl);
        } else {
            showImageError(container, src, false);
        }
    };
}

function showImageError(container, src, exhausted) {
    var mangaId = state.activeMangaId || '';
    var chapterId = state.activeChapterId || '';
    container.innerHTML = '<div class="reader-image-error" style="padding:40px 20px;text-align:center;color:var(--color-accent);display:flex;flex-direction:column;align-items:center;gap:8px;">' +
        '<i class="fa-solid fa-triangle-exclamation" style="font-size:2.5rem;margin-bottom:8px;"></i>' +
        '<p style="font-weight:700;">' + (exhausted ? 'تعذر تحميل الصورة بعد عدة محاولات' : 'فشل تحميل هذه الصفحة') + '</p>' +
        (exhausted ? '' : '<button class="retry-btn" style="background:var(--color-primary);color:white;border:none;padding:8px 18px;border-radius:20px;cursor:pointer;font-family:var(--font-family);font-weight:700;">إعادة المحاولة</button>') +
        '<button class="alt-source-btn" data-manga-id="' + mangaId + '" data-chap-id="' + chapterId + '" style="background:var(--color-secondary);color:#07080c;border:none;padding:8px 18px;border-radius:20px;cursor:pointer;font-family:var(--font-family);font-weight:700;margin-top:4px;"><i class="fa-solid fa-compass"></i> مصدر بديل</button>' +
        '</div>';
    var altBtn = container.querySelector('.alt-source-btn');
    if (altBtn) {
        altBtn.onclick = function(e) {
            e.stopPropagation();
            var mid = this.dataset.mangaId;
            var cid = this.dataset.chapId;
            if (mid && cid) {
                fetch('/api/admin/import-alt-chapter-images', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (state.sessionToken || '')},
                    body: JSON.stringify({manga_id: mid, chapter_id: cid, alt_url: ''})
                }).then(function(r) { return r.json(); }).then(function(data) {
                    if (data.alt_images && data.alt_images.length > 0) {
                        var manga = state.mangas.find(function(m) { return m.id === mid; });
                        if (manga) {
                            var ch = manga.chapters.find(function(c) { return c.id === cid; });
                            if (ch) {
                                ch.alt_images = data.alt_images;
                                container.parentElement.innerHTML = '<div class="reader-image-placeholder"><i class="fa-solid fa-circle-notch fa-spin" style="font-size:2.5rem;color:var(--color-secondary);margin-bottom:12px;"></i><span>جاري تحميل من المصدر البديل...</span></div>';
                                loadSingleImage(container.parentElement, '/proxy-image?url=' + encodeURIComponent(data.alt_images[0]));
                            }
                        }
                    } else {
                        alert('لم نعثر على مصدر بديل لهذا الفصل.');
                    }
                }).catch(function() { alert('خطأ في الاتصال بالخادم'); });
            }
        };
    }
    var retryBtn = container.querySelector('.retry-btn');
    if (retryBtn) {
        retryBtn.onclick = function(e) {
            e.stopPropagation();
            container.innerHTML = '<div class="reader-image-placeholder">' +
                '<i class="fa-solid fa-circle-notch fa-spin" style="font-size:2.5rem;color:var(--color-primary);margin-bottom:12px;"></i>' +
                '<span>جاري إعادة تحميل الصفحة...</span></div>';
            var retrySrc = src;
            if (src.includes('/proxy-image')) {
                retrySrc = src + (src.includes('?') ? '&' : '?') + 't=' + Date.now();
            }
            container.dataset.retries = '0';
            loadSingleImage(container, retrySrc);
        };
    }
}

function initLazyLoading() {
    var containers = document.querySelectorAll('.lazy-load-container');
    if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    var container = entry.target;
                    var src = container.dataset.src;
                    loadSingleImage(container, src);
                    observer.unobserve(container);
                }
            });
        }, { rootMargin: '400px' });
        containers.forEach(function(c) { observer.observe(c); });
    } else {
        containers.forEach(function(container) {
            var src = container.dataset.src;
            loadSingleImage(container, src);
        });
    }
}

function initProgressTracker() {
    const bar = document.getElementById('reading-bar');
    if (!bar) return;
    
    window.onscroll = () => {
        const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
        bar.style.width = scrolled + '%';
        
        if (state.activeMangaId && state.activeChapterId) {
            state.saveReadingProgress(state.activeMangaId, state.activeChapterId, winScroll, scrolled);
        }
    };
}

async function loadAdminStats() {
    if (state.adminStatsLoading) return;
    if (state.adminStats && !state.adminDateFrom && !state.adminDateTo) return;
    state.adminStatsLoading = true;
    try {
        let url = '/api/admin/stats';
        if (state.adminDateFrom && state.adminDateTo) {
            const fromTs = Math.floor(new Date(state.adminDateFrom).getTime() / 1000);
            const toTs = Math.floor(new Date(state.adminDateTo + 'T23:59:59').getTime() / 1000);
            url += `?from=${fromTs}&to=${toTs}`;
        }
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${state.sessionToken}`
            }
        });
        if (response.ok) {
            state.adminStats = await response.json();
            renderApp();
        }
    } catch (e) {
        console.error("Error loading admin stats:", e);
    } finally {
        state.adminStatsLoading = false;
    }
}

async function loadAdminSuggestions() {
    const container = document.getElementById('suggestions-list-admin');
    if (!container) return;
    try {
        const response = await fetch('/api/suggestions', {
            headers: {
                'Authorization': `Bearer ${state.sessionToken}`
            }
        });
        if (response.ok) {
            const list = await response.json();
            if (list.length === 0) {
                container.innerHTML = '<p style="text-align:center; padding: 20px; color: var(--text-dark);">لا توجد شكاوى أو اقتراحات مرسلة حالياً.</p>';
                return;
            }
            let html = `
            <div style="display: grid; grid-template-columns: 1fr; gap: 16px; width: 100%;">
            `;
            list.forEach(item => {
                const dateStr = new Date(item.created_at * 1000).toLocaleString('ar-EG');
                const isComplaint = item.type === 'complaint';
                const badgeBg = isComplaint ? 'rgba(255, 0, 127, 0.1)' : 'rgba(0, 255, 127, 0.1)';
                const badgeColor = isComplaint ? '#ff007f' : '#00ff7f';
                const badgeText = isComplaint ? 'شكوى' : 'اقتراح';
                const badgeIcon = isComplaint ? '<i class="fa-solid fa-circle-exclamation"></i>' : '<i class="fa-solid fa-lightbulb"></i>';
                
                html += `
                <div class="glass-card" style="padding: 20px; border-radius: var(--border-radius-md); border: 1px solid var(--border-color); background: rgba(255,255,255,0.01); display: flex; flex-direction: column; gap: 10px; text-align: right;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                        <span style="font-size: 0.8rem; color: var(--text-muted);"><i class="fa-regular fa-clock"></i> ${dateStr}</span>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span style="font-size: 0.8rem; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeColor}; padding: 2px 10px; border-radius: 20px; font-weight: 700;">
                                ${badgeIcon} ${badgeText}
                            </span>
                            <span style="font-size: 0.95rem; font-weight: 700; color: var(--text-main);"><i class="fa-solid fa-envelope" style="color: var(--color-secondary); margin-left: 6px;"></i> ${item.email}</span>
                        </div>
                    </div>
                    <p style="font-size: 0.95rem; color: var(--text-main); line-height: 1.6; margin: 0; white-space: pre-wrap;">${item.content}</p>
                </div>
                `;
            });
            html += '</div>';
            container.innerHTML = html;
        } else {
            container.innerHTML = '<p style="text-align:center; padding: 20px; color: #ff007f;">فشل تحميل الاقتراحات من السيرفر.</p>';
        }
    } catch(e) {
        container.innerHTML = '<p style="text-align:center; padding: 20px; color: #ff007f;">حدث خطأ أثناء الاتصال بالخادم.</p>';
    }
}

async function loadAdminConfig() {
    if (!state.sessionToken) return;
    try {
        const response = await fetch('/api/admin/config', {
            headers: {
                'Authorization': `Bearer ${state.sessionToken}`
            }
        });
        if (response.ok) {
            state.adminConfig = await response.json();
            const gId = document.getElementById('setting-google-id');
            if (gId && state.adminConfig.google_client_id) gId.value = state.adminConfig.google_client_id;
            
            const fId = document.getElementById('setting-facebook-id');
            if (fId && state.adminConfig.facebook_app_id) fId.value = state.adminConfig.facebook_app_id;
            
            const sHost = document.getElementById('setting-smtp-host');
            if (sHost && state.adminConfig.smtp_host) sHost.value = state.adminConfig.smtp_host;
            
            const sPort = document.getElementById('setting-smtp-port');
            if (sPort && state.adminConfig.smtp_port) sPort.value = state.adminConfig.smtp_port;
            
            const sUser = document.getElementById('setting-smtp-user');
            if (sUser && state.adminConfig.smtp_user) sUser.value = state.adminConfig.smtp_user;
            
            const sPass = document.getElementById('setting-smtp-pass');
            if (sPass && state.adminConfig.smtp_pass) sPass.value = state.adminConfig.smtp_pass;
            
            const sSender = document.getElementById('setting-smtp-sender');
            if (sSender && state.adminConfig.smtp_sender) sSender.value = state.adminConfig.smtp_sender;
        }
    } catch (e) {
        console.error("Error loading admin config:", e);
    }
}

// إغلاق مقترحات البحث عند النقر خارج صندوق البحث
document.addEventListener('click', (e) => {
    document.querySelectorAll('.bookmark-picker.open').forEach(picker => {
        if (!picker.contains(e.target)) {
            picker.classList.remove('open');
            const toggle = picker.querySelector('.bookmark-picker-toggle');
            if (toggle) toggle.setAttribute('aria-expanded', 'false');
        }
    });

    const searchBox = document.querySelector('.search-box');
    if (searchBox && !searchBox.contains(e.target)) {
        if (state.showSearchSuggestions) {
            state.showSearchSuggestions = false;
            renderApp();
        }
    }
});

async function bootstrapConfig() {
    try {
        const res = await fetch('/api/config');
        if (res.ok) {
            const config = await res.json();
            if (config.google_client_id) GOOGLE_CLIENT_ID = config.google_client_id;
            if (config.facebook_app_id) FACEBOOK_APP_ID = config.facebook_app_id;
        }
    } catch (e) {
        console.error("Failed to bootstrap public configurations:", e);
    }
    initSocialAuths();
    handleRouting();
}

// ==========================================
// Online / Offline Detection
// ==========================================
let isOnline = navigator.onLine;
window.addEventListener('online', () => { isOnline = true; document.body.classList.remove('is-offline'); renderApp(); });
window.addEventListener('offline', () => { isOnline = false; document.body.classList.add('is-offline'); renderApp(); });

// تشغيل التطبيق
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapConfig);
} else {
    bootstrapConfig();
}
