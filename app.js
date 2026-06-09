/* ----------------------------------------------------
   KAIRO/منهوا - MAIN APPLICATION JS CONTROLLER (PRO UPGRADE)
------------------------------------------------------- */

// ==========================================
// 1. قاعدة البيانات والبيانات الافتراضية (IndexedDB & State)
// ==========================================

const DB_NAME = 'kairo_manhua_offline';
const DB_VERSION = 1;
const STORE_NAME = 'downloaded_chapters';

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
        views: 24530,
        genres: ["أكشن", "مغامرة", "خيال", "قوى خارقة"],
        synopsis: "في عالم يربط فيه بوابة غامضة عالم البشر بعالم الوحوش، يكتشف الصياد الأضعف سونغ جين وو نظاماً غامضاً يمنحه القدرة الفريدة على رفع مستواه بلا حدود.",
        chapters: populateDefaultChapters(200, false)
    },
    {
        id: "2",
        title: "قاتل الشياطين (Kimetsu no Yaiba)",
        alternative: "Demon Slayer",
        author: "Koyoharu Gotouge",
        cover: "https://images.unsplash.com/photo-1618336753974-aae8e04506aa?w=500&auto=format&fit=crop&q=60",
        banner: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1200&auto=format&fit=crop&q=80",
        rating: 4.8,
        status: "مكتمل",
        type: "مانجا",
        views: 18940,
        genres: ["أكشن", "شياطين", "تاريخي", "خيال"],
        synopsis: "تانجيرو فتى طيب يعيش برفقة عائلته، لكن حياته تنقلب رأساً على عقب عندما تذبح عائلته على يد شيطان وتتحول شقيقته نيزوكو إلى شيطانة.",
        chapters: populateDefaultChapters(205, false)
    },
    {
        id: "3",
        title: "برج الإله (Tower of God)",
        alternative: "Kami no Tou",
        author: "SIU",
        cover: "https://images.unsplash.com/photo-1560942485-b2a11cc13456?w=500&auto=format&fit=crop&q=60",
        banner: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&auto=format&fit=crop&q=80",
        rating: 4.7,
        status: "مستمر",
        type: "منهوا",
        views: 15610,
        genres: ["مغامرة", "غموض", "دراما", "خيال"],
        synopsis: "ما هي رغبتك؟ الثروة؟ المجد؟ القوة؟ كل هذا وأكثر ينتظرك في قمة البرج. يدخل الفتى (بام) البرج بحثاً عن الفتاة الوحيدة التي أنارت عتمة حياته.",
        chapters: populateDefaultChapters(550, false)
    },
    {
        id: "4",
        title: "كينجدوم (Kingdom)",
        alternative: "Kingdom",
        author: "Yasuhisa Hara",
        cover: "kingdom_cover.png",
        banner: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1200",
        rating: 4.9,
        status: "مستمر",
        type: "مانجا",
        views: 32420,
        genres: ["أكشن", "تاريخي", "عسكري", "دراما", "سينين"],
        synopsis: "في عصر الدول المتحاربة في الصين القديمة، يطمح الشابان اليتيمان شين وهيو بأن يصبحا أعظم جنرالين تحت السماء. ولكن بعد مأساة تغير مسار حياتهما، يسعى شين جاهداً لمساعدة ملك مقاطعة تشين الشاب في توحيد الصين بأكملها وإنهاء الحروب المستمرة.",
        chapters: populateDefaultChapters(800, true) // توليد 800 فصل تلقائياً
    }
];

// ==========================================
// 2. إدارة الحالة العامة والتخزين (State Management)
// ==========================================

class AppState {
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
        this.chapterSearchQuery = '';
        this.activeGenre = 'الكل';
        this.downloadProgress = {};
        this.isLoading = false;
        this.showAuthModal = false;
        this.authModalTab = 'login';
        this.loadScrapedMangas();
        
        if (this.sessionToken) {
            this.fetchAndMergeSettings();
        }
    }

    loadMangas() {
        const stored = localStorage.getItem('kairo_mangas');
        if (stored) {
            this.mangas = JSON.parse(stored);
            
            // تحقق ما إذا كانت فصول كينجدوم تحتاج لتحديث وتوسيع لتشمل الـ 800 فصل بالكامل
            const kingdom = this.mangas.find(m => m.id === "4");
            const solo = this.mangas.find(m => m.id === "1");
            if (!kingdom || kingdom.chapters.length < 10 || !solo || solo.chapters.length !== 200) {
                this.mangas = DEFAULT_MANGAS;
                this.saveMangas();
            }
        } else {
            this.mangas = DEFAULT_MANGAS;
            this.saveMangas();
        }
    }

    async loadScrapedMangas() {
        try {
            const response = await fetch('./scraped_mangas.json');
            if (response.ok) {
                const scraped = await response.json();
                if (Array.isArray(scraped)) {
                    scraped.forEach(scManga => {
                        const existsIdx = this.mangas.findIndex(m => m.id === scManga.id || m.title === scManga.title);
                        if (existsIdx === -1) {
                            this.mangas.push(scManga);
                        } else {
                            // Update existing manga content/chapters if scraped version has more chapters
                            const match = this.mangas[existsIdx];
                            if (scManga.chapters && scManga.chapters.length > 0) {
                                match.chapters = scManga.chapters;
                            }
                            match.cover = scManga.cover || match.cover;
                            match.alternative = scManga.alternative || match.alternative;
                            match.synopsis = scManga.synopsis || match.synopsis;
                            match.genres = scManga.genres || match.genres;
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
            await fetch('http://localhost:8000/api/sync_settings', {
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
            const response = await fetch('http://localhost:8000/api/get_settings', {
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
        this.bookmarks = stored ? JSON.parse(stored) : {};
    }

    saveBookmarks() {
        localStorage.setItem('kairo_bookmarks', JSON.stringify(this.bookmarks));
        this.syncSettings();
    }

    loadHistory() {
        const stored = localStorage.getItem('kairo_history');
        this.history = stored ? JSON.parse(stored) : [];
    }

    saveHistory() {
        localStorage.setItem('kairo_history', JSON.stringify(this.history));
        this.syncSettings();
    }

    addToHistory(mangaId, chapterId, scrollY = 0, percentage = 0, pageIndex = 0) {
        this.history = this.history.filter(h => h.mangaId !== mangaId);
        
        this.history.unshift({
            mangaId,
            chapterId,
            scrollY,
            percentage: Math.round(percentage),
            activePageIndex: pageIndex,
            updatedAt: new Date().toISOString()
        });

        if (this.history.length > 30) {
            this.history.pop();
        }
        
        this.saveHistory();
    }

    loadReadingProgress() {
        const stored = localStorage.getItem('kairo_progress');
        this.progress = stored ? JSON.parse(stored) : {};
    }

    saveReadingProgress(mangaId, chapterId, scrollY, percentage, pageIndex = 0) {
        if (!this.progress[mangaId]) this.progress[mangaId] = {};
        this.progress[mangaId] = { chapterId, scrollY, percentage, activePageIndex: pageIndex, updatedAt: new Date().toISOString() };
        localStorage.setItem('kairo_progress', JSON.stringify(this.progress));
        this.syncSettings();
        
        this.addToHistory(mangaId, chapterId, scrollY, percentage, pageIndex);
    }

    loadComments() {
        const stored = localStorage.getItem('kairo_comments');
        this.comments = stored ? JSON.parse(stored) : {};
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
        this.likes = stored ? JSON.parse(stored) : {};
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
        this.userProfile = stored ? JSON.parse(stored) : {
            username: 'أوتلاينر مميز',
            points: 150
        };
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

    addPoints(pts) {
        this.userProfile.points += pts;
        this.saveUserProfile();
        this.syncSettings();
    }

    getUserLevelInfo() {
        const points = this.userProfile.points;
        const level = Math.floor(points / 100) + 1;
        const levelProgress = points % 100;
        
        let rankTitle = 'مبتدئ القراءة';
        if (level >= 10) rankTitle = 'ملك المانجا 👑';
        else if (level >= 7) rankTitle = 'أوتلاين أسطوري';
        else if (level >= 5) rankTitle = 'عاشق المنهوا';
        else if (level >= 3) rankTitle = 'قارئ نشط';

        return { level, levelProgress, rankTitle };
    }

    loadReaderSettings() {
        const stored = localStorage.getItem('kairo_reader_settings');
        this.readerSettings = stored ? JSON.parse(stored) : {
            theme: 'dark',
            mode: 'vertical',
            width: 'medium'
        };
    }

    saveReaderSettings() {
        localStorage.setItem('kairo_reader_settings', JSON.stringify(this.readerSettings));
    }

    async addManga(title, alternative, author, cover, banner, genres, synopsis, type) {
        const newManga = {
            id: `lek_${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now()}`,
            title,
            alternative,
            author,
            cover: cover || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500',
            banner: banner || 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1200',
            rating: 5.0,
            status: 'مستمر',
            type: type || 'منهوا',
            views: 1500,
            genres: genres.split(',').map(g => g.trim()),
            synopsis,
            chapters: []
        };

        if (this.sessionToken && this.userRole === 'admin') {
            try {
                const response = await fetch('http://localhost:8000/api/save_manga', {
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
                const response = await fetch('http://localhost:8000/api/save_manga', {
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

function navigate(view, mangaId = null, chapterId = null) {
    state.currentView = view;
    state.activeMangaId = mangaId;
    state.activeChapterId = chapterId;
    
    state.activePageIndex = 0;
    state.chapterSearchQuery = '';
    
    if (view === 'reader') {
        state.isLoading = false;
        window.scrollTo(0, 0);
        renderApp();
        return;
    }
    
    state.isLoading = true;
    window.scrollTo(0, 0);
    renderApp();

    setTimeout(() => {
        state.isLoading = false;
        renderApp();
    }, 600);
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
    const adminButton = isAdmin ? `<button class="admin-btn" id="nav-admin"><i class="fa-solid fa-screwdriver-wrench"></i> الإدارة</button>` : '';

    let accountButton = '';
    if (state.sessionToken) {
        accountButton = `
        <div class="user-profile-menu-container">
            <button class="profile-navbar-btn" id="nav-profile-btn">
                <i class="fa-solid fa-user-check"></i>
                <span>${state.userEmail.split('@')[0]}</span>
            </button>
            <button class="logout-navbar-btn" id="logout-btn" title="تسجيل الخروج">
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

    return `
    <header class="header">
        <a class="header-logo" id="logo-btn">KAIRO<span>/منهوا</span></a>
        
        <nav class="header-nav">
            <span class="nav-link ${activeView === 'home' ? 'active' : ''}" id="nav-home"><i class="fa-solid fa-house"></i> الرئيسة</span>
            <span class="nav-link ${activeView === 'bookmarks' ? 'active' : ''}" id="nav-bookmarks"><i class="fa-solid fa-bookmark"></i> المفضلة</span>
            <span class="nav-link ${activeView === 'downloads' ? 'active' : ''}" id="nav-downloads"><i class="fa-solid fa-circle-down"></i> المحملة</span>
            <span class="nav-link ${activeView === 'history' ? 'active' : ''}" id="nav-history"><i class="fa-solid fa-clock-rotate-left"></i> السجل</span>
            <span class="nav-link" id="open-suggestions-btn"><i class="fa-solid fa-comments"></i> الاقتراحات والشكاوى</span>
        </nav>
        
        <div class="header-actions">
            <div class="search-box">
                <input type="text" placeholder="ابحث عن المانجا..." id="search-input" value="${state.searchQuery}">
                <i class="fa-solid fa-magnifying-glass"></i>
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
    
    return `
    <div class="auth-modal-overlay" id="auth-modal-overlay">
        <div class="auth-modal-card glass-card">
            <button class="auth-modal-close" id="close-auth-modal">&times;</button>
            <div class="auth-modal-tabs">
                <button class="auth-tab-btn ${isLogin ? 'active' : ''}" id="auth-tab-login" data-tab="login">تسجيل الدخول</button>
                <button class="auth-tab-btn ${!isLogin ? 'active' : ''}" id="auth-tab-register" data-tab="register">حساب جديد</button>
            </div>
            
            <div class="auth-modal-body">
                <form id="auth-form" class="auth-form">
                    <div class="form-group">
                        <label for="auth-email">البريد الإلكتروني (Gmail)</label>
                        <input type="email" id="auth-email" required placeholder="example@gmail.com" autocomplete="email">
                    </div>
                    <div class="form-group">
                        <label for="auth-password">كلمة المرور</label>
                        <input type="password" id="auth-password" required placeholder="********" autocomplete="current-password">
                    </div>
                    <div id="auth-error-msg" class="auth-error-msg" style="display:none;"></div>
                    <div id="auth-success-msg" class="auth-success-msg" style="display:none;"></div>
                    <button type="submit" class="auth-submit-btn neon-pulse-hover">
                        ${isLogin ? '<i class="fa-solid fa-right-to-bracket"></i> دخول' : '<i class="fa-solid fa-user-plus"></i> إنشاء الحساب'}
                    </button>
                </form>
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
        <div class="hero-slide ${idx === activeSlideIndex ? 'active' : ''}" style="background-image: url('${manga.banner}')" data-id="${manga.id}">
            <div class="hero-overlay"></div>
            <div class="hero-content">
                <span class="hero-badge">${manga.type} المميزة</span>
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

        const percentage = hist.percentage || 0;

        historyCardsHtml += `
        <div class="history-item-card" data-manga-id="${hist.mangaId}" data-chap-id="${hist.chapterId}" data-scroll="${hist.scrollY}" data-page="${hist.activePageIndex}">
            <div class="history-item-cover">
                <img src="${manga.cover}" alt="${manga.title}">
            </div>
            <div class="history-item-details">
                <h4 class="history-item-title">${manga.title}</h4>
                <span class="history-item-chapter">الفصل ${hist.chapterId}</span>
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
                <img src="${manga.cover}" alt="${manga.title}" style="width:45px; height:65px; object-fit:cover; border-radius:var(--border-radius-sm); border:1px solid var(--border-color); flex-shrink:0;">
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
        const latestChap = manga.chapters[0] ? manga.chapters[0].id : 'قريباً';
        cardsHtml += `
        <div class="manga-card" data-id="${manga.id}">
            <div class="manga-card-cover">
                <img src="${manga.cover}" alt="${manga.title}" loading="lazy">
                <span class="card-badge">${manga.status}</span>
                <span class="card-rating"><i class="fa-solid fa-star"></i> ${manga.rating}</span>
            </div>
            <div class="manga-card-info">
                <h3 class="manga-card-title">${manga.title}</h3>
                <div class="manga-card-chapter">
                    <span>${manga.type}</span>
                    <span class="chap-num">فصل ${latestChap}</span>
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
    const info = state.getUserLevelInfo();
    return `
    <div class="sidebar-card">
        <div class="user-widget-profile">
            <div class="user-widget-avatar">${state.userProfile.username.charAt(0)}</div>
            <div class="user-widget-info">
                <h4>${state.userProfile.username}</h4>
                <p>${info.rankTitle}</p>
            </div>
        </div>
        <div style="margin-top:15px;">
            <div class="level-progress-info">
                <span>المستوى الحالي: ${info.level}</span>
                <span>النقاط: ${state.userProfile.points}</span>
            </div>
            <div class="history-progress-track">
                <div class="history-progress-bar-fill" style="width: ${info.levelProgress}%"></div>
            </div>
            <p style="font-size:0.7rem;color:var(--text-dark);margin-top:5px;text-align:center;">اقرأ فصولاً إضافية لترقية مستواك!</p>
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
                <img src="${manga.cover}" alt="${manga.title}">
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

// شبكات المانجا (مع محاكاة لـ Sk// صفحة التفاصيل الكاملة
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
    
    // جلب الفصول المحملة للتأكد من حالة التحميل
    const localDownloads = await getAllDownloadsOffline();
    const downloadedIds = localDownloads
        .filter(d => d.mangaId === manga.id)
        .map(d => d.chapterId);

    let genresHtml = '';
    manga.genres.forEach(g => {
        genresHtml += `<span class="genre-tag">${g}</span>`;
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
        const response = await fetch(`http://localhost:8000/api/manga_reviews?manga_id=${manga.id}`);
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
                        \${r.review_text ? `<p style="font-size: 0.9rem; color: var(--text-main); line-height: 1.6; margin-top: 4px;">\${r.review_text}</p>` : ''}
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
                \${userReview ? '<i class="fa-solid fa-pen-to-square"></i> تعديل تقييمك ومراجعتك' : '<i class="fa-solid fa-star-half-stroke"></i> أضف تقييمك ومراجعتك للعمل'}
            </h4>
            <div style="display: flex; align-items: center; justify-content: flex-start; gap: 14px; direction: rtl;">
                <span style="font-size: 0.95rem; font-weight: 700; color: var(--text-main);">التقييم بالنجوم:</span>
                <div class="stars-picker" id="manga-stars-picker" style="display: flex; gap: 6px; direction: ltr;">
                    \${starsPickerHtml}
                </div>
                <span id="manga-selected-rating-val" style="font-size: 1.1rem; font-weight: 800; color: #ffb703;">\${userRating} / 5</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <label for="manga-review-text" style="font-size: 0.95rem; font-weight: 700; color: var(--text-main);">رأيك أو مراجعتك (اختياري):</label>
                <textarea id="manga-review-text" rows="3" placeholder="اكتب رأيك أو مراجعتك النصية هنا..." style="width: 100%; padding: 12px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); color: var(--text-main); outline: none; font-family: var(--font-family); resize: none; text-align: right;">\${userText}</textarea>
            </div>
            <button class="detail-btn btn-read" id="submit-manga-review-btn" style="padding: 10px 24px; font-size: 0.95rem; font-weight: 800; border-radius: 30px; width: fit-content; align-self: flex-start;">
                \${userReview ? 'تحديث المراجعة والتقييم' : 'إرسال التقييم والمراجعة'}
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
        <div class="detail-banner" style="background-image: url('${manga.banner}')">
            <div class="detail-banner-blur"></div>
        </div>
        <div class="detail-main">
            <div class="detail-sidebar">
                <div class="detail-cover">
                    <img src="${manga.cover}" alt="${manga.title}">
                </div>
                <div class="detail-actions">
                    \${latestChapter ? `
                        <button class="detail-btn btn-read start-reading-btn" data-chap-id="\${latestChapter.id}">
                            <i class="fa-solid fa-book-open"></i> قراءة أول فصل
                        </button>
                    ` : ''}
                    
                    <select class="detail-btn btn-fav select-bookmark-status" data-id="${manga.id}">
                        <option value="" \${bookmarkStatus === '' ? 'selected' : ''}>+ إضافة للمفضلة</option>
                        <option value="reading" \${bookmarkStatus === 'reading' ? 'selected' : ''}>أقرأه حالياً</option>
                        <option value="plan" \${bookmarkStatus === 'plan' ? 'selected' : ''}>أرغب في قراءته</option>
                        <option value="completed" \${bookmarkStatus === 'completed' ? 'selected' : ''}>مكتمل</option>
                    </select>
                    
                    \${state.userRole === 'admin' ? `
                        <button class="detail-btn delete-manga-admin-btn" data-id="${manga.id}" style="margin-top:12px; background:rgba(255,0,127,0.1); border:1px solid #ff007f; color:#ff007f; display:flex; align-items:center; justify-content:center; gap:8px; cursor:pointer;">
                            <i class="fa-solid fa-trash-can"></i> حذف هذا العمل
                        </button>
                    ` : ''}
                </div>
            </div>
            <div class="detail-content">
                <h1 class="detail-title">${manga.title}</h1>
                <p class="detail-author">اسم آخر: ${manga.alternative} • المؤلف: ${manga.author}</p>
                
                <div class="detail-meta-grid">
                    <div class="meta-item"><strong>النوع:</strong> ${manga.type}</div>
                    <div class="meta-item"><strong>الحالة:</strong> ${manga.status}</div>
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
                        <span>متوسط التقييم: <i class="fa-solid fa-star" style="color: #ffb703;"></i> \${manga.rating}</span>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 20px;">
                        \${reviewFormHtml}
                        
                        <div style="display: flex; flex-direction: column; gap: 14px; max-height: 400px; overflow-y: auto; padding-left: 6px;">
                            \${reviewsListHtml}
                        </div>
                    </div>
                </div>
                
                <div class="chapters-section">
                    <div class="chapters-header">
                        <h3>فصول المانجا المتاحة</h3>
                        <div class="chapters-search-box">
                            <input type="text" id="chapters-search-input" placeholder="ابحث عن رقم الفصل أو العنوان..." value="\${state.chapterSearchQuery || ''}" autocomplete="off">
                            <i class="fa-solid fa-magnifying-glass"></i>
                        </div>
                        <span>إجمالي الفصول: \${manga.chapters.length}</span>
                    </div>
                    <div class="chapters-list">
                        \${chaptersHtml}
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
    
    const chapterIndex = manga.chapters.findIndex(c => c.id === state.activeChapterId);
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
    const isOfflineAvailable = !offlineData;
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
        optionsHtml += `<option value="${ch.id}" \${ch.id === chapter.id ? 'selected' : ''}>الفصل \${ch.id}</option>`;
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
            <div class="reader-image-container \${isActivePage ? 'active-page' : ''}" data-index="\${index}">
                <img src="\${proxiedUrl}" alt="صفحة \${index + 1}">
            </div>
            `;
        });
    } else {
        pages.forEach((pageUrl, index) => {
            const proxiedUrl = getProxiedImageUrl(pageUrl);
            imagesHtml += `
            <div class="reader-image-container lazy-load-container" data-src="\${proxiedUrl}">
                <div class="reader-image-placeholder">
                    <i class="fa-solid fa-circle-notch fa-spin" style="font-size:2.5rem;color:var(--color-primary);margin-bottom:12px;"></i>
                    <span>جاري تحميل الصفحة \${index + 1}...</span>
                </div>
            </div>
            `;
        });
    }

    // جلب تعليقات الفصل من السيرفر
    let chapterComments = [];
    let commentsListHtml = '';
    try {
        const response = await fetch(`http://localhost:8000/api/chapter_comments?manga_id=\${manga.id}&chapter_id=\${chapter.id}`);
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
                        <div class="comment-avatar">\${firstLetter}</div>
                        <div class="comment-body">
                            <div class="comment-header">
                                <span class="comment-username">\${userDisplay}</span>
                                <span class="comment-time">\${dateStr}</span>
                            </div>
                            <p class="comment-text">\${comm.comment_text}</p>
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
                <i class="fa-solid fa-user-check" style="color: var(--color-secondary); margin-left: 4px;"></i> التعليق باسم: <strong>\${state.userEmail.split('@')[0]}</strong>
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
    <div class="reader-wrapper \${themeClass} \${widthClass} \${modeClass}">
        <div class="reader-progress-bar" id="reading-bar" style="width: \${progressPercent}%"></div>
        
        <div class="reader-nav">
            <button class="reader-btn return-to-manga" title="العودة لصفحة المانجا"><i class="fa-solid fa-arrow-right"></i></button>
            <div class="reader-title-info">
                <h2>\${manga.title}</h2>
                <p>\${chapter.title} \${isOfflineAvailable ? '<span style="color:var(--color-secondary)"><i class="fa-solid fa-wifi-slash"></i> أوفلاين</span>' : ''}</p>
            </div>
            <div class="reader-controls">
                <button class="reader-btn prev-chapter-btn \${chapterIndex === manga.chapters.length - 1 ? 'disabled' : ''}" title="الفصل السابق"><i class="fa-solid fa-chevron-right"></i></button>
                
                <div class="custom-dropdown" id="chapter-dropdown">
                    <button class="dropdown-trigger">
                        <span>الفصل \${chapter.id}</span>
                        <i class="fa-solid fa-chevron-down"></i>
                    </button>
                    <div class="dropdown-content">
                        <div class="dropdown-search-box">
                            <input type="text" id="chapter-drop-search" placeholder="ابحث عن رقم الفصل..." autocomplete="off">
                            <i class="fa-solid fa-magnifying-glass"></i>
                        </div>
                        <div class="dropdown-items-list">
                            \${manga.chapters.map(ch => {
                                const subtitle = ch.title ? (ch.title.includes(':') ? ch.title.split(':').slice(1).join(':').trim() : ch.title) : '';
                                return `
                                    <div class="dropdown-item-opt \${ch.id === chapter.id ? 'active' : ''}" data-value="\${ch.id}">
                                        <span class="opt-num">الفصل \${ch.id}</span>
                                        \${subtitle ? `<span class="opt-title">\${subtitle}</span>` : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>

                <button class="reader-btn next-chapter-btn \${chapterIndex === 0 ? 'disabled' : ''}" title="الفصل التالي"><i class="fa-solid fa-chevron-left"></i></button>
            </div>
        </div>
        
        <div class="reader-content-images">
            \${imagesHtml}
            
            \${settings.mode === 'horizontal' ? `
                <div class="horizontal-click-navigator">
                    <div class="nav-zone nav-zone-right" id="h-prev-zone" title="الصفحة السابقة"><i class="fa-solid fa-chevron-right"></i></div>
                    <div class="nav-zone nav-zone-left" id="h-next-zone" title="الصفحة التالية"><i class="fa-solid fa-chevron-left"></i></div>
                </div>
                <div class="horizontal-page-indicator">
                    صفحة \${state.activePageIndex + 1} من \${pages.length}
                </div>
            ` : ''}
        </div>

        <div class="chapter-likes-interactive">
            <button class="like-chapter-btn \${isLiked ? 'liked' : ''}" id="chapter-like-btn">
                <i class="fa-\${isLiked ? 'solid' : 'regular'} fa-heart"></i>
                <span id="like-text">\${isLiked ? 'أعجبني هذا الفصل!' : 'أعجبني'}</span>
            </button>
        </div>
        
        <button class="reader-settings-toggle-btn" id="settings-panel-toggle" title="تخصيص القراءة"><i class="fa-solid fa-gear"></i></button>
        
        <div class="reader-settings-panel" id="settings-panel">
            <div class="setting-row">
                <label>اتجاه القراءة</label>
                <div class="setting-buttons">
                    <button class="setting-btn \${settings.mode === 'vertical' ? 'active' : ''}" data-setting="mode" data-value="vertical">طولي (Webtoon)</button>
                    <button class="setting-btn \${settings.mode === 'horizontal' ? 'active' : ''}" data-setting="mode" data-value="horizontal">أفقي (Manga)</button>
                </div>
            </div>
            <div class="setting-row">
                <label>لون الخلفية</label>
                <div class="setting-buttons">
                    <button class="setting-btn \${settings.theme === 'dark' ? 'active' : ''}" data-setting="theme" data-value="dark">داكن</button>
                    <button class="setting-btn \${settings.theme === 'gray' ? 'active' : ''}" data-setting="theme" data-value="gray">رمادي</button>
                    <button class="setting-btn \${settings.theme === 'sepia' ? 'active' : ''}" data-setting="theme" data-value="sepia">مريح للعين</button>
                </div>
            </div>
            <div class="setting-row">
                <label>عرض الصور</label>
                <div class="setting-buttons">
                    <button class="setting-btn \${settings.width === 'compact' ? 'active' : ''}" data-setting="width" data-value="compact">مضغوط</button>
                    <button class="setting-btn \${settings.width === 'medium' ? 'active' : ''}" data-setting="width" data-value="medium">متوسط</button>
                    <button class="setting-btn \${settings.width === 'full' ? 'active' : ''}" data-setting="width" data-value="full">كامل</button>
                </div>
            </div>
        </div>
        
        <div class="main-content" style="max-width: 800px; margin: 0 auto; width: 100%;">
            <div class="comments-container" style="margin-bottom: 50px;">
                <h3 class="comments-title"><i class="fa-regular fa-comments"></i> مناقشة الفصل (\${chapterComments.length})</h3>
                \${commentFormHtml}
                <div class="comments-list">
                    \${commentsListHtml}
                </div>
            </div>
        </div>
    </div>
    `;
}

// لوحة الإدارة
function AdminPanelViewComponent() {
    let mangaOptions = '';
    state.mangas.forEach(m => {
        mangaOptions += `<option value="${m.id}">${m.title}</option>`;
    });

    return `
    <div class="admin-container">
        <h2 class="admin-title">لوحة التحكم والإدارة للموقع <span>(KAIRO/منهوا)</span></h2>
        
        <div class="admin-tabs">
            <button class="admin-tab active" id="tab-add-manga">إضافة مانجا/منهوا جديدة</button>
            <button class="admin-tab" id="tab-add-chapter">إضافة فصل جديد</button>
            <button class="admin-tab" id="tab-suggestions">الشكاوى والاقتراحات</button>
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
        <div class="empty-state">
            <i class="fa-regular fa-bookmark"></i>
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
                    <img src="${manga.cover}" alt="${manga.title}" loading="lazy">
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
            <button class="bookmark-tab ${currentTab === 'all' ? 'active' : ''}" data-tab="all">الكل</button>
            <button class="bookmark-tab ${currentTab === 'reading' ? 'active' : ''}" data-tab="reading">أقرأه حالياً</button>
            <button class="bookmark-tab ${currentTab === 'plan' ? 'active' : ''}" data-tab="plan">أرغب في قراءته</button>
            <button class="bookmark-tab ${currentTab === 'completed' ? 'active' : ''}" data-tab="completed">مكتمل</button>
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
    }

    // 3. بناء وتصيير الهيكل الأساسي للواجهة
    if (state.currentView === 'reader') {
        root.innerHTML = `<div id="app-root">${viewHtml} ${AuthModalComponent()} ${SuggestionsModalComponent()}</div>`;
        
        if (state.readerSettings.mode !== 'horizontal') {
            initLazyLoading();
            initProgressTracker();
        }
    } else {
        root.innerHTML = `
        <div id="app-root">
            ${HeaderComponent()}
            <main class="main-content">
                ${viewHtml}
            </main>
            ${AuthModalComponent()}
            ${SuggestionsModalComponent()}
        </div>
        `;
    }

    attachEventListeners();
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

    const navAdmin = document.getElementById('nav-admin');
    if (navAdmin) navAdmin.onclick = () => navigate('admin');

    // شريط البحث
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.oninput = (e) => {
            state.searchQuery = e.target.value;
            if (state.currentView !== 'home') {
                state.currentView = 'home';
            }
            renderApp();
            
            const newInput = document.getElementById('search-input');
            newInput.focus();
            newInput.setSelectionRange(newInput.value.length, newInput.value.length);
        };
    }

    // تصفية التصنيفات
    const genreTags = document.querySelectorAll('.genre-tag');
    genreTags.forEach(tag => {
        tag.onclick = (e) => {
            const genre = e.target.dataset.genre;
            if (genre) {
                state.activeGenre = genre;
                renderApp();
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
    const favSelector = document.querySelector('.select-bookmark-status');
    if (favSelector) {
        favSelector.onchange = (e) => {
            const mangaId = e.target.dataset.id;
            const status = e.target.value;
            state.bookmarks[mangaId] = status;
            if (status === '') {
                delete state.bookmarks[mangaId];
            }
            state.saveBookmarks();
            renderApp();
        };
    }

    // صفحة التفاصيل: الضغط على قراءة أول فصل
    const startReadingBtn = document.querySelector('.start-reading-btn');
    if (startReadingBtn) {
        startReadingBtn.onclick = () => {
            const chapId = startReadingBtn.dataset.chapId;
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
            const chapterObj = mangaObj.chapters.find(c => c.id === chapId);

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

    // المفضلة: تبديل التبويبات
    const bookmarkTabs = document.querySelectorAll('.bookmark-tab');
    bookmarkTabs.forEach(tab => {
        tab.onclick = (e) => {
            state.activeGenre = e.target.dataset.tab;
            renderApp();
        };
    });

    // القارئ: العودة لصفحة تفاصيل المانجا
    const returnBtn = document.querySelector('.return-to-manga');
    if (returnBtn) {
        returnBtn.onclick = () => {
            navigate('detail', state.activeMangaId);
        };
    }

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
    const prevBtn = document.querySelector('.prev-chapter-btn');
    if (prevBtn && !prevBtn.classList.contains('disabled')) {
        prevBtn.onclick = () => {
            const manga = state.mangas.find(m => m.id === state.activeMangaId);
            const chapterIndex = manga.chapters.findIndex(c => c.id === state.activeChapterId);
            if (chapterIndex < manga.chapters.length - 1) {
                const prevChapId = manga.chapters[chapterIndex + 1].id;
                navigate('reader', state.activeMangaId, prevChapId);
            }
        };
    }

    // القارئ: الفصل التالي
    const nextBtn = document.querySelector('.next-chapter-btn');
    if (nextBtn && !nextBtn.classList.contains('disabled')) {
        nextBtn.onclick = () => {
            const manga = state.mangas.find(m => m.id === state.activeMangaId);
            const chapterIndex = manga.chapters.findIndex(c => c.id === state.activeChapterId);
            if (chapterIndex > 0) {
                const nextChapId = manga.chapters[chapterIndex - 1].id;
                navigate('reader', state.activeMangaId, nextChapId);
            }
        };
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
        const chapter = manga.chapters.find(c => c.id === state.activeChapterId);
        const totalPages = chapter.images.length;

        hPrevZone.onclick = (e) => {
            e.stopPropagation();
            if (state.activePageIndex > 0) {
                state.activePageIndex--;
                renderApp();
            } else {
                const chapterIndex = manga.chapters.findIndex(c => c.id === state.activeChapterId);
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
                const chapterIndex = manga.chapters.findIndex(c => c.id === state.activeChapterId);
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

    // القارئ: إرسال تعليق
    const commentForm = document.getElementById('comment-form');
    if (commentForm) {
        commentForm.onsubmit = (e) => {
            e.preventDefault();
            const user = document.getElementById('comment-user').value;
            const text = document.getElementById('comment-text').value;
            state.addComment(state.activeMangaId, state.activeChapterId, user, text);
            renderApp();
        };
    }

    // الإدارة: تبديل التبويبات
    const tabAddManga = document.getElementById('tab-add-manga');
    const tabAddChapter = document.getElementById('tab-add-chapter');
    const panelManga = document.getElementById('panel-add-manga');
    const panelChapter = document.getElementById('panel-add-chapter');

    if (tabAddManga && tabAddChapter) {
        tabAddManga.onclick = () => {
            tabAddManga.classList.add('active');
            tabAddChapter.classList.remove('active');
            panelManga.style.display = 'block';
            panelChapter.style.display = 'none';
        };

        tabAddChapter.onclick = () => {
            tabAddChapter.classList.add('active');
            tabAddManga.classList.remove('active');
            panelChapter.style.display = 'block';
            panelManga.style.display = 'none';
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
                const response = await fetch('http://localhost:8000/api/suggestions', {
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
    
    const sugOverlay = document.getElementById('suggestions-modal-overlay');
    if (sugOverlay) {
        sugOverlay.onclick = (e) => {
            if (e.target === sugOverlay) {
                state.showSuggestionsModal = false;
                renderApp();
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
                const response = await fetch(`http://localhost:8000${endpoint}`, {
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
                        state.saveUserProfile();
                        successMsg.innerText = 'تم تسجيل الدخول بنجاح!';
                        successMsg.style.display = 'block';
                        await state.fetchAndMergeSettings();
                        setTimeout(() => {
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
                    await fetch('http://localhost:8000/api/logout', {
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
                const response = await fetch('http://localhost:8000/api/manga_reviews', {
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
                const response = await fetch('http://localhost:8000/api/chapter_comments', {
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

    // الإدارة: تبويب الشكاوى والاقتراحات
    const tabSuggestions = document.getElementById('tab-suggestions');
    const panelSuggestions = document.getElementById('panel-suggestions');
    if (tabSuggestions) {
        tabSuggestions.onclick = () => {
            tabSuggestions.classList.add('active');
            if (tabAddManga) tabAddManga.classList.remove('active');
            if (tabAddChapter) tabAddChapter.classList.remove('active');
            if (panelSuggestions) panelSuggestions.style.display = 'block';
            if (panelManga) panelManga.style.display = 'none';
            if (panelChapter) panelChapter.style.display = 'none';
            loadAdminSuggestions();
        };
    }
}

// ==========================================
// 6. تشغيل القارئ والتحميل الكسول
// ==========================================

function initLazyLoading() {
    const containers = document.querySelectorAll('.lazy-load-container');
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const container = entry.target;
                    const src = container.dataset.src;
                    
                    const img = document.createElement('img');
                    img.src = src;
                    img.onload = () => {
                        container.innerHTML = '';
                        container.appendChild(img);
                    };
                    observer.unobserve(container);
                }
            });
        }, { rootMargin: '300px' });

        containers.forEach(c => observer.observe(c));
    } else {
        containers.forEach(container => {
            const src = container.dataset.src;
            const img = document.createElement('img');
            img.src = src;
            container.innerHTML = '';
            container.appendChild(img);
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

async function loadAdminSuggestions() {
    const container = document.getElementById('suggestions-list-admin');
    if (!container) return;
    try {
        const response = await fetch('http://localhost:8000/api/suggestions', {
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

// تشغيل التطبيق
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderApp);
} else {
    renderApp();
}
