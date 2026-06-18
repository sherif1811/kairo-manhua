
window.generateHomeGridHtml = async function() {
    const s = state;
    
    // 1. Fetch users if needed
    if (!s.browseUsers) {
        try {
            const res = await fetch('/api/leaderboard?limit=1000');
            s.browseUsers = await res.json();
        } catch(e) {
            console.error('Failed to load users', e);
            s.browseUsers = [];
        }
    }

    let showUsers = (s.searchType === 'username' || s.searchType === 'all');
    let showMangas = (s.searchType !== 'username');

    let usersHtml = '';
    let mangasHtml = '';

    // -- USERS --
    if (showUsers) {
        let filteredUsers = s.browseUsers || [];
        if (s.searchQuery) {
            const q = s.searchQuery.toLowerCase();
            filteredUsers = filteredUsers.filter(u => (u.username || '').toLowerCase().includes(q));
        }
        
        // If 'all' and no search query, maybe don't show all 1000 users. Only show if searched, or show top 5.
        if (s.searchType === 'all') {
             if (!s.searchQuery) {
                 filteredUsers = []; // Don't show users by default in 'all' unless searching
             } else {
                 filteredUsers = filteredUsers.slice(0, 8); // Max 8 users in 'all' search
             }
        }

        if (filteredUsers.length > 0) {
            const usersCards = filteredUsers.map(u => `
                <div class="user-search-item" style="background:var(--bg-card); padding:15px; border-radius:12px; border:1px solid var(--border-color); display:flex; align-items:center; gap:15px; cursor:pointer;" onclick="navigate('profile', '${u.username}')">
                    <div class="user-search-avatar" style="width:50px; height:50px; font-size:1.2rem; background:var(--primary-color); display:flex; justify-content:center; align-items:center; border-radius:50%; color:#fff;">${u.username ? u.username[0].toUpperCase() : '?'}</div>
                    <div>
                        <h3 style="margin:0; color:#fff; font-size:1.1rem;">${u.username}</h3>
                        <span style="color:var(--text-muted); font-size:0.85rem;"><i class="fa-solid fa-trophy" style="color:gold;"></i> Ø§Ù„Ø±ØªØ¨Ø©: ${u.rank || 'Ù…Ø¨ØªØ¯Ø¦'}</span>
                    </div>
                    <div style="margin-right:auto; color:var(--primary-color); font-weight:bold;">
                        ${u.points || 0} XP
                    </div>
                </div>
            `).join('');
            
            usersHtml = `
            <div style="margin-bottom: 30px;">
                <h2 style="color:#fff; margin-bottom:15px; font-size:1.4rem;"><i class="fa-solid fa-user-group" style="color:var(--primary-color);"></i> Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…ÙˆÙ†</h2>
                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:20px;">
                    ${usersCards}
                </div>
            </div>
            `;
        } else if (s.searchType === 'username') {
             usersHtml = '<div class="empty-state"><h3>Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ù…Ø³ØªØ®Ø¯Ù…ÙŠÙ† Ø¨Ù‡Ø°Ø§ Ø§Ù„Ø§Ø³Ù…</h3></div>';
        }
    }

    // -- MANGAS --
    if (showMangas) {
        let filtered = [...s.mangas];

        if (s.activeGenre && s.activeGenre !== 'Ø§Ù„ÙƒÙ„') {
            filtered = filtered.filter(m => m.genres && m.genres.includes(s.activeGenre));
        }
        if (s.filterStatus && s.filterStatus !== 'Ø§Ù„ÙƒÙ„') {
            filtered = filtered.filter(m => m.status === s.filterStatus || (s.filterStatus === 'Ù…Ø³ØªÙ…Ø±Ø©' && m.status === 'Ongoing'));
        }
        if (s.filterType && s.filterType !== 'Ø§Ù„ÙƒÙ„') {
            filtered = filtered.filter(m => m.type === s.filterType);
        }
        if (s.filterYearMin) {
            filtered = filtered.filter(m => (m.year || 0) >= parseInt(s.filterYearMin));
        }
        if (s.filterYearMax) {
            filtered = filtered.filter(m => (m.year || 9999) <= parseInt(s.filterYearMax));
        }
        if (s.filterRatingMin) {
            filtered = filtered.filter(m => (m.rating || 0) >= parseFloat(s.filterRatingMin));
        }
        if (s.filterRatingMax) {
            filtered = filtered.filter(m => (m.rating || 5) <= parseFloat(s.filterRatingMax));
        }
        if (s.filterChaptersMin) {
            filtered = filtered.filter(m => (m.chapters ? m.chapters.length : 0) >= parseInt(s.filterChaptersMin));
        }
        if (s.filterChaptersMax) {
            filtered = filtered.filter(m => (m.chapters ? m.chapters.length : 0) <= parseInt(s.filterChaptersMax));
        }

        if (s.searchQuery) {
            const q = s.searchQuery.toLowerCase();
            // safeStr: safely converts any value to a lowercase string for comparison
            const safeStr = v => (v == null ? '' : Array.isArray(v) ? v.join(' ') : String(v)).toLowerCase();
            filtered = filtered.filter(m => {
                const inTitle  = safeStr(m.title).includes(q) || safeStr(m.alternative).includes(q);
                const inAuthor = safeStr(m.author).includes(q);
                const inTags   = Array.isArray(m.genres) && m.genres.some(g => safeStr(g).includes(q));
                const inType   = safeStr(m.type).includes(q);
                const inDesc   = safeStr(m.description).includes(q);

                if (s.searchType === 'title')  return inTitle;
                if (s.searchType === 'author') return inAuthor;
                if (s.searchType === 'tags')   return inTags || inType;
                if (s.searchType === 'desc')   return inDesc;

                return inTitle || inAuthor || inTags || inType || inDesc;
            });
        }

        if (s.filterSort === 'Ø§Ù„Ø£Ø­Ø¯Ø«' || !s.filterSort) {
            filtered.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
        } else if (s.filterSort === 'Ø£Ø­Ø¯Ø« Ø§Ù„ØªØ­Ø¯ÙŠØ«Ø§Øª') {
            filtered.sort((a,b) => new Date(b.updated_at) - new Date(a.updated_at));
        } else if (s.filterSort === 'Ø£-ÙŠ') {
            filtered.sort((a,b) => (a.title || '').localeCompare(b.title || ''));
        } else if (s.filterSort === 'Ø§Ù„Ø£Ø¹Ù„Ù‰ ØªÙ‚ÙŠÙŠÙ…Ø§Ù‹') {
            filtered.sort((a,b) => (b.rating||0) - (a.rating||0));
        } else if (s.filterSort === 'Ø§Ù„Ø£ÙƒØ«Ø± Ø´Ø¹Ø¨ÙŠØ©') {
            filtered.sort((a,b) => (b.views||0) - (a.views||0));
        }

        const limit = s.limit || 48;
        filtered = filtered.slice(0, limit);

        if (filtered.length > 0) {
            const isList = s.viewMode === 'list';
            const cardsHtml = filtered.map(m => MangaCardComponent(m)).join('');
            mangasHtml = `
            <div style="margin-bottom: 20px;">
                <h2 style="color:#fff; margin-bottom:15px; font-size:1.4rem; display:${s.searchType==='all' && usersHtml ? 'block' : 'none'};"><i class="fa-solid fa-layer-group" style="color:var(--primary-color);"></i> Ø§Ù„Ø³Ù„Ø§Ø³Ù„</h2>
                <div class="${isList ? 'manga-list-view' : 'manga-grid'}">
                    ${cardsHtml}
                </div>
            </div>`;
        } else if (s.searchType !== 'username') {
            mangasHtml = '<div class="empty-state"><h3>Ù„Ù… ÙŠØªÙ… Ø§Ù„Ø¹Ø«ÙˆØ± Ø¹Ù„Ù‰ Ù†ØªØ§Ø¦Ø¬</h3></div>';
        }
    }
    
    // Ensure dropdowns visibility based on search type
    const dropdowns = document.querySelector('.mangatime-dropdowns-row');
    if (dropdowns) {
        dropdowns.style.display = s.searchType === 'username' ? 'none' : 'flex';
    }

    return `
    <div id="unified-grid-container" style="max-width:1200px; margin:0 auto; padding:0 20px;">
        ${usersHtml}
        ${mangasHtml}
    </div>
    `;
};

/* ----------------------------------------------------
   KAIRO/Ù…Ù†Ù‡ÙˆØ§ - MAIN APPLICATION JS CONTROLLER (PRO UPGRADE)
   VERSION: 2.5
------------------------------------------------------- */

// ==========================================
// 1. Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª ÙˆØ§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø§ÙØªØ±Ø§Ø¶ÙŠØ© (IndexedDB & State)
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

// Ù…Ø¹Ø±ÙØ§Øª Ø§Ù„ØªØ·Ø¨ÙŠÙ‚Ø§Øª Ù„ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø§Ù„Ø§Ø¬ØªÙ…Ø§Ø¹ÙŠ (ØªÙØ­Ù…Ù‘Ù„ Ù…Ù† Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª)
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
    if (!Array.isArray(manga.chapters)) manga.chapters = [];
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

function getRankColor(level) {
    if (level <= 5) return '#8a8a8a';
    if (level <= 15) return '#4caf50';
    if (level <= 30) return '#cd7f32';
    if (level <= 50) return '#c0c0c0';
    if (level <= 70) return '#ffd700';
    if (level <= 99) return '#00f0ff';
    if (level <= 149) return '#50c878';
    if (level <= 199) return '#b9f2ff';
    if (level <= 299) return '#ff4500';
    return '#ff007f';
}

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

function timeAgo(timestamp) {
    if (!timestamp) return '';
    const diff = Date.now() / 1000 - timestamp;
    if (diff < 60) return '\u0627\u0644\u0622\u0646';
    if (diff < 3600) return '\u0645\u0646\u0630 ' + Math.floor(diff / 60) + ' \u062f\u0642\u064a\u0642\u0629';
    if (diff < 86400) return '\u0645\u0646\u0630 ' + Math.floor(diff / 3600) + ' \u0633\u0627\u0639\u0629';
    return '\u0645\u0646\u0630 ' + Math.floor(diff / 86400) + ' \u064a\u0648\u0645';
}

// ØªÙ‡ÙŠØ¦Ø© Ù‚Ø§Ø¹Ø¯Ø© Ø¨ÙŠØ§Ù†Ø§Øª IndexedDB Ù„Ø­ÙØ¸ Ø§Ù„ÙØµÙˆÙ„ Ù„Ù„Ù‚Ø±Ø§Ø¡Ø© Ø¯ÙˆÙ† Ø§ØªØµØ§Ù„
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

// Ø­ÙØ¸ Ø§Ù„ÙØµÙ„ ÙÙŠ IndexedDB (Ø§Ù„Ù‚Ø±Ø§Ø¡Ø© Ø¯ÙˆÙ† Ø§ØªØµØ§Ù„)
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

// Ø¬Ù„Ø¨ Ø§Ù„ÙØµÙ„ Ø§Ù„Ù…Ø­ÙÙˆØ¸ Ù…Ù† IndexedDB
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

// Ø¬Ù„Ø¨ ÙƒØ§ÙØ© Ø§Ù„ÙØµÙˆÙ„ Ø§Ù„Ù…Ø­Ù…Ù„Ø©
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

// Ø­Ø°Ù ÙØµÙ„ Ù…Ø­Ù…Ù„
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

// Ø¥Ù†ØªØ§Ø¬ ØµÙØ­Ø§Øª Ù…Ø§Ù†Ø¬Ø§ ØªØ¬Ø±ÙŠØ¨ÙŠØ© Ù…Ù…ÙŠØ²Ø© Ø¨ØªØµÙ…ÙŠÙ… Ù…ØªØ¬Ù‡ (SVG Pages) Ù„ØªØ¹Ù…Ù„ Ø£ÙˆÙÙ„Ø§ÙŠÙ† 100% ÙˆØ¨Ø³Ø±Ø¹Ø© ÙØ§Ø¦Ù‚Ø©
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
            <!-- Ø¥Ø·Ø§Ø± Ø¬Ù…Ø§Ù„ÙŠ -->
            <rect x="20" y="20" width="760" height="1160" rx="15" fill="none" stroke="#222638" stroke-width="2"/>
            <circle cx="400" cy="550" r="140" fill="#161924" stroke="#8a2be2" stroke-width="3" stroke-dasharray="12 6"/>
            
            <!-- Ù†Øµ Ù…Ø­ØªÙˆÙ‰ Ø§Ù„ØµÙØ­Ø© -->
            <text x="400" y="520" fill="#ffffff" font-family="'Cairo', sans-serif" font-size="28" font-weight="bold" text-anchor="middle">KAIRO / Ù…Ù†Ù‡ÙˆØ§</text>
            <text x="400" y="570" fill="#00f0ff" font-family="'Cairo', sans-serif" font-size="24" font-weight="600" text-anchor="middle">${mangaTitle}</text>
            <text x="400" y="620" fill="#ff007f" font-family="'Cairo', sans-serif" font-size="20" text-anchor="middle">Ø§Ù„ÙØµÙ„ ${chapNum} - Ø§Ù„ØµÙØ­Ø© ${i}</text>
            
            <!-- Ù„ÙˆØ­Ø© Ø§Ù„Ù…Ø§Ù†Ø¬Ø§ Ø§Ù„Ø²Ø®Ø±ÙÙŠØ© -->
            <path d="M 300 800 L 500 800 L 450 950 L 350 950 Z" fill="#8a2be2" fill-opacity="0.1" stroke="#8a2be2" stroke-width="1"/>
            <line x1="50" y1="1100" x2="750" y2="1100" stroke="#222638" stroke-width="1"/>
            
            <text x="400" y="1130" fill="#62667d" font-family="'Cairo', sans-serif" font-size="14" text-anchor="middle">Ø§Ø³ØªÙ…ØªØ¹ Ø¨Ø§Ù„Ù‚Ø±Ø§Ø¡Ø© Ø§Ù„Ø³Ù„Ø³Ø© ÙˆØ§Ù„Ù…Ø­Ù…Ù„Ø© Ø¹Ù„Ù‰ Ø¬Ù‡Ø§Ø²Ùƒ</text>
        </svg>
        `;
        const encoded = btoa(unescape(encodeURIComponent(svg)));
        pages.push(`data:image/svg+xml;base64,${encoded}`);
    }
    return pages;
}

// Ø¥Ù†ØªØ§Ø¬ ØµÙØ­Ø§Øª Ù…Ø§Ù†Ø¬Ø§ Ù…Ù„ÙˆÙ†Ø© ÙˆØ­ØµØ±ÙŠØ© Ù„Ù€ Kingdom ØªØ­Ù…Ù„ Ø¹Ù„Ø§Ù…Ø© Ù…Ø§Ø¦ÙŠØ© Ù„Ù€ KAIRO/Ù…Ù†Ù‡ÙˆØ§
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
            
            <!-- Ø¥Ø·Ø§Ø± Ø¹Ø³ÙƒØ±ÙŠ Ø²Ø®Ø±ÙÙŠ -->
            <rect x="25" y="25" width="750" height="1150" rx="10" fill="none" stroke="#ff9900" stroke-width="2" stroke-opacity="0.4"/>
            <rect x="35" y="35" width="730" height="1130" rx="6" fill="none" stroke="#22263b" stroke-width="1"/>
            
            <!-- Ù„ÙˆØ­Ø§Øª Ù…Ø§Ù†Ø¬Ø§ Ù…Ù„ÙˆÙ†Ø© (Manga Panels Mockup) -->
            <!-- Ù„ÙˆØ­Ø© 1: Ù…Ø´Ù‡Ø¯ Ø­ÙˆØ§Ø±ÙŠ -->
            <rect x="60" y="80" width="680" height="300" rx="8" fill="#161924" stroke="#cc0022" stroke-width="2"/>
            <path d="M 60 80 L 740 380" stroke="#cc0022" stroke-width="1" stroke-opacity="0.1"/>
            <text x="400" y="200" fill="#f8f9fa" font-family="'Cairo', sans-serif" font-size="24" font-weight="bold" text-anchor="middle">Ù…ÙˆÙ‚Ø¹Ø© ØªÙˆØ­ÙŠØ¯ Ø§Ù„Ù…Ù‚Ø§Ø·Ø¹Ø§Øª Ø§Ù„ÙƒØ¨Ø±Ù‰</text>
            <text x="400" y="240" fill="#ff9900" font-family="'Cairo', sans-serif" font-size="18" font-weight="700" text-anchor="middle">Ø´ÙŠÙ†: "Ø³Ø£ÙƒÙˆÙ† Ø£Ø¹Ø¸Ù… Ø¬Ù†Ø±Ø§Ù„ ØªØ­Øª Ù‡Ø°Ù‡ Ø§Ù„Ø³Ù…Ø§Ø¡!"</text>
            
            <!-- Ù„ÙˆØ­Ø© 2: Ù„ÙˆØ­Ø© ØªØ¹Ø¨ÙŠØ±ÙŠØ© Ù„Ù„Ù‚ØªØ§Ù„ -->
            <rect x="60" y="410" width="320" height="400" rx="8" fill="#241a22" stroke="#8a2be2" stroke-width="1"/>
            <text x="220" y="600" fill="#ff007f" font-family="'Cairo', sans-serif" font-size="22" font-weight="800" text-anchor="middle">ØµÙˆØª Ø§Ù„Ø³ÙŠÙˆÙ! *ÙƒÙ„Ø§Ø´*</text>
            
            <!-- Ù„ÙˆØ­Ø© 3: ÙˆØ¬Ù‡ Ø´ÙŠÙ† Ø§Ù„ØºØ§Ø¶Ø¨ -->
            <rect x="420" y="410" width="320" height="400" rx="8" fill="#162029" stroke="#00f0ff" stroke-width="1"/>
            <text x="580" y="600" fill="#00f0ff" font-family="'Cairo', sans-serif" font-size="22" font-weight="800" text-anchor="middle">Ù‡Ø¬ÙˆÙ… ÙƒØªÙŠØ¨Ø© Ø§Ù„Ù‡ÙŠ Ø´ÙŠÙ†!</text>
            
            <!-- Ù„ÙˆØ­Ø© 4: Ù…Ø´Ù‡Ø¯ Ø§Ø³ØªØ±Ø§ØªÙŠØ¬ÙŠ -->
            <rect x="60" y="840" width="680" height="250" rx="8" fill="#161924" stroke="#ff9900" stroke-width="1"/>
            <text x="400" y="965" fill="#9ba0b4" font-family="'Cairo', sans-serif" font-size="18" text-anchor="middle">Ø®Ø±ÙŠØ·Ø© Ø§Ù„ØªÙ‚Ø¯Ù… Ø§Ù„ØªÙƒØªÙŠÙƒÙŠ Ù„Ø¬ÙŠØ´ ØªØ´ÙŠÙ†</text>

            <!-- Ø§Ù„Ø¹Ù„Ø§Ù…Ø© Ø§Ù„Ù…Ø§Ø¦ÙŠØ© Ø§Ù„Ø­ØµØ±ÙŠØ© Ø§Ù„ÙƒØ¨ÙŠØ±Ø© (Glowing Neon Watermark) -->
            <g transform="rotate(-30 400 600)" opacity="0.12">
                <rect x="100" y="540" width="600" height="120" fill="#cc0022" rx="15"/>
                <text x="400" y="615" fill="#ffffff" font-family="'Cairo', sans-serif" font-size="40" font-weight="900" text-anchor="middle" letter-spacing="2">KAIRO / Ù…Ù†Ù‡ÙˆØ§ - Ø­ØµØ±ÙŠ</text>
            </g>
            
            <!-- Ø¹Ù„Ø§Ù…Ø© Ù…Ø§Ø¦ÙŠØ© ØµØºÙŠØ±Ø© Ø«Ø§Ø¨ØªØ© Ø¨Ø§Ù„Ø£Ø³ÙÙ„ -->
            <text x="400" y="1125" fill="#ff9900" font-family="'Cairo', sans-serif" font-size="16" font-weight="bold" text-anchor="middle">Ø­ØµØ±ÙŠ ÙˆÙ…ØªØ±Ø¬Ù… Ù„Ù€ KAIRO/Ù…Ù†Ù‡ÙˆØ§ - Ø§Ù„ÙØµÙ„ ${chapNum} - Ø§Ù„ØµÙØ­Ø© ${i}</text>
        </svg>
        `;
        const encoded = btoa(unescape(encodeURIComponent(svg)));
        pages.push(`data:image/svg+xml;base64,${encoded}`);
    }
    return pages;
}

// Ù…ÙˆÙ„Ø¯ Ø§Ù„ÙØµÙˆÙ„ Ø§Ù„ØªÙ„Ù‚Ø§Ø¦ÙŠ Ø§Ù„ØªÙØ§Ø¹Ù„ÙŠ Ù„ØªÙ‚Ù„ÙŠÙ„ Ø­Ø¬Ù… Ø§Ù„ÙƒÙˆØ¯ Ø§Ù„Ø¨Ø±Ù…Ø¬ÙŠ ÙˆØªÙˆÙÙŠØ± Ù‚Ø§Ø¹Ø¯Ø© Ø¨ÙŠØ§Ù†Ø§Øª ÙƒØ§Ù…Ù„Ø©
function populateDefaultChapters(maxChapters, isKingdom = false) {
    const chapters = [];
    for (let i = maxChapters; i >= 1; i--) {
        chapters.push({
            id: String(i),
            title: `Ø§Ù„ÙØµÙ„ ${i}: ${isKingdom ? 'Ù…ÙˆÙ‚Ø¹Ø© ØªÙˆØ­ÙŠØ¯ Ø§Ù„ØµÙŠÙ† Ø§Ù„Ø¹Ø¸Ù…Ù‰' : 'Ø¨Ø¯Ø§ÙŠØ© Ø§Ù„Ù…ØºØ§Ù…Ø±Ø© ÙˆØ§Ù„Ù‚ØªØ§Ù„'} ${isKingdom ? '(Ù…Ù„ÙˆÙ† ÙˆØ­ØµØ±ÙŠ)' : ''}`,
            date: new Date(Date.now() - (maxChapters - i) * 8 * 60 * 60 * 1000).toISOString().split('T')[0], // ØªÙˆØ§Ø±ÙŠØ® ÙˆØ§Ù‚Ø¹ÙŠØ© Ù…ØªØ³Ù„Ø³Ù„Ø©
            images: [] // Ù…ØµÙÙˆÙØ© ÙØ§Ø±ØºØ© Ø³ÙŠØªÙ… ØªÙˆÙ„ÙŠØ¯ ØµÙˆØ±Ù‡Ø§ Ø¯ÙŠÙ†Ø§Ù…ÙŠÙƒÙŠØ§Ù‹ Ø¹Ù„Ù‰ Ø§Ù„Ø·Ø§ÙŠØ± ÙÙŠ Ø§Ù„Ù‚Ø§Ø±Ø¦
        });
    }
    return chapters;
}

// Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø§ÙØªØ±Ø§Ø¶ÙŠØ© Ù„Ù„Ù…ÙˆÙ‚Ø¹
const DEFAULT_MANGAS = [
    {
        id: "1",
        title: "Ø³ÙˆÙ„Ùˆ Ù„ÙŠÙÙŠÙ„ÙŠÙ†Øº (Solo Leveling)",
        alternative: "Na Honjaman Level Up",
        author: "Chugong",
        cover: "solo_leveling_cover.jpg",
        banner: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1200&auto=format&fit=crop&q=80",
        rating: 4.9,
        status: "Ù…ÙƒØªÙ…Ù„",
        type: "Ù…Ù†Ù‡ÙˆØ§",
        views: 0,
        genres: ["Ø£ÙƒØ´Ù†", "Ù…ØºØ§Ù…Ø±Ø©", "Ø®ÙŠØ§Ù„", "Ù‚ÙˆÙ‰ Ø®Ø§Ø±Ù‚Ø©"],
        synopsis: "ÙÙŠ Ø¹Ø§Ù„Ù… ÙŠØ±Ø¨Ø· ÙÙŠÙ‡ Ø¨ÙˆØ§Ø¨Ø© ØºØ§Ù…Ø¶Ø© Ø¹Ø§Ù„Ù… Ø§Ù„Ø¨Ø´Ø± Ø¨Ø¹Ø§Ù„Ù… Ø§Ù„ÙˆØ­ÙˆØ´ØŒ ÙŠÙƒØªØ´Ù Ø§Ù„ØµÙŠØ§Ø¯ Ø§Ù„Ø£Ø¶Ø¹Ù Ø³ÙˆÙ†Øº Ø¬ÙŠÙ† ÙˆÙˆ Ù†Ø¸Ø§Ù…Ø§Ù‹ ØºØ§Ù…Ø¶Ø§Ù‹ ÙŠÙ…Ù†Ø­Ù‡ Ø§Ù„Ù‚Ø¯Ø±Ø© Ø§Ù„ÙØ±ÙŠØ¯Ø© Ø¹Ù„Ù‰ Ø±ÙØ¹ Ù…Ø³ØªÙˆØ§Ù‡ Ø¨Ù„Ø§ Ø­Ø¯ÙˆØ¯.",
        chapters: populateDefaultChapters(200, false)
    }
];

// ==========================================
// 1.5. Ø§Ù„Ø£Ø¯ÙˆØ§Øª Ø§Ù„Ù…Ø³Ø§Ø¹Ø¯Ø© (Utilities)
// ==========================================

function showToast(msg, type = 'info', duration = 3500) {
    const existing = document.querySelector('.kairo-toast');
    if (existing) existing.remove();
    const colors = { info: 'var(--color-primary)', success: '#00c853', error: '#ff1744', warning: '#ff9100' };
    const icons = { info: 'fa-circle-info', success: 'fa-check-circle', error: 'fa-circle-exclamation', warning: 'fa-triangle-exclamation' };
    const toast = document.createElement('div');
    toast.className = 'kairo-toast';
    toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}" style="flex-shrink:0;"></i><span>${msg}</span>`;
    toast.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:99999;background:var(--bg-surface);border-right:4px solid ${colors[type] || colors.info};border-radius:10px;padding:14px 18px;display:flex;align-items:center;gap:10px;font-size:0.85rem;color:var(--text-main);box-shadow:0 8px 32px rgba(0,0,0,0.4);max-width:380px;direction:rtl;animation:kairo-toast-in 0.3s ease;`;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(20px)'; toast.style.transition = 'all 0.3s ease'; setTimeout(() => toast.remove(), 300); }, duration);
}

function initScrollToTop() {
    const btn = document.createElement('button');
    btn.id = 'scroll-top-btn';
    btn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
    btn.style.cssText = 'position:fixed;bottom:80px;right:24px;z-index:9999;width:44px;height:44px;border-radius:50%;border:none;background:var(--color-primary);color:#fff;font-size:1.1rem;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.3);display:none;transition:all 0.3s ease;';
    document.body.appendChild(btn);
    btn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
    window.addEventListener('scroll', () => { btn.style.display = window.scrollY > 400 ? 'block' : 'none'; }, { passive: true });
}

function initLazyImages() {
    if ('IntersectionObserver' in window) {
        const obs = new IntersectionObserver((entries) => {
            entries.forEach(e => { if (e.isIntersecting) { const img = e.target; if (img.dataset.src) { img.src = img.dataset.src; img.removeAttribute('data-src'); } obs.unobserve(img); } });
        }, { rootMargin: '200px' });
        document.querySelectorAll('img[data-src]').forEach(img => obs.observe(img));
    }
}

function getRelatedMangas(manga, count = 6) {
    if (!state.mangas) return [];
    const genres = manga.genres || [];
    const scored = state.mangas.filter(m => m.id !== manga.id).map(m => {
        let score = 0;
        (m.genres || []).forEach(g => { if (genres.includes(g)) score += 2; });
        if (m.type === manga.type) score += 1;
        if (m.status === manga.status) score += 1;
        return { manga: m, score };
    });
    return scored.sort((a, b) => b.score - a.score).slice(0, count).map(s => s.manga);
}

// ==========================================
// 2. Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ø­Ø§Ù„Ø© Ø§Ù„Ø¹Ø§Ù…Ø© ÙˆØ§Ù„ØªØ®Ø²ÙŠÙ† (State Management)
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
        this.activeGenre = 'Ø§Ù„ÙƒÙ„';
        this.filterStatus = 'Ø§Ù„ÙƒÙ„';
        this.filterType = 'Ø§Ù„ÙƒÙ„';
        this.filterYearMin = '';
        this.filterYearMax = '';
        this.filterRatingMin = '';
        this.filterRatingMax = '';
        this.filterChaptersMin = '';
        this.filterChaptersMax = '';
        this.filterSort = 'Ø§Ù„Ø£Ø­Ø¯Ø«';
        this.filterTime = 'all';
        this.chapterSortOrder = 'newest';
        this.leaderboardTab = 'all';
        this.downloadProgress = {};
        this.showAuthModal = false;
        this.authModalTab = 'login';
        this.showSettingsModal = false;
        this.settingsTab = 'account';
        this.editMangaId = null;
        this.adminStats = null;
        this.adminStatsLoading = false;
        this.adminDateFrom = '';
        this.adminDateTo = '';
        this.loadScrapedMangas();
        
        this.profileUsername = '';
        this.userSearchQuery = '';
        this.userSearchResults = [];
        this.showUserSearch = false;
        this.userSearchDebounce = null;
        this.notifications = [];
        this.showNotifications = false;
        this.unreadNotifications = 0;
        
        this.showDailyReward = false;
        this.dailyRewardData = null;
        this.dailyRewardLoading = false;
        this.searchViewMode = 'grid';
        this.searchPage = 1;
        this.searchScope = 'Ø§Ù„ÙƒÙ„';
        this.browseShowFilters = false;
        
        if (this.sessionToken) {
            this.fetchAndMergeSettings();
            this.fetchUserProfile();
            this.fetchNotifications();
            this.fetchUnreadCount();
            this.checkDailyReward();
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
            const response = await fetch(`./scraped_mangas.json?v=${Date.now()}`);
            if (response.ok) {
                const scraped = await response.json();
                if (Array.isArray(scraped)) {
                    scraped.forEach(scManga => {
                        if (this.deletedIds && this.deletedIds.has(scManga.id)) return;
                        
                        // Enforce strictly descending order for chapters (Newest first) so navigation logic doesn't break
                        if (scManga.chapters && Array.isArray(scManga.chapters)) {
                            scManga.chapters.sort((a, b) => {
                                const na = parseFloat(a.number) || parseFloat((a.title || '').replace(/[^0-9.]/g, '')) || 0;
                                const nb = parseFloat(b.number) || parseFloat((b.title || '').replace(/[^0-9.]/g, '')) || 0;
                                return nb - na;
                            });
                        }
                        
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
                const chaptersCopy = (m.chapters || []).map(ch => {
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
                        if (settings.userProfile.points && (!this.userProfile.points || settings.userProfile.points > this.userProfile.points)) {
                            this.userProfile.points = settings.userProfile.points;
                        }
                        if (settings.userProfile.level && (!this.userProfile.level || settings.userProfile.level > this.userProfile.level)) {
                            this.userProfile.level = settings.userProfile.level;
                        }
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
                <div class="level-up-icon">ðŸŽ‰</div>
                <div class="level-up-text">
                    <h3>ØªÙ‡Ø§Ù†ÙŠÙ†Ø§!</h3>
                    <p>Ù„Ù‚Ø¯ ØµØ¹Ø¯Øª Ù„Ù„Ù…Ø³ØªÙˆÙ‰ <strong>${newLevel}</strong></p>
                    <p class="level-up-rank">Ø±ØªØ¨ØªÙƒ: ${rankName}</p>
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
            user: username || 'Ù…Ø¬Ù‡ÙˆÙ„',
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
            username: 'Ø£ÙˆØªÙ„Ø§ÙŠÙ†Ø± Ù…Ù…ÙŠØ²',
            points: 0,
            level: 1
        });
        this.sessionToken = localStorage.getItem('kairo_session_token') || null;
        this.userEmail = localStorage.getItem('kairo_user_email') || null;
        this.userRole = localStorage.getItem('kairo_user_role') || null;
        if (this.sessionToken && !this.userRole) {
            this.userRole = 'user';
        }
        // Frontend safety: only sherifahmed2686@gmail.com can be admin
        if (this.userRole === 'admin' && this.userEmail !== 'sherifahmed2686@gmail.com') {
            this.userRole = 'user';
        }
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
    if (level <= 30) return 'Ù…Ø¨ØªØ¯Ø¦';
    if (level <= 60) return 'Ù‚Ø§Ø±Ø¦ Ù…Ù…ØªØ§Ø²';
    if (level <= 99) return 'Ù‚Ø§Ø±Ø¦ Ø£Ø³Ø·ÙˆØ±ÙŠ';
    return 'Ù…Ø¯ÙŠØ± Ø§Ù„Ù…Ø´Ø±ÙˆØ¹';
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
                if (data.username) this.userProfile.username = data.username;
                this.userProfile.streak_days = data.streak_days || 0;
                this.userProfile.daily_claim_history = data.daily_claim_history || '';
                this.saveUserProfile();
            }
        } catch (e) {
            console.error("Failed to fetch user profile:", e);
        }
    }

    async fetchNotifications() {
        if (!this.sessionToken) return;
        try {
            const res = await fetch('/api/notifications', {
                headers: { 'Authorization': 'Bearer ' + this.sessionToken }
            });
            if (res.ok) this.notifications = await res.json();
        } catch (e) {
            console.error("Failed to fetch notifications:", e);
        }
    }

    async fetchUnreadCount() {
        if (!this.sessionToken) return;
        try {
            const res = await fetch('/api/notifications/unread-count', {
                headers: { 'Authorization': 'Bearer ' + this.sessionToken }
            });
            if (res.ok) {
                const data = await res.json();
                this.unreadNotifications = data.count || 0;
            }
        } catch (e) {
            console.error("Failed to fetch unread count:", e);
        }
    }

    async checkDailyReward() {
        if (!this.sessionToken) return;
        try {
            this.dailyRewardLoading = true;
            const res = await fetch('/api/rewards/status', {
                headers: { 'Authorization': 'Bearer ' + this.sessionToken }
            });
            if (res.ok) {
                const data = await res.json();
                this.dailyRewardData = data;
                this.showDailyReward = data.can_claim;
                renderApp();
            }
        } catch (e) {
            console.error("Failed to check daily reward:", e);
        }
        this.dailyRewardLoading = false;
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
            status: 'Ù…Ø³ØªÙ…Ø±',
            type: type || 'Ù…Ù†Ù‡ÙˆØ§',
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
                    alert("ØªÙ… Ø¥Ø¯Ø±Ø§Ø¬ Ø§Ù„Ø¹Ù…Ù„ Ø§Ù„ÙÙ†ÙŠ Ø¹Ù„Ù‰ Ø§Ù„Ø³ÙŠØ±ÙØ± Ø¨Ù†Ø¬Ø§Ø­!");
                    navigate('home');
                } else {
                    const err = await response.json();
                    alert(`ÙØ´Ù„ Ø§Ù„Ø­ÙØ¸: ${err.error || 'Ø®Ø·Ø£ ØºÙŠØ± Ù…Ø¹Ø±ÙˆÙ'}`);
                }
            } catch (e) {
                alert("Ø®Ø·Ø£ ÙÙŠ Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù… ÙˆØ­ÙØ¸ Ø§Ù„Ù…Ù†Ù‡ÙˆØ§.");
            }
        } else {
            this.mangas.unshift(newManga);
            this.saveMangas();
            alert("ØªÙ… Ø­ÙØ¸ Ø§Ù„Ù…Ù†Ù‡ÙˆØ§ Ù…Ø­Ù„ÙŠØ§Ù‹ (ØºÙŠØ± Ù…Ø³Ø¬Ù„Ø© Ø¹Ù„Ù‰ Ø§Ù„Ø³ÙŠØ±ÙØ± Ù„Ø£Ù†Ùƒ Ù„Ø³Øª Ø§Ù„Ù…Ø¯ÙŠØ±).");
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
            title: title || `Ø§Ù„ÙØµÙ„ ${chapterNo}`,
            date: new Date().toISOString().split('T')[0],
            images
        };

        const originalChapters = [...manga.chapters];
        manga.chapters = manga.chapters.filter(ch => ch.id !== String(chapterNo));
        manga.chapters.unshift(newChapter);
        manga.chapters.sort((a, b) => {
            const na = parseFloat(String(a.id).replace(/[^0-9.]/g, '')) || 0;
            const nb = parseFloat(String(b.id).replace(/[^0-9.]/g, '')) || 0;
            return nb - na;
        });

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
                    alert(`ØªÙ… Ø±ÙØ¹ ÙˆÙ†Ø´Ø± Ø§Ù„ÙØµÙ„ ${chapterNo} Ø¨Ù†Ø¬Ø§Ø­!`);
                    navigate('detail', mangaId);
                } else {
                    manga.chapters = originalChapters;
                    const err = await response.json();
                    alert(`ÙØ´Ù„ Ø¥Ø¶Ø§ÙØ© Ø§Ù„ÙØµÙ„: ${err.error || 'Ø®Ø·Ø£ ØºÙŠØ± Ù…Ø¹Ø±ÙˆÙ'}`);
                }
            } catch (e) {
                manga.chapters = originalChapters;
                alert("Ø®Ø·Ø£ ÙÙŠ Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø³ÙŠØ±ÙØ± ÙˆØ¥Ø¶Ø§ÙØ© Ø§Ù„ÙØµÙ„.");
            }
        } else {
            this.saveMangas();
            alert(`ØªÙ… Ø¥Ø¶Ø§ÙØ© Ø§Ù„ÙØµÙ„ ${chapterNo} Ù…Ø­Ù„ÙŠØ§Ù‹.`);
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
// 3. Ù…Ø­Ø±Ùƒ Ø§Ù„ØªÙ†Ù‚Ù„ ÙˆØ§Ù„ØªØ­ÙƒÙ… ÙˆØ§Ù„ÙˆØ§Ø¬Ù‡Ø§Øª (Routing & Views)
// ==========================================

// Ø¯Ø§Ù„Ø© Ù…ÙˆØ­Ø¯Ø© Ù„Ù…Ù‚Ø§Ø±Ù†Ø© ÙˆØªØ·Ø¨ÙŠØ¹ Ù…Ø¹Ø±ÙØ§Øª Ø§Ù„ÙØµÙˆÙ„ Ù„Ù…Ù†Ø¹ Ø£ÙŠ ØªØ¹Ø§Ø±Ø¶ ÙÙŠ Ø§Ù„Ø£Ù†ÙˆØ§Ø¹ Ø£Ùˆ Ø§Ù„ØªÙ†Ø³ÙŠÙ‚Ø§Øª
function normalizeChapterId(id) {
    if (id === null || id === undefined) return '';
    // Ø¥Ø²Ø§Ù„Ø© Ø£ÙŠ Ù…Ø¹Ø§Ù…Ù„Ø§Øª Ø¥Ø¶Ø§ÙÙŠØ© Ø¨Ø¹Ø¯ Ø¹Ù„Ø§Ù…Ø© Ø§Ù„Ø§Ø³ØªÙÙ‡Ø§Ù… Ø¥Ù† ÙˆØ¬Ø¯Øª (Ù…Ø«Ù„ ?v=1.9)
    let cleanId = String(id).split('?')[0].trim();
    // ØªØ­ÙˆÙŠÙ„ Ø§Ù„Ø£Ø±Ù‚Ø§Ù… Ø§Ù„Ø¹Ø´Ø±ÙŠØ© Ø§Ù„ØµØ§ÙÙŠØ© Ù…Ø«Ù„ 200.0 Ø¥Ù„Ù‰ 200
    if (!isNaN(cleanId) && cleanId.includes('.')) {
        const parsed = parseFloat(cleanId);
        if (parsed % 1 === 0) {
            return String(parsed);
        }
    }
    return cleanId;
}

function navigate(view, param1 = null, param2 = null) {
    let hash = '';
    if (view === 'home') {
        hash = '#/';
    } else if (view === 'detail') {
        hash = `#/manga/${param1}`;
    } else if (view === 'reader') {
        hash = `#/reader/${param1}/${param2}`;
    } else if (view === 'profile') {
        hash = `#/profile/${param1}`;
    } else if (view === 'search') {
        const q = encodeURIComponent(param1 || state.searchQuery || '');
        const viewMode = param2 || state.searchViewMode || 'grid';
        hash = `#/search?q=${q}&view=${viewMode}`;
    } else if (view === 'suggestions') {
        hash = '#/suggestions';
    } else {
        hash = `#/${view}`;
    }
    window.location.hash = hash;
}

async function handleRouting() {
    // Ø§Ù„ØªØ­ÙˆÙŠÙ„ Ø§Ù„ØªÙ„Ù‚Ø§Ø¦ÙŠ Ù„Ù„Ù…Ø³Ø§Ø±Ø§Øª Ø§Ù„Ù†Ø¸ÙŠÙØ© (Clean URLs) Ø¥Ù„Ù‰ Ù…Ø³Ø§Ø±Ø§Øª Ø§Ù„Ù‡Ø§Ø´ (Hash URLs) Ù„Ù…Ù†Ø¹ Ø§Ù„ØªÙˆØ¬ÙŠÙ‡ Ø§Ù„Ø®Ø§Ø·Ø¦
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
    } else if (hash.startsWith('#/profile/')) {
        state.currentView = 'profile';
        state.profileUsername = hash.replace('#/profile/', '').split('/')[0];
        state.activeMangaId = null;
        state.activeChapterId = null;
    } else if (hash.startsWith('#/leaderboard')) {
        state.currentView = 'leaderboard';
        state.activeMangaId = null;
        state.activeChapterId = null;
    } else if (hash.startsWith('#/search')) {
        state.currentView = 'search';
        const params = new URLSearchParams(hash.split('?')[1] || '');
        state.searchQuery = params.get('q') || '';
        state.searchViewMode = params.get('view') || 'grid';
        state.activeMangaId = null;
        state.activeChapterId = null;
    } else if (hash.startsWith('#/suggestions')) {
        state.currentView = 'suggestions';
        state.activeMangaId = null;
        state.activeChapterId = null;
    } else if (hash.startsWith('#/announcements')) {
        state.currentView = 'announcements';
        state.activeMangaId = null;
        state.activeChapterId = null;
    } else if (hash.startsWith('#/store')) {
        state.currentView = 'store';
        state.activeMangaId = null;
        state.activeChapterId = null;
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
    
    // SEO: ØªØ­Ø¯ÙŠØ« meta tags Ø¯ÙŠÙ†Ø§Ù…ÙŠÙƒÙŠØ§Ù‹ Ø­Ø³Ø¨ Ø§Ù„Ù…Ø³Ø§Ø±
    var seoTitle = 'KAIRO / Ù…Ù†Ù‡ÙˆØ§ - Ù…Ù†ØµØ© Ù‚Ø±Ø§Ø¡Ø© Ø§Ù„Ù…Ø§Ù†Ø¬Ø§ ÙˆØ§Ù„Ù…Ù†Ù‡ÙˆØ§ Ø§Ù„Ø£ÙˆÙ„Ù‰';
    var seoDesc = 'Ù…Ù†ØµØ© KAIRO/Ù…Ù†Ù‡ÙˆØ§ - Ø§Ù‚Ø±Ø£ Ø§Ù„Ù…Ø§Ù†Ø¬Ø§ ÙˆØ§Ù„Ù…Ù†Ù‡ÙˆØ§ Ø§Ù„Ù…ÙØ¶Ù„Ø© Ù„Ø¯ÙŠÙƒ Ø¨Ø¬ÙˆØ¯Ø© Ø¹Ø§Ù„ÙŠØ© ÙˆØ¨Ø¯ÙˆÙ† Ø¥Ø¹Ù„Ø§Ù†Ø§Øª Ù…Ø²Ø¹Ø¬Ø©.';
    var seoImg = '';
    
    if (state.currentView === 'detail' && state.activeMangaId) {
        var manga = state.mangas.find(function(m) { return m.id === state.activeMangaId; });
        if (manga) {
            seoTitle = manga.title + ' | KAIRO / Ù…Ù†Ù‡ÙˆØ§';
            seoDesc = manga.synopsis ? manga.synopsis.substring(0, 200) : seoDesc;
            seoImg = getDisplayCover(manga);
        }
    } else if (state.currentView === 'reader' && state.activeMangaId && state.activeChapterId) {
        var mangaR = state.mangas.find(function(m) { return m.id === state.activeMangaId; });
        if (mangaR && Array.isArray(mangaR.chapters)) {
            var chapter = mangaR.chapters.find(function(c) { return normalizeChapterId(c.id) === normalizeChapterId(state.activeChapterId); });
            seoTitle = mangaR.title + ' - ' + (chapter ? chapter.title : 'ÙØµÙ„ ' + state.activeChapterId) + ' | KAIRO / Ù…Ù†Ù‡ÙˆØ§';
            seoDesc = 'Ø§Ù‚Ø±Ø£ ' + mangaR.title + ' Ø§Ù„ÙØµÙ„ ' + state.activeChapterId + ' Ø¹Ù„Ù‰ KAIRO/Ù…Ù†Ù‡ÙˆØ§';
            seoImg = getDisplayCover(mangaR);
        }
    } else if (state.currentView === 'bookmarks') {
        seoTitle = 'Ø§Ù„Ù…ÙØ¶Ù„Ø© | KAIRO / Ù…Ù†Ù‡ÙˆØ§';
        seoDesc = 'Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ù…Ø§Ù†Ø¬Ø§ ÙˆØ§Ù„Ù…Ù†Ù‡ÙˆØ§ Ø§Ù„Ù…ÙØ¶Ù„Ø© Ù„Ø¯ÙŠÙƒ Ø¹Ù„Ù‰ KAIRO/Ù…Ù†Ù‡ÙˆØ§';
    } else if (state.currentView === 'history') {
        seoTitle = 'Ø³Ø¬Ù„ Ø§Ù„Ù‚Ø±Ø§Ø¡Ø© | KAIRO / Ù…Ù†Ù‡ÙˆØ§';
        seoDesc = 'Ø³Ø¬Ù„ Ù‚Ø±Ø§Ø¡Ø© Ø§Ù„Ù…Ø§Ù†Ø¬Ø§ ÙˆØ§Ù„Ù…Ù†Ù‡ÙˆØ§ Ø¹Ù„Ù‰ KAIRO/Ù…Ù†Ù‡ÙˆØ§';
    } else if (state.currentView === 'downloads') {
        seoTitle = 'Ø§Ù„ÙØµÙˆÙ„ Ø§Ù„Ù…Ø­Ù…Ù„Ø© | KAIRO / Ù…Ù†Ù‡ÙˆØ§';
        seoDesc = 'Ø§Ù„ÙØµÙˆÙ„ Ø§Ù„Ù…Ø­Ù…Ù„Ø© Ù„Ù„Ù‚Ø±Ø§Ø¡Ø© Ø¯ÙˆÙ† Ø§ØªØµØ§Ù„ Ø¹Ù„Ù‰ KAIRO/Ù…Ù†Ù‡ÙˆØ§';
    } else if (state.currentView === 'admin') {
        seoTitle = 'Ù„ÙˆØ­Ø© Ø§Ù„Ø¥Ø¯Ø§Ø±Ø© | KAIRO / Ù…Ù†Ù‡ÙˆØ§';
        seoDesc = 'Ù„ÙˆØ­Ø© ØªØ­ÙƒÙ… ÙˆØ¥Ø¯Ø§Ø±Ø© Ù…ÙˆÙ‚Ø¹ KAIRO/Ù…Ù†Ù‡ÙˆØ§';
    } else if (state.currentView === 'profile') {
        seoTitle = (state.profileUsername || 'Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…') + ' | KAIRO / Ù…Ù†Ù‡ÙˆØ§';
        seoDesc = 'Ù…Ù„Ù ØªØ¹Ø±ÙŠÙ Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… Ø¹Ù„Ù‰ KAIRO/Ù…Ù†Ù‡ÙˆØ§';
    } else if (state.currentView === 'leaderboard') {
        seoTitle = 'Ø§Ù„Ù…ØªØµØ¯Ø±ÙŠÙ† | KAIRO / Ù…Ù†Ù‡ÙˆØ§';
        seoDesc = 'Ù‚Ø§Ø¦Ù…Ø© Ø£ÙƒØ«Ø± Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…ÙŠÙ† Ù†Ø´Ø§Ø·Ø§Ù‹ ÙˆÙ†Ù‚Ø§Ø·Ø§Ù‹ Ø¹Ù„Ù‰ KAIRO/Ù…Ù†Ù‡ÙˆØ§';
    } else if (state.currentView === 'suggestions') {
        root.innerHTML = `<div class="page-fade-enter">${SuggestionsViewComponent()}</div>`;
    } else if (state.currentView === 'announcements') {
        seoTitle = 'Ø§Ù„Ø¥Ø¹Ù„Ø§Ù†Ø§Øª | KAIRO / Ù…Ù†Ù‡ÙˆØ§';
        seoDesc = 'Ø¢Ø®Ø± Ø§Ù„Ø¥Ø¹Ù„Ø§Ù†Ø§Øª ÙˆØ§Ù„ØªØ­Ø¯ÙŠØ«Ø§Øª Ø¹Ù„Ù‰ KAIRO/Ù…Ù†Ù‡ÙˆØ§';
    } else if (state.currentView === 'store') {
        seoTitle = 'Ø§Ù„Ù…ØªØ¬Ø± | KAIRO / Ù…Ù†Ù‡ÙˆØ§';
        seoDesc = 'Ø§Ø³ØªØ¨Ø¯Ù„ Ù†Ù‚Ø§Ø·Ùƒ Ø¨Ø¹Ù†Ø§ØµØ± Ø­ØµØ±ÙŠØ© ÙÙŠ Ù…ØªØ¬Ø± KAIRO/Ù…Ù†Ù‡ÙˆØ§';
    } else if (state.currentView === 'search') {
        const q = state.searchQuery || '';
        seoTitle = q ? `Ø¨Ø­Ø«: ${q} | KAIRO / Ù…Ù†Ù‡ÙˆØ§` : 'Ø¨Ø­Ø« Ù…ØªÙ‚Ø¯Ù… | KAIRO / Ù…Ù†Ù‡ÙˆØ§';
        seoDesc = q ? `Ù†ØªØ§Ø¦Ø¬ Ø§Ù„Ø¨Ø­Ø« Ø¹Ù† "${q}" ÙÙŠ KAIRO/Ù…Ù†Ù‡ÙˆØ§` : 'Ø§Ø¨Ø­Ø« Ø¹Ù† Ù…Ø§Ù†Ø¬Ø§ØŒ Ù…Ø§Ù†Ù‡ÙˆØ§ØŒ ÙˆÙ…Ø³ØªØ®Ø¯Ù…ÙŠÙ† ÙÙŠ KAIRO/Ù…Ù†Ù‡ÙˆØ§';
    } else if (state.currentView === 'chat') {
        seoTitle = 'Ø§Ù„Ø´Ø§Øª Ø§Ù„Ø¹Ø§Ù… | KAIRO / Ù…Ù†Ù‡ÙˆØ§';
        seoDesc = 'ØªØ­Ø¯Ø« Ù…Ø¹ Ù…Ø¬ØªÙ…Ø¹ Ø§Ù„Ù‚Ø±Ø§Ø¡ Ø¹Ù„Ù‰ KAIRO/Ù…Ù†Ù‡ÙˆØ§';
    } else if (state.currentView === 'reset-password') {
        seoTitle = 'Ø§Ø³ØªØ¹Ø§Ø¯Ø© ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± | KAIRO / Ù…Ù†Ù‡ÙˆØ§';
        seoDesc = 'Ø§Ø³ØªØ¹Ø§Ø¯Ø© ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ù„Ø­Ø³Ø§Ø¨Ùƒ Ø¹Ù„Ù‰ KAIRO/Ù…Ù†Ù‡ÙˆØ§';
    }
    
    updateSEOMeta(seoTitle, seoDesc, seoImg);
    
    state.isLoading = false;
    window.scrollTo(0, 0);
        if (state.activeMangaId && (state.currentView === 'detail' || state.currentView === 'reader')) {
        await fetchMangaDetails(state.activeMangaId);
    }
    renderApp();
}

// Ø§Ø³ØªÙ…Ø§Ø¹ Ù„ØªØºÙŠØ±Ø§Øª Ø§Ù„Ù‡Ø§Ø´ ÙÙŠ Ø§Ù„Ù…ØªØµÙØ­ Ù„Ù„ØªÙ†Ù‚Ù„
window.addEventListener('hashchange', handleRouting);

function updateSEOMeta(title, description, image) {
    document.title = title || 'KAIRO / Ù…Ù†Ù‡ÙˆØ§ - Ù…Ù†ØµØ© Ù‚Ø±Ø§Ø¡Ø© Ø§Ù„Ù…Ø§Ù†Ø¬Ø§ ÙˆØ§Ù„Ù…Ù†Ù‡ÙˆØ§ Ø§Ù„Ø£ÙˆÙ„Ù‰';
    let desc = description || 'Ù…Ù†ØµØ© KAIRO/Ù…Ù†Ù‡ÙˆØ§ - Ø§Ù‚Ø±Ø£ Ø§Ù„Ù…Ø§Ù†Ø¬Ø§ ÙˆØ§Ù„Ù…Ù†Ù‡ÙˆØ§ Ø§Ù„Ù…ÙØ¶Ù„Ø© Ù„Ø¯ÙŠÙƒ Ø¨Ø¬ÙˆØ¯Ø© Ø¹Ø§Ù„ÙŠØ© ÙˆØ¨Ø¯ÙˆÙ† Ø¥Ø¹Ù„Ø§Ù†Ø§Øª Ù…Ø²Ø¹Ø¬Ø©. ØªØ¯Ø¹Ù… Ø§Ù„ØªØ­Ù…ÙŠÙ„ ÙˆØ§Ù„Ù‚Ø±Ø§Ø¡Ø© Ø¯ÙˆÙ† Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø¥Ù†ØªØ±Ù†Øª.';
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

window._hasPrefetchedNextChapter = false;
window._nextChapterImages = null;

function prefetchNextChapter(images) {
    if (!images || !Array.isArray(images) || window._hasPrefetchedNextChapter) return;
    window._hasPrefetchedNextChapter = true;
    
    // Only prefetch the first 5 images to avoid slowing down the current chapter
    const toPrefetch = images.slice(0, 5);
    toPrefetch.forEach(url => {
        const img = new Image();
        img.src = getProxiedImageUrl(url);
    });
}

// ==========================================
// 4. Ø¨Ù†Ø§Ø¡ Ø§Ù„Ù…ÙƒÙˆÙ†Ø§Øª (UI Components Rendering)
// ==========================================

// Ø´Ø±ÙŠØ· Ø§Ù„ØªÙ†Ù‚Ù„ Ø§Ù„Ø¹Ù„ÙˆÙŠ
function HeaderComponent() {
    const activeView = state.currentView;
    const s = state;
    const isAdmin = state.userRole === 'admin';
    const adminButton = isAdmin ? `<button class="admin-btn" id="nav-admin"><i class="fa-solid fa-sliders"></i> Ø§Ù„Ø¥Ø¯Ø§Ø±Ø©</button>` : '';

    let rightSection = '';
    
    // =====================================
    // MODALS HTML (Formerly Dropdowns)
    // =====================================
    const rewardsHtml = `
        <div id="rewards-dropdown" class="top-dropdown">
            <div class="close-modal-btn" onclick="window.toggleTopDropdown('rewards-dropdown')"><i class="fa-solid fa-xmark"></i></div>
            <div class="rewards-header">
                <div class="rewards-title"><i class="fa-solid fa-gift" style="color:var(--primary-color);"></i> Ø§Ù„Ù…ÙƒØ§ÙØ¢Øª Ø§Ù„ÙŠÙˆÙ…ÙŠØ©</div>
                <div class="rewards-subtitle">Ø§Ù„ÙŠÙˆÙ… 2 Ù…Ù† 7 <i class="fa-solid fa-fire" style="color:#e67e22;"></i> ÙŠÙˆÙ… Ù…ØªØªØ§Ù„Ù</div>
            </div>
            <div class="rewards-grid">
                <div class="reward-card completed">
                    <div class="reward-day">1</div>
                    <div class="reward-icon-box"><i class="fa-solid fa-check"></i></div>
                    <div class="reward-prizes" style="font-size:1rem; margin-top:5px;">5 <i class="fa-solid fa-star" style="font-size:0.7rem;"></i></div>
                </div>
                <div class="reward-card completed">
                    <div class="reward-day">2</div>
                    <div class="reward-icon-box"><i class="fa-solid fa-check"></i></div>
                    <div class="reward-prizes" style="font-size:1rem; margin-top:5px;">10 <i class="fa-solid fa-star" style="font-size:0.7rem;"></i></div>
                </div>
                <div class="reward-card locked">
                    <div class="reward-day">3</div>
                    <div class="reward-icon-box"><i class="fa-solid fa-lock"></i></div>
                    <div class="reward-prizes" style="font-size:1rem; margin-top:5px;">15 <i class="fa-solid fa-star" style="font-size:0.7rem;"></i></div>
                </div>
                <div class="reward-card locked">
                    <div class="reward-day">4</div>
                    <div class="reward-icon-box"><i class="fa-solid fa-lock"></i></div>
                    <div class="reward-prizes" style="font-size:1rem; margin-top:5px;">20 <i class="fa-solid fa-star" style="font-size:0.7rem;"></i></div>
                </div>
                <div class="reward-card locked">
                    <div class="reward-day">5</div>
                    <div class="reward-icon-box"><i class="fa-solid fa-lock"></i></div>
                    <div class="reward-prizes" style="font-size:1rem; margin-top:5px;">25 <i class="fa-solid fa-star" style="font-size:0.7rem;"></i></div>
                </div>
                <div class="reward-card locked">
                    <div class="reward-day">6</div>
                    <div class="reward-icon-box"><i class="fa-solid fa-lock"></i></div>
                    <div class="reward-prizes" style="font-size:1rem; margin-top:5px;">30 <i class="fa-solid fa-star" style="font-size:0.7rem;"></i></div>
                </div>
                <div class="reward-card wide locked">
                    <div>
                        <div class="reward-day" style="font-weight:bold; color:#fff;">Ø§Ù„ÙŠÙˆÙ… 7</div>
                        <div style="font-size:0.7rem; color:var(--text-muted);">Ù…ÙƒØ§ÙØ£Ø© Ø§Ù„Ø£Ø³Ø¨ÙˆØ¹ <span style="background:#f39c12; color:#000; padding:2px 5px; border-radius:4px; font-weight:bold;">Ù…Ø¶Ø§Ø¹Ù</span></div>
                        <div class="reward-prizes" style="margin-top:5px; font-size:1rem;">50 <i class="fa-solid fa-star" style="font-size:0.7rem;"></i></div>
                    </div>
                    <div class="reward-icon-box" style="width:40px; height:40px;"><i class="fa-solid fa-lock"></i></div>
                </div>
            </div>
        </div>
    `;

    const themeHtml = `
        <div id="theme-dropdown" class="top-dropdown">
            <div class="close-modal-btn" onclick="window.toggleTopDropdown('theme-dropdown')"><i class="fa-solid fa-xmark"></i></div>
            <div class="theme-header">
                <div style="font-weight:bold;"><i class="fa-solid fa-palette" style="color:var(--primary-color);"></i> Ø§Ù„Ù…Ø¸Ù‡Ø±</div>
                <div style="font-size:0.8rem; color:var(--text-muted);">Ø§Ø®ØªØ± Ø§Ù„Ù…Ø¸Ù‡Ø± Ø§Ù„Ø°ÙŠ ÙŠÙ†Ø§Ø³Ø¨Ùƒ</div>
            </div>
            <div class="theme-tabs">
                <div class="theme-tab active" onclick="setThemeMode('dark')"><i class="fa-regular fa-moon"></i> Ø§Ù„ÙˆØ¶Ø¹ Ø§Ù„Ø¯Ø§ÙƒÙ†</div>
                <div class="theme-tab" onclick="setThemeMode('light')"><i class="fa-regular fa-sun"></i> Ø§Ù„ÙˆØ¶Ø¹ Ø§Ù„ÙØ§ØªØ­</div>
            </div>
            <div style="padding:0 15px; font-weight:bold; font-size:0.9rem; color:var(--primary-color); display:flex; align-items:center; gap:8px;">
                <i class="fa-solid fa-wand-magic-sparkles"></i> Ø§Ù„Ù…Ø¬Ù…ÙˆØ¹Ø§Øª Ø§Ù„Ø¯Ø§ÙƒÙ†Ø©
            </div>
            <div class="themes-grid">
                <div class="theme-preview-card active" onclick="applyTheme('default')">
                    <div class="theme-preview-mockup" style="background:#1a1c23; border:1px solid #2a2d3a;">
                        <div style="position:absolute; top:5px; right:5px; width:20px; height:3px; background:#8e44ad; border-radius:2px;"></div>
                        <div style="position:absolute; top:12px; right:5px; width:15px; height:15px; border-radius:50%; background:#3498db;"></div>
                    </div>
                    <div class="theme-preview-name">MangaTime Dark</div>
                </div>
                <div class="theme-preview-card" onclick="applyTheme('midnight-blue')">
                    <div class="theme-preview-mockup" style="background:#0B1021; border:1px solid #232C4A;">
                        <div style="position:absolute; top:5px; right:5px; width:20px; height:3px; background:#3B82F6; border-radius:2px;"></div>
                        <div style="position:absolute; top:12px; right:5px; width:15px; height:15px; border-radius:50%; background:#10B981;"></div>
                    </div>
                    <div class="theme-preview-name">Midnight Blue</div>
                </div>
                <div class="theme-preview-card" onclick="applyTheme('signature-dark')">
                    <div class="theme-preview-mockup" style="background:#121212; border:1px solid #333333;">
                        <div style="position:absolute; top:5px; right:5px; width:20px; height:3px; background:#BB86FC; border-radius:2px;"></div>
                        <div style="position:absolute; top:12px; right:5px; width:15px; height:15px; border-radius:50%; background:#CF6679;"></div>
                    </div>
                    <div class="theme-preview-name">Signature Dark</div>
                </div>
            </div>
        </div>
    `;

    const notifHtml = `
        <div id="notifications-dropdown" class="top-dropdown">
            <div class="close-modal-btn" onclick="window.toggleTopDropdown('notifications-dropdown')"><i class="fa-solid fa-xmark"></i></div>
            <div class="notif-header">
                <div style="font-weight:bold;">Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª</div>
                <div style="display:flex; gap:15px; color:var(--text-muted); cursor:pointer; margin-left:30px;">
                    <i class="fa-solid fa-check-double" title="ØªØ­Ø¯ÙŠØ¯ Ø§Ù„ÙƒÙ„ ÙƒÙ…Ù‚Ø±ÙˆØ¡"></i>
                    <i class="fa-solid fa-trash-can" title="Ø­Ø°Ù Ø§Ù„ÙƒÙ„"></i>
                    <i class="fa-solid fa-gear" onclick="window.toggleTopDropdown('notifications-dropdown'); window.navigateView('settings'); state.settingsTab='notifications'; renderApp();" title="Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª"></i>
                </div>
            </div>
            <div class="notif-tabs">
                <div class="notif-tab active">Ø§Ù„ÙƒÙ„</div>
                <div class="notif-tab">ØºÙŠØ± Ù…Ù‚Ø±ÙˆØ¡</div>
            </div>
            <div class="notif-empty">
                <i class="fa-regular fa-bell"></i>
                <div>Ù„Ø§ Ø¥Ø´Ø¹Ø§Ø±Ø§Øª Ø­ØªÙ‰ Ø§Ù„Ø¢Ù†</div>
            </div>
            <div class="notif-footer">
                <a onclick="window.toggleTopDropdown('notifications-dropdown'); window.navigateView('profile');" style="cursor:pointer;">Ø¹Ø±Ø¶ Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª <i class="fa-solid fa-arrow-up-right-from-square"></i></a>
            </div>
        </div>
    `;

    const userMenuHtml = `
        <div id="user-dropdown" class="top-dropdown">
            <div class="close-modal-btn" onclick="window.toggleTopDropdown('user-dropdown')"><i class="fa-solid fa-xmark"></i></div>
            <div class="user-menu-header">
                <div class="user-menu-avatar">
                    <img src="https://via.placeholder.com/50" alt="Avatar" style="width:100%; height:100%; border-radius:50%;">
                    <div class="user-menu-status"></div>
                </div>
                <div class="user-menu-info">
                    <h4>${s.sessionToken ? getUserHandle(s.userEmail) : 'Guest'}</h4>
                    <p>@${s.sessionToken ? getUserHandle(s.userEmail) : 'guest'}</p>
                </div>
            </div>
            <a class="user-menu-link" style="cursor:pointer;" onclick="window.toggleTopDropdown('user-dropdown'); window.navigateView('profile');">Ø§ÙØªØ­ Ù…Ù„ÙÙƒ Ù„Ø±Ø¤ÙŠØ© Ø§Ù„Ù†Ø´Ø§Ø·ØŒ Ø§Ù„Ù…ÙƒØªØ¨Ø©ØŒ ÙˆØ§Ù„Ø¥Ù†Ø¬Ø§Ø²Ø§Øª.</a>
            
            <div style="padding:10px 0;">
                <div style="padding:0 20px 5px; font-size:0.75rem; color:var(--text-muted);">Ø­Ø³Ø§Ø¨ÙŠ</div>
                <a class="user-menu-item" style="cursor:pointer;" onclick="window.toggleTopDropdown('user-dropdown'); window.navigateView('profile');"><i class="fa-regular fa-user"></i> Ø§Ù„Ù…Ù„Ù Ø§Ù„Ø´Ø®ØµÙŠ</a>
                <a class="user-menu-item" style="cursor:pointer;" onclick="window.toggleTopDropdown('user-dropdown'); window.navigateView('bookmarks');"><i class="fa-solid fa-book-open"></i> Ù…ÙƒØªØ¨ØªÙŠ</a>
                <a class="user-menu-item" style="cursor:pointer;" onclick="window.toggleTopDropdown('user-dropdown'); window.toggleTopDropdown('notifications-dropdown');"><i class="fa-regular fa-bell"></i> Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª</a>
                <a class="user-menu-item" style="cursor:pointer;" onclick="window.toggleTopDropdown('user-dropdown');"><i class="fa-solid fa-award"></i> Ø¥Ù†Ø¬Ø§Ø²Ø§ØªÙŠ</a>
                <a class="user-menu-item" style="cursor:pointer;" onclick="window.toggleTopDropdown('user-dropdown');"><i class="fa-solid fa-crown" style="color:#f1c40f;"></i> Ø§Ø´ØªØ±Ø§ÙƒÙŠ</a>
                <a class="user-menu-item" style="cursor:pointer;" onclick="window.toggleTopDropdown('user-dropdown'); window.navigateView('suggestions');"><i class="fa-solid fa-envelope-open-text" style="color:#ff007f;"></i> Ø§Ù„Ø§Ù‚ØªØ±Ø§Ø­Ø§Øª ÙˆØ§Ù„Ø´ÙƒØ§ÙˆÙŠ</a>
                <a class="user-menu-item" style="cursor:pointer;" onclick="window.toggleTopDropdown('user-dropdown'); window.navigateView('settings');"><i class="fa-solid fa-gear"></i> Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª</a>
            </div>
            <div style="border-top:1px solid rgba(255,255,255,0.05); padding:10px 0;">
                <a class="user-menu-item danger" style="cursor:pointer;" onclick="window.performLogout()"><i class="fa-solid fa-arrow-right-from-bracket"></i> ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø®Ø±ÙˆØ¬</a>
            </div>
        </div>
    `;

    if (state.sessionToken) {
        const userInitial = getUserInitial(state.userEmail);
        const unreadNotif = state.unreadNotifications || 0;
        
        rightSection = `
            <div style="display:flex; align-items:center; gap:20px; position:relative;">
                
                <div>
                    <div onclick="toggleTopDropdown('rewards-dropdown')" style="display:flex; gap:5px; align-items:center; font-weight:bold; color:#f39c12; cursor:pointer;">
                        1 <i class="fa-solid fa-fire" style="color:#8e44ad; text-shadow:0 0 5px #8e44ad;"></i><i class="fa-solid fa-fire" style="color:#8e44ad; text-shadow:0 0 5px #8e44ad; margin-right:-8px;"></i>
                    </div>
                    ${rewardsHtml}
                </div>

                <div>
                    <div onclick="toggleTopDropdown('theme-dropdown')" style="color:var(--text-muted); cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-palette"></i></div>
                    ${themeHtml}
                </div>

                <div>
                    <div onclick="toggleTopDropdown('notifications-dropdown')" style="color:var(--text-muted); cursor:pointer; font-size:1.2rem; position:relative;">
                        <i class="fa-regular fa-bell"></i>
                        ${unreadNotif > 0 ? `<span class="mangatime-badge" style="position:absolute; top:-5px; right:-5px; background:red; color:white; border-radius:50%; font-size:0.6rem; padding:2px 5px;">${unreadNotif}</span>` : ''}
                    </div>
                    ${notifHtml}
                </div>
                
                <div>
                    <div class="mangatime-user-avatar" onclick="toggleTopDropdown('user-dropdown')" style="width:35px; height:35px; background:var(--primary-color); border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; cursor:pointer;">
                        ${userInitial}
                    </div>
                    ${userMenuHtml}
                </div>
            </div>
        `;
    } else {
        rightSection = `
            <button class="login-navbar-btn" id="open-login-btn">
                <i class="fa-solid fa-right-to-bracket"></i>
                <span>ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„</span>
            </button>
        `;
    }

    let suggestionsHtml = '';
    if (state.showSearchSuggestions && state.searchQuery && state.searchQuery.trim() !== '' && state.mangas) {
        const query = state.searchQuery.toLowerCase().trim();
        const mangaMatches = state.mangas.filter(m => 
            m.title.toLowerCase().includes(query) || 
            (m.alternative && m.alternative.toLowerCase().includes(query))
        ).slice(0, 5);
        
        if (mangaMatches.length > 0) {
            suggestionsHtml = `
            <div class="search-suggestions-dropdown" id="search-suggestions">
                <div class="suggestions-category">Ø§Ù„Ù†ØªØ§Ø¦Ø¬</div>
                ${mangaMatches.map(m => `
                    <div class="suggestion-item" data-id="${m.id}" data-action="manga">
                        <img src="${getDisplayCover(m)}" class="suggestion-cover" alt="${m.title}">
                        <div class="suggestion-info">
                            <span class="suggestion-title">${m.title}</span>
                            ${m.alternative ? `<span class="suggestion-alt">${m.alternative}</span>` : ''}
                        </div>
                    </div>
                `).join('')}
                <div class="suggestion-item suggestion-view-all" data-action="search">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <span>Ø¹Ø±Ø¶ ÙƒÙ„ Ø§Ù„Ù†ØªØ§Ø¦Ø¬ Ø¹Ù† "${state.searchQuery}"</span>
                </div>
            </div>
            `;
        } else {
            suggestionsHtml = `
            <div class="search-suggestions-dropdown" id="search-suggestions">
                <div class="suggestion-item suggestion-view-all" data-action="search">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <span>Ø¨Ø­Ø« Ø¹Ù† "${state.searchQuery}"</span>
                </div>
            </div>
            `;
        }
    }

    return `
    <header class="header">
        <a class="header-logo" id="logo-btn" onclick="window.navigateView('home');" style="cursor:pointer;">KAIRO<span>/Ù…Ù†Ù‡ÙˆØ§</span></a>
        
        <nav class="header-nav">
            <span class="nav-link ${activeView === 'home' ? 'active' : ''}" id="nav-home" onclick="window.navigateView('home');"><i class="fa-solid fa-house-chimney"></i> Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©</span>
            <span class="nav-link ${activeView === 'bookmarks' ? 'active' : ''}" id="nav-bookmarks" onclick="window.navigateView('bookmarks');"><i class="fa-solid fa-heart"></i> Ù…ÙƒØªØ¨ØªÙŠ</span>
            <span class="nav-link ${activeView === 'downloads' ? 'active' : ''}" id="nav-downloads" onclick="window.navigateView('downloads');"><i class="fa-solid fa-circle-down"></i> Ø§Ù„ØªÙ†Ø²ÙŠÙ„Ø§Øª</span>
            <span class="nav-link ${activeView === 'history' ? 'active' : ''}" id="nav-history" onclick="window.navigateView('history');"><i class="fa-solid fa-clock-rotate-left"></i> Ø§Ù„Ø³Ø¬Ù„</span>
            <div style="position:relative;display:inline-block;">
                <span class="nav-link ${activeView === 'leaderboard' || activeView === 'store' || activeView === 'announcements' || activeView === 'chat' ? 'active' : ''}" id="nav-community"><i class="fa-solid fa-users"></i> Ø§Ù„Ù…Ø¬ØªÙ…Ø¹ <i class="fa-solid fa-caret-down" style="font-size:0.6rem;"></i></span>
                <div class="community-dropdown" id="community-dropdown">
                    <div class="community-dropdown-item" id="nav-leaderboard"><i class="fa-solid fa-trophy"></i> Ø§Ù„ØªØµÙ†ÙŠÙØ§Øª</div>
                    <div class="community-dropdown-item" id="nav-store"><i class="fa-solid fa-store"></i> Ø§Ù„Ù…ØªØ¬Ø±</div>
                    <div class="community-dropdown-item" id="nav-announcements"><i class="fa-solid fa-bullhorn"></i> Ø§Ù„Ø¥Ø¹Ù„Ø§Ù†Ø§Øª</div>
                    <div class="community-dropdown-item" id="nav-chat"><i class="fa-solid fa-comment-dots"></i> Ø§Ù„Ø¯Ø±Ø¯Ø´Ø©</div>
                </div>
            </div>
            <span class="nav-link ${activeView === 'suggestions' ? 'active' : ''}" id="nav-suggestions" onclick="window.navigateView('suggestions');"><i class="fa-solid fa-envelope-open-text"></i> Ø§Ù„Ø§Ù‚ØªØ±Ø§Ø­Ø§Øª ÙˆØ§Ù„Ø´ÙƒØ§ÙˆÙŠ</span>
            <a class="nav-link youtube-nav-link" href="https://www.youtube.com/@kairo_909" target="_blank"><i class="fa-brands fa-youtube"></i> Ù‚Ù†Ø§ØªÙ†Ø§</a>
        </nav>
        
        <div class="header-actions">
            ${adminButton}
            ${rightSection}
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
                <label for="forgot-email">Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ Ø§Ù„Ù…Ø³Ø¬Ù„</label>
                <input type="email" id="forgot-email" required placeholder="example@gmail.com" autocomplete="email" style="background: var(--bg-surface); border: 1px solid var(--border-color); color: var(--text-main); padding: 12px; border-radius: var(--border-radius-sm); width: 100%; outline: none; margin-top: 6px;">
            </div>
            <div id="forgot-error-msg" class="auth-error-msg" style="display:none; margin-bottom: 12px; color: var(--color-accent); font-weight: 700;"></div>
            <div id="forgot-success-msg" class="auth-success-msg" style="display:none; margin-bottom: 12px; color: #00ff7f; font-weight: 700;"></div>
            <button type="submit" class="auth-submit-btn neon-pulse-hover" style="background: linear-gradient(135deg, var(--color-secondary), var(--color-primary)); color: #07080c; border: none; padding: 12px; border-radius: 30px; font-weight: 800; cursor: pointer; width: 100%;">
                <i class="fa-solid fa-paper-plane"></i> Ø¥Ø±Ø³Ø§Ù„ Ø±Ø§Ø¨Ø· Ø§Ù„Ø§Ø³ØªØ¹Ø§Ø¯Ø©
            </button>
            <div style="text-align: center; margin-top: 18px;">
                <a href="javascript:void(0)" id="back-to-login-btn" style="color: var(--color-secondary); font-size: 0.85rem; font-weight: 700; text-decoration: none; transition: var(--transition-fast);">Ø§Ù„Ø¹ÙˆØ¯Ø© Ù„ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„</a>
            </div>
        </form>
        `;
    } else {
        bodyHtml = `
        <form id="auth-form" class="auth-form">
            <div class="form-group">
                <label for="auth-email">Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ (Gmail)</label>
                <input type="email" id="auth-email" required placeholder="example@gmail.com" autocomplete="email">
            </div>
            <div class="form-group">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <label for="auth-password" style="margin: 0;">ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±</label>
                    <a href="javascript:void(0)" id="forgot-password-trigger" style="color: var(--color-secondary); font-size: 0.8rem; font-weight: 700; text-decoration: none; transition: var(--transition-fast);">Ù†Ø³ÙŠØª ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±ØŸ</a>
                </div>
                <input type="password" id="auth-password" required placeholder="********" autocomplete="current-password">
            </div>
            <div id="auth-error-msg" class="auth-error-msg" style="display:none;"></div>
            <div id="auth-success-msg" class="auth-success-msg" style="display:none;"></div>
            <button type="submit" class="auth-submit-btn neon-pulse-hover">
                ${isLogin ? '<i class="fa-solid fa-right-to-bracket"></i> Ø¯Ø®ÙˆÙ„' : '<i class="fa-solid fa-user-plus"></i> Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„Ø­Ø³Ø§Ø¨'}
            </button>
            
            <div class="auth-divider">
                <span>Ø£Ùˆ Ø³Ø¬Ù‘Ù„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø¨Ø§Ø³ØªØ®Ø¯Ø§Ù…</span>
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
                <button class="auth-tab-btn ${isLogin ? 'active' : ''}" id="auth-tab-login" data-tab="login">ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„</button>
                <button class="auth-tab-btn ${isRegister ? 'active' : ''}" id="auth-tab-register" data-tab="register">Ø­Ø³Ø§Ø¨ Ø¬Ø¯ÙŠØ¯</button>
            </div>
            ` : `
            <div style="text-align: center; margin-bottom: 20px;">
                <span style="font-size: 1.25rem; font-weight: 800; color: var(--text-main); display: inline-flex; align-items: center; gap: 8px;"><i class="fa-solid fa-key" style="color: var(--color-secondary);"></i> Ø§Ø³ØªØ¹Ø§Ø¯Ø© Ø§Ù„Ø­Ø³Ø§Ø¨</span>
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
                <i class="fa-solid fa-comments" style="color: var(--color-secondary);"></i> ØªÙ‚Ø¯ÙŠÙ… Ø§Ù‚ØªØ±Ø§Ø­ Ø£Ùˆ Ø´ÙƒÙˆÙ‰
            </h3>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 20px; text-align: right; line-height: 1.6;">
                Ø±Ø£ÙŠÙƒ ÙŠÙ‡Ù…Ù†Ø§ Ù„ØªØ·ÙˆÙŠØ± Ù…ÙˆÙ‚Ø¹ KAIRO/Ù…Ù†Ù‡ÙˆØ§. ÙŠÙ…ÙƒÙ†Ùƒ ÙƒØªØ§Ø¨Ø© Ø§Ù‚ØªØ±Ø§Ø­ Ù„ØªØ­Ø³ÙŠÙ† Ø§Ù„Ù…ÙˆÙ‚Ø¹ Ø£Ùˆ ØªÙ‚Ø¯ÙŠÙ… Ø´ÙƒÙˆÙ‰ Ø¹Ù† Ø£ÙŠ Ù…Ø´ÙƒÙ„Ø© ÙÙ†ÙŠØ©.
            </p>
            
            <form id="suggestions-form" class="auth-form" style="display: flex; flex-direction: column; gap: 16px;">
                <div class="form-group" style="text-align: right;">
                    <label style="display: block; font-size: 0.9rem; font-weight: 700; color: var(--text-main); margin-bottom: 8px;">Ù†ÙˆØ¹ Ø§Ù„Ø±Ø³Ø§Ù„Ø©</label>
                    <div style="display: flex; gap: 20px; justify-content: flex-start; direction: rtl;">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text-main); font-weight: 600;">
                            <input type="radio" name="sug-type" value="suggestion" checked style="cursor: pointer; accent-color: var(--color-secondary);">
                            <span>Ø§Ù‚ØªØ±Ø§Ø­ <i class="fa-solid fa-lightbulb" style="color: #ffb703;"></i></span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text-main); font-weight: 600;">
                            <input type="radio" name="sug-type" value="complaint" style="cursor: pointer; accent-color: var(--color-accent);">
                            <span>Ø´ÙƒÙˆÙ‰ <i class="fa-solid fa-circle-exclamation" style="color: var(--color-accent);"></i></span>
                        </label>
                    </div>
                </div>
                <div class="form-group" style="text-align: right;">
                    <label for="sug-content" style="display: block; font-size: 0.9rem; font-weight: 700; color: var(--text-main); margin-bottom: 8px;">ØªÙØ§ØµÙŠÙ„ Ø§Ù„Ø±Ø³Ø§Ù„Ø©</label>
                    <textarea id="sug-content" required rows="4" placeholder="Ø§ÙƒØªØ¨ ØªÙØ§ØµÙŠÙ„ Ø§Ù‚ØªØ±Ø§Ø­Ùƒ Ø£Ùˆ Ø´ÙƒÙˆØ§Ùƒ Ù‡Ù†Ø§..." style="width: 100%; padding: 12px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); color: var(--text-main); outline: none; font-family: var(--font-family); resize: none; text-align: right;"></textarea>
                </div>
                <div id="sug-error-msg" class="auth-error-msg" style="display:none; color: #ff007f; font-size: 0.85rem; text-align: right;"></div>
                <div id="sug-success-msg" class="auth-success-msg" style="display:none; color: #00ff7f; font-size: 0.85rem; text-align: right;"></div>
                <button type="submit" class="auth-submit-btn neon-pulse-hover" style="background: linear-gradient(135deg, var(--color-secondary), #00b0ff); margin-top: 10px;">
                    Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ø±Ø³Ø§Ù„Ø© Ø§Ù„Ø¢Ù† <i class="fa-solid fa-paper-plane" style="margin-right: 6px;"></i>
                </button>
            </form>
        </div>
    </div>
    `;
}

function SettingsModalComponent() {
    if (!state.showSettingsModal) return '';
    const info = state.getUserLevelInfo ? state.getUserLevelInfo() : { points: 0, level: 1, rankTitle: 'Ù…Ø¨ØªØ¯Ø¦' };
    const isAdmin = state.userRole === 'admin';
    const tab = state.settingsTab || 'account';
    return `
    <div class="auth-modal-overlay" id="settings-modal-overlay">
        <div class="auth-modal-card glass-card" style="max-width:540px;position:relative;padding:0;overflow:hidden;">
            <button class="settings-close-btn" id="close-settings-modal" style="position:absolute;top:12px;left:12px;z-index:10;background:none;border:none;color:var(--text-muted);font-size:1.2rem;cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
            <div style="background:linear-gradient(135deg,var(--color-primary),var(--color-accent));padding:24px 24px 16px;text-align:center;">
                <div style="font-size:2.2rem;margin-bottom:4px;"><i class="fa-solid fa-user-gear"></i></div>
                <h3 style="margin:0;font-size:1.3rem;font-weight:800;color:#fff;">Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª</h3>
                <p style="margin:4px 0 0;font-size:0.8rem;color:rgba(255,255,255,0.7);">${state.userEmail || ''}</p>
            </div>
            <div style="display:flex;border-bottom:1px solid var(--border-color);">
                ${[
                    { key:'account', label:'Ø§Ù„Ø­Ø³Ø§Ø¨', icon:'fa-user' },
                    { key:'profile', label:'Ø§Ù„Ù…Ù„Ù', icon:'fa-pen' },
                    { key:'security', label:'Ø§Ù„Ø£Ù…Ø§Ù†', icon:'fa-lock' },
                    { key:'appearance', label:'Ø§Ù„Ù…Ø¸Ù‡Ø±', icon:'fa-palette' }
                ].map(t => `
                    <button class="settings-tab-btn ${tab === t.key ? 'active' : ''}" data-tab="${t.key}" style="flex:1;padding:12px 6px;border:none;background:${tab === t.key ? 'var(--bg-surface)' : 'transparent'};color:${tab === t.key ? 'var(--color-primary)' : 'var(--text-muted)'};font-weight:${tab === t.key ? '800' : '600'};font-size:0.72rem;cursor:pointer;transition:var(--transition-fast);border-bottom:2px solid ${tab === t.key ? 'var(--color-primary)' : 'transparent'};">
                        <i class="fa-solid ${t.icon}" style="display:block;font-size:1rem;margin-bottom:2px;"></i>
                        ${t.label}
                    </button>
                `).join('')}
            </div>
            <div style="padding:20px 24px;max-height:400px;overflow-y:auto;text-align:right;">
                ${tab === 'account' ? `
                    <div class="settings-info-row" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px;">
                        <div class="settings-info-card" style="text-align:center;background:var(--bg-card);border-radius:10px;padding:14px 8px;">
                            <i class="fa-solid fa-star" style="color:var(--color-secondary);font-size:1.2rem;"></i>
                            <div style="font-size:1.1rem;font-weight:800;margin:4px 0;">${isAdmin ? 'âˆž' : info.points}</div>
                            <div style="font-size:0.7rem;color:var(--text-muted);">Ø§Ù„Ù†Ù‚Ø§Ø·</div>
                        </div>
                        <div class="settings-info-card" style="text-align:center;background:var(--bg-card);border-radius:10px;padding:14px 8px;">
                            <i class="fa-solid fa-crown" style="color:var(--color-primary);font-size:1.2rem;"></i>
                            <div style="font-size:1.1rem;font-weight:800;margin:4px 0;">${isAdmin ? 'Ø§Ù„Ù…Ø¯ÙŠØ±' : 'Lv.' + info.level}</div>
                            <div style="font-size:0.7rem;color:var(--text-muted);">Ø§Ù„Ù…Ø³ØªÙˆÙ‰</div>
                        </div>
                        <div class="settings-info-card" style="text-align:center;background:var(--bg-card);border-radius:10px;padding:14px 8px;">
                            <i class="fa-solid fa-fire" style="color:var(--color-accent);font-size:1.2rem;"></i>
                            <div style="font-size:1.1rem;font-weight:800;margin:4px 0;">${state.userProfile?.streak_days || 0}</div>
                            <div style="font-size:0.7rem;color:var(--text-muted);">Ø§Ù„ØªØªØ§Ø¨Ø¹</div>
                        </div>
                    </div>
                ` : ''}
                ${tab === 'profile' ? `
                    <div class="settings-section" style="margin-bottom:0;">
                        <h4 style="font-size:0.9rem;margin:0 0 12px;"><i class="fa-solid fa-pen"></i> ØªØºÙŠÙŠØ± Ø§Ø³Ù… Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…</h4>
                        <div class="form-group">
                            <input type="text" id="settings-new-username" placeholder="Ø£Ø¯Ø®Ù„ Ø§Ø³Ù… Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… Ø§Ù„Ø¬Ø¯ÙŠØ¯" value="${state.userProfile?.username || ''}" style="width:100%;padding:10px 14px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:8px;color:var(--text-main);outline:none;">
                        </div>
                        <button class="auth-submit-btn" id="btn-save-username" style="width:100%;padding:10px;border:none;border-radius:30px;font-weight:800;cursor:pointer;background:linear-gradient(135deg,var(--color-primary),var(--color-secondary));color:#07080c;margin-top:8px;">Ø­ÙØ¸ Ø§Ø³Ù… Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…</button>
                        <div id="username-msg" style="margin-top:8px;font-size:0.85rem;text-align:center;"></div>
                    </div>
                ` : ''}
                ${tab === 'security' ? `
                    <div class="settings-section" style="margin-bottom:0;">
                        <h4 style="font-size:0.9rem;margin:0 0 12px;"><i class="fa-solid fa-lock"></i> ØªØºÙŠÙŠØ± ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±</h4>
                        <div class="form-group" style="margin-bottom:12px;">
                            <input type="password" id="settings-current-password" placeholder="ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø§Ù„Ø­Ø§Ù„ÙŠØ©" style="width:100%;padding:10px 14px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:8px;color:var(--text-main);outline:none;">
                        </div>
                        <div class="form-group" style="margin-bottom:12px;">
                            <input type="password" id="settings-new-password" placeholder="ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø© (6 Ø£Ø­Ø±Ù)" style="width:100%;padding:10px 14px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:8px;color:var(--text-main);outline:none;">
                        </div>
                        <button class="auth-submit-btn" id="btn-save-password" style="width:100%;padding:10px;border:none;border-radius:30px;font-weight:800;cursor:pointer;background:linear-gradient(135deg,var(--color-secondary),var(--color-primary));color:#07080c;margin-top:4px;">ØªØºÙŠÙŠØ± ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±</button>
                        <div id="password-msg" style="margin-top:8px;font-size:0.85rem;text-align:center;"></div>
                    </div>
                ` : ''}
                ${tab === 'appearance' ? `
                    <div class="settings-section" style="margin-bottom:0;">
                        <h4 style="font-size:0.9rem;margin:0 0 12px;"><i class="fa-solid fa-palette"></i> ØªØ®ØµÙŠØµ Ø§Ù„Ù…Ø¸Ù‡Ø±</h4>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                            <div style="text-align:center;padding:16px;background:var(--bg-card);border-radius:12px;border:2px solid var(--color-primary);cursor:pointer;" id="theme-dark-btn">
                                <div style="font-size:1.5rem;"><i class="fa-solid fa-moon"></i></div>
                                <div style="font-size:0.8rem;font-weight:700;margin-top:4px;">Ø¯Ø§ÙƒÙ†</div>
                            </div>
                            <div style="text-align:center;padding:16px;background:var(--bg-card);border-radius:12px;border:2px solid var(--border-color);cursor:pointer;opacity:0.5;" id="theme-light-btn">
                                <div style="font-size:1.5rem;"><i class="fa-solid fa-sun"></i></div>
                                <div style="font-size:0.8rem;font-weight:700;margin-top:4px;">ÙØ§ØªØ­ (Ù‚Ø±ÙŠØ¨Ø§Ù‹)</div>
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>
    </div>
    `;
}

// Ø§Ù„Ø³Ù„Ø§ÙŠØ¯Ø± Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠ (Hero Slider)
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
                <span class="hero-badge">${manga.type || 'Ù…Ù†Ù‡ÙˆØ§'} Ø§Ù„Ù…Ù…ÙŠØ²Ø©</span>
                <h2 class="hero-title">${manga.title}</h2>
                <div class="hero-meta">
                    <span class="rating-stars"><i class="fa-solid fa-star"></i> ${manga.rating}</span>
                    <span>â€¢</span>
                    <span>Ø§Ù„Ù…Ø´Ø§Ù‡Ø¯Ø§Øª: ${manga.views}</span>
                </div>
                <p class="hero-desc">${manga.synopsis}</p>
                <button class="hero-btn read-now-hero" data-id="${manga.id}"><i class="fa-solid fa-book-open"></i> Ø§Ù‚Ø±Ø£ Ø§Ù„Ø¢Ù†</button>
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

// ÙƒØ±Øª Ø³Ø¬Ù„ Ø§Ù„Ù‚Ø±Ø§Ø¡Ø© Ø§Ù„Ù…ØµØºØ± Ø¨Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ© (Ø¨Ø­Ø¯ Ø£Ù‚ØµÙ‰ 5 Ø¹Ù†Ø§ØµØ±)
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
                <span class="history-item-chapter">Ø§Ù„ÙØµÙ„ ${numClean}</span>
                <div style="margin-top:4px;">
                    <div class="level-progress-info" style="margin-bottom: 2px;">
                        <span class="history-item-progress-text">ØªÙ‚Ø¯Ù… Ø§Ù„Ù‚Ø±Ø§Ø¡Ø©</span>
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
            <h3 class="section-title" style="font-size:1.2rem;border-right-color:var(--color-secondary);"><i class="fa-solid fa-clock-rotate-left" style="color:var(--color-secondary);margin-left:5px;"></i> Ø§Ø³ØªÙƒÙ…Ù„ Ø§Ù„Ù‚Ø±Ø§Ø¡Ø© <span>(Ø³Ø¬Ù„ Ø§Ù„Ù‚Ø±Ø§Ø¡Ø©)</span></h3>
        </div>
        <div class="history-scroll">
            ${historyCardsHtml}
        </div>
    </div>
    `;
}

// ØµÙØ­Ø© Ø³Ø¬Ù„ Ø§Ù„Ù‚Ø±Ø§Ø¡Ø© Ø§Ù„ØªÙØµÙŠÙ„ÙŠ
function HistoryViewComponent() {
    if (state.history.length === 0) {
        return `
        <div class="empty-state">
            <i class="fa-solid fa-clock-rotate-left" style="color:var(--border-color)"></i>
            <h3>Ø³Ø¬Ù„ Ø§Ù„Ù‚Ø±Ø§Ø¡Ø© ÙØ§Ø±Øº</h3>
            <p>Ø§Ø¨Ø¯Ø£ Ø¨Ù‚Ø±Ø§Ø¡Ø© Ø£ÙŠ Ù…Ø§Ù†Ø¬Ø§ Ø£Ùˆ Ù…Ù†Ù‡ÙˆØ§ ÙˆØ³ÙŠØªÙ… ØªØ³Ø¬ÙŠÙ„ ØªÙ‚Ø¯Ù…Ùƒ Ù‡Ù†Ø§ Ù„ØªØªÙ…ÙƒÙ† Ù…Ù† Ø§Ù„Ø¹ÙˆØ¯Ø© ÙˆØ§Ø³ØªÙƒÙ…Ø§Ù„Ù‡Ø§ ÙÙŠ Ø£ÙŠ ÙˆÙ‚Øª.</p>
        </div>
        `;
    }

    let listHtml = `
    <div class="chapters-section">
        <div class="chapters-header">
            <h3>Ø³Ø¬Ù„ Ù‚Ø±Ø§Ø¡ØªÙƒ Ù„Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø£Ø¹Ù…Ø§Ù„ (Ø­ØªÙ‰ 30 Ù…Ù†Ù‡ÙˆØ§/Ù…Ø§Ù†Ø¬Ø§)</h3>
            <span>Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ø£Ø¹Ù…Ø§Ù„: ${state.history.length}</span>
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
                        Ø§Ù„ÙØµÙ„ Ø§Ù„Ø°ÙŠ ØªÙ‚Ù Ø¹Ù†Ø¯Ù‡: <strong style="color:var(--color-secondary);">Ø§Ù„ÙØµÙ„ ${hist.chapterId}</strong> (${percentage}%)
                    </span>
                    ${hasNewChapters ? `
                        <div style="display:inline-block; margin-right:10px;">
                            <span class="badge-new-chapters" style="background:rgba(0,255,127,0.1); border:1px solid #00ff7f; color:#00ff7f; padding:2px 8px; border-radius:10px; font-size:0.75rem; font-weight:700; white-space:nowrap;">
                                <i class="fa-solid fa-bell"></i> ØªÙˆØ¬Ø¯ ÙØµÙˆÙ„ Ø¬Ø¯ÙŠØ¯Ø©! (Ø£Ø­Ø¯Ø« ÙØµÙ„: ${latestChapter.id})
                            </span>
                        </div>
                    ` : ''}
                </div>
            </div>
            <div class="chapter-actions-inline" style="gap:10px;">
                <button class="detail-btn btn-read resume-reading-history-btn" style="padding:8px 16px; font-size:0.85rem; border-radius:20px;" data-manga-id="${hist.mangaId}" data-chap-id="${hist.chapterId}" data-scroll="${hist.scrollY}" data-page="${hist.activePageIndex}">
                    <i class="fa-solid fa-play"></i> Ù…ØªØ§Ø¨Ø¹Ø© Ø§Ù„Ù‚Ø±Ø§Ø¡Ø©
                </button>
                <button class="download-btn delete-history-entry-btn" data-manga-id="${hist.mangaId}" title="Ø­Ø°Ù Ù…Ù† Ø§Ù„Ø³Ø¬Ù„" style="border-color:rgba(255,255,255,0.05); color:var(--text-dark);">
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
            <h2 class="section-title">Ø³Ø¬Ù„ Ø§Ù„Ù‚Ø±Ø§Ø¡Ø© <span>Ø§Ù„ØªÙØµÙŠÙ„ÙŠ ÙˆØ§Ù„Ù…ØªØ§Ø¨Ø¹Ø©</span></h2>
        </div>
        ${listHtml}
    </div>
    `;
}

function MangaCardComponent(manga) {
    const title = manga.title || 'Ù…Ø§Ù†Ù‡ÙˆØ§ Ù…Ø¬Ù‡ÙˆÙ„Ø©';
    const chapters = manga.chapters || [];
    const latestChapter = manga.latestChapter || (chapters.length > 0 ? chapters[0] : null);
    const chaptersCount = manga.chaptersCount || chapters.length;
    const coverUrl = getDisplayCover(manga) || 'https://via.placeholder.com/300x450/1a1a2e/ffffff?text=No+Cover';
    const id = manga.id;
    const type = manga.type || 'Ù…Ø§Ù†Ù‡ÙˆØ§';
    const rating = manga.rating || (Math.random() * (9.9 - 8.0) + 8.0).toFixed(1);

    let displayChapterText = chaptersCount > 0 ? chaptersCount + " ÙØµÙ„" : "Ù…Ø³ØªÙ…Ø±Ø©";
    if (latestChapter && latestChapter.id) {
        const numMatch = latestChapter.id.match(/\d+(?:\.\d+)?/);
        if (numMatch) {
            displayChapterText = "ÙØµÙ„ " + parseFloat(numMatch[0]);
        }
    }

    if (state.viewMode === 'list') {
        return `
        <div class="mt-list-card" onclick="navigate('detail', '${id}'); return false;" style="cursor:pointer;">
            <div class="mt-list-card-img">
                <img src="${coverUrl}" alt="${title}" loading="lazy">
                <div class="mt-badge-top-left"><i class="fa-solid fa-star"></i> ${rating}</div>
            </div>
            <div class="mt-list-card-content">
                <h3 style="margin-bottom:10px; color:#fff; font-size:1.2rem;">${title}</h3>
                <div style="color:var(--text-muted); font-size:0.9rem; margin-bottom:10px;">${manga.genres ? manga.genres.slice(0,3).join('ØŒ ') : ''}</div>
                <div style="color:var(--primary-color); font-weight:bold;">${type} â€¢ ${displayChapterText}</div>
            </div>
        </div>
        `;
    }

    return `
    <div class="mt-card" onclick="navigate('detail', '${id}'); return false;">
        <img src="${coverUrl}" alt="${title}" loading="lazy">
        <div class="mt-badge-top-left"><i class="fa-solid fa-star"></i> ${rating}</div>
        <div class="mt-badge-top-right">${type}</div>
        <div class="mt-card-overlay">
            <h3 class="mt-card-title">${title}</h3>
            ${chaptersCount > 0 ? `<div class="mt-card-chap">${displayChapterText}</div>` : ""}
        </div>
    </div>
    `;
}

function MangaGridComponent(title, mangasFiltered) {
    const isListView = state.viewMode === 'list';
    const s = state;
    if (!s.limit) s.limit = 48;
    
    // Pagination slicing
    const total = mangasFiltered.length;
    const paginated = mangasFiltered.slice(0, s.limit);

    

    if (!paginated || paginated.length === 0) {
        return `
        <div class="empty-state">
            <i class="fa-regular fa-folder-open" style="font-size:3rem; margin-bottom:15px; color:var(--text-muted);"></i>
            <h3>Ù„Ø§ ØªÙˆØ¬Ø¯ Ù†ØªØ§Ø¦Ø¬ Ù…Ø·Ø§Ø¨Ù‚Ø© Ù„Ù„Ø¨Ø­Ø«</h3>
        </div>
        `;
    }

    const gridClass = isListView ? 'mt-manga-list' : 'mt-manga-grid';
    
    return `
    <div class="${gridClass}">
        ${paginated.map(m => MangaCardComponent(m)).join('')}
    </div>
    <div class="mangatime-pagination">
        <button class="mangatime-page-btn" disabled><i class="fa-solid fa-chevron-right"></i> Ø§Ù„Ø³Ø§Ø¨Ù‚</button>
        <button class="mangatime-page-btn active" style="background:var(--primary-color);color:#fff;">1</button>
        <button class="mangatime-page-btn" disabled>Ø§Ù„ØªØ§Ù„ÙŠ <i class="fa-solid fa-chevron-left"></i></button>
    </div>
    `;
}

window.toggleFilter = function(type, value) {
    const s = state;
    if (type === 'genre') s.activeGenre = (s.activeGenre === value) ? '' : value;
    else if (type === 'status') s.filterStatus = value;
    else if (type === 'type') s.filterType = value;
    else if (type === 'sort') s.filterSort = value;
    else if (type === 'limit') s.limit = parseInt(value);
    else if (type === 'search_type') {
        s.searchType = value;
        document.querySelectorAll('.mangatime-s-filter').forEach(el => el.classList.remove('active'));
        if (event && event.currentTarget) event.currentTarget.classList.add('active');
    }
    else if (type === 'tab') {
        s.activeTab = value;
        document.querySelectorAll('.mangatime-tab').forEach(el => el.classList.remove('active'));
        if (event && event.currentTarget) event.currentTarget.classList.add('active');
        
        // Hide/Show dropdowns based on tab
        const dropdowns = document.querySelector('.mangatime-dropdowns-row');
        if (dropdowns) {
            dropdowns.style.display = value === 'users' ? 'none' : 'flex';
        }
    }
    
    updateGridOnly();
};
window.toggleViewMode = function(mode) {
    state.viewMode = mode;
    updateGridOnly();
};
window.handleSearchInput = function(e) {
    state.searchQuery = e.target.value;
    updateGridOnly();
};
window.handleNumberInput = function(type, value) {
    state[type] = value;
    updateGridOnly();
};

function AdvancedFiltersComponent() {
    const s = state;
    if (!s.limit) s.limit = 48;
    if (!s.activeTab) s.activeTab = 'series';
    if (!s.searchType) s.searchType = 'all';

    const allGenres = ['Ø§Ù„ÙƒÙ„'];
    if (s.mangas) s.mangas.forEach(m => { if (m.genres) m.genres.forEach(g => { if(!allGenres.includes(g)) allGenres.push(g); }); });

    const searchTypes = [
        {id:'all', label:'Ø§Ù„ÙƒÙ„'}, {id:'username', label:'Ø§Ø³Ù… Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…'}, {id:'title', label:'Ø§Ù„Ø¹Ù†ÙˆØ§Ù†'}, {id:'author', label:'Ø§Ù„Ù…Ø¤Ù„Ù'},
        {id:'tags', label:'Ø§Ù„Ø±Ø³ÙˆÙ…'}, {id:'desc', label:'Ø§Ù„ÙˆØµÙ'}
    ];

    const searchTypeHtml = searchTypes.map(t => 
        `<span class="mangatime-s-filter ${s.searchType===t.id ? 'active':''}" onclick="toggleFilter('search_type','${t.id}')">${t.label}</span>`
    ).join('');

    return `
    <div class="mangatime-browse-container">
        
        <div class="mangatime-hero-section">
            <h1 class="mangatime-hero-title">ØªØµÙØ­ Ø¹Ø§Ù„Ù… Ø§Ù„Ù…Ø§Ù†Ø¬Ø§</h1>
            <p class="mangatime-hero-subtitle">Ø§ÙƒØªØ´Ù Ø¹Ù…Ù„Ùƒ Ø§Ù„ØªØ§Ù„ÙŠ Ø¨ÙŠÙ† Ø¢Ù„Ø§Ù Ø§Ù„Ø³Ù„Ø§Ø³Ù„</p>
        </div>

        <div class="mangatime-search-wrapper">
            <input type="text" class="mangatime-search-input" placeholder="Ø§Ø¨Ø­Ø« Ø¹Ù† Ø£ÙŠ Ø´ÙŠØ¡..." value="${s.searchQuery || ''}" oninput="handleSearchInput(event)">
            <i class="fa-solid fa-microphone mangatime-mic-icon"></i>
            <i class="fa-solid fa-magnifying-glass mangatime-search-icon"></i>
        </div>

        <div class="mangatime-search-filters">
            <span style="color:var(--text-muted);font-size:0.85rem;margin-left:10px;">Ø§Ù„Ø¨Ø­Ø« Ø¨Ù€:</span>
            ${searchTypeHtml}
        </div>

        

        <div class="mangatime-dropdowns-row">
            <!-- Ø§Ù„ØªØµÙ†ÙŠÙ -->
            <div class="glass-select-wrapper">
                <i class="fa-solid fa-tags glass-icon"></i>
                <select class="glass-select" onchange="toggleFilter('genre', this.value)">
                    <option value="">ÙƒÙ„ Ø§Ù„ØªØµÙ†ÙŠÙØ§Øª</option>
                    ${allGenres.map(g => `<option value="${g}" ${s.activeGenre===g?'selected':''}>${g}</option>`).join('')}
                </select>
            </div>

            <!-- Ø§Ù„Ù†ÙˆØ¹ -->
            <div class="glass-select-wrapper">
                <i class="fa-solid fa-book-open glass-icon"></i>
                <select class="glass-select" onchange="toggleFilter('type', this.value)">
                    <option value="Ø§Ù„ÙƒÙ„" ${s.filterType==='Ø§Ù„ÙƒÙ„'?'selected':''}>ÙƒÙ„ Ø§Ù„Ø£Ù†ÙˆØ§Ø¹</option>
                    <option value="Ù…Ø§Ù†Ù‡ÙˆØ§ ÙƒÙˆØ±ÙŠØ©" ${s.filterType==='Ù…Ø§Ù†Ù‡ÙˆØ§ ÙƒÙˆØ±ÙŠØ©'?'selected':''}>Ù…Ø§Ù†Ù‡ÙˆØ§ ÙƒÙˆØ±ÙŠØ©</option>
                    <option value="Ù…Ø§Ù†Ø¬Ø§ ÙŠØ§Ø¨Ø§Ù†ÙŠØ©" ${s.filterType==='Ù…Ø§Ù†Ø¬Ø§ ÙŠØ§Ø¨Ø§Ù†ÙŠØ©'?'selected':''}>Ù…Ø§Ù†Ø¬Ø§ ÙŠØ§Ø¨Ø§Ù†ÙŠØ©</option>
                    <option value="Ù…Ø§Ù†Ù‡ÙˆØ§ ØµÙŠÙ†ÙŠØ©" ${s.filterType==='Ù…Ø§Ù†Ù‡ÙˆØ§ ØµÙŠÙ†ÙŠØ©'?'selected':''}>Ù…Ø§Ù†Ù‡ÙˆØ§ ØµÙŠÙ†ÙŠØ©</option>
                    <option value="Ø±ÙˆØ§ÙŠØ©" ${s.filterType==='Ø±ÙˆØ§ÙŠØ©'?'selected':''}>Ø±ÙˆØ§ÙŠØ©</option>
                </select>
            </div>

            <!-- Ø§Ù„Ø­Ø§Ù„Ø© -->
            <div class="glass-select-wrapper">
                <i class="fa-solid fa-circle-check glass-icon"></i>
                <select class="glass-select" onchange="toggleFilter('status', this.value)">
                    <option value="Ø§Ù„ÙƒÙ„" ${s.filterStatus==='Ø§Ù„ÙƒÙ„'?'selected':''}>ÙƒÙ„ Ø§Ù„Ø­Ø§Ù„Ø§Øª</option>
                    <option value="Ù…Ø³ØªÙ…Ø±Ø©" ${s.filterStatus==='Ù…Ø³ØªÙ…Ø±Ø©'?'selected':''}>Ù…Ø³ØªÙ…Ø±Ø©</option>
                    <option value="Ù…ÙƒØªÙ…Ù„Ø©" ${s.filterStatus==='Ù…ÙƒØªÙ…Ù„Ø©'?'selected':''}>Ù…ÙƒØªÙ…Ù„Ø©</option>
                    <option value="Ù…ØªÙˆÙ‚ÙØ©" ${s.filterStatus==='Ù…ØªÙˆÙ‚ÙØ©'?'selected':''}>Ù…ØªÙˆÙ‚ÙØ©</option>
                </select>
            </div>

            <!-- Ø§Ù„ØªØ±ØªÙŠØ¨ -->
            <div class="glass-select-wrapper">
                <i class="fa-solid fa-arrow-down-short-wide glass-icon"></i>
                <select class="glass-select" onchange="toggleFilter('sort', this.value)">
                    <option value="Ø§Ù„Ø£Ø­Ø¯Ø«" ${s.filterSort==='Ø§Ù„Ø£Ø­Ø¯Ø«'?'selected':''}>Ø§Ù„Ø£Ø­Ø¯Ø«</option>
                    <option value="Ø§Ù„Ø£ÙƒØ«Ø± Ø´Ø¹Ø¨ÙŠØ©" ${s.filterSort==='Ø§Ù„Ø£ÙƒØ«Ø± Ø´Ø¹Ø¨ÙŠØ©'?'selected':''}>Ø§Ù„Ø£ÙƒØ«Ø± Ø´Ø¹Ø¨ÙŠØ©</option>
                    <option value="Ø§Ù„Ø£Ø¹Ù„Ù‰ ØªÙ‚ÙŠÙŠÙ…Ø§Ù‹" ${s.filterSort==='Ø§Ù„Ø£Ø¹Ù„Ù‰ ØªÙ‚ÙŠÙŠÙ…Ø§Ù‹'?'selected':''}>Ø§Ù„Ø£Ø¹Ù„Ù‰ ØªÙ‚ÙŠÙŠÙ…Ø§Ù‹</option>
                    <option value="Ø£Ø­Ø¯Ø« Ø§Ù„ØªØ­Ø¯ÙŠØ«Ø§Øª" ${s.filterSort==='Ø£Ø­Ø¯Ø« Ø§Ù„ØªØ­Ø¯ÙŠØ«Ø§Øª'?'selected':''}>Ø£Ø­Ø¯Ø« Ø§Ù„ØªØ­Ø¯ÙŠØ«Ø§Øª</option>
                    <option value="Ø£-ÙŠ" ${s.filterSort==='Ø£-ÙŠ'?'selected':''}>Ø£Ø¨Ø¬Ø¯ÙŠØ§Ù‹</option>
                    <option value="Ø§Ù„Ø£ÙƒØ«Ø± ÙØµÙˆÙ„Ø§Ù‹" ${s.filterSort==='Ø§Ù„Ø£ÙƒØ«Ø± ÙØµÙˆÙ„Ø§Ù‹'?'selected':''}>Ø§Ù„Ø£ÙƒØ«Ø± ÙØµÙˆÙ„Ø§Ù‹</option>
                    <option value="Ø§Ù„Ø£Ù‚Ù„ ÙØµÙˆÙ„Ø§Ù‹" ${s.filterSort==='Ø§Ù„Ø£Ù‚Ù„ ÙØµÙˆÙ„Ø§Ù‹'?'selected':''}>Ø§Ù„Ø£Ù‚Ù„ ÙØµÙˆÙ„Ø§Ù‹</option>
                </select>
            </div>

            <!-- Ø§Ù„Ø³Ù†Ø© -->
            <div class="glass-input-group">
                <i class="fa-regular fa-calendar glass-icon" style="margin-left:5px;"></i>
                <input type="number" class="glass-input" placeholder="Ù…Ù† Ø³Ù†Ø©" value="${s.filterYearMin||''}" oninput="handleNumberInput('filterYearMin', this.value)">
                <span class="glass-separator">-</span>
                <input type="number" class="glass-input" placeholder="Ø¥Ù„Ù‰" value="${s.filterYearMax||''}" oninput="handleNumberInput('filterYearMax', this.value)">
            </div>

            <!-- Ø§Ù„ØªÙ‚ÙŠÙŠÙ… -->
            <div class="glass-input-group">
                <i class="fa-solid fa-star glass-icon" style="margin-left:5px;"></i>
                <input type="number" class="glass-input" placeholder="Ù…Ù† ØªÙ‚ÙŠÙŠÙ…" value="${s.filterRatingMin||''}" step="0.1" oninput="handleNumberInput('filterRatingMin', this.value)">
                <span class="glass-separator">-</span>
                <input type="number" class="glass-input" placeholder="Ø¥Ù„Ù‰" value="${s.filterRatingMax||''}" step="0.1" oninput="handleNumberInput('filterRatingMax', this.value)">
            </div>

            <!-- Ø§Ù„ÙØµÙˆÙ„ -->
            <div class="glass-input-group">
                <i class="fa-solid fa-list-ol glass-icon" style="margin-left:5px;"></i>
                <input type="number" class="glass-input" placeholder="Ù…Ù† ÙØµÙˆÙ„" value="${s.filterChaptersMin||''}" oninput="handleNumberInput('filterChaptersMin', this.value)">
                <span class="glass-separator">-</span>
                <input type="number" class="glass-input" placeholder="Ø¥Ù„Ù‰" value="${s.filterChaptersMax||''}" oninput="handleNumberInput('filterChaptersMax', this.value)">
            </div>

            <!-- Ø£Ø¯ÙˆØ§Øª Ø§Ù„Ø¹Ø±Ø¶ ÙˆØ§Ù„ØªÙ‚Ø³ÙŠÙ… -->
            <div class="glass-toolbar" style="display:flex; align-items:center; gap:10px;">
                <span style="color:var(--text-muted); font-size:0.85rem;">Ø¹Ø±Ø¶:</span>
                <div class="glass-select-wrapper" style="padding:0; min-width:unset;">
                    <select class="glass-select" style="padding:8px 10px; min-width:60px;" onchange="toggleFilter('limit', this.value)">
                        <option value="12" ${s.limit===12?'selected':''}>12</option>
                        <option value="24" ${s.limit===24?'selected':''}>24</option>
                        <option value="48" ${s.limit===48?'selected':''}>48</option>
                    </select>
                </div>
                <button class="mangatime-view-btn ${!s.viewMode || s.viewMode==='grid'?'active':''}" onclick="toggleViewMode('grid')" title="Ø¹Ø±Ø¶ Ø´Ø¨ÙƒÙŠ" style="padding:8px;"><i class="fa-solid fa-border-all"></i></button>
                <button class="mangatime-view-btn ${s.viewMode==='list'?'active':''}" onclick="toggleViewMode('list')" title="Ø¹Ø±Ø¶ Ø±Ø£Ø³ÙŠ" style="padding:8px;"><i class="fa-solid fa-list"></i></button>
            </div>
        </div>
    </div>
    `;
}
// ØµÙØ­Ø© Ø§Ù„ØªÙØ§ØµÙŠÙ„ Ø§Ù„ÙƒØ§Ù…Ù„Ø©
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
    if (!manga) return '<p>Ø§Ù„Ù…Ø§Ù†Ø¬Ø§ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯Ø©</p>';

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
    
    // Ø¬Ù„Ø¨ Ø§Ù„ÙØµÙˆÙ„ Ø§Ù„Ù…Ø­Ù…Ù„Ø© Ù„Ù„ØªØ£ÙƒØ¯ Ù…Ù† Ø­Ø§Ù„Ø© Ø§Ù„ØªØ­Ù…ÙŠÙ„
    const localDownloads = await getAllDownloadsOffline();
    const downloadedIds = localDownloads
        .filter(d => d.mangaId === manga.id)
        .map(d => d.chapterId);

    let genresHtml = '';
    (manga.genres || []).forEach(g => {
        if (!g) return;
        const gStr = String(g);
        const escapedG = gStr.replace(/'/g, "\\'");
        genresHtml += `<span class="genre-tag clickable-genre" style="cursor: pointer;" onclick="event.stopPropagation(); state.activeGenre='${escapedG}'; navigate('home'); window.scrollTo(0, 0);">${gStr}</span>`;
    });

    const searchQ = (state.chapterSearchQuery || '').trim();
    let filteredChapters = manga.chapters.filter(ch => {
        if (!searchQ) return true;
        const qLower = searchQ.toLowerCase();
        const idStr = String(ch.id).toLowerCase();
        const titleStr = (ch.title || '').toLowerCase();
        return idStr === qLower || idStr.replace(/[^0-9]/g, '') === qLower || titleStr === qLower || titleStr.includes(qLower);
    });

    filteredChapters = [...filteredChapters].sort((a, b) => {
        // Use .number field directly (most reliable), fallback to title parsing
        const na = parseFloat(a.number) || parseFloat((a.title || '').replace(/[^0-9.]/g, '')) || 0;
        const nb = parseFloat(b.number) || parseFloat((b.title || '').replace(/[^0-9.]/g, '')) || 0;
        return state.chapterSortOrder === 'oldest' ? na - nb : nb - na;
    });
    let chaptersHtml = '';
    if (filteredChapters.length === 0) {
        chaptersHtml = `<p style="padding: 20px; color: var(--text-dark); text-align: center;">${searchQ ? 'Ù„Ø§ ØªÙˆØ¬Ø¯ ÙØµÙˆÙ„ ØªØ·Ø§Ø¨Ù‚ Ø§Ù„Ø¨Ø­Ø«.' : 'Ù„Ø§ ØªØªÙˆÙØ± Ø£ÙŠ ÙØµÙˆÙ„ Ø­Ø§Ù„ÙŠØ§Ù‹ Ù„Ù‡Ø°Ù‡ Ø§Ù„Ù…Ø§Ù†Ø¬Ø§.'}</p>`;
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
                        <button class="download-btn ${downloadClass}" data-chap-id="${ch.id}" title="${isDownloaded ? 'Ù…Ø­Ù…Ù„ Ø£ÙˆÙÙ„Ø§ÙŠÙ† (Ø§Ø¶ØºØ· Ù„Ù„Ø­Ø°Ù)' : 'ØªØ­Ù…ÙŠÙ„ Ù„Ù„Ù‚Ø±Ø§Ø¡Ø© Ø¨Ø¯ÙˆÙ† Ø§ØªØµØ§Ù„'}">
                            ${downloadIcon}
                        </button>
                    </div>
                </div>
            </div>
            `;
        });
    }

    // Ø¬Ù„Ø¨ Ø§Ù„ØªÙ‚ÙŠÙŠÙ…Ø§Øª ÙˆØ§Ù„Ù…Ø±Ø§Ø¬Ø¹Ø§Øª Ù…Ù† Ø§Ù„Ø³ÙŠØ±ÙØ±
    let reviewsListHtml = '';
    let userReview = null;
    let avgRating = 0;
    let hasReviews = false;
    
    try {
        const response = await fetch(`/api/manga_reviews?manga_id=${manga.id}`);
        if (response.ok) {
            const reviews = await response.json();
            if (reviews.length > 0) {
                hasReviews = true;
                let sum = 0;
                reviews.forEach(r => {
                    sum += r.rating;
                    if (state.userEmail && r.email.toLowerCase() === state.userEmail.toLowerCase()) {
                        userReview = r;
                    }
                    
                    const stars = `<i class="fa-solid fa-star" style="color: #ffb703;"></i> <span style="font-weight:800; font-size:1rem; color:var(--text-main);">${r.rating} / 10</span>`;
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
                reviewsListHtml = '<p style="color: var(--text-dark); text-align: center; padding: 20px;">Ù„Ø§ ØªÙˆØ¬Ø¯ Ù…Ø±Ø§Ø¬Ø¹Ø§Øª Ù„Ù‡Ø°Ø§ Ø§Ù„Ø¹Ù…Ù„ Ø­Ø§Ù„ÙŠØ§Ù‹. ÙƒÙ† Ø£ÙˆÙ„ Ù…Ù† ÙŠÙƒØªØ¨ Ù…Ø±Ø§Ø¬Ø¹Ø©!</p>';
            }
        }
    } catch (e) {
        console.error("Error loading reviews:", e);
        reviewsListHtml = '<p style="color: #ff007f; text-align: center; padding: 20px;">ÙØ´Ù„ ØªØ­Ù…ÙŠÙ„ Ù…Ø±Ø§Ø¬Ø¹Ø§Øª Ù‡Ø°Ø§ Ø§Ù„Ø¹Ù…Ù„.</p>';
    }

    manga.rating = hasReviews ? parseFloat(avgRating) : 0;
    const displayRating = hasReviews ? `${manga.rating} / 10` : 'Ù„Ù… ØªÙÙ‚ÙŠÙ… Ø¨Ø¹Ø¯';

    // Ù†Ù…ÙˆØ°Ø¬ Ø¥Ø¶Ø§ÙØ© Ù…Ø±Ø§Ø¬Ø¹Ø©
    let reviewFormHtml = '';
    if (state.sessionToken) {
        const userRating = userReview ? userReview.rating : 10;
        const userText = userReview ? userReview.review_text : '';
        
        let starsPickerHtml = '';
        for (let i = 1; i <= 10; i++) {
            const starClass = i <= userRating ? 'fa-solid' : 'fa-regular';
            starsPickerHtml += `<i class="${starClass} fa-star star-opt" data-rating="${i}" style="font-size: 1.2rem; color: #ffb703; cursor: pointer; transition: transform 0.2s; padding: 0 2px;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'"></i>`;
        }

        reviewFormHtml = `
        <div class="review-form-container glass-card" style="padding: 20px; border-radius: var(--border-radius-md); border: 1px solid var(--border-color); background: rgba(255, 255, 255, 0.02); display: flex; flex-direction: column; gap: 16px; text-align: right;">
            <h4 style="font-size: 1.1rem; font-weight: 800; color: var(--text-main); margin-bottom: 4px;">
                ${userReview ? '<i class="fa-solid fa-pen-to-square"></i> ØªØ¹Ø¯ÙŠÙ„ ØªÙ‚ÙŠÙŠÙ…Ùƒ ÙˆÙ…Ø±Ø§Ø¬Ø¹ØªÙƒ' : '<i class="fa-solid fa-star-half-stroke"></i> Ø£Ø¶Ù ØªÙ‚ÙŠÙŠÙ…Ùƒ ÙˆÙ…Ø±Ø§Ø¬Ø¹ØªÙƒ Ù„Ù„Ø¹Ù…Ù„'}
            </h4>
            <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-start; gap: 14px; direction: rtl;">
                <span style="font-size: 0.95rem; font-weight: 700; color: var(--text-main);">Ø§Ù„ØªÙ‚ÙŠÙŠÙ… Ù…Ù† 10:</span>
                <div class="stars-picker" id="manga-stars-picker" style="display: flex; direction: ltr; flex-wrap: nowrap;">
                    ${starsPickerHtml}
                </div>
                <span id="manga-selected-rating-val" style="font-size: 1.1rem; font-weight: 800; color: #ffb703;">${userRating} / 10</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <label for="manga-review-text" style="font-size: 0.95rem; font-weight: 700; color: var(--text-main);">Ø±Ø£ÙŠÙƒ Ø£Ùˆ Ù…Ø±Ø§Ø¬Ø¹ØªÙƒ (Ø§Ø®ØªÙŠØ§Ø±ÙŠ):</label>
                <textarea id="manga-review-text" rows="3" placeholder="Ø§ÙƒØªØ¨ Ø±Ø£ÙŠÙƒ Ø£Ùˆ Ù…Ø±Ø§Ø¬Ø¹ØªÙƒ Ø§Ù„Ù†ØµÙŠØ© Ù‡Ù†Ø§..." style="width: 100%; padding: 12px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); color: var(--text-main); outline: none; font-family: var(--font-family); resize: none; text-align: right;">${userText}</textarea>
            </div>
            <button class="detail-btn btn-read" id="submit-manga-review-btn" style="padding: 10px 24px; font-size: 0.95rem; font-weight: 800; border-radius: 30px; width: fit-content; align-self: flex-start;">
                ${userReview ? 'ØªØ­Ø¯ÙŠØ« Ø§Ù„Ù…Ø±Ø§Ø¬Ø¹Ø© ÙˆØ§Ù„ØªÙ‚ÙŠÙŠÙ…' : 'Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„ØªÙ‚ÙŠÙŠÙ… ÙˆØ§Ù„Ù…Ø±Ø§Ø¬Ø¹Ø©'}
            </button>
        </div>
        `;
    } else {
        reviewFormHtml = `
        <div class="glass-card" style="padding: 20px; border-radius: var(--border-radius-md); border: 1px solid var(--border-color); background: rgba(255, 0, 127, 0.03); text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px;">
            <p style="font-size: 0.95rem; font-weight: 700; color: var(--text-main); margin: 0;"><i class="fa-solid fa-lock" style="color: var(--color-accent); margin-left: 6px;"></i> ÙŠØ¬Ø¨ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø¨Ø§Ù„Ø¬ÙŠÙ…ÙŠÙ„ Ø§Ù„Ø®Ø§Øµ Ø¨Ùƒ Ù„ØªØªÙ…ÙƒÙ† Ù…Ù† ØªÙ‚ÙŠÙŠÙ… Ø§Ù„Ù…Ù†Ù‡ÙˆØ§ ÙˆØªØ±Ùƒ Ù…Ø±Ø§Ø¬Ø¹Ø©.</p>
            <button class="login-navbar-btn" id="review-auth-prompt-btn" style="padding: 8px 20px; font-size: 0.85rem; border-radius: 20px;"><i class="fa-solid fa-right-to-bracket"></i> ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø§Ù„Ø¢Ù†</button>
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
                            <i class="fa-solid fa-play"></i> Ù‚Ø±Ø§Ø¡Ø© Ø£ÙˆÙ„ ÙØµÙ„
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
                            <i class="fa-solid fa-pen-to-square"></i> ØªØ¹Ø¯ÙŠÙ„ Ù‡Ø°Ø§ Ø§Ù„Ø¹Ù…Ù„
                        </button>
                        <button class="detail-btn delete-manga-admin-btn" data-id="${manga.id}" style="margin-top:6px; background:rgba(255,0,127,0.1); border:1px solid #ff007f; color:#ff007f; display:flex; align-items:center; justify-content:center; gap:8px; cursor:pointer;">
                            <i class="fa-solid fa-trash-can"></i> Ø­Ø°Ù Ù‡Ø°Ø§ Ø§Ù„Ø¹Ù…Ù„
                        </button>
                    ` : ''}
                    
                    ${state.sessionToken ? `
                        <div class="overall-progress-container">
                            <div class="overall-progress-label"><i class="fa-solid fa-chart-simple"></i> ØªÙ‚Ø¯Ù… Ø§Ù„Ù‚Ø±Ø§Ø¡Ø© Ø§Ù„Ø¥Ø¬Ù…Ø§Ù„ÙŠ: ${state.getOverallProgress(manga.id)}%</div>
                            <div class="overall-progress-track">
                                <div class="overall-progress-fill" style="width:${state.getOverallProgress(manga.id)}%"></div>
                            </div>
                        </div>
                    ` : ''}
                    ${state.progress[manga.id] ? `
                        <button class="detail-btn btn-continue continue-reading-btn" data-chap-id="${state.progress[manga.id].chapterId}">
                            <i class="fa-solid fa-arrow-rotate-right"></i> Ù…ØªØ§Ø¨Ø¹Ø© Ø§Ù„Ù‚Ø±Ø§Ø¡Ø©
                        </button>
                    ` : ''}
                </div>
            </div>
            <div class="detail-content">
                <h1 class="detail-title">${manga.title}</h1>
                <p class="detail-author">Ø§Ø³Ù… Ø¢Ø®Ø±: ${manga.alternative} â€¢ Ø§Ù„Ù…Ø¤Ù„Ù: ${manga.author}</p>
                
                <div class="detail-meta-grid">
                    <div class="meta-item"><strong>Ø§Ù„Ù†ÙˆØ¹:</strong> ${manga.type || 'Ù…Ù†Ù‡ÙˆØ§'}</div>
                    <div class="meta-item"><strong>Ø§Ù„Ø­Ø§Ù„Ø©:</strong> ${manga.status === 'Ongoing' ? 'Ù…Ø³ØªÙ…Ø±Ø©' : manga.status === 'Completed' ? 'Ù…ÙƒØªÙ…Ù„Ø©' : manga.status}</div>
                    <div class="meta-item"><strong>Ø§Ù„Ù…Ø´Ø§Ù‡Ø¯Ø§Øª:</strong> <i class="fa-solid fa-eye" style="color:var(--color-secondary)"></i> ${manga.views || 0}</div>
                    <div class="meta-item"><strong>Ø§Ù„ØªÙ‚ÙŠÙŠÙ…:</strong> <i class="fa-solid fa-star" style="color:#ffb703"></i> ${manga.rating}</div>
                </div>
                
                <div class="genres-list">
                    ${genresHtml}
                </div>
                
                <div class="detail-synopsis">
                    <h3>Ø§Ù„Ù‚ØµØ© ÙˆØ§Ù„ÙˆØµÙ</h3>
                    <p>${manga.synopsis}</p>
                </div>
                
                <!-- Ù‚Ø³Ù… Ù…Ø±Ø§Ø¬Ø¹Ø§Øª Ø§Ù„Ù…Ù†Ù‡ÙˆØ§ ÙˆØ§Ù„ØªÙ‚ÙŠÙŠÙ…Ø§Øª -->
                <div class="chapters-section" style="margin-top: 30px;">
                    <div class="chapters-header" style="margin-bottom: 20px;">
                        <h3>ØªÙ‚ÙŠÙŠÙ…Ø§Øª ÙˆÙ…Ø±Ø§Ø¬Ø¹Ø§Øª Ø§Ù„Ù…ØªØ§Ø¨Ø¹ÙŠÙ†</h3>
                        <span>Ù…ØªÙˆØ³Ø· Ø§Ù„ØªÙ‚ÙŠÙŠÙ…: <i class="fa-solid fa-star" style="color: #ffb703;"></i> ${manga.rating}</span>
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
                        <h3>ÙØµÙˆÙ„ Ø§Ù„Ù…Ø§Ù†Ø¬Ø§ Ø§Ù„Ù…ØªØ§Ø­Ø©</h3>
                        <div class="chapters-search-box">
                            <input type="text" id="chapters-search-input" placeholder="Ø§Ø¨Ø­Ø« Ø¹Ù† Ø±Ù‚Ù… Ø§Ù„ÙØµÙ„ Ø£Ùˆ Ø§Ù„Ø¹Ù†ÙˆØ§Ù†..." value="${state.chapterSearchQuery || ''}" autocomplete="off">
                            <i class="fa-solid fa-magnifying-glass"></i>
                        </div>
                        <select id="chapter-sort-select" style="background:var(--bg-surface);border:1px solid var(--border-color);color:var(--text-main);padding:6px 12px;border-radius:8px;font-size:0.8rem;outline:none;cursor:pointer;">
                            <option value="newest" ${state.chapterSortOrder === 'newest' ? 'selected' : ''}>Ø§Ù„Ø£Ø­Ø¯Ø« Ø£ÙˆÙ„Ø§Ù‹</option>
                            <option value="oldest" ${state.chapterSortOrder === 'oldest' ? 'selected' : ''}>Ø§Ù„Ø£Ù‚Ø¯Ù… Ø£ÙˆÙ„Ø§Ù‹</option>
                        </select>
                        <span>Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„ÙØµÙˆÙ„: ${manga.chapters.length}</span>
                    </div>
                    <div class="chapters-list">
                        ${chaptersHtml}
                    </div>
                </div>
            </div>
        </div>
        ${renderRelatedMangas(manga)}
    </div>
    `;
}

function renderRelatedMangas(manga) {
    const related = getRelatedMangas(manga);
    if (related.length === 0) return '';
    return `
    <div class="related-section">
        <div class="section-header"><h2 class="section-title">Ù‚Ø¯ ÙŠØ¹Ø¬Ø¨Ùƒ Ø£ÙŠØ¶Ø§Ù‹ <span>ØªÙˆØµÙŠØ§Øª</span></h2></div>
        <div class="related-grid">
            ${related.map(m => `
                <div class="related-card" onclick="navigate('detail','${m.id}')" role="button">
                    <img src="${m.cover || DEFAULT_COVER_URL}" alt="${m.title}" loading="lazy">
                    <div class="related-title">${m.title}</div>
                    <div class="related-rating">${m.rating ? 'â­ '.repeat(Math.round(m.rating)) : ''}</div>
                </div>
            `).join('')}
        </div>
    </div>`;
}

// Ù‚Ø§Ø±Ø¦ Ø§Ù„ÙØµÙˆÙ„
async function ReaderViewComponent() {
    const manga = state.mangas.find(m => m.id === state.activeMangaId);
    if (!manga) return '<p>Ø§Ù„Ù…Ø§Ù†Ø¬Ø§ ØºÙŠØ± Ù…ØªÙˆÙØ±Ø©</p>';

    if (manga.id === "1" && !state.soloLevelingLoaded) {
        await state.loadSoloLevelingChapters();
    }
    
    const chapterIndex = manga.chapters.findIndex(c => normalizeChapterId(c.id) === normalizeChapterId(state.activeChapterId));
    if (chapterIndex === -1) return '<p>Ø§Ù„ÙØµÙ„ ØºÙŠØ± Ù…ØªÙˆÙØ±</p>';
    
    const chapter = manga.chapters[chapterIndex];
    
    // Ø²ÙŠØ§Ø¯Ø© Ø§Ù„Ù…Ø´Ø§Ù‡Ø¯Ø§Øª Ù…Ø­Ù„ÙŠØ§Ù‹
    manga.views = (manga.views || 0) + 1;
    
    // Ù†Ù‚Ø§Ø· Ø§Ù„Ù‚Ø±Ø§Ø¡Ø©
    state.addPoints(3);

    // ÙØ­Øµ Ù…Ø§ Ø¥Ø°Ø§ ÙƒØ§Ù† Ù‡Ø°Ø§ Ø§Ù„ÙØµÙ„ Ù…Ø­Ù…Ù„ Ø£ÙˆÙÙ„Ø§ÙŠÙ†
    let pages = chapter.images;
    const offlineData = await getChapterOffline(manga.id, chapter.id);
    const isOfflineAvailable = !!offlineData;
    if (isOfflineAvailable) {
        pages = offlineData.images;
        console.log("ØªÙ… ØªØ­Ù…ÙŠÙ„ ØµÙØ­Ø§Øª Ø§Ù„ÙØµÙ„ Ø§Ù„Ù…Ø­ÙÙˆØ¸Ø© Ù…Ù† Ø§Ù„Ù€ IndexedDB Ù…Ø­Ù„ÙŠØ§Ù‹.");
    }

    // Ø§Ù„ØªÙˆÙ„ÙŠØ¯ Ø§Ù„Ø¯ÙŠÙ†Ø§Ù…ÙŠÙƒÙŠ Ø¹Ù„Ù‰ Ø§Ù„Ø·Ø§ÙŠØ± Ù„ØªØ®ÙÙŠÙ Ø§Ù„Ø°Ø§ÙƒØ±Ø© ÙˆØ§Ù„Ù…Ù„ÙØ§Øª
    if (!pages || pages.length === 0) {
        if (manga.id === "4") {
            pages = generateKingdomMockPages(manga.title, chapter.id);
        } else {
            pages = generateMockPages(manga.title, chapter.id);
        }
    }

    // Ø¥Ø¹Ø¯Ø§Ø¯ Ø§Ù„ØªØ­Ù…ÙŠÙ„ Ø§Ù„Ù…Ø³Ø¨Ù‚ Ø§Ù„Ø°ÙƒÙŠ (Ù‡ÙŠØªÙØ¹Ù„ Ù„Ù…Ø§ Ø§Ù„Ù‚Ø§Ø±Ø¦ ÙŠÙ†Ø²Ù„ Ù„ØªØ­Øª)
    window._hasPrefetchedNextChapter = false;
    window._nextChapterImages = null;
    const nextChapter = manga.chapters[chapterIndex - 1];
    if (nextChapter) {
        window._nextChapterImages = nextChapter.images;
    }

    // Ø§Ù„ØªØ­Ù…ÙŠÙ„ Ø§Ù„Ù…Ø³Ø¨Ù‚ Ø§Ù„Ø°ÙƒÙŠ Ø¹Ù„Ù‰ Ø§Ù„Ø³ÙŠØ±ÙØ± Ù„Ù„ÙØµÙˆÙ„ Ø§Ù„Ù‚Ø§Ø¯Ù…Ø©
    const prefetchCount = 2; 
    for (let i = 1; i <= prefetchCount; i++) {
        const futureChapter = manga.chapters[chapterIndex - i];
        if (futureChapter && futureChapter.id) {
            fetch('/api/preload-chapter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ manga_id: manga.id, chapter_id: futureChapter.id })
            }).catch(e => console.log('Preload background error:', e));
        }
    }

    // Ø®ÙŠØ§Ø±Ø§Øª Ø§Ù„ÙØµÙˆÙ„
    let optionsHtml = '';
    manga.chapters.forEach(ch => {
            optionsHtml += `<option value="${ch.id}" ${normalizeChapterId(ch.id) === normalizeChapterId(chapter.id) ? 'selected' : ''}>Ø§Ù„ÙØµÙ„ ${ch.id}</option>`;
    });

    // ØªÙØ¶ÙŠÙ„ Ø§Ù„ÙØµÙ„
    const likeKey = `${manga.id}_${chapter.id}`;
    const isLiked = state.likes[likeKey] || false;

    // Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„Ù‚Ø§Ø±Ø¦
    const settings = state.readerSettings;
    const themeClass = `reader-theme-${settings.theme}`;
    const widthClass = `reader-width-${settings.width}`;
    const modeClass = settings.mode === 'horizontal' ? 'reader-mode-horizontal' : '';

    let imagesHtml = '';
    if (settings.mode === 'horizontal') {
        pages.forEach((pageUrl, index) => {
            const isActivePage = index === state.activePageIndex;
            imagesHtml += `
            <div class="reader-image-container ${isActivePage ? 'active-page' : ''}" data-index="${index}">
                <img src="${pageUrl}" alt="ØµÙØ­Ø© ${index + 1}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='/proxy-image?url=' + encodeURIComponent('${pageUrl}')">
            </div>
            `;
        });
    } else {
        pages.forEach((pageUrl, index) => {
            imagesHtml += `
            <div class="reader-image-container lazy-load-container" data-src="${pageUrl}">
                <div class="reader-image-placeholder">
                    <i class="fa-solid fa-circle-notch fa-spin" style="font-size:2.5rem;color:var(--color-primary);margin-bottom:12px;"></i>
                    <span>Ø¬Ø§Ø±ÙŠ ØªØ­Ù…ÙŠÙ„ Ø§Ù„ØµÙØ­Ø© ${index + 1}...</span>
                </div>
            </div>
            `;
        });
    }

    // --- Ø§Ù„ØªØ­Ù…ÙŠÙ„ Ø§Ù„ØªÙ„Ù‚Ø§Ø¦ÙŠ Ù„Ù„ÙØµÙ„ Ø§Ù„ØªØ§Ù„ÙŠ (Infinite Scroll) ---
    if (chapterIndex > 0 && settings.mode !== 'horizontal') {
        imagesHtml += '<div id="next-chapter-sentinel" style="height:1px;width:100%;"></div>';
    }

    // Ø¬Ù„Ø¨ ØªØ¹Ù„ÙŠÙ‚Ø§Øª Ø§Ù„ÙØµÙ„ Ù…Ù† Ø§Ù„Ø³ÙŠØ±ÙØ±
    let chapterComments = [];
    let commentsListHtml = '';
    try {
        const response = await fetch(`/api/chapter_comments?manga_id=${manga.id}&chapter_id=${chapter.id}`);
        if (response.ok) {
            chapterComments = await response.json();
            if (chapterComments.length === 0) {
                commentsListHtml = '<p style="color:var(--text-dark);text-align:center;padding:20px;">ÙƒÙ† Ø£ÙˆÙ„ Ù…Ù† ÙŠØªØ±Ùƒ ØªØ¹Ù„ÙŠÙ‚Ø§Ù‹ Ø¹Ù„Ù‰ Ù‡Ø°Ø§ Ø§Ù„ÙØµÙ„!</p>';
            } else {
                chapterComments.forEach(comm => {
                    const userDisplay = comm.email.split('@')[0];
                    const firstLetter = userDisplay.charAt(0).toUpperCase();
                    const dateStr = new Date(comm.created_at * 1000).toLocaleDateString('ar-EG');
                    const badgeIcons = {
                        'gold': '<i class="fa-solid fa-medal" style="color:#ffd700;" title="Ø£ÙˆÙ„ ØªØ¹Ù„ÙŠÙ‚"></i>',
                        'silver': '<i class="fa-solid fa-medal" style="color:#c0c0c0;" title="Ø«Ø§Ù†ÙŠ ØªØ¹Ù„ÙŠÙ‚"></i>',
                        'bronze': '<i class="fa-solid fa-medal" style="color:#cd7f32;" title="Ø«Ø§Ù„Ø« ØªØ¹Ù„ÙŠÙ‚"></i>'
                    };
                    const badgeHtml = badgeIcons[comm.badge] ? `<span class="comment-badge">${badgeIcons[comm.badge]}</span>` : '';
                    commentsListHtml += `
                    <div class="comment-item">
                        <div class="comment-avatar">${firstLetter}</div>
                        <div class="comment-body">
                            <div class="comment-header">
                                <span class="comment-username">${userDisplay} ${badgeHtml}</span>
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
        commentsListHtml = '<p style="color:#ff007f;text-align:center;padding:20px;">ÙØ´Ù„ ØªØ­Ù…ÙŠÙ„ ØªØ¹Ù„ÙŠÙ‚Ø§Øª Ù‡Ø°Ø§ Ø§Ù„ÙØµÙ„.</p>';
    }

    // ØµÙ†Ø¯ÙˆÙ‚ ØªØ¹Ù„ÙŠÙ‚ Ù…Ø³Ø¬Ù„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø£Ùˆ ØºÙŠØ± Ø§Ù„Ù…Ø³Ø¬Ù„
    let commentFormHtml = '';
    if (state.sessionToken) {
        commentFormHtml = `
        <form class="comments-form" id="chapter-comment-form" style="display: flex; flex-direction: column; gap: 10px; text-align: right;">
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 6px;">
                <i class="fa-solid fa-user-check" style="color: var(--color-secondary); margin-left: 4px;"></i> Ø§Ù„ØªØ¹Ù„ÙŠÙ‚ Ø¨Ø§Ø³Ù…: <strong>${state.userEmail.split('@')[0]}</strong>
            </div>
            <div style="display: flex; gap: 12px; width: 100%;">
                <input type="text" placeholder="Ø´Ø§Ø±ÙƒÙ†Ø§ Ø±Ø£ÙŠÙƒ Ø­ÙˆÙ„ Ø§Ù„ÙØµÙ„..." id="chapter-comment-text" required style="flex: 1; padding: 12px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 30px; color: var(--text-main); outline: none; text-align: right;">
                <button type="submit" style="padding: 10px 24px; background: var(--color-primary); color: #fff; border: none; border-radius: 30px; font-weight: 700; cursor: pointer;">Ø¥Ø±Ø³Ø§Ù„</button>
            </div>
        </form>
        `;
    } else {
        commentFormHtml = `
        <div class="glass-card" style="padding: 18px; border-radius: var(--border-radius-md); border: 1px solid var(--border-color); background: rgba(255, 0, 127, 0.03); text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px;">
            <p style="font-size: 0.9rem; font-weight: 700; color: var(--text-main); margin: 0;">
                <i class="fa-solid fa-lock" style="color: var(--color-accent); margin-left: 6px;"></i> ÙŠØ¬Ø¨ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø¨Ø§Ù„Ø¬ÙŠÙ…ÙŠÙ„ Ø§Ù„Ø®Ø§Øµ Ø¨Ùƒ Ù„ØªØªÙ…ÙƒÙ† Ù…Ù† ÙƒØªØ§Ø¨Ø© ØªØ¹Ù„ÙŠÙ‚ Ø¹Ù„Ù‰ Ù‡Ø°Ø§ Ø§Ù„ÙØµÙ„.
            </p>
            <button class="login-navbar-btn" id="comment-auth-prompt-btn" style="padding: 6px 18px; font-size: 0.8rem; border-radius: 20px;"><i class="fa-solid fa-right-to-bracket"></i> ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø§Ù„Ø¢Ù†</button>
        </div>
        `;
    }

    // Ø§Ø³ØªØ±Ø¬Ø§Ø¹ ÙˆØ­ÙØ¸ Ø§Ù„ØªÙ‚Ø¯Ù…
    const progressPercent = settings.mode === 'horizontal' ? ((state.activePageIndex + 1) / pages.length) * 100 : 0;
    state.saveReadingProgress(manga.id, chapter.id, 0, progressPercent, state.activePageIndex);

    return `
    <div class="reader-wrapper ${themeClass} ${widthClass} ${modeClass} page-fade-in">
        <div class="reader-progress-bar" id="reading-bar" style="width: ${progressPercent}%"></div>
        
        <div class="reader-nav">
            <button class="reader-btn return-to-manga" title="Ø§Ù„Ø¹ÙˆØ¯Ø© Ù„ØµÙØ­Ø© Ø§Ù„Ù…Ø§Ù†Ø¬Ø§"><i class="fa-solid fa-arrow-right"></i></button>
            <div class="reader-title-info">
                <h2>${manga.title}</h2>
                <p>${chapter.title} ${isOfflineAvailable ? '<span style="color:var(--color-secondary)"><i class="fa-solid fa-wifi-slash"></i> Ø£ÙˆÙÙ„Ø§ÙŠÙ†</span>' : ''}</p>
            </div>
            <div class="reader-controls">
                <button class="reader-btn prev-chapter-btn ${chapterIndex === manga.chapters.length - 1 ? 'disabled' : ''}" title="Ø§Ù„ÙØµÙ„ Ø§Ù„Ø³Ø§Ø¨Ù‚"><i class="fa-solid fa-chevron-right"></i></button>
                
                <div class="custom-dropdown" id="chapter-dropdown">
                    <button class="dropdown-trigger">
                        <span>${chapter.title}</span>
                        <i class="fa-solid fa-chevron-down"></i>
                    </button>
                    <div class="dropdown-content">
                        <div class="dropdown-search-box">
                            <input type="text" id="chapter-drop-search" placeholder="Ø§Ø¨Ø­Ø« Ø¹Ù† Ø±Ù‚Ù… Ø§Ù„ÙØµÙ„..." autocomplete="off">
                            <i class="fa-solid fa-magnifying-glass"></i>
                        </div>
                        <div class="dropdown-items-list">
                            ${manga.chapters.map(ch => {
                                let subtitle = ch.title ? (ch.title.includes(':') ? ch.title.split(':').slice(1).join(':').trim() : '') : '';
                                let mainTitle = ch.title ? ch.title.split(':')[0].trim() : `Ø§Ù„ÙØµÙ„ ${String(ch.id).replace(/^ch_/, '').replace(/_0$/, '').replace(/_/g, '.')}`;
                                if (subtitle.replace(/[^0-9.]/g, '') === mainTitle.replace(/[^0-9.]/g, '')) {
                                    subtitle = '';
                                }
                                return `
                                    <div class="dropdown-item-opt ${normalizeChapterId(ch.id) === normalizeChapterId(chapter.id) ? 'active' : ''}" data-value="${ch.id}">
                                        <span class="opt-num">${mainTitle}</span>
                                        ${subtitle ? `<span class="opt-title">${subtitle}</span>` : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>

                <button class="reader-btn next-chapter-btn ${chapterIndex === 0 ? 'disabled' : ''}" title="Ø§Ù„ÙØµÙ„ Ø§Ù„ØªØ§Ù„ÙŠ"><i class="fa-solid fa-chevron-left"></i></button>
                ${state.userRole === 'admin' ? `
                <button class="reader-btn translate-chapter-btn" title="ØªØ±Ø¬Ù…Ø© Ù‡Ø°Ø§ Ø§Ù„ÙØµÙ„" data-url="${chapter.url}" data-manga-id="${manga.id}" data-chapter-id="${chapter.id}">
                    <i class="fa-solid fa-language"></i>
                </button>` : ''}
            </div>
        </div>
        
        <div class="reader-content-images">
            ${imagesHtml}
            
            ${settings.mode === 'horizontal' ? `
                <div class="horizontal-click-navigator">
                    <div class="nav-zone nav-zone-right" id="h-prev-zone" title="Ø§Ù„ØµÙØ­Ø© Ø§Ù„Ø³Ø§Ø¨Ù‚Ø©"><i class="fa-solid fa-chevron-right"></i></div>
                    <div class="nav-zone nav-zone-left" id="h-next-zone" title="Ø§Ù„ØµÙØ­Ø© Ø§Ù„ØªØ§Ù„ÙŠØ©"><i class="fa-solid fa-chevron-left"></i></div>
                </div>
                <div class="horizontal-page-indicator">
                    ØµÙØ­Ø© ${state.activePageIndex + 1} Ù…Ù† ${pages.length}
                </div>
            ` : ''}
        </div>

        <div class="chapter-likes-interactive">
            <button class="like-chapter-btn ${isLiked ? 'liked' : ''}" id="chapter-like-btn">
                <i class="fa-${isLiked ? 'solid' : 'regular'} fa-heart"></i>
                <span id="like-text">${isLiked ? 'Ø£Ø¹Ø¬Ø¨Ù†ÙŠ Ù‡Ø°Ø§ Ø§Ù„ÙØµÙ„!' : 'Ø£Ø¹Ø¬Ø¨Ù†ÙŠ'}</span>
            </button>
        </div>
        
        <div class="reader-bottom-nav">
            <button class="reader-btn prev-chapter-btn ${chapterIndex === manga.chapters.length - 1 ? 'disabled' : ''}" title="Ø§Ù„ÙØµÙ„ Ø§Ù„Ø³Ø§Ø¨Ù‚"><i class="fa-solid fa-chevron-right"></i> Ø§Ù„ÙØµÙ„ Ø§Ù„Ø³Ø§Ø¨Ù‚</button>
            <button class="reader-btn return-to-manga" title="Ø§Ù„Ø¹ÙˆØ¯Ø© Ù„ØµÙØ­Ø© Ø§Ù„Ù…Ø§Ù†Ù‡ÙˆØ§">Ø±Ø¬ÙˆØ¹ Ø¥Ù„Ù‰ Ø§Ù„Ù…Ø§Ù†Ù‡ÙˆØ§</button>
            <button class="reader-btn next-chapter-btn ${chapterIndex === 0 ? 'disabled' : ''}" title="Ø§Ù„ÙØµÙ„ Ø§Ù„ØªØ§Ù„ÙŠ">Ø§Ù„ÙØµÙ„ Ø§Ù„ØªØ§Ù„ÙŠ <i class="fa-solid fa-chevron-left"></i></button>
        </div>
        
        <button class="reader-settings-toggle-btn" id="settings-panel-toggle" title="ØªØ®ØµÙŠØµ Ø§Ù„Ù‚Ø±Ø§Ø¡Ø©"><i class="fa-solid fa-gear"></i></button>
        
        <div class="reader-settings-panel" id="settings-panel">
            <div class="setting-row">
                <label>Ø§ØªØ¬Ø§Ù‡ Ø§Ù„Ù‚Ø±Ø§Ø¡Ø©</label>
                <div class="setting-buttons">
                    <button class="setting-btn ${settings.mode === 'vertical' ? 'active' : ''}" data-setting="mode" data-value="vertical">Ø·ÙˆÙ„ÙŠ (Webtoon)</button>
                    <button class="setting-btn ${settings.mode === 'horizontal' ? 'active' : ''}" data-setting="mode" data-value="horizontal">Ø£ÙÙ‚ÙŠ (Manga)</button>
                </div>
            </div>
            <div class="setting-row">
                <label>Ù„ÙˆÙ† Ø§Ù„Ø®Ù„ÙÙŠØ©</label>
                <div class="setting-buttons">
                    <button class="setting-btn ${settings.theme === 'dark' ? 'active' : ''}" data-setting="theme" data-value="dark">Ø¯Ø§ÙƒÙ†</button>
                    <button class="setting-btn ${settings.theme === 'gray' ? 'active' : ''}" data-setting="theme" data-value="gray">Ø±Ù…Ø§Ø¯ÙŠ</button>
                    <button class="setting-btn ${settings.theme === 'sepia' ? 'active' : ''}" data-setting="theme" data-value="sepia">Ù…Ø±ÙŠØ­ Ù„Ù„Ø¹ÙŠÙ†</button>
                </div>
            </div>
            <div class="setting-row">
                <label>Ø¹Ø±Ø¶ Ø§Ù„ØµÙˆØ±</label>
                <div class="setting-buttons">
                    <button class="setting-btn ${settings.width === 'compact' ? 'active' : ''}" data-setting="width" data-value="compact">Ù…Ø¶ØºÙˆØ·</button>
                    <button class="setting-btn ${settings.width === 'medium' ? 'active' : ''}" data-setting="width" data-value="medium">Ù…ØªÙˆØ³Ø·</button>
                    <button class="setting-btn ${settings.width === 'full' ? 'active' : ''}" data-setting="width" data-value="full">ÙƒØ§Ù…Ù„</button>
                </div>
            </div>
            <div class="setting-row">
                <label>ÙˆØ¶Ø¹ Ø§Ù„Ù‚Ø±Ø§Ø¡Ø©</label>
                <div class="setting-buttons">
                    <button class="setting-btn" id="reader-fullscreen-btn"><i class="fa-solid fa-expand"></i> Ù…Ù„Ø¡ Ø§Ù„Ø´Ø§Ø´Ø©</button>
                    <button class="setting-btn" id="reader-strip-toggle"><i class="fa-solid fa-align-center"></i> ØªÙ…Ø±ÙŠØ± Ù…Ø³ØªÙ…Ø±</button>
                    <button class="setting-btn" id="reader-zoom-in" title="ØªÙƒØ¨ÙŠØ±"><i class="fa-solid fa-plus"></i></button>
                    <button class="setting-btn" id="reader-zoom-out" title="ØªØµØºÙŠØ±"><i class="fa-solid fa-minus"></i></button>
                    <button class="setting-btn" id="reader-zoom-reset" title="Ø¥Ø¹Ø§Ø¯Ø© Ø§Ù„Ø¶Ø¨Ø·"><i class="fa-solid fa-undo"></i></button>
                </div>
            </div>
        </div>
        
        <div class="main-content" style="max-width: 800px; margin: 0 auto; width: 100%;">
            <div class="comments-container" style="margin-bottom: 50px;">
                <h3 class="comments-title"><i class="fa-regular fa-comments"></i> Ù…Ù†Ø§Ù‚Ø´Ø© Ø§Ù„ÙØµÙ„ (${chapterComments.length})</h3>
                ${commentFormHtml}
                <div class="comments-list" id="chapter-comments-list">
                    ${commentsListHtml}
                </div>
            </div>
        </div>
    </div>
    `;
}

// Ù„ÙˆØ­Ø© Ø§Ù„Ø¥Ø¯Ø§Ø±Ø©
function AdminPanelViewComponent() {
    if (state.userRole !== 'admin') {
        return '<p style="padding: 40px; text-align: center; color: var(--text-dark);">Ù„Ø§ ØªÙ…Ù„Ùƒ ØµÙ„Ø§Ø­ÙŠØ© Ø§Ù„ÙˆØµÙˆÙ„ Ø¥Ù„Ù‰ Ù„ÙˆØ­Ø© Ø§Ù„Ø¥Ø¯Ø§Ø±Ø©.</p>';
    }
    if (!state.adminStats) {
        loadAdminStats();
    }

    let mangaOptions = '';
    state.mangas.forEach(m => {
        mangaOptions += `<option value="${m.id}">${m.title}</option>`;
    });

    const dateFrom = state.adminDateFrom || '';
    const dateTo = state.adminDateTo || '';
    const statsTitle = state.adminDateFrom && state.adminDateTo ? `Ø¥Ø­ØµØ§Ø¦ÙŠØ§Øª (${state.adminDateFrom} â†’ ${state.adminDateTo})` : 'Ù„ÙˆØ­Ø© Ø§Ù„Ø¥Ø­ØµØ§Ø¦ÙŠØ§Øª Ø§Ù„Ø­ÙŠÙˆÙŠØ©';
    return `
    <div class="admin-container" style="position: relative;">
        <button class="settings-close-btn" id="close-admin-btn" title="Ø®Ø±ÙˆØ¬ Ù…Ù† Ù„ÙˆØ­Ø© Ø§Ù„Ø¥Ø¯Ø§Ø±Ø©" style="position: absolute; top: 12px; left: 12px;"><i class="fa-solid fa-xmark"></i></button>
        <h2 class="admin-title">Ù„ÙˆØ­Ø© Ø§Ù„ØªØ­ÙƒÙ… ÙˆØ§Ù„Ø¥Ø¯Ø§Ø±Ø© Ù„Ù„Ù…ÙˆÙ‚Ø¹ <span>(KAIRO/Ù…Ù†Ù‡ÙˆØ§)</span></h2>
        
        <!-- Date Range + Export Controls -->
        <div class="admin-controls" style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 20px; padding: 16px; border-radius: var(--border-radius-md); border: 1px solid var(--border-color); background: rgba(255,255,255,0.01);">
            <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 700;"><i class="fa-solid fa-calendar"></i> ØªØµÙÙŠØ©:</span>
            <input type="date" id="admin-date-from" value="${dateFrom}" style="direction: ltr; text-align: right; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); padding: 8px 12px; border-radius: var(--border-radius-sm); font-size: 0.85rem; outline: none;">
            <span style="color: var(--text-dark);">â†’</span>
            <input type="date" id="admin-date-to" value="${dateTo}" style="direction: ltr; text-align: right; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); padding: 8px 12px; border-radius: var(--border-radius-sm); font-size: 0.85rem; outline: none;">
            <button class="admin-control-btn" id="btn-admin-apply-filter" style="padding: 8px 20px; border-radius: var(--border-radius-sm); border: none; background: linear-gradient(135deg, var(--color-primary), var(--color-secondary)); color: #fff; font-weight: 700; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 6px;"><i class="fa-solid fa-filter"></i> ØªØ·Ø¨ÙŠÙ‚</button>
            <button class="admin-control-btn" id="btn-admin-clear-filter" style="padding: 8px 16px; border-radius: var(--border-radius-sm); border: 1px solid var(--border-color); background: transparent; color: var(--text-dark); font-weight: 600; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 6px;"><i class="fa-solid fa-xmark"></i> Ù…Ø³Ø­</button>
            <span style="flex:1;"></span>
            <button class="admin-control-btn" id="btn-admin-export-csv" style="padding: 8px 20px; border-radius: var(--border-radius-sm); border: 1px solid #00ff7f44; background: rgba(0,255,127,0.05); color: #00ff7f; font-weight: 700; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 6px;"><i class="fa-solid fa-file-csv"></i> CSV</button>
            <button class="admin-control-btn" id="btn-admin-export-json" style="padding: 8px 20px; border-radius: var(--border-radius-sm); border: 1px solid #6c63ff44; background: rgba(108,99,255,0.05); color: #6c63ff; font-weight: 700; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 6px;"><i class="fa-solid fa-file-export"></i> JSON</button>
        </div>
        
        <!-- Ù„ÙˆØ­Ø© Ø§Ù„Ø¥Ø­ØµØ§Ø¦ÙŠØ§Øª Ø§Ù„Ø­ÙŠÙˆÙŠØ© -->
        <div class="admin-stats-dashboard" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 30px;">
            ${state.adminStats ? `
                <div class="stat-card glass-card" style="padding: 16px; border-radius: var(--border-radius-md); border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 6px; background: rgba(255,255,255,0.01); text-align: right;">
                    <span style="font-size: 0.85rem; color: var(--text-muted);"><i class="fa-solid fa-eye" style="color: var(--color-secondary); margin-left: 6px;"></i> Ø²ÙŠØ§Ø±Ø§Øª Ø§Ù„Ù…ÙˆÙ‚Ø¹ Ø§Ù„ÙƒÙ„ÙŠØ©</span>
                    <strong style="font-size: 1.5rem; color: var(--text-main); font-weight: 800;">${state.adminStats.visits}</strong>
                </div>
                <div class="stat-card glass-card" style="padding: 16px; border-radius: var(--border-radius-md); border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 6px; background: rgba(255,255,255,0.01); text-align: right;">
                    <span style="font-size: 0.85rem; color: var(--text-muted);"><i class="fa-solid fa-users" style="color: var(--color-primary); margin-left: 6px;"></i> Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ù…Ø´ØªØ±ÙƒÙŠÙ†</span>
                    <strong style="font-size: 1.5rem; color: var(--text-main); font-weight: 800;">${state.adminStats.total_users}</strong>
                </div>
                <div class="stat-card glass-card" style="padding: 16px; border-radius: var(--border-radius-md); border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 6px; background: rgba(255,255,255,0.01); text-align: right;">
                    <span style="font-size: 0.85rem; color: var(--text-muted);"><i class="fa-brands fa-google" style="color: #ea4335; margin-left: 6px;"></i> Ø§Ù„ØªØ³Ø¬ÙŠÙ„ Ø¨Ù€ Google</span>
                    <strong style="font-size: 1.5rem; color: var(--text-main); font-weight: 800;">${state.adminStats.google}</strong>
                </div>
                <div class="stat-card glass-card" style="padding: 16px; border-radius: var(--border-radius-md); border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 6px; background: rgba(255,255,255,0.01); text-align: right;">
                    <span style="font-size: 0.85rem; color: var(--text-muted);"><i class="fa-brands fa-facebook" style="color: #1877f2; margin-left: 6px;"></i> Ø§Ù„ØªØ³Ø¬ÙŠÙ„ Ø¨Ù€ Facebook</span>
                    <strong style="font-size: 1.5rem; color: var(--text-main); font-weight: 800;">${state.adminStats.facebook}</strong>
                </div>
                ${state.adminStats.suggestions_in_range !== undefined ? `
                <div class="stat-card glass-card" style="padding: 16px; border-radius: var(--border-radius-md); border: 1px solid #ff007f44; display: flex; flex-direction: column; gap: 6px; background: rgba(255,0,127,0.03); text-align: right;">
                    <span style="font-size: 0.85rem; color: var(--text-muted);"><i class="fa-solid fa-message" style="color: #ff007f; margin-left: 6px;"></i> Ø§Ù‚ØªØ±Ø§Ø­Ø§Øª/Ø´ÙƒØ§ÙˆÙ‰ (ÙÙŠ Ø§Ù„Ù†Ø·Ø§Ù‚)</span>
                    <strong style="font-size: 1.5rem; color: #ff007f; font-weight: 800;">${state.adminStats.suggestions_in_range}</strong>
                </div>` : state.adminStats.total_suggestions !== undefined ? `
                <div class="stat-card glass-card" style="padding: 16px; border-radius: var(--border-radius-md); border: 1px solid #ff007f44; display: flex; flex-direction: column; gap: 6px; background: rgba(255,0,127,0.03); text-align: right;">
                    <span style="font-size: 0.85rem; color: var(--text-muted);"><i class="fa-solid fa-message" style="color: #ff007f; margin-left: 6px;"></i> Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ø§Ù‚ØªØ±Ø§Ø­Ø§Øª ÙˆØ§Ù„Ø´ÙƒØ§ÙˆÙ‰</span>
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
            <button class="admin-tab" id="tab-add-chapter">Ø¥Ø¶Ø§ÙØ© ÙØµÙ„ Ø¬Ø¯ÙŠØ¯</button>
            <button class="admin-tab" id="tab-edit-manga">ØªØ¹Ø¯ÙŠÙ„ Ù…Ø§Ù†Ø¬Ø§/Ù…Ù†Ù‡ÙˆØ§</button>
            <button class="admin-tab active" id="tab-live-scraper"><i class="fa-solid fa-terminal"></i> Ø³Ø­Ø¨ Ùˆ Ù…Ø±Ø§Ù‚Ø¨Ø© (Pro)</button>
            <button class="admin-tab" id="tab-suggestions">Ø§Ù„Ø´ÙƒØ§ÙˆÙ‰ ÙˆØ§Ù„Ø§Ù‚ØªØ±Ø§Ø­Ø§Øª</button>
            <button class="admin-tab" id="tab-site-settings">Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„Ù…ÙˆÙ‚Ø¹</button>
            <button class="admin-tab" id="tab-alt-sources">Ù…ØµØ§Ø¯Ø± Ø¨Ø¯ÙŠÙ„Ø©</button>
        </div>
        
        <div class="admin-form-panel" id="panel-edit-manga" style="display:none;">
            <form id="edit-manga-form">
                <div class="admin-form-group">
                    <label>Ø§Ø®ØªØ± Ø§Ù„Ù…Ø§Ù†Ø¬Ø§/Ø§Ù„Ù…Ù†Ù‡ÙˆØ§ Ù„Ù„ØªØ¹Ø¯ÙŠÙ„</label>
                    <select id="edit-manga-id" required>
                        <option value="">-- Ø§Ø®ØªØ± --</option>
                        ${mangaOptions}
                    </select>
                </div>
                <div id="edit-manga-fields" style="display:none; margin-top: 20px; border-top: 1px solid var(--border-color); padding-top: 20px;">
                    <div class="admin-form-group">
                        <label>Ø±Ø§Ø¨Ø· ØµÙˆØ±Ø© Ø§Ù„ØºÙ„Ø§Ù (Cover)</label>
                        <input type="url" id="edit-manga-cover" placeholder="Ø±Ø§Ø¨Ø· URL Ù„Ù„ØºÙ„Ø§Ù">
                    </div>
                    <div class="admin-form-group">
                        <label>Ø§Ù„ØªØµÙ†ÙŠÙØ§Øª (ØªÙØµÙ„ Ø¨ÙØ§ØµÙ„Ø©)</label>
                        <input type="text" id="edit-manga-genres" placeholder="Ø£ÙƒØ´Ù†, Ù…ØºØ§Ù…Ø±Ø©, Ø®ÙŠØ§Ù„, Ø¹Ø³ÙƒØ±ÙŠ">
                    </div>
                    <div class="admin-form-group">
                        <label>Ø§Ù„Ø¹Ù†ÙˆØ§Ù†</label>
                        <input type="text" id="edit-manga-title" placeholder="Ø¹Ù†ÙˆØ§Ù† Ø§Ù„Ù…Ø§Ù†Ø¬Ø§">
                    </div>
                    <div class="admin-form-group">
                        <label>Ø§Ù„Ø¹Ù†ÙˆØ§Ù† Ø§Ù„Ø¨Ø¯ÙŠÙ„</label>
                        <input type="text" id="edit-manga-alt" placeholder="Ø§Ù„Ø¹Ù†ÙˆØ§Ù† Ø¨Ø§Ù„Ø¥Ù†Ø¬Ù„ÙŠØ²ÙŠ Ø£Ùˆ Ø§Ù„Ø¨Ø¯ÙŠÙ„">
                    </div>
                    <div class="admin-form-group">
                        <label>Ø§Ù„Ù…Ø¤Ù„Ù</label>
                        <input type="text" id="edit-manga-author" placeholder="Ø§Ø³Ù… Ø§Ù„Ù…Ø¤Ù„Ù Ø£Ùˆ Ø§Ù„Ø±Ø³Ø§Ù…">
                    </div>
                    <div class="admin-form-group">
                        <label>Ø§Ù„Ù‚ØµØ© (Ø§Ù„ÙˆØµÙ)</label>
                        <textarea id="edit-manga-synopsis" rows="4" placeholder="ÙˆØµÙ Ø§Ù„Ù‚ØµØ©"></textarea>
                    </div>


                    <div class="admin-form-group">
                        <label>Ù†ÙˆØ¹ Ø§Ù„Ø¹Ù…Ù„ (Type)</label>
                        <select id="edit-manga-type">
                            <option value="Manga">Ù…Ø§Ù†Ø¬Ø§ (Manga)</option>
                            <option value="Manhwa">Ù…Ø§Ù†Ù‡ÙˆØ§ ÙƒÙˆØ±ÙŠØ© (Manhwa)</option>
                            <option value="Manhua">Ù…Ø§Ù†Ù‡ÙˆØ§ ØµÙŠÙ†ÙŠØ© (Manhua)</option>
                            <option value="Comic">ÙƒÙˆÙ…ÙŠÙƒ (Comic)</option>
                        </select>
                    </div>
                    <div class="admin-form-group">
                        <label>Ø­Ø§Ù„Ø© Ø§Ù„Ø¹Ù…Ù„</label>
                        <select id="edit-manga-status">
                            <option value="Ù…Ø³ØªÙ…Ø±">Ù…Ø³ØªÙ…Ø±</option>
                            <option value="Ù…ÙƒØªÙ…Ù„">Ù…ÙƒØªÙ…Ù„</option>
                            <option value="Ù…ØªÙˆÙ‚Ù">Ù…ØªÙˆÙ‚Ù</option>
                        </select>
                    </div>
                    <button type="submit" class="admin-submit-btn"><i class="fa-solid fa-floppy-disk"></i> Ø­ÙØ¸ Ø§Ù„ØªØ¹Ø¯ÙŠÙ„Ø§Øª</button>
                    <div id="edit-manga-msg" style="margin-top: 12px; font-size: 0.9rem; text-align: center;"></div>
                </div>
            </form>
        </div>

        <div class="admin-form-panel" id="panel-alt-sources" style="display:none;">
            <form id="alt-source-form">
                <div class="admin-form-group">
                    <label>Ø§Ø®ØªØ± Ø§Ù„Ù…Ø§Ù†Ø¬Ø§/Ø§Ù„Ù…Ù†Ù‡ÙˆØ§</label>
                    <select id="alt-manga-id" required>
                        ${mangaOptions}
                    </select>
                </div>
                <button type="submit" class="admin-submit-btn"><i class="fa-solid fa-search"></i> Ø¨Ø­Ø« Ø¹Ù† Ù…ØµØ§Ø¯Ø± Ø¨Ø¯ÙŠÙ„Ø©</button>
            </form>
            <div id="alt-source-results" style="margin-top:20px;"></div>
        </div>
        
        <div class="admin-form-panel" id="panel-add-manga" style="display:none;">
            <form id="add-manga-form">
                <div class="admin-form-group">
                    <label>Ø¹Ù†ÙˆØ§Ù† Ø§Ù„Ù…Ø§Ù†Ø¬Ø§ Ø§Ù„Ø£ØµÙ„ÙŠ</label>
                    <input type="text" id="manga-title" placeholder="Ø£Ø¯Ø®Ù„ Ø§Ù„Ø¹Ù†ÙˆØ§Ù† Ø¨Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©ØŒ Ù…Ø«Ù„Ø§Ù‹: ÙƒÙŠÙ†Ø¬Ø¯ÙˆÙ…" required>
                </div>
                <div class="admin-form-group">
                    <label>Ø§Ù„Ø¹Ù†ÙˆØ§Ù† Ø§Ù„Ø¨Ø¯ÙŠÙ„ (Ø§Ø®ØªÙŠØ§Ø±ÙŠ)</label>
                    <input type="text" id="manga-alt" placeholder="Ø£Ø¯Ø®Ù„ Ø§Ù„Ø¹Ù†ÙˆØ§Ù† Ø¨Ø§Ù„Ø¥Ù†Ø¬Ù„ÙŠØ²ÙŠ Ø£Ùˆ Ø§Ù„ÙŠØ§Ø¨Ø§Ù†ÙŠ">
                </div>
                <div class="admin-form-group">
                    <label>Ø§Ù„Ù…Ø¤Ù„Ù</label>
                    <input type="text" id="manga-author" placeholder="Ø£Ø¯Ø®Ù„ Ø§Ø³Ù… Ø§Ù„Ù…Ø¤Ù„Ù Ø£Ùˆ Ø§Ù„Ø±Ø³Ø§Ù…" required>
                </div>
                <div class="admin-form-group">
                    <label>Ù†ÙˆØ¹ Ø§Ù„Ø¹Ù…Ù„</label>
                    <select id="manga-type">
                        <option value="Ù…Ø§Ù†Ø¬Ø§">Ù…Ø§Ù†Ø¬Ø§ (Manga)</option>
                        <option value="Ù…Ù†Ù‡ÙˆØ§">Ù…Ù†Ù‡ÙˆØ§ (Manhua/Webtoon)</option>
                    </select>
                </div>
                <div class="admin-form-group">
                    <label>Ø±Ø§Ø¨Ø· ØµÙˆØ±Ø© Ø§Ù„ØºÙ„Ø§Ù (Cover)</label>
                    <input type="url" id="manga-cover" placeholder="Ø±Ø§Ø¨Ø· URL Ù„Ù„ØºÙ„Ø§ÙØŒ Ø£Ùˆ Ø§ØªØ±ÙƒÙ‡ ÙØ§Ø±ØºØ§Ù‹ Ù„Ù†Ø³ØªØ®Ø¯Ù… ØµÙˆØ±Ø© Ø§ÙØªØ±Ø§Ø¶ÙŠØ© Ù…Ù…ØªØ§Ø²Ø©">
                </div>
                <div class="admin-form-group">
                    <label>Ø±Ø§Ø¨Ø· ØµÙˆØ±Ø© Ø§Ù„Ø®Ù„ÙÙŠØ© Ø§Ù„Ø¹Ø±ÙŠØ¶Ø© (Banner)</label>
                    <input type="url" id="manga-banner" placeholder="Ø±Ø§Ø¨Ø· URL Ù„Ù„Ø®Ù„ÙÙŠØ© ÙÙŠ ØµÙØ­Ø© Ø§Ù„ØªÙØ§ØµÙŠÙ„">
                </div>
                <div class="admin-form-group">
                    <label>Ø§Ù„ØªØµÙ†ÙŠÙØ§Øª (ØªÙØµÙ„ Ø¨ÙØ§ØµÙ„Ø©)</label>
                    <input type="text" id="manga-genres" placeholder="Ø£ÙƒØ´Ù†, Ù…ØºØ§Ù…Ø±Ø©, Ø®ÙŠØ§Ù„, Ø¹Ø³ÙƒØ±ÙŠ" required>
                </div>
                <div class="admin-form-group">
                    <label>Ù‚ØµØ© Ø§Ù„Ù…Ø§Ù†Ø¬Ø§ (Ø§Ù„ÙˆØµÙ)</label>
                    <textarea id="manga-synopsis" rows="5" placeholder="Ø£ÙƒØªØ¨ Ù…Ù„Ø®Øµ Ø§Ù„Ù‚ØµØ© ÙˆØ§Ù„Ø³ÙŠÙ†Ø§Ø±ÙŠÙˆ Ø§Ù„Ø®Ø§Øµ Ø¨Ø§Ù„Ù…Ø§Ù†Ø¬Ø§..." required></textarea>
                </div>
                <button type="submit" class="admin-submit-btn">Ø­ÙØ¸ ÙˆØ¥Ø¯Ø±Ø§Ø¬ Ø§Ù„Ø¹Ù…Ù„ Ø§Ù„Ø¬Ø¯ÙŠØ¯</button>
            </form>
        </div>

        <div class="admin-form-panel" id="panel-add-chapter" style="display:none;">
            <form id="add-chapter-form">
                <div class="admin-form-group">
                    <label>Ø§Ø®ØªØ± Ø§Ù„Ù…Ø§Ù†Ø¬Ø§/Ø§Ù„Ù…Ù†Ù‡ÙˆØ§</label>
                    <select id="chap-manga-id" required>
                        ${mangaOptions}
                    </select>
                </div>
                <div class="admin-form-group">
                    <label>Ø±Ù‚Ù… Ø§Ù„ÙØµÙ„</label>
                    <input type="number" step="any" id="chap-number" placeholder="Ø±Ù‚Ù… Ø§Ù„ÙØµÙ„ØŒ Ù…Ø«Ù„Ø§Ù‹: 4 Ø£Ùˆ 4.5" required>
                </div>
                <div class="admin-form-group">
                    <label>Ø¹Ù†ÙˆØ§Ù† Ø§Ù„ÙØµÙ„ (Ø§Ø®ØªÙŠØ§Ø±ÙŠ)</label>
                    <input type="text" id="chap-title" placeholder="Ø£Ø¯Ø®Ù„ Ø§Ø³Ù…Ø§Ù‹ Ù„Ù„ÙØµÙ„ØŒ Ù…Ø«Ù„Ø§Ù‹: Ø§Ù„Ø¨Ø¯Ø§ÙŠØ© Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø©">
                </div>
                <div class="admin-form-group">
                    <label>Ø±ÙˆØ§Ø¨Ø· ØµÙØ­Ø§Øª Ø§Ù„Ù…Ø§Ù†Ø¬Ø§ (Ø±Ø§Ø¨Ø· ÙˆØ§Ø­Ø¯ ÙÙŠ ÙƒÙ„ Ø³Ø·Ø±)</label>
                    <textarea id="chap-images" rows="8" placeholder="Ø¶Ø¹ Ø±Ø§Ø¨Ø· Ø§Ù„ØµÙˆØ±Ø© Ø§Ù„Ù…Ø¨Ø§Ø´Ø± Ù„ÙƒÙ„ ØµÙØ­Ø©ØŒ Ø³Ø·Ø± ØªÙ„Ùˆ Ø³Ø·Ø±.&#10;Ø¥Ø°Ø§ ØªØ±ÙƒØªÙ‡ ÙØ§Ø±ØºØ§Ù‹ØŒ Ø³Ù†Ù‚ÙˆÙ… Ø¨ØªÙˆÙ„ÙŠØ¯ ØµÙØ­Ø§Øª ØªØ¬Ø±ÙŠØ¨ÙŠØ© ÙØ§Ø¦Ù‚Ø© Ø§Ù„Ø¬Ù…Ø§Ù„ ØªÙ„Ù‚Ø§Ø¦ÙŠØ§Ù‹ Ù„ØªØ¬Ø±Ø¨Ø© Ø§Ù„Ù‚Ø±Ø§Ø¡Ø© Ø£ÙˆÙÙ„Ø§ÙŠÙ†."></textarea>
                </div>
                <button type="submit" class="admin-submit-btn">Ø­ÙØ¸ ÙˆÙ†Ø´Ø± Ø§Ù„ÙØµÙ„ Ø§Ù„Ø¬Ø¯ÙŠØ¯</button>
            </form>
        </div>

        
        <div class="admin-form-panel" id="panel-live-scraper" style="display:none; text-align: right;">
            <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:10px; padding:20px; margin-bottom:20px;">
                <h3 style="color:var(--primary-color); margin-bottom:15px;"><i class="fa-solid fa-robot"></i> Ø§Ù„Ù…Ø­Ø¯Ø« Ø§Ù„ØªÙ„Ù‚Ø§Ø¦ÙŠ (Auto-Updater)</h3>
                <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:15px;">ÙŠØªØ­ÙƒÙ… ÙÙŠ ØªØ´ØºÙŠÙ„ ÙˆØ¥ÙŠÙ‚Ø§Ù Ø§Ù„Ø±ÙˆØ¨ÙˆØª Ø§Ù„Ø°ÙŠ ÙŠØ¨Ø­Ø« Ø¹Ù† Ø§Ù„ÙØµÙˆÙ„ Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø© Ù„Ù„Ù…Ø§Ù†Ù‡ÙˆØ§Øª Ø§Ù„Ù…ÙˆØ¬ÙˆØ¯Ø© ÙÙŠ Ø§Ù„Ù…ÙˆÙ‚Ø¹ Ø¨Ø´ÙƒÙ„ ØªÙ„Ù‚Ø§Ø¦ÙŠ.</p>
                
                <div style="display:flex; align-items:center; gap:15px;">
                    <label class="switch">
                        <input type="checkbox" id="auto-updater-toggle" onchange="toggleAutoUpdater()">
                        <span class="slider round"></span>
                    </label>
                    <span id="auto-updater-status" style="font-weight:bold; color:#ff4444;">Ù…ØªÙˆÙ‚Ù</span>
                </div>
            </div>

            <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:10px; padding:20px;">
                <h3 style="color:var(--primary-color); margin-bottom:15px;"><i class="fa-solid fa-terminal"></i> Ø§Ù„Ø³Ø­Ø¨ Ø§Ù„Ù…Ø¨Ø§Ø´Ø± (Live Terminal)</h3>
                <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:15px;">Ø§Ø³Ø­Ø¨ Ø£ÙŠ Ù…Ø§Ù†Ù‡ÙˆØ§ ÙŠØ¯ÙˆÙŠØ§Ù‹ ÙˆØ±Ø§Ù‚Ø¨ ØªÙ‚Ø¯Ù… Ø§Ù„Ø¹Ù…Ù„ÙŠØ§Øª Ù‡Ù†Ø§ ÙÙŠ Ø§Ù„ÙˆÙ‚Øª Ø§Ù„ÙØ¹Ù„ÙŠ.</p>
                
                <div style="display:flex; gap:10px; margin-bottom:20px;">
                    <input type="text" id="live-scrape-url" placeholder="Ø£Ø¯Ø®Ù„ Ø±Ø§Ø¨Ø· Ø§Ù„Ù…Ø§Ù†Ù‡ÙˆØ§ Ù‡Ù†Ø§..." style="flex:1; padding:10px; background:rgba(0,0,0,0.2); border:1px solid var(--border-color); color:#fff; border-radius:5px; outline:none;">
                    <button id="live-scrape-btn" class="primary-btn" onclick="startLiveScrape()" style="padding:10px 20px; border-radius:5px;"><i class="fa-solid fa-play"></i> Ø§Ø¨Ø¯Ø£ Ø§Ù„Ø³Ø­Ø¨</button>
                </div>
                
                <div id="terminal-output" style="background:#0a0a0a; border:1px solid #333; border-radius:5px; padding:15px; height:350px; overflow-y:auto; color:#0f0; font-family:monospace; font-size:0.9rem; white-space:pre-wrap; direction:ltr; text-align:left;">
                    <span style="color:#666;">$ Terminal ready. Waiting for command...</span>
                </div>
            </div>
        </div>

        <div class="admin-form-panel" id="panel-suggestions" style="display:none; text-align: right;">
            <div id="suggestions-list-admin" style="display: flex; flex-direction: column; gap: 16px;">
                <p style="text-align:center; padding: 20px; color: var(--text-dark);"><i class="fa-solid fa-spinner fa-spin"></i> Ø¬Ø§Ø±ÙŠ ØªØ­Ù…ÙŠÙ„ Ø§Ù„Ø´ÙƒØ§ÙˆÙ‰ ÙˆØ§Ù„Ø§Ù‚ØªØ±Ø§Ø­Ø§Øª...</p>
            </div>
        </div>

        <div class="admin-form-panel" id="panel-site-settings" style="display:none; text-align: right;">
            <form id="site-settings-form">
                <div class="admin-form-group">
                    <label>Ù…Ø¹Ø±Ù ØªØ·Ø¨ÙŠÙ‚ Ø¬ÙˆØ¬Ù„ (Google Client ID)</label>
                    <input type="text" id="setting-google-id" value="${state.adminConfig?.google_client_id || GOOGLE_CLIENT_ID}" placeholder="Ù…Ø«Ø§Ù„: 123456789-abc123xyz.apps.googleusercontent.com" style="direction: ltr; text-align: left; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); padding: 10px; border-radius: var(--border-radius-sm); width: 100%; outline: none;" required>
                    <span style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px; display: block;">ÙŠÙ…ÙƒÙ†Ùƒ Ø§Ù„Ø­ØµÙˆÙ„ Ø¹Ù„ÙŠÙ‡ Ù…Ù† Google Cloud Console Ù„ØªÙØ¹ÙŠÙ„ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø¨Ø¬ÙŠÙ…ÙŠÙ„.</span>
                </div>
                <div class="admin-form-group">
                    <label>Ù…Ø¹Ø±Ù ØªØ·Ø¨ÙŠÙ‚ ÙÙŠØ³Ø¨ÙˆÙƒ (Facebook App ID)</label>
                    <input type="text" id="setting-facebook-id" value="${state.adminConfig?.facebook_app_id || FACEBOOK_APP_ID}" placeholder="Ù…Ø«Ø§Ù„: 123456789012345" style="direction: ltr; text-align: left; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); padding: 10px; border-radius: var(--border-radius-sm); width: 100%; outline: none;" required>
                    <span style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px; display: block;">ÙŠÙ…ÙƒÙ†Ùƒ Ø§Ù„Ø­ØµÙˆÙ„ Ø¹Ù„ÙŠÙ‡ Ù…Ù† Meta Developers Ù„ØªÙØ¹ÙŠÙ„ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø¨ÙÙŠØ³Ø¨ÙˆÙƒ.</span>
                </div>
                
                <h3 style="color: var(--text-main); margin-top: 30px; margin-bottom: 15px; border-right: 4px solid var(--color-primary); padding-right: 10px; font-size: 1.15rem; font-weight: 800;"><i class="fa-solid fa-envelope" style="color: var(--color-primary); margin-left: 6px;"></i> Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø®Ø§Ø¯Ù… Ø§Ù„Ø¨Ø±ÙŠØ¯ (SMTP)</h3>
                
                <div class="admin-form-group">
                    <label>Ø®Ø§Ø¯Ù… SMTP (SMTP Host)</label>
                    <input type="text" id="setting-smtp-host" value="${state.adminConfig?.smtp_host || 'smtp.gmail.com'}" placeholder="smtp.gmail.com" style="direction: ltr; text-align: left; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); padding: 10px; border-radius: var(--border-radius-sm); width: 100%; outline: none;" required>
                </div>
                <div class="admin-form-group">
                    <label>Ù…Ù†ÙØ° SMTP (SMTP Port)</label>
                    <input type="text" id="setting-smtp-port" value="${state.adminConfig?.smtp_port || '587'}" placeholder="587" style="direction: ltr; text-align: left; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); padding: 10px; border-radius: var(--border-radius-sm); width: 100%; outline: none;" required>
                </div>
                <div class="admin-form-group">
                    <label>Ø¨Ø±ÙŠØ¯ Ø®Ø§Ø¯Ù… Ø§Ù„Ø¥Ø±Ø³Ø§Ù„ (SMTP Username)</label>
                    <input type="text" id="setting-smtp-user" value="${state.adminConfig?.smtp_user || ''}" placeholder="example@gmail.com" style="direction: ltr; text-align: left; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); padding: 10px; border-radius: var(--border-radius-sm); width: 100%; outline: none;">
                    <span style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px; display: block;">Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ Ø§Ù„Ø°ÙŠ Ø³ÙŠÙ‚ÙˆÙ… Ø§Ù„Ø®Ø§Ø¯Ù… Ø¨Ø§Ø³ØªØ®Ø¯Ø§Ù…Ù‡ Ù„Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ø±Ø³Ø§Ø¦Ù„ (Ù…Ø«Ù„ Ø­Ø³Ø§Ø¨ Gmail).</span>
                </div>
                <div class="admin-form-group">
                    <label>ÙƒÙ„Ù…Ø© Ù…Ø±ÙˆØ± Ø§Ù„ØªØ·Ø¨ÙŠÙ‚ (SMTP Password / Gmail App Password)</label>
                    <input type="password" id="setting-smtp-pass" value="${state.adminConfig?.smtp_pass || ''}" placeholder="ÙƒÙ„Ù…Ø© Ù…Ø±ÙˆØ± Ø§Ù„ØªØ·Ø¨ÙŠÙ‚ Ø§Ù„Ù…ÙƒÙˆÙ†Ø© Ù…Ù† 16 Ø­Ø±ÙØ§Ù‹" style="direction: ltr; text-align: left; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); padding: 10px; border-radius: var(--border-radius-sm); width: 100%; outline: none;">
                    <span style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px; display: block;">Ø¥Ø°Ø§ ÙƒÙ†Øª ØªØ³ØªØ®Ø¯Ù… GmailØŒ ÙŠØ±Ø¬Ù‰ Ø¥Ù†Ø´Ø§Ø¡ ÙƒÙ„Ù…Ø© Ù…Ø±ÙˆØ± ØªØ·Ø¨ÙŠÙ‚ (App Password) Ù…Ù† Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø­Ø³Ø§Ø¨ Google Ø§Ù„Ø®Ø§Øµ Ø¨Ùƒ.</span>
                </div>
                <div class="admin-form-group">
                    <label>Ø¹Ù†ÙˆØ§Ù† ÙˆØ§Ø³Ù… Ø§Ù„Ù…Ø±Ø³Ù„ (Sender Email & Name)</label>
                    <input type="text" id="setting-smtp-sender" value="${state.adminConfig?.smtp_sender || 'KAIRO/Ù…Ù†Ù‡ÙˆØ§ <noreply@kairo-manhua.com>'}" placeholder="KAIRO/Ù…Ù†Ù‡ÙˆØ§ &lt;noreply@kairo-manhua.com&gt;" style="background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); padding: 10px; border-radius: var(--border-radius-sm); width: 100%; outline: none;" required>
                </div>
                
                <button type="submit" class="admin-submit-btn">Ø­ÙØ¸ Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª ÙˆØªØ·Ø¨ÙŠÙ‚Ù‡Ø§</button>
            </form>
        </div>
    </div>
    `;
}

// ØµÙØ­Ø© Ø§Ù„Ù…ÙØ¶Ù„Ø© ÙˆØ§Ù„Ù…ØªØ§Ø¨Ø¹Ø© (Bookmarks)
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
            <h3>Ø§Ù„Ù…ÙØ¶Ù„Ø© ÙØ§Ø±ØºØ©</h3>
            <p>ØªØµÙØ­ Ø§Ù„Ø£Ø¹Ù…Ø§Ù„ ÙˆÙ‚Ù… Ø¨Ø¥Ø¶Ø§ÙØªÙ‡Ø§ Ù„Ù…ÙØ¶Ù„ØªÙƒ Ù„ØªØ¸Ù‡Ø± Ù‡Ù†Ø§ ÙˆØªØªØ§Ø¨Ø¹Ù‡Ø§ Ø£ÙˆÙ„Ø§Ù‹ Ø¨Ø£ÙˆÙ„.</p>
        </div>
        `;
    } else {
        listHtml = `<div class="manga-grid">`;
        mangasFiltered.forEach(manga => {
            const status = state.bookmarks[manga.id];
            const statusText = status === 'reading' ? 'Ø£Ù‚Ø±Ø£Ù‡ Ø­Ø§Ù„ÙŠØ§Ù‹' :
                               status === 'plan' ? 'Ø£Ø±ØºØ¨ Ø¨Ù‚Ø±Ø§Ø¡ØªÙ‡' : 'Ù…ÙƒØªÙ…Ù„';
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
                        <span>ØªÙ‚Ø¯Ù… Ø§Ù„Ù‚Ø±Ø§Ø¡Ø©</span>
                        <span class="chap-num">ÙØµÙ„ ${state.progress[manga.id] ? state.progress[manga.id].chapterId : 'Ù„Ù… ØªØ¨Ø¯Ø£'}</span>
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
            <h2 class="section-title">Ù…ÙƒØªØ¨ØªÙƒ ÙˆÙ…ÙØ¶Ù„ØªÙƒ <span>Ø§Ù„Ø®Ø§ØµØ©</span></h2>
        </div>
        <div class="bookmarks-tabs">
            <button class="bookmark-tab ${currentTab === 'all' ? 'active' : ''}" data-tab="all"><i class="fa-solid fa-layer-group"></i> Ø§Ù„ÙƒÙ„</button>
            <button class="bookmark-tab ${currentTab === 'reading' ? 'active' : ''}" data-tab="reading"><i class="fa-solid fa-book-open-reader"></i> Ø£Ù‚Ø±Ø£Ù‡ Ø­Ø§Ù„ÙŠØ§Ù‹</button>
            <button class="bookmark-tab ${currentTab === 'plan' ? 'active' : ''}" data-tab="plan"><i class="fa-solid fa-clock"></i> Ø£Ø±ØºØ¨ ÙÙŠ Ù‚Ø±Ø§Ø¡ØªÙ‡</button>
            <button class="bookmark-tab ${currentTab === 'completed' ? 'active' : ''}" data-tab="completed"><i class="fa-solid fa-circle-check"></i> Ù…ÙƒØªÙ…Ù„</button>
        </div>
        ${listHtml}
    </div>
    `;
}

// ØµÙØ­Ø© Ø§Ù„ØªØ­Ù…ÙŠÙ„Ø§Øª ÙˆØ§Ù„Ù‚Ø±Ø§Ø¡Ø© Ø£ÙˆÙÙ„Ø§ÙŠÙ† (Downloads)
async function DownloadsViewComponent() {
    const localDownloads = await getAllDownloadsOffline();
    
    let listHtml = '';
    if (localDownloads.length === 0) {
        listHtml = `
        <div class="empty-state">
            <i class="fa-solid fa-circle-down" style="color:var(--border-color)"></i>
            <h3>Ù„Ø§ ØªÙˆØ¬Ø¯ ÙØµÙˆÙ„ Ù…Ø­Ù…Ù„Ø©</h3>
            <p>Ù‚Ù… Ø¨Ø§Ù„Ø¯Ø®ÙˆÙ„ Ù„ØµÙØ­Ø© Ø£ÙŠ Ù…Ø§Ù†Ø¬Ø§ ÙˆØ§Ø¶ØºØ· Ø¹Ù„Ù‰ Ø²Ø± Ø§Ù„ØªØ­Ù…ÙŠÙ„ Ø¨Ø¬ÙˆØ§Ø± Ø§Ù„ÙØµÙ„ Ù„ÙŠØªÙ… Ø­ÙØ¸Ù‡ Ø¹Ù„Ù‰ Ø¬Ù‡Ø§Ø²Ùƒ Ù„Ù„Ø§Ø³ØªØ®Ø¯Ø§Ù… Ø¯ÙˆÙ† Ø¥Ù†ØªØ±Ù†Øª.</p>
        </div>
        `;
    } else {
        listHtml = `
        <div class="chapters-section">
            <div class="chapters-header">
                <h3>Ø§Ù„ÙØµÙˆÙ„ Ø§Ù„Ù…Ø­Ù…Ù„Ø© Ù„Ù„Ø§Ø³ØªØ®Ø¯Ø§Ù… Ø£ÙˆÙÙ„Ø§ÙŠÙ†</h3>
                <span>Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„ÙØµÙˆÙ„: ${localDownloads.length}</span>
            </div>
            <div class="chapters-list">
        `;
        
        localDownloads.forEach(d => {
            const manga = state.mangas.find(m => m.id === d.mangaId);
            const mangaTitle = manga ? manga.title : 'Ù…Ø§Ù†Ø¬Ø§ ØºÙŠØ± Ù…Ø¹Ø±ÙˆÙØ©';
            listHtml += `
            <div class="chapter-item" data-manga-id="${d.mangaId}" data-chap-id="${d.chapterId}">
                <div class="chapter-info">
                    <span class="chapter-name">${mangaTitle} - Ø§Ù„ÙØµÙ„ ${d.chapterId}</span>
                    <span class="chapter-date" style="color:var(--color-secondary);"><i class="fa-solid fa-wifi-slash"></i> Ù…ØªØ§Ø­ Ø¯ÙˆÙ† Ø§ØªØµØ§Ù„</span>
                </div>
                <div class="chapter-actions-inline">
                    <button class="download-btn downloaded delete-download-btn" data-manga-id="${d.mangaId}" data-chap-id="${d.chapterId}" title="Ø­Ø°Ù Ø§Ù„Ù…Ù„ÙØ§Øª Ø§Ù„Ù…Ø­Ù…Ù„Ø©">
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
            <h2 class="section-title">Ù…Ø±ÙƒØ² Ø§Ù„ØªØ­Ù…ÙŠÙ„Ø§Øª <span>Ø£ÙˆÙÙ„Ø§ÙŠÙ†</span></h2>
        </div>
        ${listHtml}
    </div>
    `;
}

function ResetPasswordViewComponent() {
    return `
    <div class="reset-password-wrapper" style="max-width: 450px; margin: 60px auto; padding: 30px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--border-radius-md); box-shadow: var(--shadow-lg); text-align: right; backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);">
        <h2 style="font-size: 1.6rem; font-weight: 800; color: var(--text-main); margin-bottom: 20px; border-right: 4px solid var(--color-secondary); padding-right: 12px;"><i class="fa-solid fa-lock" style="color:var(--color-secondary); margin-left: 6px;"></i> Ø§Ø³ØªØ¹Ø§Ø¯Ø© ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±</h2>
        <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 24px;">Ø§Ù„Ø±Ø¬Ø§Ø¡ Ø¥Ø¯Ø®Ø§Ù„ ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø© Ù„Ø­Ø³Ø§Ø¨Ùƒ.</p>
        
        <form id="reset-password-form" style="display: flex; flex-direction: column; gap: 16px;">
            <div class="form-group" style="text-align: right;">
                <label style="color:var(--text-main); font-weight:700; font-size:0.9rem;">ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø©</label>
                <input type="password" id="reset-new-pass" required placeholder="********" style="background: var(--bg-surface); border: 1px solid var(--border-color); color: var(--text-main); padding: 12px; border-radius: var(--border-radius-sm); width: 100%; outline: none; margin-top: 6px;">
            </div>
            <div class="form-group" style="text-align: right;">
                <label style="color:var(--text-main); font-weight:700; font-size:0.9rem;">ØªØ£ÙƒÙŠØ¯ ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø©</label>
                <input type="password" id="reset-confirm-pass" required placeholder="********" style="background: var(--bg-surface); border: 1px solid var(--border-color); color: var(--text-main); padding: 12px; border-radius: var(--border-radius-sm); width: 100%; outline: none; margin-top: 6px;">
            </div>
            <div id="reset-error-msg" class="auth-error-msg" style="display:none; margin-bottom: 8px; color: var(--color-accent); font-weight: 700;"></div>
            <div id="reset-success-msg" class="auth-success-msg" style="display:none; margin-bottom: 8px; color: #00ff7f; font-weight: 700;"></div>
            <button type="submit" class="auth-submit-btn neon-pulse-hover" style="background: linear-gradient(135deg, var(--color-secondary), var(--color-primary)); color: #07080c; border: none; padding: 12px; border-radius: 30px; font-weight: 800; cursor: pointer; width: 100%;">ØªØ­Ø¯ÙŠØ« ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±</button>
        </form>
    </div>
    `;
}

// ==========================================
// 4.4.7. Ø§Ù„Ù…ÙƒØ§ÙØ¢Øª Ø§Ù„ÙŠÙˆÙ…ÙŠØ©
// ==========================================

function DailyRewardModalComponent() {
    if (!state.showDailyReward) return '';
    const data = state.dailyRewardData;
    if (!data) {
        return `
        <div class="reward-modal-overlay" id="reward-modal-overlay">
            <div class="reward-modal-card">
                <button class="reward-close-btn" id="close-reward-modal"><i class="fa-solid fa-xmark"></i></button>
                <div class="reward-header">
                    <div class="reward-gift-icon"><i class="fa-solid fa-gift"></i></div>
                    <h2>Ø§Ù„Ù…ÙƒØ§ÙØ¢Øª Ø§Ù„ÙŠÙˆÙ…ÙŠØ©</h2>
                    <p class="reward-streak-text">ðŸ”¥ Ø§Ù„Ù…ÙƒØ§ÙØ¢Øª Ø§Ù„ÙŠÙˆÙ…ÙŠØ© ØºÙŠØ± Ù…ØªÙˆÙØ±Ø© Ø­Ø§Ù„ÙŠØ§Ù‹</p>
                </div>
                <p style="text-align:center;padding:20px;color:var(--text-muted);">Ù‡Ø°Ù‡ Ø§Ù„Ù…ÙŠØ²Ø© Ù‚ÙŠØ¯ Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯</p>
            </div>
        </div>`;
    }
    const rewards = data.rewards || [];
    const currentDay = data.current_day || 1;
    const streak = data.current_streak || 0;
    const canClaim = data.can_claim;

    return `
    <div class="reward-modal-overlay" id="reward-modal-overlay">
        <div class="reward-modal-card">
            <button class="reward-close-btn" id="close-reward-modal"><i class="fa-solid fa-xmark"></i></button>
            <div class="reward-header">
                <div class="reward-gift-icon"><i class="fa-solid fa-gift"></i></div>
                <h2>Ø§Ù„Ù…ÙƒØ§ÙØ¢Øª Ø§Ù„ÙŠÙˆÙ…ÙŠØ©</h2>
                <p class="reward-streak-text">ðŸ”¥ Ø§Ù„ÙŠÙˆÙ… ${currentDay} Ù…Ù† 7 â€” ${streak} ÙŠÙˆÙ… Ù…ØªØªØ§Ù„Ù</p>
            </div>
            <div class="reward-cards-grid">
                ${rewards.map(r => {
                    const isPast = r.day < currentDay;
                    const isCurrent = r.day === currentDay;
                    const isFuture = r.day > currentDay;
                    const isWeekBonus = r.day === 7;
                    let cardClass = 'reward-card';
                    if (isPast) cardClass += ' claimed';
                    if (isCurrent) cardClass += ' current';
                    if (isFuture) cardClass += ' locked';
                    if (isWeekBonus) cardClass += ' week-bonus';
                    return `
                    <div class="${cardClass}">
                        ${isWeekBonus ? '<span class="week-badge">Ù…ÙƒØ§ÙØ£Ø© Ø§Ù„Ø£Ø³Ø¨ÙˆØ¹</span>' : ''}
                        <div class="reward-card-day">Ø§Ù„ÙŠÙˆÙ… ${r.day}</div>
                        <div class="reward-card-points"><i class="fa-solid fa-star"></i> ${r.points}</div>
                        <div class="reward-card-status">
                            ${isPast ? '<i class="fa-solid fa-check"></i>' : isCurrent && canClaim ? '<i class="fa-solid fa-gift" style="color:var(--color-secondary);"></i>' : isCurrent ? '<i class="fa-solid fa-star" style="color:var(--color-primary);"></i>' : '<i class="fa-solid fa-lock"></i>'}
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>
            ${canClaim ? '<button class="claim-reward-btn" id="claim-reward-btn"><i class="fa-solid fa-gift"></i> Ø¬Ù…Ø¹ Ø§Ù„Ù…ÙƒØ§ÙØ£Ø©</button>' : '<p class="reward-claimed-msg">âœ… ØªÙ… Ø¬Ù…Ø¹ Ù…ÙƒØ§ÙØ£Ø© Ø§Ù„ÙŠÙˆÙ…ØŒ Ø¹Ø¯ ØºØ¯Ø§Ù‹ Ù„ÙŠÙˆÙ… Ø¬Ø¯ÙŠØ¯!</p>'}
        </div>
    </div>
    `;
}

// ==========================================
// 4.4.8. Confetti Effect
// ==========================================

function triggerConfetti() {
    const colors = ['#ff007f', '#00f0ff', '#ffd700', '#8a2be2', '#ff6b35', '#00ff7f', '#ff4500'];
    const container = document.body;
    for (let i = 0; i < 80; i++) {
        const el = document.createElement('div');
        el.className = 'confetti-piece';
        el.style.cssText = `
            position: fixed;
            z-index: 99999;
            width: ${6 + Math.random() * 8}px;
            height: ${6 + Math.random() * 8}px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            left: ${Math.random() * 100}vw;
            top: -10px;
            border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
            pointer-events: none;
            opacity: ${0.7 + Math.random() * 0.3};
            transform: rotate(${Math.random() * 360}deg);
            animation: confettiFall ${2 + Math.random() * 2}s ease-out forwards;
            animation-delay: ${Math.random() * 0.5}s;
        `;
        container.appendChild(el);
        setTimeout(() => el.remove(), 4000);
    }
}

// ØªØ¬Ù…ÙŠØ¹ ÙˆØªØµÙŠÙŠØ± Ø§Ù„ØªØ·Ø¨ÙŠÙ‚ Ø¨Ø§Ù„ÙƒØ§Ù…Ù„
async function renderReaderContent() {
    const root = document.getElementById('app-root');
    if (!root) { renderApp(); return; }
    const readerEl = root.querySelector('.reader-wrapper, main .reader-wrapper');
    const readerHtml = await ReaderViewComponent();
    if (readerEl) {
        readerEl.outerHTML = readerHtml;
    } else {
        const mainEl = root.querySelector('main') || root;
        mainEl.innerHTML = readerHtml;
    }
    attachEventListeners();
    state.dailyRewardLoading = false;
}

function getFilteredMangas() {
    const s = state;
    let result = s.mangas;
    if (s.searchQuery) {
        result = result.filter(m => 
            (m.title || '').toLowerCase().includes(s.searchQuery.toLowerCase()) ||
            (m.alternative || '').toLowerCase().includes(s.searchQuery.toLowerCase())
        );
    }
    if (s.activeGenre !== 'Ø§Ù„ÙƒÙ„') {
        result = result.filter(m => m.genres.includes(s.activeGenre));
    }
    if (s.filterStatus !== 'Ø§Ù„ÙƒÙ„') {
        result = result.filter(m => m.status === s.filterStatus);
    }
    if (s.filterType !== 'Ø§Ù„ÙƒÙ„') {
        result = result.filter(m => (m.type || '') === s.filterType);
    }
    if (s.filterYearMin) {
        const yearMin = parseFloat(s.filterYearMin);
        if (!isNaN(yearMin)) result = result.filter(m => (m.year || 0) >= yearMin);
    }
    if (s.filterYearMax) {
        const yearMax = parseFloat(s.filterYearMax);
        if (!isNaN(yearMax)) result = result.filter(m => (m.year || 9999) <= yearMax);
    }
    if (s.filterRatingMin) {
        const ratingMin = parseFloat(s.filterRatingMin);
        if (!isNaN(ratingMin)) result = result.filter(m => (m.rating || 0) >= ratingMin);
    }
    if (s.filterRatingMax) {
        const ratingMax = parseFloat(s.filterRatingMax);
        if (!isNaN(ratingMax)) result = result.filter(m => (m.rating || 5) <= ratingMax);
    }
    if (s.filterChaptersMin) {
        const chMin = parseInt(s.filterChaptersMin);
        if (!isNaN(chMin)) result = result.filter(m => (m.chapters ? m.chapters.length : 0) >= chMin);
    }
    if (s.filterChaptersMax) {
        const chMax = parseInt(s.filterChaptersMax);
        if (!isNaN(chMax)) result = result.filter(m => (m.chapters ? m.chapters.length : 0) <= chMax);
    }
    if (s.filterSort === 'Ø§Ù„Ø£Ù‚Ø¯Ù…') {
        result = [...result].reverse();
    } else if (s.filterSort === 'Ø§Ù„ØªÙ‚ÙŠÙŠÙ…') {
        result = [...result].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (s.filterSort === 'Ø¹Ø¯Ø¯ Ø§Ù„ÙØµÙˆÙ„') {
        result = [...result].sort((a, b) => (b.chapters ? b.chapters.length : 0) - (a.chapters ? a.chapters.length : 0));
    }
    if (s.filterTime === 'today') {
        result = result.filter(m => m.lastUpdated && Date.now() - new Date(m.lastUpdated).getTime() < 86400000);
    } else if (s.filterTime === 'week') {
        result = result.filter(m => m.lastUpdated && Date.now() - new Date(m.lastUpdated).getTime() < 604800000);
    } else if (s.filterTime === 'month') {
        result = result.filter(m => m.lastUpdated && Date.now() - new Date(m.lastUpdated).getTime() < 2592000000);
    } else if (s.filterTime === 'year') {
        result = result.filter(m => m.lastUpdated && Date.now() - new Date(m.lastUpdated).getTime() < 31536000000);
    }
    return result;
}

function updateGridOnly() {
    if (state.activeTab === 'users') {
        const usersContainer = document.getElementById('users-grid-container');
        if (!usersContainer) { renderApp(); return; }
        
        let filteredUsers = state.browseUsers || [];
        if (state.searchQuery) {
            const q = state.searchQuery.toLowerCase();
            filteredUsers = filteredUsers.filter(u => (u.username || '').toLowerCase().includes(q));
        }

        const totalUsers = filteredUsers.length;
        const usersCards = filteredUsers.map(u => `
            <div class="user-search-item" style="background:var(--bg-card); padding:15px; border-radius:12px; border:1px solid var(--border-color); display:flex; align-items:center; gap:15px; cursor:pointer;" onclick="navigate('profile', '${u.username}')">
                <div class="user-search-avatar" style="width:50px; height:50px; font-size:1.2rem; background:var(--primary-color); display:flex; justify-content:center; align-items:center; border-radius:50%; color:#fff;">${u.username ? u.username[0].toUpperCase() : '?'}</div>
                <div>
                    <h3 style="margin:0; color:#fff; font-size:1.1rem;">${u.username}</h3>
                    <span style="color:var(--text-muted); font-size:0.85rem;"><i class="fa-solid fa-trophy" style="color:gold;"></i> Ø§Ù„Ø±ØªØ¨Ø©: ${u.rank || 'Ù…Ø¨ØªØ¯Ø¦'}</span>
                </div>
                <div style="margin-right:auto; color:var(--primary-color); font-weight:bold;">
                    ${u.points || 0} XP
                </div>
            </div>
        `).join('');

        usersContainer.innerHTML = `
            <div class="mangatime-toolbar" style="margin-bottom:20px;">
                <div class="mangatime-toolbar-left">${totalUsers} Ù…Ø³ØªØ®Ø¯Ù…</div>
            </div>
            ${filteredUsers.length === 0 ? '<div class="empty-state"><h3>Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ù…Ø³ØªØ®Ø¯Ù…ÙŠÙ†</h3></div>' : `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:20px;">${usersCards}</div>`}
        `;
        return;
    }

    const gridContainer = document.getElementById('manga-grid-container');
    if (!gridContainer) { renderApp(); return; }

    const s = state;
    let filtered = [...s.mangas];

    if (s.activeGenre && s.activeGenre !== 'Ø§Ù„ÙƒÙ„') {
        filtered = filtered.filter(m => m.genres && m.genres.includes(s.activeGenre));
    }
    if (s.filterStatus && s.filterStatus !== 'Ø§Ù„ÙƒÙ„') {
        filtered = filtered.filter(m => m.status === s.filterStatus || (s.filterStatus === 'Ù…Ø³ØªÙ…Ø±Ø©' && m.status === 'Ongoing'));
    }
    if (s.filterType && s.filterType !== 'Ø§Ù„ÙƒÙ„') {
        filtered = filtered.filter(m => m.type === s.filterType);
    }
    if (s.filterYearMin) {
        filtered = filtered.filter(m => (m.year || 0) >= parseInt(s.filterYearMin));
    }
    if (s.filterYearMax) {
        filtered = filtered.filter(m => (m.year || 9999) <= parseInt(s.filterYearMax));
    }
    if (s.filterRatingMin) {
        filtered = filtered.filter(m => (m.rating || 0) >= parseFloat(s.filterRatingMin));
    }
    if (s.filterRatingMax) {
        filtered = filtered.filter(m => (m.rating || 5) <= parseFloat(s.filterRatingMax));
    }
    if (s.filterChaptersMin) {
        filtered = filtered.filter(m => (m.chapters ? m.chapters.length : 0) >= parseInt(s.filterChaptersMin));
    }
    if (s.filterChaptersMax) {
        filtered = filtered.filter(m => (m.chapters ? m.chapters.length : 0) <= parseInt(s.filterChaptersMax));
    }

    if (s.searchQuery) {
        const q = s.searchQuery.toLowerCase();
        filtered = filtered.filter(m => {
            const inTitle = (m.title && m.title.toLowerCase().includes(q)) || (m.alternative && m.alternative.toLowerCase().includes(q));
            const inAuthor = m.author && m.author.toLowerCase().includes(q);
            const inTags = m.genres && m.genres.some(g => g.toLowerCase().includes(q));
            const inType = m.type && m.type.toLowerCase().includes(q);
            const inDesc = m.description && m.description.toLowerCase().includes(q);
            
            if (s.searchType === 'title') return inTitle;
            if (s.searchType === 'author') return inAuthor;
            if (s.searchType === 'tags') return inTags || inType;
            if (s.searchType === 'desc') return inDesc;
            
            return inTitle || inAuthor || inTags || inType || inDesc;
        });
    }

    if (s.filterSort === 'Ø§Ù„Ø£Ø­Ø¯Ø«' || !s.filterSort) {
        filtered.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (s.filterSort === 'Ø£Ø­Ø¯Ø« Ø§Ù„ØªØ­Ø¯ÙŠØ«Ø§Øª') {
        filtered.sort((a,b) => new Date(b.updated_at) - new Date(a.updated_at));
    } else if (s.filterSort === 'Ø£-ÙŠ') {
        filtered.sort((a,b) => (a.title || '').localeCompare(b.title || ''));
    } else if (s.filterSort === 'Ø§Ù„Ø£Ø¹Ù„Ù‰ ØªÙ‚ÙŠÙŠÙ…Ø§Ù‹') {
        filtered.sort((a,b) => (b.rating||0) - (a.rating||0));
    } else if (s.filterSort === 'Ø§Ù„Ø£ÙƒØ«Ø± ÙØµÙˆÙ„Ø§Ù‹') {
        filtered.sort((a,b) => (b.chapters ? b.chapters.length : 0) - (a.chapters ? a.chapters.length : 0));
    } else if (s.filterSort === 'Ø§Ù„Ø£Ù‚Ù„ ÙØµÙˆÙ„Ø§Ù‹') {
        filtered.sort((a,b) => (a.chapters ? a.chapters.length : 0) - (b.chapters ? b.chapters.length : 0));
    } else if (s.filterSort === 'Ø§Ù„Ø£ÙƒØ«Ø± Ø´Ø¹Ø¨ÙŠØ©') {
        filtered.sort((a,b) => (b.views||0) - (a.views||0));
    }

    gridContainer.innerHTML = MangaGridComponent("ØªØµÙØ­ Ø§Ù„Ù…Ø§Ù†Ù‡ÙˆØ§", filtered);
}

async function renderApp() {
    try {
    const root = document.getElementById('app');
    
    const loader = document.getElementById('initial-loader');
    if (loader) loader.remove();

    // 1. ØªØµÙÙŠØ© Ø§Ù„Ù…Ø§Ù†Ø¬Ø§
    let filteredMangas = getFilteredMangas();
    const s = state;
    if (s.searchQuery) {
        filteredMangas = filteredMangas.filter(m => 
            (m.title || '').toLowerCase().includes(s.searchQuery.toLowerCase()) ||
            (m.alternative || '').toLowerCase().includes(s.searchQuery.toLowerCase())
        );
    }
    if (s.activeGenre !== 'Ø§Ù„ÙƒÙ„' && s.currentView === 'home') {
        filteredMangas = filteredMangas.filter(m => m.genres && m.genres.includes(s.activeGenre));
    }
    if (s.currentView === 'home') {
        if (s.filterStatus !== 'Ø§Ù„ÙƒÙ„') {
            filteredMangas = filteredMangas.filter(m => m.status === s.filterStatus);
        }
        if (s.filterType !== 'Ø§Ù„ÙƒÙ„') {
            filteredMangas = filteredMangas.filter(m => (m.type || '') === s.filterType);
        }
        if (s.filterYearMin) {
            const yearMin = parseFloat(s.filterYearMin);
            if (!isNaN(yearMin)) filteredMangas = filteredMangas.filter(m => (m.year || 0) >= yearMin);
        }
        if (s.filterYearMax) {
            const yearMax = parseFloat(s.filterYearMax);
            if (!isNaN(yearMax)) filteredMangas = filteredMangas.filter(m => (m.year || 9999) <= yearMax);
        }
        if (s.filterRatingMin) {
            const ratingMin = parseFloat(s.filterRatingMin);
            if (!isNaN(ratingMin)) filteredMangas = filteredMangas.filter(m => (m.rating || 0) >= ratingMin);
        }
        if (s.filterRatingMax) {
            const ratingMax = parseFloat(s.filterRatingMax);
            if (!isNaN(ratingMax)) filteredMangas = filteredMangas.filter(m => (m.rating || 5) <= ratingMax);
        }
        if (s.filterChaptersMin) {
            const chMin = parseInt(s.filterChaptersMin);
            if (!isNaN(chMin)) filteredMangas = filteredMangas.filter(m => (m.chapters ? m.chapters.length : 0) >= chMin);
        }
        if (s.filterChaptersMax) {
            const chMax = parseInt(s.filterChaptersMax);
            if (!isNaN(chMax)) filteredMangas = filteredMangas.filter(m => (m.chapters ? m.chapters.length : 0) <= chMax);
        }
        if (s.filterSort === 'Ø§Ù„Ø£Ù‚Ø¯Ù…') {
            filteredMangas = [...filteredMangas].reverse();
        } else if (s.filterSort === 'Ø§Ù„ØªÙ‚ÙŠÙŠÙ…') {
            filteredMangas = [...filteredMangas].sort((a, b) => (b.rating || 0) - (a.rating || 0));
        } else if (s.filterSort === 'Ø¹Ø¯Ø¯ Ø§Ù„ÙØµÙˆÙ„') {
            filteredMangas = [...filteredMangas].sort((a, b) => (b.chapters ? b.chapters.length : 0) - (a.chapters ? a.chapters.length : 0));
        }
    }

    // 2. ØªØ¬Ù…ÙŠØ¹ Ù…Ø­ØªÙˆÙ‰ Ø§Ù„ÙˆØ§Ø¬Ù‡Ø© Ø§Ù„Ù…Ø¹Ù†ÙŠØ©
    let viewHtml = '';
    
        if (state.currentView === 'home') {
            const s = state;
            const searchTypes = [
                {id:'all', label:'Ø§Ù„ÙƒÙ„'}, {id:'username', label:'Ø§Ø³Ù… Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…'}, {id:'title', label:'Ø§Ù„Ø¹Ù†ÙˆØ§Ù†'}, {id:'author', label:'Ø§Ù„Ù…Ø¤Ù„Ù'},
                {id:'tags', label:'Ø§Ù„Ø±Ø³ÙˆÙ…'}, {id:'desc', label:'Ø§Ù„ÙˆØµÙ'}
            ];
            const searchTypeHtml = searchTypes.map(t => 
                `<span class="mangatime-s-filter ${s.searchType===t.id ? 'active':''}" onclick="toggleFilter('search_type','${t.id}')">${t.label}</span>`
            ).join('');

            const allGenres = ['Ø§Ù„ÙƒÙ„'];
            if (s.mangas) s.mangas.forEach(m => { if (m.genres) m.genres.forEach(g => { if(!allGenres.includes(g)) allGenres.push(g); }); });

            const contentHtml = await window.generateHomeGridHtml();

            viewHtml = `
            <div class="mangatime-browse-container">
                <div class="mangatime-hero-section">
                    <h1 class="mangatime-hero-title">ØªØµÙØ­ Ø¹Ø§Ù„Ù… Ø§Ù„Ù…Ø§Ù†Ø¬Ø§</h1>
                    <p class="mangatime-hero-subtitle">Ø§ÙƒØªØ´Ù Ø¹Ù…Ù„Ùƒ Ø§Ù„ØªØ§Ù„ÙŠ Ø¨ÙŠÙ† Ø¢Ù„Ø§Ù Ø§Ù„Ø³Ù„Ø§Ø³Ù„</p>
                </div>
                <div class="mangatime-search-wrapper">
                    <input type="text" class="mangatime-search-input" placeholder="Ø§Ø¨Ø­Ø« Ø¹Ù† Ø£ÙŠ Ø´ÙŠØ¡..." value="${s.searchQuery || ''}" oninput="handleSearchInput(event)">
                    <i class="fa-solid fa-microphone mangatime-mic-icon"></i>
                    <i class="fa-solid fa-magnifying-glass mangatime-search-icon"></i>
                </div>
                <div class="mangatime-search-filters">
                    <span style="color:var(--text-muted);font-size:0.85rem;margin-left:10px;">Ø§Ù„Ø¨Ø­Ø« Ø¨Ù€:</span>
                    ${searchTypeHtml}
                </div>
                <div class="mangatime-dropdowns-row" style="display:${s.searchType==='username'?'none':'flex'}">
                    <div class="glass-select-wrapper">
                        <i class="fa-solid fa-tags glass-icon"></i>
                        <select class="glass-select" onchange="toggleFilter('genre', this.value)">
                            ${allGenres.map(g => `<option value="${g}" ${s.activeGenre===g?'selected':''}>${g}</option>`).join('')}
                        </select>
                    </div>
                    <div class="glass-select-wrapper">
                        <i class="fa-solid fa-book-open glass-icon"></i>
                        <select class="glass-select" onchange="toggleFilter('type', this.value)">
                            <option value="Ø§Ù„ÙƒÙ„" ${s.filterType==='Ø§Ù„ÙƒÙ„'?'selected':''}>ÙƒÙ„ Ø§Ù„Ø£Ù†ÙˆØ§Ø¹</option>
                            <option value="Ù…Ø§Ù†Ù‡ÙˆØ§ ÙƒÙˆØ±ÙŠØ©" ${s.filterType==='Ù…Ø§Ù†Ù‡ÙˆØ§ ÙƒÙˆØ±ÙŠØ©'?'selected':''}>Ù…Ø§Ù†Ù‡ÙˆØ§ ÙƒÙˆØ±ÙŠØ©</option>
                            <option value="Ù…Ø§Ù†Ø¬Ø§ ÙŠØ§Ø¨Ø§Ù†ÙŠØ©" ${s.filterType==='Ù…Ø§Ù†Ø¬Ø§ ÙŠØ§Ø¨Ø§Ù†ÙŠØ©'?'selected':''}>Ù…Ø§Ù†Ø¬Ø§ ÙŠØ§Ø¨Ø§Ù†ÙŠØ©</option>
                            <option value="Ù…Ø§Ù†Ù‡Ø§ ØµÙŠÙ†ÙŠØ©" ${s.filterType==='Ù…Ø§Ù†Ù‡Ø§ ØµÙŠÙ†ÙŠØ©'?'selected':''}>Ù…Ø§Ù†Ù‡Ø§ ØµÙŠÙ†ÙŠØ©</option>
                            <option value="ÙƒÙˆÙ…ÙŠÙƒ" ${s.filterType==='ÙƒÙˆÙ…ÙŠÙƒ'?'selected':''}>ÙƒÙˆÙ…ÙŠÙƒ</option>
                        </select>
                    </div>
                    <div class="glass-select-wrapper">
                        <i class="fa-solid fa-circle-check glass-icon"></i>
                        <select class="glass-select" onchange="toggleFilter('status', this.value)">
                            <option value="Ø§Ù„ÙƒÙ„" ${s.filterStatus==='Ø§Ù„ÙƒÙ„'?'selected':''}>ÙƒÙ„ Ø§Ù„Ø­Ø§Ù„Ø§Øª</option>
                            <option value="Ù…Ø³ØªÙ…Ø±Ø©" ${s.filterStatus==='Ù…Ø³ØªÙ…Ø±Ø©'?'selected':''}>Ù…Ø³ØªÙ…Ø±Ø©</option>
                            <option value="Ù…ÙƒØªÙ…Ù„Ø©" ${s.filterStatus==='Ù…ÙƒØªÙ…Ù„Ø©'?'selected':''}>Ù…ÙƒØªÙ…Ù„Ø©</option>
                            <option value="Ù…ØªÙˆÙ‚ÙØ©" ${s.filterStatus==='Ù…ØªÙˆÙ‚ÙØ©'?'selected':''}>Ù…ØªÙˆÙ‚ÙØ©</option>
                        </select>
                    </div>
                    <div class="glass-select-wrapper">
                        <i class="fa-solid fa-arrow-down-short-wide glass-icon"></i>
                        <select class="glass-select" onchange="toggleFilter('sort', this.value)">
                            <option value="Ø§Ù„Ø£Ø­Ø¯Ø«" ${s.filterSort==='Ø§Ù„Ø£Ø­Ø¯Ø«'?'selected':''}>Ø§Ù„Ø£Ø­Ø¯Ø«</option>
                            <option value="Ø£Ø­Ø¯Ø« Ø§Ù„ØªØ­Ø¯ÙŠØ«Ø§Øª" ${s.filterSort==='Ø£Ø­Ø¯Ø« Ø§Ù„ØªØ­Ø¯ÙŠØ«Ø§Øª'?'selected':''}>Ø£Ø­Ø¯Ø« Ø§Ù„ØªØ­Ø¯ÙŠØ«Ø§Øª</option>
                            <option value="Ø§Ù„Ø£Ø¹Ù„Ù‰ ØªÙ‚ÙŠÙŠÙ…Ø§Ù‹" ${s.filterSort==='Ø§Ù„Ø£Ø¹Ù„Ù‰ ØªÙ‚ÙŠÙŠÙ…Ø§Ù‹'?'selected':''}>Ø§Ù„Ø£Ø¹Ù„Ù‰ ØªÙ‚ÙŠÙŠÙ…Ø§Ù‹</option>
                            <option value="Ø§Ù„Ø£ÙƒØ«Ø± Ø´Ø¹Ø¨ÙŠØ©" ${s.filterSort==='Ø§Ù„Ø£ÙƒØ«Ø± Ø´Ø¹Ø¨ÙŠØ©'?'selected':''}>Ø§Ù„Ø£ÙƒØ«Ø± Ø´Ø¹Ø¨ÙŠØ©</option>
                            <option value="Ø£-ÙŠ" ${s.filterSort==='Ø£-ÙŠ'?'selected':''}>Ø£Ø¨Ø¬Ø¯ÙŠØ§Ù‹</option>
                            <option value="Ø¹Ø¯Ø¯ Ø§Ù„ÙØµÙˆÙ„" ${s.filterSort==='Ø¹Ø¯Ø¯ Ø§Ù„ÙØµÙˆÙ„'?'selected':''}>Ø¹Ø¯Ø¯ Ø§Ù„ÙØµÙˆÙ„</option>
                        </select>
                    </div>
                    <div class="glass-input-group">
                        <i class="fa-regular fa-calendar glass-icon" style="margin-left:5px;"></i>
                        <input type="number" class="glass-input" placeholder="Ù…Ù† Ø³Ù†Ø©" value="${s.filterYearMin||''}" oninput="handleNumberInput('filterYearMin', this.value)">
                        <span class="glass-separator">-</span>
                        <input type="number" class="glass-input" placeholder="Ø¥Ù„Ù‰" value="${s.filterYearMax||''}" oninput="handleNumberInput('filterYearMax', this.value)">
                    </div>
                    <div class="glass-toolbar" style="display:flex; align-items:center; gap:10px;">
                        <span style="color:var(--text-muted); font-size:0.85rem;">Ø¹Ø±Ø¶:</span>
                        <div class="glass-select-wrapper" style="padding:0; min-width:unset;">
                            <select class="glass-select" style="padding:8px 10px; min-width:60px;" onchange="toggleFilter('limit', this.value)">
                                <option value="12" ${s.limit===12?'selected':''}>12</option>
                                <option value="24" ${s.limit===24?'selected':''}>24</option>
                                <option value="48" ${s.limit===48?'selected':''}>48</option>
                            </select>
                        </div>
                        <button class="mangatime-view-btn ${!s.viewMode || s.viewMode==='grid'?'active':''}" onclick="toggleViewMode('grid')" title="Ø¹Ø±Ø¶ Ø´Ø¨ÙƒÙŠ" style="padding:8px;"><i class="fa-solid fa-border-all"></i></button>
                        <button class="mangatime-view-btn ${s.viewMode==='list'?'active':''}" onclick="toggleViewMode('list')" title="Ø¹Ø±Ø¶ Ù‚Ø§Ø¦Ù…Ø©" style="padding:8px;"><i class="fa-solid fa-list"></i></button>
                    </div>
                </div>
                ${contentHtml}
            </div>
            `;
        startSliderTimer();
    } else if (state.currentView === 'profile') {
        viewHtml = await ProfileViewComponent();
        if (sliderInterval) clearInterval(sliderInterval);
    } else if (state.currentView === 'settings') {
        viewHtml = SettingsViewComponent();
        if (sliderInterval) clearInterval(sliderInterval);
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
    } else if (state.currentView === 'profile') {
        viewHtml = await ProfileViewComponent();
        if (sliderInterval) clearInterval(sliderInterval);
    } else if (state.currentView === 'leaderboard') {
        viewHtml = await LeaderboardViewComponent();
        if (sliderInterval) clearInterval(sliderInterval);
    } else if (state.currentView === 'reset-password') {
        viewHtml = ResetPasswordViewComponent();
        if (sliderInterval) clearInterval(sliderInterval);
    } else if (state.currentView === 'suggestions') {
        root.innerHTML = `<div class="page-fade-enter">${SuggestionsViewComponent()}</div>`;
    } else if (state.currentView === 'announcements') {
        viewHtml = await AnnouncementsViewComponent();
        if (sliderInterval) clearInterval(sliderInterval);
    } else if (state.currentView === 'store') {
        viewHtml = await StoreViewComponent();
        if (sliderInterval) clearInterval(sliderInterval);
    } else if (state.currentView === 'chat') {
        viewHtml = ChatViewComponent();
        if (sliderInterval) clearInterval(sliderInterval);
    } else if (state.currentView === 'search') {
        viewHtml = SearchViewComponent();
        if (sliderInterval) clearInterval(sliderInterval);
    }

    // 3. Ø¨Ù†Ø§Ø¡ ÙˆØªØµÙŠÙŠØ± Ø§Ù„Ù‡ÙŠÙƒÙ„ Ø§Ù„Ø£Ø³Ø§Ø³ÙŠ Ù„Ù„ÙˆØ§Ø¬Ù‡Ø©
    const isReader = state.currentView === 'reader';
    let appRoot = document.getElementById('app-root');
    let mainContent = document.getElementById('main-content');
    const currentShellIsReader = appRoot && appRoot.getAttribute('data-shell') === 'reader';

    if (!appRoot || (isReader !== currentShellIsReader)) {
        if (isReader) {
            root.innerHTML = `<div id="app-root" data-shell="reader">${viewHtml} ${AuthModalComponent()}  ${SettingsModalComponent()} ${DailyRewardModalComponent()}</div>`;
        } else {
            root.innerHTML = `
            <div id="app-root" data-shell="main">
                ${HeaderComponent()}
                <main id="main-content" class="main-content page-fade-in">${viewHtml}</main>
                ${BottomNavComponent()}
                <div id="modals-container">
                    ${AuthModalComponent()}
                    ${SettingsModalComponent()}
                    ${DailyRewardModalComponent()}
                </div>
            </div>
            `;
        }
    } else {
        if (isReader) {
            appRoot.innerHTML = `${viewHtml} ${AuthModalComponent()}  ${SettingsModalComponent()} ${DailyRewardModalComponent()}`;
        } else {
            if (mainContent) {
                mainContent.innerHTML = viewHtml;
                window.scrollTo({ top: 0, behavior: 'smooth' });
                updateBottomNavActiveState();
                
                // Update header active state
                const headerNavLinks = document.querySelectorAll('.header-nav a');
                headerNavLinks.forEach(link => {
                    link.classList.remove('active');
                    const onclick = link.getAttribute('onclick') || '';
                    if (onclick.includes(`navigateView('${state.currentView}')`)) {
                        link.classList.add('active');
                    } else if (state.currentView === 'bookmarks' && onclick.includes('bookmarks')) {
                        link.classList.add('active');
                    }
                });
                
                let modalsContainer = document.getElementById('modals-container');
                if (!modalsContainer) {
                    modalsContainer = document.createElement('div');
                    modalsContainer.id = 'modals-container';
                    appRoot.appendChild(modalsContainer);
                }
                modalsContainer.innerHTML = `${AuthModalComponent()} ${SettingsModalComponent()} ${DailyRewardModalComponent()}`;
            }
        }
    }

    if (state.currentView === 'reader' && state.readerSettings.mode !== 'horizontal') {
        initLazyLoading();
        initProgressTracker();
    }

    initScrollToTop();
    initLazyImages();
    attachEventListeners();
    } catch (err) {
        console.error(err);
        document.body.innerHTML = `<div style="background:#fff; color:#f00; padding:20px; font-family:monospace; direction:ltr; text-align:left; font-size:16px;"><h1>Fatal Error in renderApp</h1><pre>${err.message}\n${err.stack}</pre></div>`;
    }
}

function BottomNavComponent() {
    const s = state.currentView;
    return `
    <nav class="bottom-nav">
        <a href="javascript:void(0);" class="bottom-nav-item ${s==='home'?'active':''}" onclick="event.preventDefault(); window.navigateView('home')">
            <i class="fa-solid fa-house"></i>
            <span>Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©</span>
        </a>
        <a href="javascript:void(0);" class="bottom-nav-item ${s==='search'?'active':''}" onclick="event.preventDefault(); window.navigateView('search')">
            <i class="fa-solid fa-magnifying-glass"></i>
            <span>Ø¨Ø­Ø«</span>
        </a>
        <a href="javascript:void(0);" class="bottom-nav-item ${s==='bookmarks'?'active':''}" onclick="event.preventDefault(); window.navigateView('bookmarks')">
            <i class="fa-solid fa-bookmark"></i>
            <span>Ù…ÙƒØªØ¨ØªÙŠ</span>
        </a>
        <a href="javascript:void(0);" class="bottom-nav-item ${s==='profile'?'active':''}" onclick="event.preventDefault(); if(state.sessionToken){ window.navigateProfile(state.sessionUsername); } else { window.toggleModal('auth-modal'); }">
            <i class="fa-solid fa-user"></i>
            <span>Ø­Ø³Ø§Ø¨ÙŠ</span>
        </a>
    </nav>
    `;
}

function updateBottomNavActiveState() {
    const s = state.currentView;
    const items = document.querySelectorAll('.bottom-nav-item');
    items.forEach(item => {
        item.classList.remove('active');
        const onclick = item.getAttribute('onclick') || '';
        if (s === 'home' && onclick.includes('home')) item.classList.add('active');
        if (s === 'search' && onclick.includes('search')) item.classList.add('active');
        if (s === 'bookmarks' && onclick.includes('bookmarks')) item.classList.add('active');
        if (s === 'profile' && onclick.includes('profile')) item.classList.add('active');
    });
}


// ==========================================
// 4.4.5. Ù…Ø¹Ø§ÙŠÙ†Ø© Ù…Ù„Ù Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…
// ==========================================

async function ProfileViewComponent() {
    const username = state.profileUsername;
    if (!username) return '<div class="empty-state"><p>Ù„Ù… ÙŠØªÙ… ØªØ­Ø¯ÙŠØ¯ Ù…Ø³ØªØ®Ø¯Ù…</p></div>';
    try {
        const res = await fetch('/api/profile/' + encodeURIComponent(username));
        if (!res.ok) return '<div class="empty-state"><p>Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯</p></div>';
        const profile = await res.json();
        
        // Fetch activity, reviews, lists in parallel
        const [activityRes, libraryRes, reviewsRes, listsRes] = await Promise.all([
            fetch('/api/profile/' + encodeURIComponent(username) + '/activity'),
            state.sessionToken ? fetch('/api/profile/' + encodeURIComponent(username) + '/library') : Promise.resolve({json: () => []}),
            fetch('/api/profile/' + encodeURIComponent(username) + '/reviews'),
            fetch('/api/profile/' + encodeURIComponent(username) + '/lists')
        ]);
        const activities = await activityRes.json();
        const library = state.sessionToken ? await libraryRes.json() : [];
        const reviews = await reviewsRes.json();
        const lists = await listsRes.json();
        
        const rankName = profile.rank;
        const isOwner = profile.is_owner;
        const userHandle = getUserHandle(profile.email);
        const userInitial = getUserInitial(profile.email);
        const rankClass = profile.level <= 5 ? 'rank-starter' : profile.level <= 15 ? 'rank-reader' : profile.level <= 30 ? 'rank-bronze' : profile.level <= 50 ? 'rank-silver' : profile.level <= 70 ? 'rank-gold' : profile.level <= 99 ? 'rank-platinum' : profile.level <= 149 ? 'rank-emerald' : profile.level <= 199 ? 'rank-diamond' : profile.level <= 299 ? 'rank-master' : 'rank-admin';
        
        const xpPercent = profile.xp_for_next > 0 ? Math.min(100, Math.round(((profile.points - profile.xp_for_current) / (profile.xp_for_next - profile.xp_for_current)) * 100)) : 0;
        
        let followBtnHtml = '';
        if (state.sessionToken && !isOwner) {
            followBtnHtml = `<button class="follow-btn ${profile.is_following ? 'following' : ''}" id="profile-follow-btn" data-username="${username}">
                <i class="fa-solid ${profile.is_following ? 'fa-user-check' : 'fa-user-plus'}"></i>
                ${profile.is_following ? 'Ù…ØªØ§Ø¨ÙŽØ¹' : 'Ù…ØªØ§Ø¨Ø¹Ø©'}
            </button>`;
        }
        
        const initials = getUserInitial(profile.email);
        
        return `
        <div class="profile-page">
            <div class="profile-header-card">
                <div class="profile-cover"></div>
                <div class="profile-info-row">
                    <div class="profile-avatar-wrapper ${rankClass}">
                        <span class="profile-avatar-text">${initials}</span>
                    </div>
                    <div class="profile-meta">
                        <h1 class="profile-username">${profile.username}</h1>
                        <div class="profile-rank-badge ${rankClass}"><i class="fa-solid fa-crown"></i> ${rankName}</div>
                        ${profile.bio ? `<p class="profile-bio">${profile.bio}</p>` : ''}
                    </div>
                    <div class="profile-actions">
                        ${followBtnHtml}
                    </div>
                </div>
                <div class="profile-stats-row">
                    <div class="profile-stat"><span class="stat-value">${profile.points.toLocaleString()}</span><span class="stat-label">Ù†Ù‚Ø§Ø·</span></div>
                    <div class="profile-stat"><span class="stat-value">${profile.level}</span><span class="stat-label">Ø§Ù„Ù…Ø³ØªÙˆÙ‰</span></div>
                    <div class="profile-stat"><span class="stat-value">${profile.chapters_read}</span><span class="stat-label">ÙØµÙ„ Ù…Ù‚Ø±ÙˆØ¡</span></div>
                    <div class="profile-stat"><span class="stat-value">${profile.followers}</span><span class="stat-label">Ù…ØªØ§Ø¨Ø¹ÙˆÙ†</span></div>
                    <div class="profile-stat"><span class="stat-value">${profile.following}</span><span class="stat-label">ÙŠØªØ§Ø¨Ø¹</span></div>
                    <div class="profile-stat"><span class="stat-value">${profile.streak_days || 0}</span><span class="stat-label">streak ðŸ”¥</span></div>
                    ${profile.created_at ? `<div class="profile-stat"><span class="stat-value">${new Date(profile.created_at).toLocaleDateString('ar-EG')}</span><span class="stat-label">ØªØ§Ø±ÙŠØ® Ø§Ù„Ø§Ù†Ø¶Ù…Ø§Ù…</span></div>` : ''}
                    ${profile.comments_count !== undefined ? `<div class="profile-stat"><span class="stat-value">${profile.comments_count}</span><span class="stat-label">ØªØ¹Ù„ÙŠÙ‚Ø§Øª</span></div>` : ''}
                </div>
                <div class="profile-xp-bar-container">
                    <div class="profile-xp-bar-fill" style="width:${xpPercent}%"></div>
                    <span class="profile-xp-text">Ø§Ù„Ù…Ø³ØªÙˆÙ‰ ${profile.level} â€” ${profile.points} XP</span>
                </div>
            </div>

            <div class="reading-stats-section" style="display:flex;flex-wrap:wrap;gap:12px;margin:16px 0;padding:16px;background:var(--bg-surface);border-radius:12px;border:1px solid var(--border-color);">
                <div style="flex:1;min-width:120px;text-align:center;padding:8px;">
                    <div style="font-size:1.2rem;font-weight:800;color:var(--color-secondary);">${profile.chapters_read || 0}</div>
                    <div style="font-size:0.7rem;color:var(--text-muted);">Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„ÙØµÙˆÙ„</div>
                </div>
                <div style="flex:1;min-width:120px;text-align:center;padding:8px;">
                    <div style="font-size:1.2rem;font-weight:800;color:var(--color-primary);">${profile.avg_rating ? profile.avg_rating.toFixed(1) : 'â€”'}</div>
                    <div style="font-size:0.7rem;color:var(--text-muted);">Ù…ØªÙˆØ³Ø· Ø§Ù„ØªÙ‚ÙŠÙŠÙ…</div>
                </div>
                <div style="flex:1;min-width:120px;text-align:center;padding:8px;">
                    <div style="font-size:1.2rem;font-weight:800;color:var(--color-secondary);">${profile.unique_manga || 0}</div>
                    <div style="font-size:0.7rem;color:var(--text-muted);">Ù…Ø§Ù†Ø¬Ø§ Ù…Ø®ØªÙ„ÙØ©</div>
                </div>
                <div style="flex:1;min-width:120px;text-align:center;padding:8px;">
                    <div style="font-size:1.2rem;font-weight:800;color:var(--color-primary);">${profile.weekly_pace || 0}</div>
                    <div style="font-size:0.7rem;color:var(--text-muted);">ÙØµÙ„/Ø£Ø³Ø¨ÙˆØ¹</div>
                </div>
            </div>

            <div class="profile-tabs">
                <button class="profile-tab active" data-tab="activity">Ø§Ù„Ù†Ø´Ø§Ø·</button>
                <button class="profile-tab" data-tab="library">Ø§Ù„Ù…ÙƒØªØ¨Ø©</button>
                <button class="profile-tab" data-tab="reviews">Ø§Ù„ØªÙ‚ÙŠÙŠÙ…Ø§Øª (${reviews.length})</button>
                <button class="profile-tab" data-tab="lists">Ø§Ù„Ù‚ÙˆØ§Ø¦Ù… (${lists.length})</button>
            </div>

            <div class="profile-tab-content active" id="profile-tab-activity">
                ${activities.length === 0 ? '<div class="empty-state"><p>Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ù†Ø´Ø§Ø· Ø¨Ø¹Ø¯</p></div>' : activities.map(a => `
                    <div class="activity-item" data-manga="${a.manga_id}">
                        <img src="${a.cover || DEFAULT_COVER_URL}" class="activity-cover">
                        <div class="activity-info">
                            <strong>${a.title}</strong>
                            <span>Ø§Ù„ÙØµÙ„ ${a.chapter_id}</span>
                            <small>${timeAgo(a.time)}</small>
                        </div>
                    </div>
                `).join('')}
            </div>

            <div class="profile-tab-content" id="profile-tab-library">
                ${library.length === 0 ? '<div class="empty-state"><p>Ù„Ø§ ØªÙˆØ¬Ø¯ Ù…Ø§Ù†Ø¬Ø§ ÙÙŠ Ø§Ù„Ù…ÙƒØªØ¨Ø©</p></div>' : `<div class="profile-library-grid">${library.map(m => `
                    <div class="library-card" data-manga="${m.manga_id}">
                        <img src="${m.cover || DEFAULT_COVER_URL}" class="library-card-cover">
                        <span class="library-card-title">${m.title}</span>
                    </div>
                `).join('')}</div>`}
            </div>

            <div class="profile-tab-content" id="profile-tab-reviews">
                ${reviews.length === 0 ? '<div class="empty-state"><p>Ù„Ø§ ØªÙˆØ¬Ø¯ ØªÙ‚ÙŠÙŠÙ…Ø§Øª Ø¨Ø¹Ø¯</p></div>' : reviews.map(r => `
                    <div class="review-card" data-manga="${r.manga_id}">
                        <img src="${r.cover || DEFAULT_COVER_URL}" class="review-cover">
                        <div class="review-body">
                            <strong>${r.title}</strong>
                            <div class="review-stars">${'â˜…'.repeat(r.rating)}${'â˜†'.repeat(5 - r.rating)}</div>
                            ${r.review ? `<p class="review-text">${r.review}</p>` : ''}
                            <small>${timeAgo(r.time)}</small>
                        </div>
                    </div>
                `).join('')}
            </div>

            <div class="profile-tab-content" id="profile-tab-lists">
                ${lists.length === 0 ? '<div class="empty-state"><p>Ù„Ø§ ØªÙˆØ¬Ø¯ Ù‚ÙˆØ§Ø¦Ù… Ø¨Ø¹Ø¯</p></div>' : lists.map(l => `
                    <div class="list-card" data-list="${l.id}">
                        <div class="list-card-header">
                            <strong>${l.name}</strong>
                            <span class="list-count">${l.count} Ù…Ø§Ù†Ø¬Ø§</span>
                        </div>
                        ${l.description ? `<p class="list-desc">${l.description}</p>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
        `;
    } catch (e) {
        console.error('Profile error:', e);
        return '<div class="empty-state"><p>Ø­Ø¯Ø« Ø®Ø·Ø£ ÙÙŠ ØªØ­Ù…ÙŠÙ„ Ø§Ù„Ù…Ù„Ù Ø§Ù„Ø´Ø®ØµÙŠ</p></div>';
    }
}

// ==========================================
// 4.4.6. ØµÙØ­Ø© Ø§Ù„Ø¥Ø¹Ù„Ø§Ù†Ø§Øª
// ==========================================

async function AnnouncementsViewComponent() {
    try {
        const res = await fetch('/api/announcements');
        if (!res.ok) return '<div class="empty-state"><p>Ù„Ø§ ØªÙˆØ¬Ø¯ Ø¥Ø¹Ù„Ø§Ù†Ø§Øª Ø­Ø§Ù„ÙŠØ§Ù‹</p></div>';
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.announcements || []);
        if (list.length === 0) return '<div class="empty-state"><p>Ù„Ø§ ØªÙˆØ¬Ø¯ Ø¥Ø¹Ù„Ø§Ù†Ø§Øª Ø­Ø§Ù„ÙŠØ§Ù‹</p></div>';
        const items = list.map(a => {
            const date = a.created_at ? new Date(a.created_at).toLocaleDateString('ar-EG') : '';
            return `
            <div class="announcement-card" style="background:var(--bg-surface);border-radius:12px;padding:20px;margin-bottom:16px;box-shadow:0 2px 12px rgba(0,0,0,0.1);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <h3 style="margin:0;font-size:1.1rem;">${a.title || 'Ø¥Ø¹Ù„Ø§Ù†'}</h3>
                    ${date ? `<small style="color:var(--text-muted);">${date}</small>` : ''}
                </div>
                <p style="margin:0;color:var(--text-dark);line-height:1.6;">${a.content || a.body || ''}</p>
            </div>`;
        }).join('');
        return `
        <div style="max-width:800px;margin:0 auto;padding:24px;">
            <div class="section-header"><h2 class="section-title">Ø§Ù„Ø¥Ø¹Ù„Ø§Ù†Ø§Øª <span>ÙˆØ§Ù„ØªØ­Ø¯ÙŠØ«Ø§Øª</span></h2></div>
            ${items}
        </div>`;
    } catch (e) {
        console.error('Announcements error:', e);
        return '<div class="empty-state"><p>ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ Ø§Ù„Ø¥Ø¹Ù„Ø§Ù†Ø§Øª</p></div>';
    }
}

// ==========================================
// 4.4.7. ØµÙØ­Ø© Ø§Ù„Ù…ØªØ¬Ø±
// ==========================================

async function StoreViewComponent() {
    try {
        const res = await fetch('/api/store/items');
        const data = await res.json();
        const items = Array.isArray(data) ? data : (data.items || []);
        if (items.length === 0) return '<div class="empty-state"><p>Ø§Ù„Ù…ØªØ¬Ø± Ù‚ÙŠØ¯ Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯ØŒ Ø¹Ø¯ Ù„Ø§Ø­Ù‚Ø§Ù‹!</p></div>';
        const s = state;
        return `
        <div style="max-width:1000px;margin:0 auto;padding:24px;">
            <div class="section-header"><h2 class="section-title">Ø§Ù„Ù…ØªØ¬Ø± <span>Ø§Ø³ØªØ¨Ø¯Ù„ Ù†Ù‚Ø§Ø·Ùƒ</span></h2></div>
            <div class="manga-grid">
                ${items.map(item => {
                    const canBuy = (s.userProfile.points || 0) >= item.cost;
                    return `
                    <div class="store-item" data-id="${item.id}" style="background:var(--bg-surface);border-radius:16px;overflow:hidden;border:1px solid var(--border-color);transition:var(--transition-fast);">
                        <div style="padding:24px;text-align:center;">
                            <div style="font-size:3rem;margin-bottom:12px;">${item.icon || 'ðŸŽ'}</div>
                            <h3 style="margin:0 0 8px;font-size:1rem;">${item.name}</h3>
                            <p style="font-size:0.8rem;color:var(--text-muted);margin:0 0 16px;">${item.description || ''}</p>
                            <div style="font-size:1.1rem;font-weight:700;color:var(--color-secondary);margin-bottom:12px;">
                                <i class="fa-solid fa-star"></i> ${item.cost}
                            </div>
                            <button class="store-buy-btn" data-id="${item.id}" ${canBuy ? '' : 'disabled'} style="width:100%;padding:10px;border:none;border-radius:30px;font-weight:700;cursor:${canBuy ? 'pointer' : 'not-allowed'};background:${canBuy ? 'var(--color-primary)' : 'var(--border-color)'};color:#fff;">
                                ${canBuy ? 'Ø´Ø±Ø§Ø¡' : 'Ù†Ù‚Ø§Ø· ØºÙŠØ± ÙƒØ§ÙÙŠØ©'}
                            </button>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </div>`;
    } catch (e) {
        console.error('Store error:', e);
        return '<div class="empty-state"><p>Ø§Ù„Ù…ØªØ¬Ø± ØºÙŠØ± Ù…ØªØ§Ø­ Ø­Ø§Ù„ÙŠØ§Ù‹</p></div>';
    }
}

// ==========================================
// 4.4.8. Ø§Ù„Ø´Ø§Øª Ø§Ù„Ø¹Ø§Ù… (ÙˆØ§Ø¬Ù‡Ø© ÙÙ‚Ø·)
// ==========================================

function ChatViewComponent() {
    const demoMsgs = [
        { user: 'Kairo', text: 'Ù…Ø±Ø­Ø¨Ø§Ù‹ Ø¨Ø§Ù„Ø¬Ù…ÙŠØ¹ ÙÙŠ Ø§Ù„Ø´Ø§Øª! ðŸ™Œ', time: '02:30', mine: false },
        { user: 'ReadMaster', text: 'Ù‡Ù„ Ù‡Ù†Ø§Ùƒ Ù…Ø§Ù†Ø¬Ø§ Ø¬Ø¯ÙŠØ¯Ø© Ø§Ù„ÙŠÙˆÙ…ØŸ', time: '02:31', mine: false },
        { user: 'Ø£Ù†Øª', text: 'Ø£Ù‡Ù„Ø§Ù‹! Ù†Ø¹Ù… ÙÙŠÙ‡ Ø¥ØµØ¯Ø§Ø±Ø§Øª Ø¬Ø¯ÙŠØ¯Ø©', time: '02:32', mine: true },
    ];
    const msgsHtml = demoMsgs.map(m => `
        <div class="chat-msg ${m.mine ? 'mine' : 'other'}">
            ${!m.mine ? `<div class="chat-user">${m.user}</div>` : ''}
            <div>${m.text}</div>
            <div class="chat-time">${m.time}</div>
        </div>
    `).join('');
    const isLoggedIn = !!state.sessionToken;
    return `
    <div style="max-width:700px;margin:0 auto;padding:24px;">
        <div class="section-header"><h2 class="section-title">Ø§Ù„Ø´Ø§Øª Ø§Ù„Ø¹Ø§Ù… <span>ØªÙˆØ§ØµÙ„ Ù…Ø¹ Ø§Ù„Ù…Ø¬ØªÙ…Ø¹</span></h2></div>
        <div class="chat-container">
            <div class="chat-messages" id="chat-messages">
                ${msgsHtml}
                ${!isLoggedIn ? '<div class="empty-state" style="margin:auto;"><p>Ø³Ø¬Ù‘Ù„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ù„Ù„Ù…Ø´Ø§Ø±ÙƒØ© ÙÙŠ Ø§Ù„Ø´Ø§Øª</p></div>' : ''}
            </div>
            <div class="chat-input-area">
                <input type="text" id="chat-input" placeholder="${isLoggedIn ? 'Ø§ÙƒØªØ¨ Ø±Ø³Ø§Ù„ØªÙƒ...' : 'Ø³Ø¬Ù‘Ù„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø£ÙˆÙ„Ø§Ù‹'}" ${!isLoggedIn ? 'disabled' : ''}>
                <button id="chat-send-btn" ${!isLoggedIn ? 'disabled style="opacity:0.5"' : ''}><i class="fa-solid fa-paper-plane"></i> Ø¥Ø±Ø³Ø§Ù„</button>
            </div>
        </div>
    </div>`;
}

// ==========================================
// 4.4.9. ØµÙØ­Ø© Ø§Ù„Ø¨Ø­Ø« Ø§Ù„Ù…ØªÙ‚Ø¯Ù…
// ==========================================

function getLastChapterNum(m) {
    if (m.chapters && m.chapters.length > 0) {
        let maxNum = 0;
        const first = m.chapters[0].number || 0;
        const last = m.chapters[m.chapters.length - 1].number || 0;
        maxNum = Math.max(first, last);
        if (maxNum > 0) return maxNum;
    }
    return null;
}

function getTypeLabel(m) {
    const t = (m.type || '').trim();
    if (!t) return '';
    const labels = { 'manga': 'Ù…Ø§Ù†Ø¬Ø§', 'manhwa': 'Ù…Ø§Ù†Ù‡ÙˆØ§', 'manhua': 'Ù…Ø§Ù†Ù‡Ø§', 'Ù…Ø§Ù†Ø¬Ø§': 'Ù…Ø§Ù†Ø¬Ø§', 'Ù…Ø§Ù†Ù‡ÙˆØ§': 'Ù…Ø§Ù†Ù‡ÙˆØ§', 'Ù…Ø§Ù†Ù‡Ø§': 'Ù…Ø§Ù†Ù‡Ø§' };
    return labels[t.toLowerCase()] || t;
}

function getStatusLabel(s) {
    const labels = { 'ongoing': 'Ù…Ø³ØªÙ…Ø±Ø©', 'completed': 'Ù…ÙƒØªÙ…Ù„Ø©', 'hiatus': 'Ù…ØªÙˆÙ‚ÙØ©', 'cancelled': 'Ù…Ù„ØºÙŠØ©', 'Ù…Ø³ØªÙ…Ø±Ø©': 'Ù…Ø³ØªÙ…Ø±Ø©', 'Ù…ÙƒØªÙ…Ù„Ø©': 'Ù…ÙƒØªÙ…Ù„Ø©', 'Ù…ØªÙˆÙ‚ÙØ©': 'Ù…ØªÙˆÙ‚ÙØ©' };
    return labels[s] || s;
}

function SearchViewComponent() {
    const query = (state.searchQuery || '').trim();
    const viewMode = state.searchViewMode || 'grid';
    const perPage = 30;
    const page = state.searchPage || 1;
    const scope = state.searchScope || 'Ø§Ù„ÙƒÙ„';
    const sortBy = state.filterSort || 'Ø§Ù„Ø£ÙƒØ«Ø± Ø´Ø¹Ø¨ÙŠØ©';
    const showFilters = state.browseShowFilters;
    const filterStatus = state.filterStatus || 'Ø§Ù„ÙƒÙ„';
    const filterType = state.filterType || 'Ø§Ù„ÙƒÙ„';
    const filterYearMin = state.filterYearMin || '';
    const filterYearMax = state.filterYearMax || '';
    const filterRatingMin = state.filterRatingMin || '';
    const filterRatingMax = state.filterRatingMax || '';
    const filterChaptersMin = state.filterChaptersMin || '';
    const filterChaptersMax = state.filterChaptersMax || '';

    let results = state.mangas ? [...state.mangas] : [];

    if (query) {
        const q = query.toLowerCase();
        if (scope === 'Ø§Ù„Ø¹Ù†ÙˆØ§Ù†') {
            results = results.filter(m => m.title.toLowerCase().includes(q));
        } else if (scope === 'Ø§Ù„Ù…Ø¤Ù„Ù') {
            results = results.filter(m => (m.author || '').toLowerCase().includes(q));
        } else if (scope === 'Ø§Ù„ÙˆØ³ÙˆÙ…') {
            results = results.filter(m => (m.genres || []).some(g => g.toLowerCase().includes(q)));
        } else if (scope === 'Ø§Ù„ÙˆØµÙ') {
            results = results.filter(m => (m.synopsis || '').toLowerCase().includes(q));
        } else {
            results = results.filter(m =>
                m.title.toLowerCase().includes(q) ||
                (m.alternative || '').toLowerCase().includes(q) ||
                (m.author || '').toLowerCase().includes(q) ||
                (m.artist || '').toLowerCase().includes(q) ||
                (m.genres || []).some(g => g.toLowerCase().includes(q))
            );
        }
    }

    if (filterStatus !== 'Ø§Ù„ÙƒÙ„') {
        results = results.filter(m => {
            const s = (m.status || '').trim();
            return s === filterStatus || getStatusLabel(s) === filterStatus;
        });
    }
    if (filterType !== 'Ø§Ù„ÙƒÙ„') {
        results = results.filter(m => {
            const t = (m.type || '').trim();
            return t === filterType || getTypeLabel(t) === filterType;
        });
    }

    const allGenres = [...new Set((state.mangas || []).flatMap(m => m.genres || []))].sort();
    const activeGenre = state.activeGenre || 'Ø§Ù„ÙƒÙ„';
    if (activeGenre !== 'Ø§Ù„ÙƒÙ„') {
        results = results.filter(m => m.genres && m.genres.includes(activeGenre));
    }

    if (filterYearMin) {
        const yMin = parseInt(filterYearMin);
        if (!isNaN(yMin)) results = results.filter(m => (m.year || 9999) >= yMin);
    }
    if (filterYearMax) {
        const yMax = parseInt(filterYearMax);
        if (!isNaN(yMax)) results = results.filter(m => (m.year || 0) <= yMax);
    }
    if (filterRatingMin) {
        const rMin = parseFloat(filterRatingMin);
        if (!isNaN(rMin)) results = results.filter(m => (m.rating || 0) >= rMin);
    }
    if (filterRatingMax) {
        const rMax = parseFloat(filterRatingMax);
        if (!isNaN(rMax)) results = results.filter(m => (m.rating || 5) <= rMax);
    }
    if (filterChaptersMin) {
        const cMin = parseInt(filterChaptersMin);
        if (!isNaN(cMin)) results = results.filter(m => (m.chapters ? m.chapters.length : 0) >= cMin);
    }
    if (filterChaptersMax) {
        const cMax = parseInt(filterChaptersMax);
        if (!isNaN(cMax)) results = results.filter(m => (m.chapters ? m.chapters.length : 0) <= cMax);
    }

    if (sortBy === 'Ø§Ù„Ø£ÙƒØ«Ø± Ø´Ø¹Ø¨ÙŠØ©') {
        results.sort((a, b) => (b.popularity || b.rating || 0) - (a.popularity || a.rating || 0));
    } else if (sortBy === 'Ø§Ù„Ø£Ø­Ø¯Ø«') {
        results.sort((a, b) => (b.year || 0) - (a.year || 0));
    } else if (sortBy === 'Ø§Ù„Ø£Ø¹Ù„Ù‰ ØªÙ‚ÙŠÙŠÙ…Ø§Ù‹') {
        results.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === 'Ø§Ù„Ø£ÙƒØ«Ø± ÙØµÙˆÙ„Ø§Ù‹') {
        results.sort((a, b) => (b.chapters ? b.chapters.length : 0) - (a.chapters ? a.chapters.length : 0));
    } else if (sortBy === 'Ø§Ù„Ø£Ù‚Ù„ ÙØµÙˆÙ„Ø§Ù‹') {
        results.sort((a, b) => (a.chapters ? a.chapters.length : 0) - (b.chapters ? b.chapters.length : 0));
    }

    const totalCount = results.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
    const startIdx = (page - 1) * perPage;
    const pageResults = results.slice(startIdx, startIdx + perPage);

    const itemsHtml = pageResults.map(m => {
        const lastCh = getLastChapterNum(m);
        const chLabel = lastCh != null ? `Ø§Ù„ÙØµÙ„ ${lastCh}` : (m.chapters ? `${m.chapters.length} ÙØµÙˆÙ„` : '');

        if (viewMode === 'list') {
            return `
            <div class="browse-list-item" data-id="${m.id}">
                <img src="${getDisplayCover(m)}" class="browse-list-cover" alt="${m.title}" loading="lazy">
                <div class="browse-list-info">
                    <h3 class="browse-list-title">${m.title}</h3>
                    <div class="browse-list-chapter">
                        <span class="browse-chapter-num">${chLabel}</span>
                        <span class="browse-type-tag">${getTypeLabel(m) || ''}</span>
                    </div>
                </div>
            </div>
            `;
        }
        return `
        <div class="browse-card" data-id="${m.id}">
            <div class="browse-card-cover">
                <img src="${getDisplayCover(m)}" alt="${m.title}" loading="lazy">
            </div>
            <div class="browse-card-body">
                <h3 class="browse-card-title">${m.title}</h3>
                <div class="browse-card-meta">
                    <span class="browse-chapter-num">${chLabel}</span>
                    <span class="browse-type-tag">${getTypeLabel(m) || ''}</span>
                </div>
            </div>
        </div>
        `;
    }).join('');

    const emptyMsg = query
        ? `<div class="empty-state"><i class="fa-solid fa-search" style="font-size:3rem;color:var(--text-muted);margin-bottom:16px;"></i><p>Ù„Ø§ ØªÙˆØ¬Ø¯ Ù†ØªØ§Ø¦Ø¬ Ù„Ù€ "${query}"</p></div>`
        : `<div class="empty-state"><i class="fa-solid fa-book-open" style="font-size:3rem;color:var(--text-muted);margin-bottom:16px;"></i><p>Ù„Ø§ ØªÙˆØ¬Ø¯ Ù…Ø§Ù†Ø¬Ø§ Ø¨Ø¹Ø¯</p></div>`;

    let pagHtml = '';
    if (totalPages > 1) {
        let pages = [];
        const startP = Math.max(1, page - 2);
        const endP = Math.min(totalPages, page + 2);
        if (startP > 1) pages.push(1);
        if (startP > 2) pages.push('...');
        for (let i = startP; i <= endP; i++) pages.push(i);
        if (endP < totalPages - 1) pages.push('...');
        if (endP < totalPages) pages.push(totalPages);

        pagHtml = `<div class="browse-pagination">${pages.map(p => {
            if (p === '...') return `<span class="page-dots">...</span>`;
            return `<button class="page-btn ${p === page ? 'active' : ''}" data-page="${p}">${p}</button>`;
        }).join('')}</div>`;
    }

    const scopeTabs = ['Ø§Ù„ÙƒÙ„', 'Ø§Ù„Ø¹Ù†ÙˆØ§Ù†', 'Ø§Ù„Ù…Ø¤Ù„Ù', 'Ø§Ù„ÙˆØ³ÙˆÙ…', 'Ø§Ù„ÙˆØµÙ'];
    const filterStatuses = ['Ø§Ù„ÙƒÙ„', 'Ù…Ø³ØªÙ…Ø±Ø©', 'Ù…ÙƒØªÙ…Ù„Ø©', 'Ù…ØªÙˆÙ‚ÙØ©'];
    const filterTypes = ['Ø§Ù„ÙƒÙ„', 'Ù…Ø§Ù†Ø¬Ø§', 'Ù…Ø§Ù†Ù‡ÙˆØ§', 'Ù…Ø§Ù†Ù‡Ø§'];
    const sortOptions = ['Ø§Ù„Ø£ÙƒØ«Ø± Ø´Ø¹Ø¨ÙŠØ©', 'Ø§Ù„Ø£Ø­Ø¯Ø«', 'Ø§Ù„Ø£Ø¹Ù„Ù‰ ØªÙ‚ÙŠÙŠÙ…Ø§Ù‹', 'Ø§Ù„Ø£ÙƒØ«Ø± ÙØµÙˆÙ„Ø§Ù‹', 'Ø§Ù„Ø£Ù‚Ù„ ÙØµÙˆÙ„Ø§Ù‹'];

    return `
    <div class="browse-page">
        <div class="browse-hero">
            <h1 class="browse-hero-title">Ø¹Ø§Ù„Ù… Ø§Ù„Ù…Ø§Ù†Ø¬Ø§</h1>
            <p class="browse-hero-sub">ØªØµÙÙ‘Ø­ Ø¹Ø§Ù„Ù… Ø§Ù„Ù…Ø§Ù†Ø¬Ø§</p>
            <p class="browse-hero-desc">Ø§ÙƒØªØ´Ù Ø¹Ù…Ù„Ùƒ Ø§Ù„ØªØ§Ù„ÙŠ Ø¨ÙŠÙ† Ø¢Ù„Ø§Ù Ø§Ù„Ø³Ù„Ø§Ø³Ù„</p>
        </div>

        <div class="browse-toolbar">
            <div class="browse-counter">${totalCount} Ø³Ù„Ø³Ù„Ø©</div>
            <div class="browse-actions">
                <select class="browse-sort-select" id="browse-sort">
                    ${sortOptions.map(s => `<option value="${s}" ${s === sortBy ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
                <div class="view-toggle">
                    <button class="view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}" data-view="grid" title="Ø´Ø¨ÙƒØ©"><i class="fa-solid fa-th-large"></i></button>
                    <button class="view-toggle-btn ${viewMode === 'list' ? 'active' : ''}" data-view="list" title="Ù‚Ø§Ø¦Ù…Ø©"><i class="fa-solid fa-list"></i></button>
                </div>
            </div>
        </div>

        <div class="browse-scope-bar">
            <span class="browse-scope-label">Ø§Ù„Ø¨Ø­Ø« Ø¨Ù€:</span>
            ${scopeTabs.map(s => `
                <button class="browse-scope-btn ${s === scope ? 'active' : ''}" data-scope="${s}">${s}</button>
            `).join('')}
        </div>

        <div class="browse-filter-bar">
            <div class="browse-filter-group">
                <label>Ø§Ù„Ø­Ø§Ù„Ø©</label>
                <select class="browse-filter-select" id="browse-filter-status">
                    ${filterStatuses.map(s => `<option value="${s}" ${s === filterStatus ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
            </div>
            <div class="browse-filter-group">
                <label>Ø§Ù„Ù†ÙˆØ¹</label>
                <select class="browse-filter-select" id="browse-filter-type">
                    ${filterTypes.map(s => `<option value="${s}" ${s === filterType ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
            </div>
            <div class="browse-filter-group">
                <label>Ø§Ù„ØªØµÙ†ÙŠÙØ§Øª</label>
                <select class="browse-filter-select" id="browse-filter-genre">
                    <option value="Ø§Ù„ÙƒÙ„" ${activeGenre === 'Ø§Ù„ÙƒÙ„' ? 'selected' : ''}>Ø§Ù„ÙƒÙ„</option>
                    ${allGenres.map(g => `<option value="${g}" ${g === activeGenre ? 'selected' : ''}>${g}</option>`).join('')}
                </select>
            </div>
            <div class="browse-filter-group browse-filter-collapsible">
                <button class="browse-filter-toggle" id="browse-filter-toggle">
                    <i class="fa-solid fa-sliders"></i> Ø®ÙŠØ§Ø±Ø§Øª Ø£Ø®Ø±Ù‰
                </button>
            </div>
        </div>

        <div class="browse-extra-filters" id="browse-extra-filters" style="display:${showFilters ? 'flex' : 'none'}">
            <div class="browse-filter-group">
                <label>Ø§Ù„Ø³Ù†Ø© Ù…Ù†</label>
                <input type="number" class="browse-filter-input" id="browse-filter-year-min" value="${filterYearMin}" placeholder="Ù…Ø«Ø§Ù„: 2020">
            </div>
            <div class="browse-filter-group">
                <label>Ø§Ù„Ø³Ù†Ø© Ø¥Ù„Ù‰</label>
                <input type="number" class="browse-filter-input" id="browse-filter-year-max" value="${filterYearMax}" placeholder="Ù…Ø«Ø§Ù„: 2026">
            </div>
            <div class="browse-filter-group">
                <label>Ø§Ù„ØªÙ‚ÙŠÙŠÙ… Ù…Ù†</label>
                <input type="number" class="browse-filter-input" id="browse-filter-rating-min" value="${filterRatingMin}" placeholder="0" min="0" max="5" step="0.5">
            </div>
            <div class="browse-filter-group">
                <label>Ø§Ù„ØªÙ‚ÙŠÙŠÙ… Ø¥Ù„Ù‰</label>
                <input type="number" class="browse-filter-input" id="browse-filter-rating-max" value="${filterRatingMax}" placeholder="5" min="0" max="5" step="0.5">
            </div>
            <div class="browse-filter-group">
                <label>Ø£Ù‚Ù„ ÙØµÙˆÙ„</label>
                <input type="number" class="browse-filter-input" id="browse-filter-ch-min" value="${filterChaptersMin}" placeholder="0">
            </div>
            <div class="browse-filter-group">
                <label>Ø£ÙƒØ«Ø± ÙØµÙˆÙ„</label>
                <input type="number" class="browse-filter-input" id="browse-filter-ch-max" value="${filterChaptersMax}" placeholder="1000">
            </div>
        </div>

        <div class="browse-results ${viewMode === 'grid' ? 'browse-grid' : 'browse-list'}">
            ${totalCount > 0 ? itemsHtml : emptyMsg}
        </div>

        ${pagHtml}
    </div>`;
}

// ==========================================
// 4.4.10. Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ù…ØªØµØ¯Ø±ÙŠÙ†
// ==========================================

async function LeaderboardViewComponent() {
    try {
        const baseUrl = '/api/leaderboard';
        const params = new URLSearchParams();
        if (state.leaderboardTab === 'monthly') params.set('period', 'monthly');
        if (state.leaderboardTab === 'weekly') params.set('period', 'weekly');
        params.set('limit', '100');
        const qs = params.toString();
        const res = await fetch(baseUrl + (qs ? '?' + qs : ''));
        const data = await res.json();
        if (!data || data.length === 0) return '<div class="empty-state"><p>Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ù…ØªØµØ¯Ø±ÙŠÙ† Ø¨Ø¹Ø¯</p></div>';

        // Ù…Ø¹Ø±ÙØ© Ù…ÙˆÙ‚Ø¹ Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… Ø§Ù„Ø­Ø§Ù„ÙŠ
        let myRankHtml = '';
        if (state.sessionToken && state.userEmail) {
            const myUsername = getUserHandle(state.userEmail);
            const myData = data.find(u => u.username === myUsername);
            const inTop100 = myData && myData.rank <= 100;
            if (inTop100) {
                const myRank = myData.rank;
                myRankHtml = `
                <div class="my-rank-card" style="background:linear-gradient(135deg,var(--color-primary),var(--color-secondary));padding:16px 20px;border-radius:12px;margin:20px 0;text-align:center;color:#fff;">
                    <div style="font-size:1.5rem;font-weight:800;">#${myRank}</div>
                    <div style="font-size:0.85rem;opacity:0.9;">ØªØ±ØªÙŠØ¨Ùƒ Ø§Ù„Ø­Ø§Ù„ÙŠ â€” ${myData.points.toLocaleString()} Ù†Ù‚Ø·Ø©</div>
                </div>`;
            } else if (state.userProfile && state.userProfile.points != null) {
                const userPoints = state.userProfile.points;
                const lastRank = data.length;
                const lastUser = data[data.length - 1];
                const pointsNeeded = lastUser ? (lastUser.points - userPoints + 1) : 0;
                const myTrueRank = myData ? myData.rank : '?';
                myRankHtml = `
                <div class="my-rank-card" style="background:var(--bg-surface);border:2px dashed var(--color-primary);padding:16px 20px;border-radius:12px;margin:20px 0;text-align:center;">
                    <div style="font-size:0.9rem;color:var(--text-muted);">ØªØ±ØªÙŠØ¨Ùƒ Ø§Ù„Ø­Ø§Ù„ÙŠ: #${myTrueRank}</div>
                    <div style="font-size:1rem;margin:6px 0;color:var(--text-main);">
                        Ø±ØµÙŠØ¯Ùƒ: <strong>${userPoints.toLocaleString()}</strong> Ù†Ù‚Ø·Ø©
                    </div>
                    ${pointsNeeded > 0 ? `<div style="font-size:0.85rem;color:var(--color-secondary);">
                        ÙŠÙ†Ù‚ØµÙƒ <strong>${pointsNeeded.toLocaleString()}</strong> Ù†Ù‚Ø·Ø© Ù„Ø¯Ø®ÙˆÙ„ Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ù…Ø§Ø¦Ø©
                    </div>` : ''}
                    ${lastUser ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">
                        ØµØ§Ø­Ø¨ Ø§Ù„Ù…Ø±ÙƒØ² #${lastRank} Ù„Ø¯ÙŠÙ‡ ${lastUser.points.toLocaleString()} Ù†Ù‚Ø·Ø©
                    </div>` : ''}
                </div>`;
            }
        }
        
        const displayData = data.slice(0, 100);
        const top3 = displayData.slice(0, 3);
        const rest = displayData.slice(3);
        
        const medalEmojis = ['ðŸ¥‡', 'ðŸ¥ˆ', 'ðŸ¥‰'];
        const stickers = ['âœ¦', 'âœ§', 'â­', 'ðŸ’«', 'âœ¨'];
        const tabs = [
            { key: 'all', label: 'ÙƒÙ„ Ø§Ù„ÙˆÙ‚Øª' },
            { key: 'monthly', label: 'Ø´Ù‡Ø±ÙŠ' },
            { key: 'weekly', label: 'Ø£Ø³Ø¨ÙˆØ¹ÙŠ' }
        ];
        const activeTab = state.leaderboardTab || 'all';
        
        const flt = (s) => `<span style="position:absolute;font-size:${1.5 + Math.random() * 1.5}rem;opacity:${0.2 + Math.random() * 0.3};color:var(--color-primary);pointer-events:none;user-select:none;${s}">${['â˜…','âœ¦','âœ§','â­','ðŸ’«','âœ¨','âš¡','ðŸ”¥','ðŸ’Ž','ðŸŽ¯'][Math.floor(Math.random()*10)]}</span>`;
        return `
        <div class="leaderboard-page" style="position:relative;overflow:hidden;">
            ${flt('top:5%;left:3%;')}${flt('top:12%;right:5%;')}${flt('top:25%;left:6%;')}${flt('top:40%;right:3%;')}${flt('top:55%;left:4%;')}${flt('top:70%;right:6%;')}${flt('top:85%;left:5%;')}${flt('top:15%;right:8%;')}${flt('top:30%;left:8%;')}${flt('top:50%;right:4%;')}
            <div class="leaderboard-header">
                <h1><i class="fa-solid fa-trophy" style="color: #ffd700;"></i> Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ù…ØªØµØ¯Ø±ÙŠÙ†</h1>
                <p>Ø£ÙƒØ«Ø± Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…ÙŠÙ† Ù†Ø´Ø§Ø·Ø§Ù‹ Ø¹Ù„Ù‰ KAIRO/Ù…Ù†Ù‡ÙˆØ§</p>
            </div>
            
            <div class="bookmarks-tabs" style="justify-content:center;margin-bottom:20px;">
                ${tabs.map(t => `
                    <button class="bookmark-tab lb-tab ${activeTab === t.key ? 'active' : ''}" data-tab="${t.key}">${t.label}</button>
                `).join('')}
            </div>
            
            ${myRankHtml}
            
            <div class="leaderboard-podium">
                ${top3.length > 1 ? `<div class="podium-item second">
                    <div class="podium-avatar">${getUserInitial(data[1].username)}</div>
                    <div class="podium-rank">${medalEmojis[1]}</div>
                    <div class="podium-name">${data[1].username}</div>
                    <div class="podium-points">${data[1].points.toLocaleString()}</div>
                    <span class="podium-sticker">${stickers[1]}</span>
                </div>` : ''}
                ${top3.length > 0 ? `<div class="podium-item first">
                    <div class="podium-avatar">${getUserInitial(data[0].username)}</div>
                    <div class="podium-rank">${medalEmojis[0]}</div>
                    <div class="podium-name">${data[0].username}</div>
                    <div class="podium-points">${data[0].points.toLocaleString()}</div>
                    <div class="podium-crown"><i class="fa-solid fa-crown"></i></div>
                    <span class="podium-sticker">${stickers[0]}</span>
                </div>` : ''}
                ${top3.length > 2 ? `<div class="podium-item third">
                    <div class="podium-avatar">${getUserInitial(data[2].username)}</div>
                    <div class="podium-rank">${medalEmojis[2]}</div>
                    <div class="podium-name">${data[2].username}</div>
                    <div class="podium-points">${data[2].points.toLocaleString()}</div>
                    <span class="podium-sticker">${stickers[2]}</span>
                </div>` : ''}
            </div>
            
            <div class="leaderboard-table">
                ${rest.map(u => `
                    <div class="leaderboard-row" data-username="${u.username}">
                        <span class="lb-rank">#${u.rank}</span>
                        <span class="lb-avatar" style="background:${getRankColor(u.level)}">${getUserInitial(u.username)}</span>
                        <span class="lb-name">${u.username}</span>
                        <span class="lb-rank-name">${u.rank_name}</span>
                        <span class="lb-stats">${u.chapters_read} ÙØµÙ„</span>
                        <span class="lb-points">${u.points.toLocaleString()} <i class="fa-solid fa-star" style="font-size:0.6rem;"></i></span>
                    </div>
                `).join('')}
            </div>
            <div style="text-align:center;margin-top:24px;">
                <button class="header-logo" id="lb-home-btn" style="background:none;border:none;cursor:pointer;font-size:1.2rem;color:var(--color-secondary);">â† Ø§Ù„Ø¹ÙˆØ¯Ø© Ù„Ù„Ø±Ø¦ÙŠØ³ÙŠØ©</button>
            </div>
        </div>
        `;
    } catch (e) {
        console.error('Leaderboard error:', e);
        return '<div class="empty-state"><p>Ø­Ø¯Ø« Ø®Ø·Ø£ ÙÙŠ ØªØ­Ù…ÙŠÙ„ Ø§Ù„Ù…ØªØµØ¯Ø±ÙŠÙ†</p></div>';
    }
}

function formatNotificationTime(timestamp) {
    if (!timestamp) return '';
    const diff = Date.now() / 1000 - timestamp;
    if (diff < 60) return 'Ø§Ù„Ø¢Ù†';
    if (diff < 3600) return Math.floor(diff / 60) + ' Ø¯Ù‚ÙŠÙ‚Ø©';
    if (diff < 86400) return Math.floor(diff / 3600) + ' Ø³Ø§Ø¹Ø©';
    return Math.floor(diff / 86400) + ' ÙŠÙˆÙ…';
}

// Frontend safety: enforce admin only for the designated email
function enforceAdminRole() {
    if (state.userEmail !== 'sherifahmed2686@gmail.com') {
        state.userRole = 'user';
    }
}

// ==========================================
// 4.5. Ø§Ù„ØªÙˆØ«ÙŠÙ‚ Ø§Ù„Ø§Ø¬ØªÙ…Ø§Ø¹ÙŠ (Google & Facebook OAuth)
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
            state.userRole = result.role || 'user';
            enforceAdminRole();
            if (result.points !== undefined) state.userProfile.points = result.points;
            if (result.level !== undefined) state.userProfile.level = result.level;
            if (result.username) state.userProfile.username = result.username;
            state.saveUserProfile();
            await state.fetchAndMergeSettings();
            state.showAuthModal = false;
            state.checkDailyReward();
            renderApp();
            alert(`Ø£Ù‡Ù„Ø§Ù‹ Ø¨Ùƒ! ØªÙ… ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø¨Ù†Ø¬Ø§Ø­ Ø¹Ø¨Ø± Google Ø¨Ø§Ø³Ù… ${result.email.split('@')[0]}`);
        } else {
            alert(result.error || 'ÙØ´Ù„ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø¨Ù€ Google');
        }
    } catch (e) {
        console.error("Google Auth error:", e);
        alert('Ø®Ø·Ø£ ÙÙŠ Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù… Ø£Ø«Ù†Ø§Ø¡ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø¨Ù€ Google');
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
            state.userRole = result.role || 'user';
            enforceAdminRole();
            if (result.points !== undefined) state.userProfile.points = result.points;
            if (result.level !== undefined) state.userProfile.level = result.level;
            if (result.username) state.userProfile.username = result.username;
            state.saveUserProfile();
            await state.fetchAndMergeSettings();
            state.showAuthModal = false;
            state.checkDailyReward();
            renderApp();
            alert(`Ø£Ù‡Ù„Ø§Ù‹ Ø¨Ùƒ! ØªÙ… ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø¨Ù†Ø¬Ø§Ø­ Ø¹Ø¨Ø± Google Ø¨Ø§Ø³Ù… ${result.email.split('@')[0]}`);
        } else {
            alert(result.error || 'ÙØ´Ù„ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø¨Ù€ Google');
        }
    } catch (e) {
        console.error("Google access token verification error:", e);
        alert('Ø®Ø·Ø£ ÙÙŠ Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø³ÙŠØ±ÙØ± Ø£Ø«Ù†Ø§Ø¡ Ø§Ù„ØªØ­Ù‚Ù‚ Ù…Ù† Ø­Ø³Ø§Ø¨ Google');
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
            state.userRole = result.role || 'user';
            enforceAdminRole();
            if (result.points !== undefined) state.userProfile.points = result.points;
            if (result.level !== undefined) state.userProfile.level = result.level;
            state.saveUserProfile();
            await state.fetchAndMergeSettings();
            state.showAuthModal = false;
            renderApp();
            alert(`Ø£Ù‡Ù„Ø§Ù‹ Ø¨Ùƒ! ØªÙ… ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø¨Ù†Ø¬Ø§Ø­ Ø¹Ø¨Ø± Facebook Ø¨Ø§Ø³Ù… ${result.email.split('@')[0]}`);
        } else {
            alert(result.error || 'ÙØ´Ù„ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø¨Ù€ Facebook');
        }
    } catch (e) {
        console.error("Facebook access token verification error:", e);
        alert('Ø®Ø·Ø£ ÙÙŠ Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø³ÙŠØ±ÙØ± Ø£Ø«Ù†Ø§Ø¡ Ø§Ù„ØªØ­Ù‚Ù‚ Ù…Ù† Ø­Ø³Ø§Ø¨ Facebook');
    }
}

function handleFacebookLoginClick() {
    if (typeof FB === 'undefined') {
        alert("Ù…ÙƒØªØ¨Ø© Ø§Ù„ÙÙŠØ³Ø¨ÙˆÙƒ Ù„Ù… ÙŠØªÙ… ØªØ­Ù…ÙŠÙ„Ù‡Ø§ Ø¨Ø¹Ø¯. ÙŠØ±Ø¬Ù‰ Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø© Ù…Ø±Ø© Ø£Ø®Ø±Ù‰.");
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
    // 1. ØªÙ‡ÙŠØ¦Ø© Google Sign-In & One Tap
    googleTokenClient = null;
    if (isUsableGoogleClientId()) {
        if (typeof google === 'undefined') {
            // Google library not yet loaded, retry after it loads
            const checkGoogle = setInterval(() => {
                if (typeof google !== 'undefined') {
                    clearInterval(checkGoogle);
                    initGoogleAuth();
                }
            }, 200);
            setTimeout(() => clearInterval(checkGoogle), 15000);
        } else {
            initGoogleAuth();
        }
    }

    function initGoogleAuth() {
        try {
            google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: handleGoogleLogin,
                auto_select: false
            });
            
            if (!state.sessionToken) {
                google.accounts.id.prompt();
            }
            
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

    // 2. ØªÙ‡ÙŠØ¦Ø© Facebook SDK ÙˆØªØ­Ù…ÙŠÙ„Ù‡Ø§ ØªÙ„Ù‚Ø§Ø¦ÙŠØ§Ù‹
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
// 5. Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ø£Ø­Ø¯Ø§Ø« ÙˆØ§Ù„Ø§ØªØµØ§Ù„ Ù…Ø¹ Ø§Ù„Ù€ DOM (Events Binding)
// ==========================================

function attachEventListeners() {
    // ØªÙØ¹ÙŠÙ„ Ø´Ø¹Ø§Ø± Ø§Ù„Ù…ÙˆÙ‚Ø¹
    const logoBtn = document.getElementById('logo-btn');
    if (logoBtn) logoBtn.onclick = () => {
        state.searchQuery = '';
        state.activeGenre = 'Ø§Ù„ÙƒÙ„';
        navigate('home');
    };

    // Ø±ÙˆØ§Ø¨Ø· Ø§Ù„ØªÙ†Ù‚Ù„
    const navHome = document.getElementById('nav-home');
    if (navHome) navHome.onclick = () => {
        state.activeGenre = 'Ø§Ù„ÙƒÙ„';
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
        if (state.sessionToken && state.userEmail) navigate('profile', state.userEmail);
    };

    const navSettingsBtn = document.getElementById('nav-settings-btn');
    if (navSettingsBtn) navSettingsBtn.onclick = () => {
        state.showSettingsModal = true;
        renderApp();
    };

    const navCommunity = document.getElementById('nav-community');
    const communityDropdown = document.getElementById('community-dropdown');
    if (navCommunity && communityDropdown) {
        navCommunity.onclick = (e) => {
            e.stopPropagation();
            const dd = document.getElementById('community-dropdown');
            if (dd) dd.style.display = dd.style.display === 'flex' ? 'none' : 'flex';
        };
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#nav-community') && !e.target.closest('#community-dropdown')) {
                const dd = document.getElementById('community-dropdown');
                if (dd) dd.style.display = 'none';
            }
        });
    }

    function closeCommunityDropdown() {
        const dd = document.getElementById('community-dropdown');
        if (dd) dd.style.display = 'none';
    }

    const navLeaderboard = document.getElementById('nav-leaderboard');
    if (navLeaderboard) navLeaderboard.onclick = () => { closeCommunityDropdown(); navigate('leaderboard'); };

    const navStore = document.getElementById('nav-store');
    if (navStore) navStore.onclick = () => { closeCommunityDropdown(); navigate('store'); };

    const navAnnouncements = document.getElementById('nav-announcements');
    if (navAnnouncements) navAnnouncements.onclick = () => { closeCommunityDropdown(); navigate('announcements'); };

    const navChat = document.getElementById('nav-chat');
    if (navChat) navChat.onclick = () => { closeCommunityDropdown(); navigate('chat'); };

    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatInput = document.getElementById('chat-input');
    const doSendChat = () => {
        if (!chatInput || !chatInput.value.trim()) return;
        const msgs = document.getElementById('chat-messages');
        if (msgs) {
            const div = document.createElement('div');
            div.className = 'chat-msg mine';
            div.innerHTML = `<div>${escapeHtml(chatInput.value.trim())}</div><div class="chat-time">${new Date().toLocaleTimeString('ar-EG', {hour:'2-digit',minute:'2-digit'})}</div>`;
            msgs.appendChild(div);
            msgs.scrollTop = msgs.scrollHeight;
        }
        chatInput.value = '';
    };
    if (chatSendBtn) chatSendBtn.onclick = doSendChat;
    if (chatInput) chatInput.onkeydown = (e) => { if (e.key === 'Enter') doSendChat(); };

    const closeAdminBtn = document.getElementById('close-admin-btn');
    if (closeAdminBtn) closeAdminBtn.onclick = () => navigate('home');

    const navAdmin = document.getElementById('nav-admin');
    if (navAdmin) navAdmin.onclick = () => navigate('admin');

    // Ø´Ø±ÙŠØ· Ø§Ù„Ø¨Ø­Ø« ÙˆÙ…Ù‚ØªØ±Ø­Ø§Øª Ø§Ù„Ø¨Ø­Ø«
    const searchInput = document.getElementById('search-input');
    const searchBox = document.getElementById('search-box');
    if (searchInput) {
        searchInput.onfocus = () => {
            if (state.searchQuery && state.searchQuery.trim() !== '') {
                state.showSearchSuggestions = true;
            }
        };

        searchInput.oninput = (e) => {
            state.searchQuery = e.target.value;
            state.showSearchSuggestions = e.target.value.trim() !== '';
            if (window._searchTimer) clearTimeout(window._searchTimer);
            window._searchTimer = setTimeout(() => renderApp(), 250);
        };

        searchInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                state.showSearchSuggestions = false;
                state.searchPage = 1;
                navigate('search', state.searchQuery, state.searchViewMode || 'grid');
            } else if (e.key === 'Escape') {
                state.showSearchSuggestions = false;
                renderApp();
            }
        };
    }

    // Ø²Ø± Ù…Ø³Ø­ Ø§Ù„Ø¨Ø­Ø«
    const searchClearBtn = document.getElementById('search-clear-btn');
    if (searchClearBtn) {
        searchClearBtn.onclick = () => {
            state.searchQuery = '';
            state.showSearchSuggestions = false;
            renderApp();
            if (searchInput) searchInput.focus();
        };
    }

    // Ø¥ØºÙ„Ø§Ù‚ Ø§Ù„Ù‚Ø§Ø¦Ù…Ø© Ø¹Ù†Ø¯ Ø§Ù„Ù†Ù‚Ø± Ø®Ø§Ø±Ø¬Ù‡Ø§
    document.addEventListener('click', (e) => {
        if (searchBox && !searchBox.contains(e.target) && state.showSearchSuggestions) {
            state.showSearchSuggestions = false;
        }
    });

    // Ø§Ù„Ù†Ù‚Ø± Ø¹Ù„Ù‰ Ù…Ù‚ØªØ±Ø­ Ø¨Ø­Ø«
    const suggestionItems = document.querySelectorAll('.suggestion-item');
    suggestionItems.forEach(item => {
        item.onclick = (e) => {
            e.stopPropagation();
            const action = e.currentTarget.dataset.action;
            const id = e.currentTarget.dataset.id;
            state.showSearchSuggestions = false;
            if (action === 'manga' && id) {
                state.searchQuery = '';
                navigate('detail', id);
            } else if (action === 'search') {
                state.searchPage = 1;
                navigate('search', state.searchQuery, state.searchViewMode || 'grid');
            }
        };
    });


    // ØªØµÙÙŠØ© Ø§Ù„ØªØµÙ†ÙŠÙØ§Øª
    const genreTags = document.querySelectorAll('.genre-tag');
    genreTags.forEach(tag => {
        tag.onclick = (e) => {
            const genre = e.target.dataset.genre || e.target.textContent.trim();
            if (genre) {
                state.activeGenre = genre;
                const homeLayout = document.querySelector('.homepage-layout');
                if (homeLayout) {
                    const cards = homeLayout.querySelectorAll('.manga-card');
                    cards.forEach(card => {
                        const genres = card.dataset.genres || '';
                        const match = genre === 'Ø§Ù„ÙƒÙ„' || genres.split(',').includes(genre);
                        card.style.display = match ? '' : 'none';
                    });
                    // Update active genre visual
                    document.querySelectorAll('.genre-tag').forEach(t => t.classList.remove('active'));
                    e.currentTarget.classList.add('active');
                    window.scrollTo(0, 0);
                } else {
                    if (state.currentView !== 'home') {
                        navigate('home');
                    } else {
                        renderApp();
                    }
                    window.scrollTo(0, 0);
                }
            }
        };
    });

    // Ø§Ù„Ø³Ù„Ø§ÙŠØ¯Ø± Ø§Ù„Ø¨Ø§Ù†Ø±
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

    // Ø§Ù„Ø¶ØºØ· Ø¹Ù„Ù‰ Ø¨Ø·Ø§Ù‚Ø© Ù…Ø§Ù†Ø¬Ø§ Ù„ÙØªØ­Ù‡Ø§
    const mangaCards = document.querySelectorAll('.manga-card');
    mangaCards.forEach(card => {
        card.onclick = () => {
            const id = card.dataset.id;
            navigate('detail', id);
        };
    });

    // Ø§Ù„Ø¶ØºØ· Ø¹Ù„Ù‰ Ø³Ø¬Ù„Ø§Øª Ø§Ù„Ù‚Ø±Ø§Ø¡Ø© Ù„Ø§Ø³ØªØ¦Ù†Ø§Ù Ø§Ù„Ù‚Ø±Ø§Ø¡Ø©
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

    // Ø£Ø­Ø¯Ø§Ø« ØµÙØ­Ø© Ø§Ù„Ø³Ø¬Ù„ Ø§Ù„ØªÙØµÙŠÙ„ÙŠ: Ø²Ø± Ù…ØªØ§Ø¨Ø¹Ø© Ø§Ù„Ù‚Ø±Ø§Ø¡Ø©
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

    // Ø£Ø­Ø¯Ø§Ø« ØµÙØ­Ø© Ø§Ù„Ø³Ø¬Ù„ Ø§Ù„ØªÙØµÙŠÙ„ÙŠ: Ø²Ø± Ø­Ø°Ù Ø¹Ù…Ù„ Ù…Ù† Ø§Ù„Ø³Ø¬Ù„
    const deleteHistoryEntryBtns = document.querySelectorAll('.delete-history-entry-btn');
    deleteHistoryEntryBtns.forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const mId = btn.dataset.mangaId;
            if (confirm("Ù‡Ù„ ØªØ±ÙŠØ¯ Ø¥Ø²Ø§Ù„Ø© Ù‡Ø°Ø§ Ø§Ù„Ø¹Ù…Ù„ Ù…Ù† Ø³Ø¬Ù„ Ø§Ù„Ù…Ø´Ø§Ù‡Ø¯Ø©ØŸ")) {
                state.history = state.history.filter(h => h.mangaId !== mId);
                state.saveHistory();
                renderApp();
            }
        };
    });

    // Ø§Ù„Ø¶ØºØ· Ø¹Ù„Ù‰ Ø§Ù„Ø£ÙƒØ«Ø± Ø´Ø¹Ø¨ÙŠØ©
    const trendingItems = document.querySelectorAll('.trending-item');
    trendingItems.forEach(item => {
        item.onclick = () => {
            const id = item.dataset.id;
            navigate('detail', id);
        };
    });

    // ØµÙØ­Ø© Ø§Ù„ØªÙØ§ØµÙŠÙ„: Ø­Ø¬Ø² Ø§Ù„Ù…ÙØ¶Ù„Ø©
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
                const newStatus = option.dataset.status || '';
                setBookmarkStatus(picker.dataset.id, newStatus);
                picker.classList.remove('open');
                toggle.setAttribute('aria-expanded', 'false');
                
                // Update DOM dynamically instead of renderApp()
                const newMeta = getBookmarkStatusMeta(newStatus);
                const iconSpan = toggle.querySelector('.bookmark-picker-icon');
                const labelSpan = toggle.querySelector('.bookmark-picker-label');
                
                if (newStatus) {
                    toggle.classList.add('is-selected');
                } else {
                    toggle.classList.remove('is-selected');
                }
                
                iconSpan.className = `bookmark-picker-icon ${newMeta.tone}`;
                iconSpan.innerHTML = `<i class="${newMeta.icon}"></i>`;
                labelSpan.innerText = newMeta.label;
            };
        });
    });

    // ØµÙØ­Ø© Ø§Ù„ØªÙØ§ØµÙŠÙ„: Ø§Ù„Ø¶ØºØ· Ø¹Ù„Ù‰ Ù‚Ø±Ø§Ø¡Ø© Ø£ÙˆÙ„ ÙØµÙ„
    const startReadingBtn = document.querySelector('.start-reading-btn');
    if (startReadingBtn) {
        startReadingBtn.onclick = () => {
            const chapId = startReadingBtn.dataset.chapId;
            navigate('reader', state.activeMangaId, chapId);
        };
    }

    // ØµÙØ­Ø© Ø§Ù„ØªÙØ§ØµÙŠÙ„: Ø§Ù„Ø¶ØºØ· Ø¹Ù„Ù‰ Ù…ØªØ§Ø¨Ø¹Ø© Ø§Ù„Ù‚Ø±Ø§Ø¡Ø©
    const continueReadingBtn = document.querySelector('.continue-reading-btn');
    if (continueReadingBtn) {
        continueReadingBtn.onclick = () => {
            const chapId = continueReadingBtn.dataset.chapId;
            navigate('reader', state.activeMangaId, chapId);
        };
    }

    // ØµÙØ­Ø© Ø§Ù„ØªÙØ§ØµÙŠÙ„: Ø§Ù„Ø¶ØºØ· Ø¹Ù„Ù‰ ÙØµÙ„ Ù„Ù‚Ø±Ø§Ø¡ØªÙ‡
    const chapterItems = document.querySelectorAll('.chapter-item');
    chapterItems.forEach(item => {
        item.onclick = (e) => {
            if (e.target.closest('.download-btn') || e.target.closest('.delete-download-btn')) return;
            const chapId = item.dataset.chapId;
            const mId = item.dataset.mangaId || state.activeMangaId;
            navigate('reader', mId, chapId);
        };
    });

    // ØµÙØ­Ø© Ø§Ù„ØªÙØ§ØµÙŠÙ„: Ø§Ù„Ø¨Ø­Ø« Ø¹Ù† ÙØµÙ„
    const chaptersSearch = document.getElementById('chapters-search-input');
    if (chaptersSearch) {
        chaptersSearch.oninput = (e) => {
            state.chapterSearchQuery = e.target.value;
            const query = e.target.value.trim();
            const container = document.querySelector('.chapters-list');
            if (!container) return;
            const items = container.querySelectorAll('.chapter-item');
            const qNums = query.replace(/[^0-9]/g, '');
            let visibleCount = 0;
            items.forEach(item => {
                const id = item.dataset.chapId || '';
                const badge = item.querySelector('.chapter-item-badge');
                const subtitle = item.querySelector('.chapter-item-subtitle');
                const titleText = (badge ? badge.textContent.replace(/[^0-9]/g, '') : '');
                const subtitleText = subtitle ? subtitle.textContent.toLowerCase() : '';
                const fullText = id.toLowerCase() + ' ' + (badge ? badge.textContent.toLowerCase() : '') + ' ' + subtitleText;
                let match = false;
                if (!query) {
                    match = true;
                } else if (qNums) {
                    const chNums = id.replace(/[^0-9]/g, '');
                    match = chNums.includes(qNums);
                    if (!match) match = fullText.includes(query.toLowerCase());
                } else {
                    match = fullText.includes(query.toLowerCase());
                }
                item.style.display = match ? '' : 'none';
                if (match) visibleCount++;
            });
            let noResult = container.querySelector('.chapters-search-noresult');
            if (visibleCount === 0 && query) {
                if (!noResult) {
                    noResult = document.createElement('p');
                    noResult.className = 'chapters-search-noresult';
                    noResult.style.cssText = 'padding: 20px; color: var(--text-dark); text-align: center;';
                    noResult.textContent = 'Ù„Ø§ ØªÙˆØ¬Ø¯ ÙØµÙˆÙ„ ØªØ·Ø§Ø¨Ù‚ Ø§Ù„Ø¨Ø­Ø«.';
                    container.appendChild(noResult);
                }
            } else if (noResult) {
                noResult.remove();
            }
        };
    }

    // ØµÙØ­Ø© Ø§Ù„ØªÙØ§ØµÙŠÙ„: Ø²Ø± ØªØ­Ù…ÙŠÙ„ Ø§Ù„ÙØµÙ„ Ù„Ù„Ø£ÙˆÙÙ„Ø§ÙŠÙ†
    const downloadBtns = document.querySelectorAll('.download-btn');
    downloadBtns.forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const chapId = btn.dataset.chapId;
            const mangaId = state.activeMangaId;
            const key = `${mangaId}_${chapId}`;

            const isDownloaded = btn.classList.contains('downloaded');
            if (isDownloaded) {
                if (confirm("Ù‡Ù„ ØªØ±ÙŠØ¯ Ø¥Ø²Ø§Ù„Ø© Ù‡Ø°Ø§ Ø§Ù„ÙØµÙ„ Ù…Ù† Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„ØªØ­Ù…ÙŠÙ„Ø§ØªØŸ")) {
                    await deleteChapterOffline(mangaId, chapId);
                    renderApp();
                }
                return;
            }

            btn.classList.add('loading');
            btn.disabled = true;
            state.downloadProgress[key] = 0;
            
            const mangaObj = state.mangas.find(m => m.id === mangaId);
            if (!mangaObj) { btn.classList.remove('loading'); btn.disabled = false; return; }
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

    // Ù…Ø±ÙƒØ² Ø§Ù„ØªØ­Ù…ÙŠÙ„Ø§Øª: Ø­Ø°Ù  Ø§Ù„Ù ØµÙ„
    const deleteDownloadBtns = document.querySelectorAll('.delete-download-btn');
    deleteDownloadBtns.forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const mangaId = btn.dataset.mangaId;
            const chapId = btn.dataset.chapId;
            if (confirm("Ù‡Ù„ ØªØ±ÙŠØ¯ Ø¥Ø²Ø§Ù„Ø© Ù‡Ø°Ø§ Ø§Ù„Ù ØµÙ„ Ø§Ù„Ù…Ø­Ù…Ù„ØŸ")) {
                await deleteChapterOffline(mangaId, chapId);
                renderApp();
            }
        };
    });

    // Ø§Ù„Ø¥Ø¯Ø§Ø±Ø©: Ø­Ø°Ù Ù…Ù†Ù‡ÙˆØ§ (Admin Only)
    const deleteMangaBtns = document.querySelectorAll('.delete-manga-admin-btn');
    deleteMangaBtns.forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const mangaId = btn.dataset.id;
            if (!confirm("Ù‡Ù„ Ø£Ù†Øª Ù…ØªØ£ÙƒØ¯ Ù…Ù† Ø­Ø°Ù Ù‡Ø°Ù‡ Ø§Ù„Ù…Ù†Ù‡ÙˆØ§ Ø¨Ø§Ù„ÙƒØ§Ù…Ù„ØŸ\nÙ‡Ø°Ø§ Ø§Ù„Ø¥Ø¬Ø±Ø§Ø¡ Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø§Ù„ØªØ±Ø§Ø¬Ø¹ Ø¹Ù†Ù‡.")) return;
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
                    alert(result.error || 'ÙØ´Ù„ Ø§Ù„Ø­Ø°Ù');
                }
            } catch (err) {
                alert('Ø®Ø·Ø£ ÙÙŠ Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù…');
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

    // Ø§Ù„Ù…ÙØ¶Ù„Ø©: ØªØ¨Ø¯ÙŠÙ„ Ø§Ù„ØªØ¨ÙˆÙŠØ¨Ø§Øª
    const bookmarkTabs = document.querySelectorAll('.bookmark-tab');
    bookmarkTabs.forEach(tab => {
        tab.onclick = (e) => {
            state.activeGenre = e.target.dataset.tab;
            renderApp();
        };
    });

    // Ø§Ù„Ù‚Ø§Ø±Ø¦: Ø§Ù„Ø¹ÙˆØ¯Ø© Ù„ØµÙØ­Ø© ØªÙØ§ØµÙŠÙ„ Ø§Ù„Ù…Ø§Ù†Ø¬Ø§
    const returnBtns = document.querySelectorAll('.return-to-manga');
    returnBtns.forEach(btn => {
        btn.onclick = () => {
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Ø¬Ø§Ø±ÙŠ Ø§Ù„Ø±Ø¬ÙˆØ¹...</span>';
            btn.style.pointerEvents = 'none';
            setTimeout(() => {
                navigate('detail', state.activeMangaId);
            }, 50);
        };
    });

    // Fullscreen toggle
    const fsBtn = document.getElementById('reader-fullscreen-btn');
    if (fsBtn) {
        fsBtn.onclick = () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen?.();
                fsBtn.innerHTML = '<i class="fa-solid fa-compress"></i> Ø¥Ù†Ù‡Ø§Ø¡ Ø§Ù„Ù…Ù„Ø¡';
            } else {
                document.exitFullscreen?.();
                fsBtn.innerHTML = '<i class="fa-solid fa-expand"></i> Ù…Ù„Ø¡ Ø§Ù„Ø´Ø§Ø´Ø©';
            }
        };
        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement) fsBtn.innerHTML = '<i class="fa-solid fa-expand"></i> Ù…Ù„Ø¡ Ø§Ù„Ø´Ø§Ø´Ø©';
        });
    }

    // Strip mode toggle
    const stripBtn = document.getElementById('reader-strip-toggle');
    if (stripBtn) {
        stripBtn.onclick = () => {
            const wrapper = document.querySelector('.reader-wrapper');
            if (wrapper) wrapper.classList.toggle('reader-strip-mode');
            stripBtn.classList.toggle('active');
        };
    }

    // Zoom controls for reader
    const zoomInBtn = document.getElementById('reader-zoom-in');
    const zoomOutBtn = document.getElementById('reader-zoom-out');
    const zoomResetBtn = document.getElementById('reader-zoom-reset');
    let currentZoom = 1;
    const applyZoom = () => {
        document.querySelectorAll('.reader-image-container img').forEach(img => {
            img.style.transform = `scale(${currentZoom})`;
            img.style.transformOrigin = 'center top';
        });
        document.querySelectorAll('.reader-image-container').forEach(c => {
            if (currentZoom !== 1) c.classList.add('zoomed');
            else c.classList.remove('zoomed');
        });
    };
    if (zoomInBtn) zoomInBtn.onclick = () => { currentZoom = Math.min(3, currentZoom + 0.25); applyZoom(); };
    if (zoomOutBtn) zoomOutBtn.onclick = () => { currentZoom = Math.max(0.5, currentZoom - 0.25); applyZoom(); };
    if (zoomResetBtn) zoomResetBtn.onclick = () => { currentZoom = 1; applyZoom(); };

    // Click-to-toggle zoom on images
    document.querySelectorAll('.reader-image-container img').forEach(img => {
        img.onclick = () => {
            if (currentZoom !== 1) { currentZoom = 1; applyZoom(); return; }
            currentZoom = 2;
            applyZoom();
        };
    });

    // Drag-to-pan when zoomed
    let isPanning = false, startX, startY, scrollLeft, scrollTop;
    const readerContent = document.querySelector('.reader-content-images');
    if (readerContent) {
        readerContent.addEventListener('mousedown', (e) => {
            if (currentZoom === 1) return;
            isPanning = true;
            startX = e.clientX;
            startY = e.clientY;
            scrollLeft = readerContent.scrollLeft;
            scrollTop = readerContent.scrollTop;
        });
        document.addEventListener('mousemove', (e) => {
            if (!isPanning) return;
            readerContent.scrollLeft = scrollLeft - (e.clientX - startX);
            readerContent.scrollTop = scrollTop - (e.clientY - startY);
        });
        document.addEventListener('mouseup', () => { isPanning = false; });
    }

    // Pinch-to-zoom for reader images
    const readerWrapper2 = document.querySelector('.reader-wrapper');
    if (readerWrapper2) {
        let lastDist = 0;
        readerWrapper2.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) lastDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        }, { passive: true });
        readerWrapper2.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
                currentZoom = Math.min(3, Math.max(0.5, currentZoom * (dist / lastDist)));
                lastDist = dist;
                applyZoom();
            }
        }, { passive: true });
    }

    // Keyboard shortcuts for reader
    if (state.currentView === 'reader') {
        document.onkeydown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            const manga = state.mangas.find(m => m.id === state.activeMangaId);
            if (!manga) return;
            const idx = manga.chapters.findIndex(c => normalizeChapterId(c.id) === normalizeChapterId(state.activeChapterId));
            if (idx === -1) return;
            if (e.key === 'ArrowRight' || e.key === 'Escape') {
                if (e.key === 'Escape') { navigate('detail', state.activeMangaId); return; }
                e.preventDefault();
                if (idx > 0) navigate('reader', state.activeMangaId, manga.chapters[idx - 1].id);
            } else if (e.key === 'ArrowLeft' && idx < manga.chapters.length - 1) {
                e.preventDefault();
                navigate('reader', state.activeMangaId, manga.chapters[idx + 1].id);
            } else if (e.key === 'f' || e.key === 'F') {
                if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
                else document.exitFullscreen?.();
            }
        };
    } else {
        document.onkeydown = null;
    }

    // Ø§Ù„Ù‚Ø§Ø±Ø¦: Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ù…Ù†Ø³Ø¯Ù„Ø© Ø§Ù„Ù…Ø®ØµØµØ© Ù„Ù„ÙØµÙˆÙ„
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

        // Ù…Ù†Ø¹ Ø¥ØºÙ„Ø§Ù‚ Ø§Ù„Ù‚Ø§Ø¦Ù…Ø© Ø¹Ù†Ø¯ Ø§Ù„Ø¶ØºØ· Ø¯Ø§Ø®Ù„ Ù…Ø±Ø¨Ø¹ Ø§Ù„Ø¨Ø­Ø«
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

        // Ø§Ø®ØªÙŠØ§Ø± ÙØµÙ„ Ù…Ù† Ø§Ù„Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ù…Ø®ØµØµØ©
        const options = dropdown.querySelectorAll('.dropdown-item-opt');
        options.forEach(opt => {
            opt.onclick = (e) => {
                e.stopPropagation();
                const val = opt.dataset.value;
                dropdown.classList.remove('open');
                navigate('reader', state.activeMangaId, val);
            };
        });

        // Ø¥ØºÙ„Ø§Ù‚ Ø§Ù„Ù…Ù†Ø³Ø¯Ù„Ø© Ø¹Ù†Ø¯ Ø§Ù„Ø¶ØºØ· ÙÙŠ Ø£ÙŠ Ù…ÙƒØ§Ù† Ø¢Ø®Ø± Ø¨Ø§Ù„ØµÙØ­Ø©
        document.addEventListener('click', (e) => {
            if (dropdown && !dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
            }
        });
    }

    // Ø§Ù„Ù‚Ø§Ø±Ø¦: Ø§Ù„ÙØµÙ„ Ø§Ù„Ø³Ø§Ø¨Ù‚
    const prevBtns = document.querySelectorAll('.prev-chapter-btn');
    prevBtns.forEach(btn => {
        if (!btn.classList.contains('disabled')) {
        const manga = state.mangas.find(m => m.id === state.activeMangaId);
        if (!manga) return;
        const chapterIndex = manga.chapters.findIndex(c => normalizeChapterId(c.id) === normalizeChapterId(state.activeChapterId));
        if (chapterIndex < manga.chapters.length - 1) {
            btn.onclick = () => {
                const prevChapId = manga.chapters[chapterIndex + 1].id;
                state.activeChapterId = prevChapId;
                state.activePageIndex = 0;
                renderReaderContent();
                window.scrollTo(0, 0);
            };
        }
    }
    });

    // Ø§Ù„Ù‚Ø§Ø±Ø¦: Ø§Ù„ÙØµÙ„ Ø§Ù„ØªØ§Ù„ÙŠ
    const nextBtns = document.querySelectorAll('.next-chapter-btn');
    nextBtns.forEach(btn => {
        if (!btn.classList.contains('disabled')) {
        const manga = state.mangas.find(m => m.id === state.activeMangaId);
        if (!manga) return;
        const chapterIndex = manga.chapters.findIndex(c => normalizeChapterId(c.id) === normalizeChapterId(state.activeChapterId));
        if (chapterIndex > 0) {
            btn.onclick = () => {
                const nextChapId = manga.chapters[chapterIndex - 1].id;
                state.activeChapterId = nextChapId;
                state.activePageIndex = 0;
                renderReaderContent();
                window.scrollTo(0, 0);
            };
        }
    }
    });

    // Ø§Ù„Ù‚Ø§Ø±Ø¦: ØªØ±Ø¬Ù…Ø© Ø§Ù„ÙØµÙ„
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
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + state.sessionToken
                    },
                    body: JSON.stringify({url, manga_id: mangaId, chapter_id: chapterId})
                });
                const data = await res.json();
                if (data.status === 'queued') {
                    alert('ØªÙ…Øª Ø¥Ø¶Ø§ÙØ© Ø§Ù„ÙØµÙ„ Ù„Ø·Ø§Ø¨ÙˆØ± Ø§Ù„ØªØ±Ø¬Ù…Ø©');
                } else {
                    alert(data.error || 'ÙØ´Ù„Øª Ø§Ù„ØªØ±Ø¬Ù…Ø©');
                }
            } catch (e) {
                alert('Ø®Ø·Ø£ ÙÙŠ Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù…');
            }
            this.innerHTML = '<i class="fa-solid fa-language"></i>';
            this.disabled = false;
        };
    });

    // --- Ø§Ù„ØªØ­Ù…ÙŠÙ„ Ø§Ù„ØªÙ„Ù‚Ø§Ø¦ÙŠ Ù„Ù„ÙØµÙ„ Ø§Ù„ØªØ§Ù„ÙŠ Ø¹Ù†Ø¯ Ø§Ù„ØªÙ…Ø±ÙŠØ± (Infinite Scroll) ---
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

    // Ø§Ù„Ù‚Ø§Ø±Ø¦: ÙØªØ­/Ø¥ØºÙ„Ø§Ù‚ Ù„ÙˆØ­Ø© Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„Ø¹Ø§Ø¦Ù…Ø© Ù„Ù„ØªØ®ØµÙŠØµ
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

    // Ø§Ù„Ù‚Ø§Ø±Ø¦: Ø§Ù„Ø¶ØºØ· Ø¹Ù„Ù‰ Ø®ÙŠØ§Ø±Ø§Øª Ø§Ù„ØªØ®ØµÙŠØµ
    const settingPanelBtns = document.querySelectorAll('.setting-btn');
    settingPanelBtns.forEach(btn => {
        btn.onclick = (e) => {
            const settingName = btn.dataset.setting;
            const settingVal = btn.dataset.value;

            state.readerSettings[settingName] = settingVal;
            state.saveReaderSettings();
            
            if (settingName === 'mode') {
                state.activePageIndex = 0;
                renderApp();
            } else {
                // Apply theme or width directly to DOM to avoid jitter
                const wrapper = document.querySelector('.reader-wrapper');
                if (wrapper) {
                    if (settingName === 'theme') {
                        wrapper.classList.remove('reader-theme-dark', 'reader-theme-gray', 'reader-theme-sepia');
                        wrapper.classList.add(`reader-theme-${settingVal}`);
                    } else if (settingName === 'width') {
                        wrapper.classList.remove('reader-width-compact', 'reader-width-medium', 'reader-width-full');
                        wrapper.classList.add(`reader-width-${settingVal}`);
                    }
                }
                
                // Update active button styles
                const parent = btn.closest('.setting-buttons');
                if (parent) {
                    parent.querySelectorAll('.setting-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                }
            }
        };
    });

    // Ø§Ù„Ù‚Ø§Ø±Ø¦ Ø§Ù„Ø£ÙÙ‚ÙŠ: Ø§Ù„ØªÙ†Ù‚Ù„ Ø¨ÙŠÙ† Ø§Ù„ØµÙØ­Ø§Øª
    const hPrevZone = document.getElementById('h-prev-zone');
    const hNextZone = document.getElementById('h-next-zone');
    if (hPrevZone && hNextZone) {
        const manga = state.mangas.find(m => m.id === state.activeMangaId);
        if (!manga) return;
        const chapter = manga.chapters.find(c => normalizeChapterId(c.id) === normalizeChapterId(state.activeChapterId));
        if (!chapter) return;
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
                    alert("Ø£Ù†Øª ÙÙŠ Ø£ÙˆÙ„ ØµÙØ­Ø© ÙÙŠ Ø£ÙˆÙ„ ÙØµÙ„!");
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
                    alert("Ù„Ù‚Ø¯ ÙˆØµÙ„Øª Ù„Ø¢Ø®Ø± ØµÙØ­Ø© ÙÙŠ Ø¢Ø®Ø± ÙØµÙ„ Ù…ØªØ§Ø­!");
                }
            }
        };
    }

    // Ø§Ù„Ù‚Ø§Ø±Ø¦: Ø²Ø± Ø§Ù„Ø¥Ø¹Ø¬Ø§Ø¨ Ø¨Ø§Ù„ÙØµÙ„
    const chapterLikeBtn = document.getElementById('chapter-like-btn');
    if (chapterLikeBtn) {
        chapterLikeBtn.onclick = () => {
            const isLiked = state.toggleLike(state.activeMangaId, state.activeChapterId);
            const icon = chapterLikeBtn.querySelector('i');
            const text = document.getElementById('like-text');

            if (isLiked) {
                chapterLikeBtn.classList.add('liked');
                icon.className = 'fa-solid fa-heart';
                text.innerText = 'Ø£Ø¹Ø¬Ø¨Ù†ÙŠ Ù‡Ø°Ø§ Ø§Ù„ÙØµÙ„!';
            } else {
                chapterLikeBtn.classList.remove('liked');
                icon.className = 'fa-regular fa-heart';
                text.innerText = 'Ø£Ø¹Ø¬Ø¨Ù†ÙŠ';
            }
        };
    }

    // Ø§Ù„Ø¥Ø¯Ø§Ø±Ø©: ØªØ¨Ø¯ÙŠÙ„ Ø§Ù„ØªØ¨ÙˆÙŠØ¨Ø§Øª ÙˆØªÙØ¹ÙŠÙ„ Ø§Ù„ØªØ¨ÙˆÙŠØ¨ Ø§Ù„Ù…Ø®ØªØ§Ø±
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
        
        if (tabAddChapter) tabAddChapter.classList.remove('active');
        if (tabEditManga) tabEditManga.classList.remove('active');
        if (tabSuggestions) tabSuggestions.classList.remove('active');
        if (tabSiteSettings) tabSiteSettings.classList.remove('active');
        if (tabAltSources) tabAltSources.classList.remove('active');
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

    
    const tabLiveScraper = document.getElementById('tab-live-scraper');
    const panelLiveScraper = document.getElementById('panel-live-scraper');

    if (tabLiveScraper) {
        tabLiveScraper.onclick = () => {
            hideAllAdminPanels();
            tabLiveScraper.classList.add('active');
            if (panelLiveScraper) panelLiveScraper.style.display = 'block';
            checkAutoUpdaterStatus();
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
        btnExportCsv.onclick = async () => {
            const token = state.sessionToken;
            if (!token) return;
            try {
                const res = await fetch('/api/admin/stats/export?format=csv', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'kairo_stats_export.csv';
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } catch(e) {}
        };
    }
    
    if (btnExportJson) {
        btnExportJson.onclick = async () => {
            const token = state.sessionToken;
            if (!token) return;
            try {
                const res = await fetch('/api/admin/stats/export?format=json', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'kairo_stats_export.json';
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } catch(e) {}
        };
    }

    // Ø§Ù„Ø¥Ø¯Ø§Ø±Ø©: Ø¥Ø±Ø³Ø§Ù„ Ù†Ù…ÙˆØ°Ø¬ Ù…Ø§Ù†Ø¬Ø§
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
            alert("ØªÙ… Ø¥Ø¯Ø±Ø§Ø¬ Ø§Ù„Ø¹Ù…Ù„ Ø§Ù„ÙÙ†ÙŠ Ø¨Ù†Ø¬Ø§Ø­!");
            addMangaForm.reset();
            navigate('home');
        };
    }

    // Ø§Ù„Ø¥Ø¯Ø§Ø±Ø©: Ø¥Ø±Ø³Ø§Ù„ Ù†Ù…ÙˆØ°Ø¬ ÙØµÙ„
    const addChapterForm = document.getElementById('add-chapter-form');
    if (addChapterForm) {
        addChapterForm.onsubmit = (e) => {
            e.preventDefault();
            const mangaId = document.getElementById('chap-manga-id').value;
            const chapterNo = document.getElementById('chap-number').value;
            const title = document.getElementById('chap-title').value;
            const images = document.getElementById('chap-images').value;

            state.addChapter(mangaId, title, chapterNo, images);
            alert(`ØªÙ… Ø±ÙØ¹ ÙˆÙ†Ø´Ø± Ø§Ù„ÙØµÙ„ ${chapterNo} Ø¨Ù†Ø¬Ø§Ø­!`);
            addChapterForm.reset();
            navigate('detail', mangaId);
        };
    }

    // Ø§Ù„Ø´ÙƒØ§ÙˆÙ‰ ÙˆØ§Ù„Ø§Ù‚ØªØ±Ø§Ø­Ø§Øª: ÙØªØ­ ÙˆØ¥ØºÙ„Ø§Ù‚ Ø§Ù„Ù†Ø§ÙØ°Ø©
    const openSuggestionsBtn = document.getElementById('open-suggestions-btn');
    if (openSuggestionsBtn) {
        openSuggestionsBtn.onclick = () => {
            if (!state.sessionToken) {
                alert("Ø§Ù„Ø±Ø¬Ø§Ø¡ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø£ÙˆÙ„Ø§Ù‹ Ù„ØªØªÙ…ÙƒÙ† Ù…Ù† ØªÙ‚Ø¯ÙŠÙ… Ø§Ù‚ØªØ±Ø§Ø­ Ø£Ùˆ Ø´ÙƒÙˆÙ‰.");
                state.showAuthModal = true;
                state.authModalTab = 'login';
                renderApp();
            } else {
                state.showSuggestionsModal = true;
                state.suggestionsError = '';
                state.suggestionsSuccess = '';
                const existingOverlay = document.getElementById('suggestions-modal-overlay');
                if (existingOverlay) {
                    existingOverlay.style.display = 'flex';
                } else {
                    renderApp();
                }
            }
        };
    }

    const closeSuggestionsBtn = document.getElementById('close-suggestions-modal');
    if (closeSuggestionsBtn) {
        closeSuggestionsBtn.onclick = () => {
            state.showSuggestionsModal = false;
            const overlay = document.getElementById('suggestions-modal-overlay');
            if (overlay) { overlay.style.display = 'none'; } else { renderApp(); }
        };
    }

    // Ø§Ù„Ø´ÙƒØ§ÙˆÙ‰ ÙˆØ§Ù„Ø§Ù‚ØªØ±Ø§Ø­Ø§Øª: Ù†Ù…ÙˆØ°Ø¬ Ø§Ù„Ø¥Ø±Ø³Ø§Ù„
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
                    errorMsg.innerText = result.error || 'Ø­Ø¯Ø« Ø®Ø·Ø£ Ù…Ø§';
                    errorMsg.style.display = 'block';
                }
            } catch (err) {
                errorMsg.innerText = 'Ø®Ø·Ø£ ÙÙŠ Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù…';
                errorMsg.style.display = 'block';
            }
        };
    }

    // Ø§Ù„ØªÙˆØ«ÙŠÙ‚: ÙØªØ­ Ø§Ù„Ù†Ø§ÙØ°Ø© Ø§Ù„Ù…Ù†Ø¨Ø«Ù‚Ø©
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
        commentsLoginBtn.onclick = (e) => {
            if (e.target.closest('.star-opt')) {
                const star = e.target.closest('.star-opt');
                const rating = parseInt(star.dataset.rating);
                chosenRating = rating;
                document.getElementById('manga-selected-rating-val').innerText = `${rating} / 10`;
                document.querySelectorAll('.star-opt').forEach((s, idx) => {
                    if (idx < rating) {
                        s.classList.remove('fa-regular');
                        s.classList.add('fa-solid');
                    } else {
                        s.classList.remove('fa-solid');
                        s.classList.add('fa-regular');
                    }
                });
            }
            state.showAuthModal = true;
            state.authModalTab = 'login';
            renderApp();
        };
    }

    // Ø§Ù„ØªÙˆØ«ÙŠÙ‚: ØªØ¨Ø¯ÙŠÙ„ Ø§Ù„ØªØ¨ÙˆÙŠØ¨Ø§Øª
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

    // Ø§Ù„ØªÙˆØ«ÙŠÙ‚: Ø¥ØºÙ„Ø§Ù‚ Ø§Ù„Ù†Ø§ÙØ°Ø©
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
    
    // Ø§Ù„ØªÙˆØ«ÙŠÙ‚: ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø§Ù„Ø§Ø¬ØªÙ…Ø§Ø¹ÙŠ Ø¹Ø¨Ø± Ø§Ù„Ø£Ø²Ø±Ø§Ø±
    const googleLoginBtn = document.getElementById('google-login-btn');
    if (googleLoginBtn) {
        googleLoginBtn.onclick = () => {
            if (!isUsableGoogleClientId()) {
                alert("âš ï¸ Ù„Ù… ÙŠØªÙ… ØªÙƒÙˆÙŠÙ† Google Client ID Ø¨Ø¹Ø¯.\n\nÙŠØ±Ø¬Ù‰ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ ÙƒÙ…Ø³Ø¤ÙˆÙ„ Ø«Ù… Ø§Ù„Ø°Ù‡Ø§Ø¨ Ø¥Ù„Ù‰ (Ù„ÙˆØ­Ø© Ø§Ù„Ø¥Ø¯Ø§Ø±Ø© â† Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„Ù…ÙˆÙ‚Ø¹) Ù„ØªØ­Ø¯ÙŠØ« Ø§Ù„Ù…Ø¹Ø±Ù‘Ù Ø§Ù„ÙØ¹Ù„ÙŠ Ù„ØªÙØ¹ÙŠÙ„ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø¨Ø¬ÙˆØ¬Ù„.");
                return;
            }
            if (typeof google !== 'undefined' && googleTokenClient) {
                googleTokenClient.requestAccessToken();
            } else {
                alert("Ù…ÙƒØªØ¨Ø© Ø¬ÙˆØ¬Ù„ Ù„Ù… ÙŠØªÙ… ØªØ­Ù…ÙŠÙ„Ù‡Ø§ Ø¨Ø¹Ø¯ Ø£Ùˆ Ø§Ù„Ù…Ø¹Ø±Ù‘Ù ØºÙŠØ± ØµØ­ÙŠØ­. ÙŠØ±Ø¬Ù‰ Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø© Ù„Ø§Ø­Ù‚Ø§Ù‹.");
            }
        };
    }

    const facebookLoginBtn = document.getElementById('facebook-login-btn');
    if (facebookLoginBtn) {
        facebookLoginBtn.onclick = () => {
            if (!isUsableFacebookAppId()) {
                alert("âš ï¸ Ù„Ù… ÙŠØªÙ… ØªÙƒÙˆÙŠÙ† Facebook App ID Ø¨Ø¹Ø¯.\n\nÙŠØ±Ø¬Ù‰ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ ÙƒÙ…Ø³Ø¤ÙˆÙ„ Ø«Ù… Ø§Ù„Ø°Ù‡Ø§Ø¨ Ø¥Ù„Ù‰ (Ù„ÙˆØ­Ø© Ø§Ù„Ø¥Ø¯Ø§Ø±Ø© â† Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„Ù…ÙˆÙ‚Ø¹) Ù„ØªØ­Ø¯ÙŠØ« Ø§Ù„Ù…Ø¹Ø±Ù‘Ù Ø§Ù„ÙØ¹Ù„ÙŠ Ù„ØªÙØ¹ÙŠÙ„ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø¨ÙÙŠØ³Ø¨ÙˆÙƒ.");
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
            const overlay = document.getElementById('settings-modal-overlay');
            if (overlay) { overlay.style.display = 'none'; } else { renderApp(); }
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

    document.querySelectorAll('.settings-tab-btn').forEach(btn => {
        btn.onclick = () => {
            state.settingsTab = btn.dataset.tab;
            renderApp();
        };
    });

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
                    successMsg.innerText = result.message || 'ØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ø±Ø§Ø¨Ø· Ø§Ø³ØªØ¹Ø§Ø¯Ø© ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±!';
                    successMsg.style.display = 'block';
                } else {
                    errorMsg.innerText = result.error || 'ÙØ´Ù„ Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ø·Ù„Ø¨';
                    errorMsg.style.display = 'block';
                }
            } catch (err) {
                errorMsg.innerText = 'Ø®Ø·Ø£ ÙÙŠ Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù…';
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
                errorMsg.innerText = 'ÙŠØ¬Ø¨ Ø£Ù† ØªØªÙƒÙˆÙ† ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ù…Ù† 6 Ø£Ø­Ø±Ù Ø¹Ù„Ù‰ Ø§Ù„Ø£Ù‚Ù„';
                errorMsg.style.display = 'block';
                return;
            }
            if (newPass !== confirmPass) {
                errorMsg.innerText = 'ÙƒÙ„Ù…ØªØ§ Ø§Ù„Ù…Ø±ÙˆØ± ØºÙŠØ± Ù…ØªØ·Ø§Ø¨Ù‚ØªÙŠÙ†';
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
                    successMsg.innerText = 'ØªÙ… ØªØ­Ø¯ÙŠØ« ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø¨Ù†Ø¬Ø§Ø­! Ø³ÙŠØªÙ… ØªÙˆØ¬ÙŠÙ‡Ùƒ Ø§Ù„Ø¢Ù† Ù„ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„.';
                    successMsg.style.display = 'block';
                    setTimeout(() => {
                        state.showAuthModal = true;
                        state.authModalTab = 'login';
                        navigate('home');
                    }, 2000);
                } else {
                    errorMsg.innerText = result.error || 'ÙØ´Ù„ ØªØ­Ø¯ÙŠØ« ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±';
                    errorMsg.style.display = 'block';
                }
            } catch (err) {
                errorMsg.innerText = 'Ø®Ø·Ø£ ÙÙŠ Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù…';
                errorMsg.style.display = 'block';
            }
        };
    }

    // Ø§Ù„ØªÙˆØ«ÙŠÙ‚: Ø¥Ø±Ø³Ø§Ù„ Ù†Ù…ÙˆØ°Ø¬ Ø§Ù„Ø¯Ø®ÙˆÙ„/Ø§Ù„ØªØ³Ø¬ÙŠÙ„
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
                        state.userRole = result.role || 'user';
                        enforceAdminRole();
                        if (result.points !== undefined) state.userProfile.points = result.points;
                        if (result.level !== undefined) state.userProfile.level = result.level;
                        if (result.username) state.userProfile.username = result.username;
                        state.saveUserProfile();
                        successMsg.innerText = 'ØªÙ… ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø¨Ù†Ø¬Ø§Ø­!';
                        successMsg.style.display = 'block';
                        await state.fetchAndMergeSettings();
                        state.checkDailyReward();
                        setTimeout(() => {
                            state.showAuthModal = false;
                            renderApp();
                        }, 1200);
                    } else {
                        if (result.token) {
                            state.sessionToken = result.token;
                            state.userEmail = result.email;
                            state.userRole = result.role || 'user';
                            enforceAdminRole();
                            if (result.points !== undefined) state.userProfile.points = result.points;
                            if (result.level !== undefined) state.userProfile.level = result.level;
                            if (result.username) state.userProfile.username = result.username;
                            state.saveUserProfile();
                            successMsg.innerText = 'ØªÙ… Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„Ø­Ø³Ø§Ø¨ Ø¨Ù†Ø¬Ø§Ø­! Ø¬Ø§Ø±ÙŠ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„...';
                            successMsg.style.display = 'block';
                            setTimeout(async () => {
                                await state.fetchAndMergeSettings();
                                state.checkDailyReward();
                                state.showAuthModal = false;
                                renderApp();
                            }, 1200);
                        } else {
                            successMsg.innerText = result.message || 'ØªÙ… Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„Ø­Ø³Ø§Ø¨ Ø¨Ù†Ø¬Ø§Ø­ØŒ ÙŠÙ…ÙƒÙ†Ùƒ Ø§Ù„Ø¢Ù† ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„';
                            successMsg.style.display = 'block';
                            setTimeout(() => {
                                state.authModalTab = 'login';
                                renderApp();
                            }, 1500);
                        }
                    }
                } else {
                    errorMsg.innerText = result.error || 'Ø­Ø¯Ø« Ø®Ø·Ø£ Ù…Ø§';
                    errorMsg.style.display = 'block';
                }
            } catch (err) {
                errorMsg.innerText = 'Ø®Ø·Ø£ ÙÙŠ Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø³ÙŠØ±ÙØ±';
                errorMsg.style.display = 'block';
            }
        };
    }

    // Ø§Ù„ØªÙˆØ«ÙŠÙ‚: ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø®Ø±ÙˆØ¬
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            if (confirm("Ù‡Ù„ ØªØ±ÙŠØ¯ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø®Ø±ÙˆØ¬ØŸ")) {
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

    window.performLogout = async () => {
        if (confirm("Ù‡Ù„ ØªØ±ÙŠØ¯ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø®Ø±ÙˆØ¬ØŸ")) {
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

    // Ù…Ø±Ø§Ø¬Ø¹Ø§Øª Ø§Ù„Ù…Ù†Ù‡ÙˆØ§: Ø§Ù„Ù†Ø¬ÙˆÙ… Ø§Ù„ØªÙØ§Ø¹Ù„ÙŠØ© ÙˆØ¥Ø±Ø³Ø§Ù„ Ø§Ù„Ù…Ø±Ø§Ø¬Ø¹Ø©
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
                alert("Ø®Ø·Ø£ ÙÙŠ Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù…");
            }
        };
    }

    // Ø§Ù„ØªØ¹Ù„ÙŠÙ‚ Ø¹Ù„Ù‰ Ø§Ù„ÙØµÙˆÙ„: Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„ØªØ¹Ù„ÙŠÙ‚ Ù„Ù„Ø³ÙŠØ±ÙØ±
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
                    const badgeIcons = {
                        'gold': '<i class="fa-solid fa-medal" style="color:#ffd700;" title="Ø£ÙˆÙ„ ØªØ¹Ù„ÙŠÙ‚"></i>',
                        'silver': '<i class="fa-solid fa-medal" style="color:#c0c0c0;" title="Ø«Ø§Ù†ÙŠ ØªØ¹Ù„ÙŠÙ‚"></i>',
                        'bronze': '<i class="fa-solid fa-medal" style="color:#cd7f32;" title="Ø«Ø§Ù„Ø« ØªØ¹Ù„ÙŠÙ‚"></i>'
                    };
                    const badgeHtml = badgeIcons[result.badge] ? `<span class="comment-badge">${badgeIcons[result.badge]}</span>` : '';
                    const userDisplay = state.userEmail.split('@')[0];
                    const firstLetter = userDisplay.charAt(0).toUpperCase();
                    const dateStr = new Date().toLocaleDateString('ar-EG');
                    const newCommentHtml = `
                    <div class="comment-item">
                        <div class="comment-avatar">${firstLetter}</div>
                        <div class="comment-body">
                            <div class="comment-header">
                                <span class="comment-username">${userDisplay} ${badgeHtml}</span>
                                <span class="comment-time">${dateStr}</span>
                            </div>
                            <p class="comment-text">${text}</p>
                        </div>
                    </div>
                    `;
                    const emptyMsg = document.querySelector('.comments-section p');
                    const commentsContainer = document.getElementById('chapter-comments-list');
                    if (emptyMsg && emptyMsg.textContent.includes('ÙƒÙ† Ø£ÙˆÙ„ Ù…Ù† ÙŠØªØ±Ùƒ')) {
                        emptyMsg.outerHTML = newCommentHtml;
                    } else if (commentsContainer) {
                        commentsContainer.insertAdjacentHTML('afterbegin', newCommentHtml);
                    } else {
                        renderApp();
                    }
                } else {
                    alert(result.error);
                }
            } catch (err) {
                alert("Ø®Ø·Ø£ ÙÙŠ Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù…");
            }
        };
    }

    // Ø§Ù„Ø¥Ø¯Ø§Ø±Ø©: Ø­ÙØ¸ Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„Ù…ÙˆÙ‚Ø¹ Ø¯ÙŠÙ†Ø§Ù…ÙŠÙƒÙŠØ§Ù‹
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
                    alert("ØªÙ… Ø­ÙØ¸ Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„Ù…ÙˆÙ‚Ø¹ Ø¨Ù†Ø¬Ø§Ø­!");
                    initSocialAuths();
                    renderApp();
                } else {
                    alert(result.error || "ÙØ´Ù„ Ø­ÙØ¸ Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª");
                }
            } catch (err) {
                alert("Ø®Ø·Ø£ ÙÙŠ Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù… Ø£Ø«Ù†Ø§Ø¡ Ø­ÙØ¸ Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª");
            }
        };
    }

    // Ø§Ù„Ø¥Ø¯Ø§Ø±Ø©: Ø§Ù„Ø¨Ø­Ø« Ø¹Ù† Ù…ØµØ§Ø¯Ø± Ø¨Ø¯ÙŠÙ„Ø©
    const altSourceForm = document.getElementById('alt-source-form');
    if (altSourceForm) {
        altSourceForm.onsubmit = async (e) => {
            e.preventDefault();
            const mangaId = document.getElementById('alt-manga-id')?.value;
            if (!mangaId) return;
            const resultsDiv = document.getElementById('alt-source-results');
            if (resultsDiv) resultsDiv.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-dark);"><i class="fa-solid fa-spinner fa-spin"></i> Ø¬Ø§Ø±ÙŠ Ø§Ù„Ø¨Ø­Ø«...</p>';
            try {
                const resp = await fetch('/api/admin/find-alternative-sources', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${state.sessionToken}`},
                    body: JSON.stringify({manga_id: mangaId})
                });
                const data = await resp.json();
                if (!resp.ok || !data.results || data.results.length === 0) {
                    if (resultsDiv) resultsDiv.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-dark);">Ù„Ù… Ù†Ø¹Ø«Ø± Ø¹Ù„Ù‰ Ù…ØµØ§Ø¯Ø± Ø¨Ø¯ÙŠÙ„Ø©.</p>';
                    return;
                }
                let html = '<h3 style="color:var(--text-main);margin-bottom:16px;">Ø§Ù„Ù…ØµØ§Ø¯Ø± Ø§Ù„Ø¨Ø¯ÙŠÙ„Ø© Ø§Ù„Ù…ØªØ§Ø­Ø©:</h3>';
                data.results.forEach(r => {
                    html += `
                    <div style="padding:16px;border:1px solid var(--border-color);border-radius:var(--border-radius-md);margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <strong style="color:var(--text-main);">${r.title}</strong>
                            <span style="display:block;font-size:0.85rem;color:var(--text-dark);">Ø§Ù„Ù…ØµØ¯Ø±: ${r.source} â€¢ ${r.chapters ? r.chapters.length + ' ÙØµÙ„' : ''}</span>
                        </div>
                        <button class="admin-submit-btn link-alt-source-btn" style="padding:8px 16px;font-size:0.85rem;" data-manga-id="${mangaId}" data-source="${r.source}" data-url="${r.url}">
                            <i class="fa-solid fa-link"></i> Ø±Ø¨Ø·
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
                            alert(ldata.error || 'ØªÙ… Ø±Ø¨Ø· Ø§Ù„Ù…ØµØ¯Ø± Ø§Ù„Ø¨Ø¯ÙŠÙ„ Ø¨Ù†Ø¬Ø§Ø­!');
                            if (lresp.ok) btn.disabled = true;
                        } catch (err) {
                            alert('Ø®Ø·Ø£ ÙÙŠ Ø§Ù„Ø§ØªØµØ§Ù„');
                        }
                    };
                });
            } catch (err) {
                if (resultsDiv) resultsDiv.innerHTML = '<p style="text-align:center;padding:20px;color:#ff007f;">Ø®Ø·Ø£ ÙÙŠ Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù….</p>';
            }
        };
    }

    // Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…: Ø­ÙØ¸ Ø§Ø³Ù… Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…
    const btnSaveUsername = document.getElementById('btn-save-username');
    if (btnSaveUsername) {
        btnSaveUsername.onclick = async () => {
            const input = document.getElementById('settings-new-username');
            const msg = document.getElementById('username-msg');
            const username = input.value.trim();
            if (!username || username.length < 2) {
                msg.innerHTML = '<span style="color:#ff007f;">Ø§Ø³Ù… Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… ÙŠØ¬Ø¨ Ø£Ù† ÙŠÙƒÙˆÙ† Ø­Ø±ÙÙŠÙ† Ø¹Ù„Ù‰ Ø§Ù„Ø£Ù‚Ù„</span>';
                return;
            }
            msg.innerHTML = '<span style="color:var(--text-muted);">Ø¬Ø§Ø±ÙŠ Ø§Ù„Ø­ÙØ¸...</span>';
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
                    msg.innerHTML = '<span style="color:#00ff7f;">ØªÙ… ØªØ­Ø¯ÙŠØ« Ø§Ø³Ù… Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… Ø¨Ù†Ø¬Ø§Ø­</span>';
                } else {
                    msg.innerHTML = `<span style="color:#ff007f;">${data.error || 'ÙØ´Ù„ Ø§Ù„ØªØ­Ø¯ÙŠØ«'}</span>`;
                }
            } catch (err) {
                msg.innerHTML = '<span style="color:#ff007f;">Ø®Ø·Ø£ ÙÙŠ Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù…</span>';
            }
        };
    }

    // Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…: ØªØºÙŠÙŠØ± ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±
    const btnSavePassword = document.getElementById('btn-save-password');
    if (btnSavePassword) {
        btnSavePassword.onclick = async () => {
            const currentPass = document.getElementById('settings-current-password');
            const newPass = document.getElementById('settings-new-password');
            const msg = document.getElementById('password-msg');
            if (!currentPass.value) {
                msg.innerHTML = '<span style="color:#ff007f;">Ø§Ù„Ø±Ø¬Ø§Ø¡ Ø¥Ø¯Ø®Ø§Ù„ ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø§Ù„Ø­Ø§Ù„ÙŠØ©</span>';
                return;
            }
            if (!newPass.value || newPass.value.length < 6) {
                msg.innerHTML = '<span style="color:#ff007f;">ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø© ÙŠØ¬Ø¨ Ø£Ù† ØªÙƒÙˆÙ† 6 Ø£Ø­Ø±Ù Ø¹Ù„Ù‰ Ø§Ù„Ø£Ù‚Ù„</span>';
                return;
            }
            msg.innerHTML = '<span style="color:var(--text-muted);">Ø¬Ø§Ø±ÙŠ Ø§Ù„Ø­ÙØ¸...</span>';
            try {
                const res = await fetch('/api/auth/change-password', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${state.sessionToken}`},
                    body: JSON.stringify({ current_password: currentPass.value, new_password: newPass.value })
                });
                const data = await res.json();
                if (res.ok) {
                    msg.innerHTML = '<span style="color:#00ff7f;">ØªÙ… ØªØºÙŠÙŠØ± ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø¨Ù†Ø¬Ø§Ø­</span>';
                    currentPass.value = '';
                    newPass.value = '';
                } else {
                    msg.innerHTML = `<span style="color:#ff007f;">${data.error || 'ÙØ´Ù„ Ø§Ù„ØªØºÙŠÙŠØ±'}</span>`;
                }
            } catch (err) {
                msg.innerHTML = '<span style="color:#ff007f;">Ø®Ø·Ø£ ÙÙŠ Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù…</span>';
            }
        };
    }

    // Ø§Ù„Ø¥Ø¯Ø§Ø±Ø©: ØªØ­Ù…ÙŠÙ„ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…Ù†Ù‡ÙˆØ§ ÙÙŠ Ù†Ù…ÙˆØ°Ø¬ Ø§Ù„ØªØ¹Ø¯ÙŠÙ„ Ø¹Ù†Ø¯ Ø§Ø®ØªÙŠØ§Ø±Ù‡Ø§
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
            document.getElementById('edit-manga-genres').value = (Array.isArray(manga.genres) ? manga.genres.join('ØŒ ') : manga.genres || '');
            document.getElementById('edit-manga-title').value = manga.title || '';
            document.getElementById('edit-manga-alt').value = manga.alternative || '';
            document.getElementById('edit-manga-author').value = manga.author || '';
            document.getElementById('edit-manga-synopsis').value = manga.synopsis || '';
            const statusMap = { 'Ongoing': 'Ù…Ø³ØªÙ…Ø±', 'Ù…Ø³ØªÙ…Ø±': 'Ù…Ø³ØªÙ…Ø±', 'Completed': 'Ù…ÙƒØªÙ…Ù„', 'Ù…ÙƒØªÙ…Ù„': 'Ù…ÙƒØªÙ…Ù„', 'Ù…ØªÙˆÙ‚Ù': 'Ù…ØªÙˆÙ‚Ù' };
            const statusSelect = document.getElementById('edit-manga-status');
            statusSelect.value = statusMap[manga.status] || 'Ù…Ø³ØªÙ…Ø±';
            document.getElementById('edit-manga-fields').style.display = 'block';
            document.getElementById('edit-manga-msg').innerHTML = '';
        };
    }

    // Ø§Ù„Ø¥Ø¯Ø§Ø±Ø©: Ø­ÙØ¸ ØªØ¹Ø¯ÙŠÙ„Ø§Øª Ø§Ù„Ù…Ù†Ù‡ÙˆØ§
    const editMangaForm = document.getElementById('edit-manga-form');
    if (editMangaForm) {
        editMangaForm.onsubmit = async (e) => {
            e.preventDefault();
            const mangaId = document.getElementById('edit-manga-id').value;
            if (!mangaId) return;
            const msg = document.getElementById('edit-manga-msg');
            msg.innerHTML = '<span style="color:var(--text-muted);">Ø¬Ø§Ø±ÙŠ Ø§Ù„Ø­ÙØ¸...</span>';
            try {
                const manga = state.mangas.find(m => m.id === mangaId);
                if (!manga) {
                    msg.innerHTML = '<span style="color:#ff007f;">Ø§Ù„Ù…Ù†Ù‡ÙˆØ§ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯Ø©</span>';
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
                const statusMapRev = { 'Ù…Ø³ØªÙ…Ø±': 'Ongoing', 'Ù…ÙƒØªÙ…Ù„': 'Completed', 'Ù…ØªÙˆÙ‚Ù': 'Hiatus' };
                updated.status = statusMapRev[statusSelect.value] || manga.status;
                updated.type = document.getElementById('edit-manga-type').value || manga.type;

                const res = await fetch('/api/save_manga', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${state.sessionToken}`},
                    body: JSON.stringify(updated)
                });
                if (res.ok) {
                    msg.innerHTML = '<span style="color:#00ff7f;">ØªÙ… Ø­ÙØ¸ Ø§Ù„ØªØ¹Ø¯ÙŠÙ„Ø§Øª Ø¨Ù†Ø¬Ø§Ø­! Ø³ÙŠØªÙ… Ø§Ù„ØªØ­Ø¯ÙŠØ« Ø¨Ø¹Ø¯ Ø¥Ø¹Ø§Ø¯Ø© ØªØ­Ù…ÙŠÙ„ Ø§Ù„ØµÙØ­Ø©.</span>';
                    const idx = state.mangas.findIndex(m => m.id === mangaId);
                    if (idx !== -1) state.mangas[idx] = updated;
                    state.saveMangas();
                } else {
                    const errData = await res.json();
                    msg.innerHTML = `<span style="color:#ff007f;">${errData.error || 'ÙØ´Ù„ Ø§Ù„Ø­ÙØ¸'}</span>`;
                }
            } catch (err) {
                msg.innerHTML = '<span style="color:#ff007f;">Ø®Ø·Ø£ ÙÙŠ Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù…</span>';
            }
        };
    }

    // =================================
    // SOCIAL FEATURES EVENT HANDLERS
    // =================================

    function updateUserSearchDropdown() {
        const container = document.querySelector('.user-search-box');
        if (!container) return;
        let dropdown = document.getElementById('user-search-dropdown');
        if (!state.showUserSearch || state.userSearchResults.length === 0 || !state.userSearchQuery) {
            if (dropdown) dropdown.remove();
            return;
        }
        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.className = 'user-search-dropdown';
            dropdown.id = 'user-search-dropdown';
            container.appendChild(dropdown);
        }
        const q = state.userSearchQuery.toLowerCase().trim();
        const matches = state.userSearchResults.filter(u => u.username !== getUserHandle(state.userEmail));
        if (matches.length === 0 || q.length === 0) {
            dropdown.remove();
            return;
        }
        dropdown.innerHTML = matches.map(u => `
            <div class="user-search-item" data-username="${u.username}">
                <span class="user-search-avatar">${getUserInitial(u.email)}</span>
                <div class="user-search-info">
                    <span class="user-search-name">${u.username}</span>
                    <span class="user-search-rank">${u.rank}</span>
                </div>
            </div>
        `).join('');
        dropdown.querySelectorAll('.user-search-item').forEach(item => {
            item.onclick = (e) => {
                e.stopPropagation();
                const username = e.currentTarget.dataset.username;
                state.userSearchQuery = '';
                state.userSearchResults = [];
                state.showUserSearch = false;
                const input = document.getElementById('user-search-input');
                if (input) input.value = '';
                dropdown.remove();
                navigate('profile', username);
            };
        });
    }

    // User search by username (debounced)
    const userSearchInput = document.getElementById('user-search-input');
    if (userSearchInput) {
        userSearchInput.oninput = (e) => {
            const q = e.target.value.trim();
            state.userSearchQuery = q;
            if (state.userSearchDebounce) clearTimeout(state.userSearchDebounce);
            if (q.length > 0) {
                state.showUserSearch = true;
                state.userSearchDebounce = setTimeout(async () => {
                    try {
                        const res = await fetch('/api/user/search?q=' + encodeURIComponent(q));
                        state.userSearchResults = await res.json();
                        updateUserSearchDropdown();
                    } catch (e) { console.error('User search error:', e); }
                }, 300);
            } else {
                state.showUserSearch = false;
                state.userSearchResults = [];
                updateUserSearchDropdown();
            }
        };
        userSearchInput.onfocus = () => {
            if (state.userSearchQuery && state.userSearchResults.length > 0) {
                state.showUserSearch = true;
                updateUserSearchDropdown();
            }
        };
        userSearchInput.onblur = () => {
            setTimeout(() => { state.showUserSearch = false; updateUserSearchDropdown(); }, 200);
        };
    }

    // Notification button toggle
    const notifBtn = document.getElementById('notification-btn');
    if (notifBtn) {
        notifBtn.onclick = async (e) => {
            e.stopPropagation();
            state.showNotifications = !state.showNotifications;
            if (state.showNotifications) {
                await state.fetchNotifications();
            }
            renderApp();
        };
    }

    // Notification item click (mark as read + navigate)
    document.querySelectorAll('.notification-item').forEach(item => {
        item.onclick = async (e) => {
            e.stopPropagation();
            const id = e.currentTarget.dataset.id;
            try {
                await fetch('/api/notifications/mark-read', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + state.sessionToken },
                    body: JSON.stringify({ id: parseInt(id) })
                });
                state.showNotifications = false;
                await state.fetchUnreadCount();
                renderApp();
            } catch (e) { console.error(e); }
        };
    });

    // Mark all notifications read
    const markAllRead = document.getElementById('mark-all-notif-read');
    if (markAllRead) {
        markAllRead.onclick = async (e) => {
            e.stopPropagation();
            try {
                await fetch('/api/notifications/mark-read', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + state.sessionToken },
                    body: JSON.stringify({})
                });
                state.showNotifications = false;
                state.notifications = state.notifications.map(n => { n.is_read = true; return n; });
                state.unreadNotifications = 0;
                renderApp();
            } catch (e) { console.error(e); }
        };
    }

    // Close notifications on outside click
    document.addEventListener('click', (e) => {
        if (state.showNotifications && !e.target.closest('.notification-btn') && !e.target.closest('.notifications-dropdown')) {
            state.showNotifications = false;
            renderApp();
        }
    });

    // Follow button toggle
    const followBtn = document.getElementById('profile-follow-btn');
    if (followBtn) {
        followBtn.onclick = async () => {
            const username = followBtn.dataset.username;
            followBtn.disabled = true;
            try {
                const res = await fetch('/api/follow/' + encodeURIComponent(username), {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + state.sessionToken }
                });
                const data = await res.json();
                if (res.ok) {
                    if (data.following) {
                        followBtn.classList.add('following');
                        followBtn.innerHTML = '<i class="fa-solid fa-user-check"></i> Ù…ØªØ§Ø¨ÙŽØ¹';
                    } else {
                        followBtn.classList.remove('following');
                        followBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Ù…ØªØ§Ø¨Ø¹Ø©';
                    }
                }
            } catch (e) { console.error(e); }
            followBtn.disabled = false;
        };
    }

    // Profile tab switching
    document.querySelectorAll('.profile-tab').forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.profile-tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const content = document.getElementById('profile-tab-' + tab.dataset.tab);
            if (content) content.classList.add('active');
        };
    });

    // Activity items â†’ navigate to manga detail
    document.querySelectorAll('.activity-item').forEach(item => {
        item.onclick = () => {
            const mangaId = item.dataset.manga;
            if (mangaId) navigate('detail', mangaId);
        };
    });

    // Library card â†’ navigate to manga detail
    document.querySelectorAll('.library-card').forEach(card => {
        card.onclick = () => {
            const mangaId = card.dataset.manga;
            if (mangaId) navigate('detail', mangaId);
        };
    });

    // Review card â†’ navigate to manga detail
    document.querySelectorAll('.review-card').forEach(card => {
        card.onclick = () => {
            const mangaId = card.dataset.manga;
            if (mangaId) navigate('detail', mangaId);
        };
    });

    // Leaderboard row â†’ navigate to profile
    document.querySelectorAll('.leaderboard-row').forEach(row => {
        row.onclick = () => {
            const username = row.dataset.username;
            if (username) navigate('profile', username);
        };
    });

    // Leaderboard back-to-home button
    const lbHomeBtn = document.getElementById('lb-home-btn');
    if (lbHomeBtn) lbHomeBtn.onclick = () => navigate('home');

    // Podium items â†’ navigate to profile
    document.querySelectorAll('.podium-item .podium-name').forEach(el => {
        el.onclick = (e) => {
            e.stopPropagation();
            const username = el.textContent.trim();
            if (username) navigate('profile', username);
        };
    });

    // =================================
    // DAILY REWARD EVENT HANDLERS
    // =================================

    // Claim reward button
    const claimBtn = document.getElementById('claim-reward-btn');
    if (claimBtn) {
        claimBtn.onclick = async () => {
            claimBtn.disabled = true;
            claimBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Ø¬Ø§Ø±ÙŠ...';
            try {
                const res = await fetch('/api/rewards/claim_daily', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + state.sessionToken }
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    triggerConfetti();
                    state.userProfile.points = data.total_points;
                    state.userProfile.level = data.level;
                    state.saveUserProfile();
                    state.showDailyReward = false;
                    setTimeout(() => {
                        renderApp();
                        // update navbar points
                        const badge = document.querySelector('.points-badge-text');
                        if (badge) badge.innerHTML = data.total_points + ' <i class="fa-solid fa-star" style="font-size:0.6rem;"></i>';
                    }, 100);
                } else {
                    alert(data.error || 'Ø­Ø¯Ø« Ø®Ø·Ø£');
                    claimBtn.disabled = false;
                    claimBtn.innerHTML = '<i class="fa-solid fa-gift"></i> Ø¬Ù…Ø¹ Ø§Ù„Ù…ÙƒØ§ÙØ£Ø©';
                }
            } catch (e) {
                console.error('Claim reward error:', e);
                alert('Ø®Ø·Ø£ ÙÙŠ Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù…');
                claimBtn.disabled = false;
                claimBtn.innerHTML = '<i class="fa-solid fa-gift"></i> Ø¬Ù…Ø¹ Ø§Ù„Ù…ÙƒØ§ÙØ£Ø©';
            }
        };
    }

    // Close reward modal on overlay click
    const rewardOverlay = document.getElementById('reward-modal-overlay');
    if (rewardOverlay) {
        rewardOverlay.onclick = (e) => {
            if (e.target === rewardOverlay) {
                state.showDailyReward = false;
                renderApp();
            }
        };
    }

    const closeRewardBtn = document.getElementById('close-reward-modal');
    if (closeRewardBtn) {
        closeRewardBtn.onclick = () => {
            state.showDailyReward = false;
            const overlay = document.getElementById('reward-modal-overlay');
            if (overlay) { overlay.style.display = 'none'; } else { renderApp(); }
        };
    }

    // =================================
    // GENRE TAG FILTER
    // =================================
    document.querySelectorAll('.genres-list .genre-tag').forEach(tag => {
        tag.onclick = () => {
            const genre = tag.dataset.genre;
            if (genre) {
                state.activeGenre = genre;
                renderApp();
            }
        };
    });

    // =================================
    // ADVANCED FILTER CONTROLS
    // =================================
    const filterMap = { 'status':'filterStatus', 'type':'filterType', 'year-min':'filterYearMin', 'year-max':'filterYearMax', 'rating-min':'filterRatingMin', 'rating-max':'filterRatingMax', 'chapters-min':'filterChaptersMin', 'chapters-max':'filterChaptersMax', 'sort':'filterSort', 'time':'filterTime' };
    Object.keys(filterMap).forEach(key => {
        const el = document.getElementById('filter-' + key);
        if (el) {
            el.onchange = (e) => {
                state[filterMap[key]] = e.target.value;
                if (state.currentView === 'home' && document.getElementById('manga-grid-container')) {
                    updateGridOnly();
                } else {
                    renderApp();
                }
            };
        }
    });

    // =================================
    // LEADERBOARD TABS
    // =================================
    document.querySelectorAll('.lb-tab').forEach(tab => {
        tab.onclick = () => {
            const tabKey = tab.dataset.tab;
            if (tabKey && tabKey !== state.leaderboardTab) {
                state.leaderboardTab = tabKey;
                renderApp();
            }
        };
    });

    // =================================
    // CHAPTER SORT DROPDOWN
    // =================================
    const chapterSortSelect = document.getElementById('chapter-sort-select');
    if (chapterSortSelect) {
        chapterSortSelect.onchange = (e) => {
            state.chapterSortOrder = e.target.value;
            renderApp();
        };
    }

    // =================================
    // STORE BUY BUTTONS
    // =================================
    document.querySelectorAll('.store-buy-btn').forEach(btn => {
        btn.onclick = async () => {
            if (btn.disabled) return;
            const itemId = btn.dataset.id;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            try {
                const res = await fetch('/api/store/buy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + state.sessionToken },
                    body: JSON.stringify({ item_id: itemId })
                });
                const result = await res.json();
                if (res.ok) {
                    alert('ØªÙ… Ø§Ù„Ø´Ø±Ø§Ø¡ Ø¨Ù†Ø¬Ø§Ø­!');
                    state.userProfile.points = result.points || state.userProfile.points;
                    if (result.item_id) {
                        state.userProfile.purchased = state.userProfile.purchased || [];
                        state.userProfile.purchased.push(result.item_id);
                    }
                    state.saveUserProfile();
                    renderApp();
                } else {
                    alert(result.error || 'ÙØ´Ù„ Ø§Ù„Ø´Ø±Ø§Ø¡');
                    btn.disabled = false;
                    btn.innerHTML = 'Ø´Ø±Ø§Ø¡';
                }
            } catch (e) {
                console.error('Buy error:', e);
                alert('Ø®Ø·Ø£ ÙÙŠ Ø§Ù„Ø§ØªØµØ§Ù„');
                btn.disabled = false;
                btn.innerHTML = 'Ø´Ø±Ø§Ø¡';
            }
        };
    });
}

// ==========================================
// 5.5. Ø¯ÙˆØ§Ù„ Ù…Ø³Ø§Ø¹Ø¯Ø© Ù„Ù„Ø¥Ø¯Ø§Ø±Ø©
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
// 6. ØªØ´ØºÙŠÙ„ Ø§Ù„Ù‚Ø§Ø±Ø¦ ÙˆØ§Ù„ØªØ­Ù…ÙŠÙ„ Ø§Ù„ÙƒØ³ÙˆÙ„
// ==========================================

window.readerImageQueue = [];
window.readerActiveImageLoads = 0;
const MAX_CONCURRENT_IMAGES = 3;

function processReaderImageQueue() {
    if (window.readerActiveImageLoads >= MAX_CONCURRENT_IMAGES || window.readerImageQueue.length === 0) return;
    
    window.readerActiveImageLoads++;
    var task = window.readerImageQueue.shift();
    var container = task.container;
    var src = task.src;
    var isProxyFallback = task.isProxyFallback;

    var retries = parseInt(container.dataset.retries || '0', 10);
    if (retries >= 2) {
        window.readerActiveImageLoads--;
        showImageError(container, src, true);
        processReaderImageQueue();
        return;
    }

    var img = document.createElement('img');
    img.referrerPolicy = "no-referrer"; // Bypass basic hotlink protection
    img.src = src;

    img.onload = function() {
        container.innerHTML = '';
        container.appendChild(img);
        window.readerActiveImageLoads--;
        processReaderImageQueue();
    };

    img.onerror = function() {
        container.dataset.retries = String(retries + 1);
        window.readerActiveImageLoads--;
        
        // If the direct link failed and we haven't tried the proxy yet
        if (!isProxyFallback && src.startsWith('http')) {
            var proxyUrl = '/proxy-image?url=' + encodeURIComponent(src);
            window.readerImageQueue.unshift({ container: container, src: proxyUrl, isProxyFallback: true });
        } else {
            showImageError(container, src, false);
        }
        processReaderImageQueue();
    };
}

function loadSingleImage(container, src) {
    // Determine if the URL is already a proxy URL (e.g. from retry button)
    var isProxy = src && src.startsWith('/proxy-image');
    window.readerImageQueue.push({ container: container, src: src, isProxyFallback: isProxy });
    processReaderImageQueue();
}

function showImageError(container, src, exhausted) {
    var mangaId = state.activeMangaId || '';
    var chapterId = state.activeChapterId || '';
    container.innerHTML = '<div class="reader-image-error" style="padding:40px 20px;text-align:center;color:var(--color-accent);display:flex;flex-direction:column;align-items:center;gap:8px;">' +
        '<i class="fa-solid fa-triangle-exclamation" style="font-size:2.5rem;margin-bottom:8px;"></i>' +
        '<p style="font-weight:700;">' + (exhausted ? 'ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ Ø§Ù„ØµÙˆØ±Ø© Ø¨Ø¹Ø¯ Ø¹Ø¯Ø© Ù…Ø­Ø§ÙˆÙ„Ø§Øª' : 'ÙØ´Ù„ ØªØ­Ù…ÙŠÙ„ Ù‡Ø°Ù‡ Ø§Ù„ØµÙØ­Ø©') + '</p>' +
        (exhausted ? '' : '<button class="retry-btn" style="background:var(--color-primary);color:white;border:none;padding:8px 18px;border-radius:20px;cursor:pointer;font-family:var(--font-family);font-weight:700;">Ø¥Ø¹Ø§Ø¯Ø© Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø©</button>') +
        '<button class="alt-source-btn" data-manga-id="' + mangaId + '" data-chap-id="' + chapterId + '" style="background:var(--color-secondary);color:#07080c;border:none;padding:8px 18px;border-radius:20px;cursor:pointer;font-family:var(--font-family);font-weight:700;margin-top:4px;"><i class="fa-solid fa-compass"></i> Ù…ØµØ¯Ø± Ø¨Ø¯ÙŠÙ„</button>' +
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
                                container.parentElement.innerHTML = '<div class="reader-image-placeholder"><i class="fa-solid fa-circle-notch fa-spin" style="font-size:2.5rem;color:var(--color-secondary);margin-bottom:12px;"></i><span>Ø¬Ø§Ø±ÙŠ ØªØ­Ù…ÙŠÙ„ Ù…Ù† Ø§Ù„Ù…ØµØ¯Ø± Ø§Ù„Ø¨Ø¯ÙŠÙ„...</span></div>';
                                loadSingleImage(container.parentElement, '/proxy-image?url=' + encodeURIComponent(data.alt_images[0]));
                            }
                        }
                    } else {
                        alert('Ù„Ù… Ù†Ø¹Ø«Ø± Ø¹Ù„Ù‰ Ù…ØµØ¯Ø± Ø¨Ø¯ÙŠÙ„ Ù„Ù‡Ø°Ø§ Ø§Ù„ÙØµÙ„.');
                    }
                }).catch(function() { alert('Ø®Ø·Ø£ ÙÙŠ Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù…'); });
            }
        };
    }
    var retryBtn = container.querySelector('.retry-btn');
    if (retryBtn) {
        retryBtn.onclick = function(e) {
            e.stopPropagation();
            container.innerHTML = '<div class="reader-image-placeholder">' +
                '<i class="fa-solid fa-circle-notch fa-spin" style="font-size:2.5rem;color:var(--color-primary);margin-bottom:12px;"></i>' +
                '<span>Ø¬Ø§Ø±ÙŠ Ø¥Ø¹Ø§Ø¯Ø© ØªØ­Ù…ÙŠÙ„ Ø§Ù„ØµÙØ­Ø©...</span></div>';
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
        
        // Ø§Ù„ØªØ­Ù…ÙŠÙ„ Ø§Ù„Ø§Ø³ØªØ¨Ø§Ù‚ÙŠ Ø§Ù„Ø°ÙƒÙŠ Ù„Ù„ÙØµÙ„ Ø§Ù„Ù‚Ø§Ø¯Ù…
        if (scrolled > 70 && !window._hasPrefetchedNextChapter && window._nextChapterImages) {
            prefetchNextChapter(window._nextChapterImages);
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
                container.innerHTML = '<p style="text-align:center; padding: 20px; color: var(--text-dark);">Ù„Ø§ ØªÙˆØ¬Ø¯ Ø´ÙƒØ§ÙˆÙ‰ Ø£Ùˆ Ø§Ù‚ØªØ±Ø§Ø­Ø§Øª Ù…Ø±Ø³Ù„Ø© Ø­Ø§Ù„ÙŠØ§Ù‹.</p>';
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
                const badgeText = isComplaint ? 'Ø´ÙƒÙˆÙ‰' : 'Ø§Ù‚ØªØ±Ø§Ø­';
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
            container.innerHTML = '<p style="text-align:center; padding: 20px; color: #ff007f;">ÙØ´Ù„ ØªØ­Ù…ÙŠÙ„ Ø§Ù„Ø§Ù‚ØªØ±Ø§Ø­Ø§Øª Ù…Ù† Ø§Ù„Ø³ÙŠØ±ÙØ±.</p>';
        }
    } catch(e) {
        container.innerHTML = '<p style="text-align:center; padding: 20px; color: #ff007f;">Ø­Ø¯Ø« Ø®Ø·Ø£ Ø£Ø«Ù†Ø§Ø¡ Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù….</p>';
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

// Ø¥ØºÙ„Ø§Ù‚ Ù…Ù‚ØªØ±Ø­Ø§Øª Ø§Ù„Ø¨Ø­Ø« Ø¹Ù†Ø¯ Ø§Ù„Ù†Ù‚Ø± Ø®Ø§Ø±Ø¬ ØµÙ†Ø¯ÙˆÙ‚ Ø§Ù„Ø¨Ø­Ø«
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

    // View toggle (search + browse)
    const viewToggle = e.target.closest('.view-toggle-btn');
    if (viewToggle) {
        const view = viewToggle.dataset.view;
        if (view) {
            state.searchViewMode = view;
            state.searchPage = 1;
            navigate('search', state.searchQuery, view);
        }
        return;
    }

    // Pagination
    const pageBtn = e.target.closest('.page-btn');
    if (pageBtn) {
        const p = parseInt(pageBtn.dataset.page);
        if (p && p !== state.searchPage) {
            state.searchPage = p;
            navigate('search', state.searchQuery, state.searchViewMode);
        }
        return;
    }

    // Browse card/item click
    const browseItem = e.target.closest('.browse-card, .browse-list-item');
    if (browseItem && browseItem.dataset.id) {
        navigate('detail', browseItem.dataset.id);
        return;
    }

    // Browse scope tab
    const scopeBtn = e.target.closest('.browse-scope-btn');
    if (scopeBtn) {
        state.searchScope = scopeBtn.dataset.scope;
        state.searchPage = 1;
        navigate('search', state.searchQuery, state.searchViewMode);
        return;
    }

    // Browse filter toggle
    const filterToggle = e.target.closest('#browse-filter-toggle');
    if (filterToggle) {
        state.browseShowFilters = !state.browseShowFilters;
        navigate('search', state.searchQuery, state.searchViewMode);
        return;
    }
});
document.addEventListener('change', (e) => {
    // Browse sort dropdown
    const sortSelect = e.target.closest('#browse-sort');
    if (sortSelect) {
        state.filterSort = sortSelect.value;
        state.searchPage = 1;
        navigate('search', state.searchQuery, state.searchViewMode);
        return;
    }
    // Browse filter dropdowns
    const filterSelect = e.target.closest('.browse-filter-select');
    if (filterSelect) {
        const id = filterSelect.id;
        if (id === 'browse-filter-status') state.filterStatus = filterSelect.value;
        else if (id === 'browse-filter-type') state.filterType = filterSelect.value;
        else if (id === 'browse-filter-genre') state.activeGenre = filterSelect.value;
        state.searchPage = 1;
        navigate('search', state.searchQuery, state.searchViewMode);
        return;
    }
    // Extra filter inputs
    const filterInput = e.target.closest('.browse-filter-input');
    if (filterInput) {
        const id = filterInput.id;
        const val = filterInput.value;
        if (id === 'browse-filter-year-min') state.filterYearMin = val;
        else if (id === 'browse-filter-year-max') state.filterYearMax = val;
        else if (id === 'browse-filter-rating-min') state.filterRatingMin = val;
        else if (id === 'browse-filter-rating-max') state.filterRatingMax = val;
        else if (id === 'browse-filter-ch-min') state.filterChaptersMin = val;
        else if (id === 'browse-filter-ch-max') state.filterChaptersMax = val;
        return;
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

// ØªØ´ØºÙŠÙ„ Ø§Ù„ØªØ·Ø¨ÙŠÙ‚
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapConfig);
} else {
    bootstrapConfig();
}


// =====================================
// FULL PROFILE VIEW
// =====================================
async function ProfileViewComponent() {
    const s = state;
    const username = s.userEmail ? getUserHandle(s.userEmail) : 'Guest';
    const initial = username.charAt(0).toUpperCase();

    // The Rewards grid injected into profile
    const rewardsHtml = `
        <div class="settings-card">
            <div class="flex-between" style="margin-bottom:15px;">
                <div style="font-weight:bold; font-size:1.1rem;"><i class="fa-solid fa-gift" style="color:var(--primary-color);"></i> Ø§Ù„Ù…ÙƒØ§ÙØ¢Øª Ø§Ù„ÙŠÙˆÙ…ÙŠØ©</div>
                <div style="font-size:0.85rem; color:var(--text-muted);">Ø§Ù„ÙŠÙˆÙ… 2 Ù…Ù† 7 <i class="fa-solid fa-fire" style="color:#e67e22;"></i> ÙŠÙˆÙ… Ù…ØªØªØ§Ù„Ù</div>
            </div>
            <div class="rewards-grid">
                <div class="reward-card completed">
                    <div class="reward-day">1</div>
                    <div class="reward-icon-box"><i class="fa-solid fa-check"></i></div>
                    <div class="reward-prizes">5 <i class="fa-solid fa-star" style="font-size:0.7rem;"></i></div>
                </div>
                <div class="reward-card completed">
                    <div class="reward-day">2</div>
                    <div class="reward-icon-box"><i class="fa-solid fa-check"></i></div>
                    <div class="reward-prizes">10 <i class="fa-solid fa-star" style="font-size:0.7rem;"></i></div>
                </div>
                <div class="reward-card locked">
                    <div class="reward-day">3</div>
                    <div class="reward-icon-box"><i class="fa-solid fa-lock"></i></div>
                    <div class="reward-prizes">15 <i class="fa-solid fa-star" style="font-size:0.7rem;"></i></div>
                </div>
                <div class="reward-card locked">
                    <div class="reward-day">4</div>
                    <div class="reward-icon-box"><i class="fa-solid fa-lock"></i></div>
                    <div class="reward-prizes">20 <i class="fa-solid fa-star" style="font-size:0.7rem;"></i></div>
                </div>
                <div class="reward-card locked">
                    <div class="reward-day">5</div>
                    <div class="reward-icon-box"><i class="fa-solid fa-lock"></i></div>
                    <div class="reward-prizes">25 <i class="fa-solid fa-star" style="font-size:0.7rem;"></i></div>
                </div>
                <div class="reward-card locked">
                    <div class="reward-day">6</div>
                    <div class="reward-icon-box"><i class="fa-solid fa-lock"></i></div>
                    <div class="reward-prizes">30 <i class="fa-solid fa-star" style="font-size:0.7rem;"></i></div>
                </div>
                <div class="reward-card wide locked">
                    <div>
                        <div class="reward-day" style="font-weight:bold; color:#fff;">Ø§Ù„ÙŠÙˆÙ… 7</div>
                        <div style="font-size:0.7rem; color:var(--text-muted);">Ù…ÙƒØ§ÙØ£Ø© Ø§Ù„Ø£Ø³Ø¨ÙˆØ¹ <span style="background:#f39c12; color:#000; padding:2px 5px; border-radius:4px; font-weight:bold;">Ù…Ø¶Ø§Ø¹Ù</span></div>
                        <div class="reward-prizes" style="margin-top:5px;">50 <i class="fa-solid fa-star" style="font-size:0.7rem;"></i></div>
                    </div>
                    <div class="reward-icon-box" style="width:40px; height:40px;"><i class="fa-solid fa-lock"></i></div>
                </div>
            </div>
        </div>
    `;

    return `
    <div style="max-width:1200px; margin:0 auto; padding-bottom:50px;">
        <!-- Banner -->
        <div style="height:300px; background:linear-gradient(to right, #1a1c23, #000), url('https://via.placeholder.com/1200x300/1a1a2e/ffffff?text=Banner') center/cover; position:relative; border-bottom:1px solid rgba(255,255,255,0.05);">
            <div style="position:absolute; bottom:-50px; right:40px; display:flex; align-items:flex-end; gap:20px;">
                <div style="width:120px; height:120px; border-radius:50%; border:4px solid var(--bg-color); background:var(--bg-card); display:flex; align-items:center; justify-content:center; font-size:3rem; color:var(--primary-color);">
                    ${initial}
                </div>
                <div style="padding-bottom:10px;">
                    <h1 style="margin:0; font-size:2rem;">${username}</h1>
                    <span style="color:var(--text-muted);">@${username}</span>
                </div>
            </div>
            <div style="position:absolute; bottom:20px; left:40px;">
                <button class="btn-primary" onclick="navigate('settings')"><i class="fa-solid fa-gear"></i> Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„Ø­Ø³Ø§Ø¨</button>
            </div>
        </div>

        <!-- Stats Row -->
        <div style="display:flex; justify-content:center; gap:50px; padding:30px 0; background:rgba(255,255,255,0.02); margin-top:50px; border-radius:12px;">
            <div style="text-align:center;">
                <div style="font-size:1.5rem; font-weight:bold;">0</div>
                <div style="color:var(--text-muted); font-size:0.85rem;">Ø§Ù„Ù…ØªØ§Ø¨Ø¹ÙˆÙ†</div>
            </div>
            <div style="text-align:center;">
                <div style="font-size:1.5rem; font-weight:bold;">0</div>
                <div style="color:var(--text-muted); font-size:0.85rem;">ÙŠØªØ§Ø¨Ø¹</div>
            </div>
            <div style="text-align:center;">
                <div style="font-size:1.5rem; font-weight:bold;">0</div>
                <div style="color:var(--text-muted); font-size:0.85rem;">Ø£ÙŠØ§Ù… Ø§Ù„ØªØ³Ø¬ÙŠÙ„</div>
            </div>
            <div style="text-align:center;">
                <div style="font-size:1.5rem; font-weight:bold;">0</div>
                <div style="color:var(--text-muted); font-size:0.85rem;">Ø³Ø¬Ù„ Ø§Ù„Ù‚Ø±Ø§Ø¡Ø©</div>
            </div>
        </div>

        <div class="settings-layout" style="margin-top:30px;">
            <div class="settings-content" style="flex:2;">
                <!-- Tabs -->
                <div class="notif-tabs" style="margin-bottom:20px;">
                    <div class="notif-tab active" onclick="window.switchProfileViewTab(this, 'activity')">Ù†Ø´Ø§Ø· Ø§Ù„Ø­Ø³Ø§Ø¨</div>
                    <div class="notif-tab" onclick="window.switchProfileViewTab(this, 'library')">Ø§Ù„Ù…ÙƒØªØ¨Ø©</div>
                    <div class="notif-tab" onclick="window.switchProfileViewTab(this, 'reviews')">Ø§Ù„Ù…Ø±Ø§Ø¬Ø¹Ø§Øª</div>
                    <div class="notif-tab" onclick="window.switchProfileViewTab(this, 'chapters')">Ø§Ù„ÙØµÙˆÙ„</div>
                    <div class="notif-tab" onclick="window.switchProfileViewTab(this, 'ratings')">Ø§Ù„ØªÙ‚ÙŠÙŠÙ…</div>
                </div>
                
                <div class="notif-empty" id="profile-content-box">
                    <i class="fa-solid fa-ghost"></i>
                    <div>Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ø£ÙŠ Ù†Ø´Ø§Ø· Ø­ØªÙ‰ Ø§Ù„Ø¢Ù†</div>
                </div>
            </div>
            
            <div class="settings-sidebar" style="flex:1; padding:0; background:transparent; border:none;">
                <!-- Level System Card -->
                <div class="settings-card">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:15px;">
                        <div>
                            <div style="font-size:0.85rem; color:var(--text-muted);">Ù…Ø¹Ù„ÙˆÙ…Ø§Øª Ø§Ù„Ø¹Ø¶Ùˆ</div>
                            <div style="font-weight:bold; font-size:1.1rem;">Ù…Ø³ØªØ®Ø¯Ù… 1</div>
                        </div>
                        <i class="fa-solid fa-crown" style="font-size:2rem; color:var(--primary-color);"></i>
                    </div>
                    <div style="width:100%; background:rgba(255,255,255,0.1); height:8px; border-radius:4px; margin-bottom:5px; position:relative;">
                        <div style="position:absolute; top:0; right:0; height:100%; width:10%; background:var(--primary-color); border-radius:4px;"></div>
                    </div>
                    <div style="font-size:0.75rem; color:var(--text-muted); text-align:center;">10% Ø¥Ù„Ù‰ Ù…Ø³ØªÙˆÙ‰ 2</div>
                    <p style="font-size:0.7rem; color:rgba(255,255,255,0.3); text-align:center; margin-top:10px;">ÙˆØ³Ø§Ù… Ø§Ù„Ù‚Ø±Ø§Ø¡Ø© ÙˆØ§Ù„Ù…ÙƒØ§ÙØ¢Øª ØªØ¹Ø²Ø² Ù…Ø³ØªÙˆØ§Ùƒ Ø£Ø¹Ù„Ù‰</p>
                </div>

                ${rewardsHtml}
            </div>
        </div>
    </div>
    `;
}

// =====================================
// SETTINGS VIEW
// =====================================
function SettingsViewComponent() {
    const s = state;

    const profileHtml = `
        <div class="settings-tab-pane" id="settings-pane-profile" style="display:block;">
            <div class="settings-section-title"><i class="fa-regular fa-user"></i> Ù…Ø¸Ù‡Ø± Ø§Ù„Ù…Ù„Ù Ø§Ù„Ø´Ø®ØµÙŠ</div>
            <div class="settings-card">
                <div class="flex-between">
                    <div>
                        <div class="form-label">ØµÙˆØ±Ø© Ø§Ù„ØºÙ„Ø§Ù (Banner)</div>
                        <div onclick="alert('Ø³ÙŠØªÙ… ØªÙØ¹ÙŠÙ„ Ø±ÙØ¹ Ø§Ù„ØµÙˆØ± Ù‚Ø±ÙŠØ¨Ø§Ù‹')" style="width:400px; height:120px; background:rgba(0,0,0,0.3); border:2px dashed rgba(255,255,255,0.1); border-radius:10px; display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--text-muted); cursor:pointer;">
                            <i class="fa-solid fa-cloud-arrow-up" style="font-size:2rem; margin-bottom:10px;"></i>
                            <span>Ø±ÙØ¹ ØµÙˆØ±Ø© ØºÙ„Ø§Ù</span>
                        </div>
                    </div>
                    <div>
                        <div class="form-label">Ø§Ù„ØµÙˆØ±Ø© Ø§Ù„Ø´Ø®ØµÙŠØ©</div>
                        <div onclick="alert('Ø³ÙŠØªÙ… ØªÙØ¹ÙŠÙ„ Ø±ÙØ¹ Ø§Ù„ØµÙˆØ± Ù‚Ø±ÙŠØ¨Ø§Ù‹')" style="width:100px; height:100px; border-radius:50%; background:rgba(0,0,0,0.3); border:2px dashed rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; color:var(--text-muted); cursor:pointer;">
                            <i class="fa-solid fa-camera"></i>
                        </div>
                    </div>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Ø§Ù„Ø§Ø³Ù… Ø§Ù„Ù…Ø³ØªØ¹Ø§Ø±</label>
                <input type="text" class="form-control" value="${s.userEmail ? getUserHandle(s.userEmail) : ''}">
            </div>
            <div class="form-group">
                <label class="form-label">Ø§Ù„Ù†Ø¨Ø°Ø© Ø§Ù„ØªØ¹Ø±ÙŠÙÙŠØ© (Bio)</label>
                <textarea class="form-control" placeholder="ØªØ­Ø¯Ø« Ø¹Ù† Ù†ÙØ³Ùƒ..."></textarea>
                <div style="font-size:0.75rem; color:var(--text-muted); margin-top:5px; text-align:left;">0/500</div>
            </div>
        </div>
    `;

    const securityHtml = `
        <div class="settings-tab-pane" id="settings-pane-security" style="display:none;">
            <div class="settings-section-title"><i class="fa-solid fa-lock"></i> Ø§Ù„Ø£Ù…Ø§Ù† ÙˆØªØºÙŠÙŠØ± ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±</div>
            <div class="settings-card">
                <div class="form-group">
                    <label class="form-label">ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø§Ù„Ø­Ø§Ù„ÙŠØ©</label>
                    <input type="password" class="form-control" value="........................">
                </div>
                <div class="form-group">
                    <label class="form-label">ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø©</label>
                    <input type="password" class="form-control" placeholder="........">
                </div>
                <div class="form-group">
                    <label class="form-label">ØªØ£ÙƒÙŠØ¯ ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø©</label>
                    <input type="password" class="form-control" placeholder="........">
                </div>
                <div style="text-align:left;">
                    <button class="btn-primary" onclick="alert('ØªÙ… ØªØ­Ø¯ÙŠØ« Ø§Ù„Ø£Ù…Ø§Ù† Ø¨Ù†Ø¬Ø§Ø­')">ØªØºÙŠÙŠØ± ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±</button>
                </div>
            </div>
        </div>
    `;

    const notifHtml = `
        <div class="settings-tab-pane" id="settings-pane-notifications" style="display:none;">
            <div class="settings-section-title"><i class="fa-regular fa-bell"></i> Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª</div>
            <div class="settings-card">
                <div class="flex-between" style="margin-bottom:15px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:15px;">
                    <div>
                        <div style="font-weight:bold; margin-bottom:5px;">Ø¥Ø´Ø¹Ø§Ø±Ø§Øª Ø§Ù„ÙØµÙˆÙ„ Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø©</div>
                        <div style="color:var(--text-muted); font-size:0.85rem;">ØªÙ„Ù‚ÙŠ Ø¥Ø´Ø¹Ø§Ø±Ø§Øª ÙÙˆØ±ÙŠØ© Ø¹Ù†Ø¯ ØµØ¯ÙˆØ± ÙØµÙˆÙ„ Ù„Ù„Ù…Ø§Ù†Ø¬Ø§ ÙÙŠ Ù…ÙƒØªØ¨ØªÙƒ.</div>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" checked>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <div class="flex-between">
                    <div>
                        <div style="font-weight:bold; margin-bottom:5px;">Ø¥Ø´Ø¹Ø§Ø±Ø§Øª Ø§Ù„Ù†Ø¸Ø§Ù…</div>
                        <div style="color:var(--text-muted); font-size:0.85rem;">Ø¥Ø´Ø¹Ø§Ø±Ø§Øª ØªØ®Øµ Ø§Ù„ØªØ­Ø¯ÙŠØ«Ø§Øª ÙˆØ§Ù„Ù‡Ø¯Ø§ÙŠØ§ ÙˆØ§Ù„Ù…ÙƒØ§ÙØ¢Øª.</div>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" checked>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </div>
        </div>
    `;

    const privacyHtml = `
        <div class="settings-tab-pane" id="settings-pane-privacy" style="display:none;">
            <div class="settings-section-title"><i class="fa-solid fa-shield-halved"></i> Ø§Ù„Ø®ØµÙˆØµÙŠØ© ÙˆØ§Ù„Ø¨ÙŠØ§Ù†Ø§Øª</div>
            <div class="settings-card flex-between">
                <div>
                    <div style="font-weight:bold; font-size:1.1rem; margin-bottom:5px;">Ø¥Ø®ÙØ§Ø¡ Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ù‚Ø±Ø§Ø¡Ø©</div>
                    <div style="color:var(--text-muted); font-size:0.85rem;">Ø§Ù„Ø³Ù…Ø§Ø­ Ù„Ù„Ø¢Ø®Ø±ÙŠÙ† Ø¨Ù…Ø´Ø§Ù‡Ø¯Ø© Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ø£Ø¹Ù…Ø§Ù„ Ø§Ù„ØªÙŠ ØªÙ‚Ø±Ø£Ù‡Ø§.</div>
                </div>
                <label class="toggle-switch">
                    <input type="checkbox" checked>
                    <span class="toggle-slider"></span>
                </label>
            </div>
        </div>
    `;

    return `
    <div class="settings-container">
        <div style="font-size:1.5rem; font-weight:bold; margin-bottom:10px;">Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª</div>
        <div style="color:var(--text-muted); margin-bottom:30px;">Ø¥Ø¯Ø§Ø±Ø© Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø­Ø³Ø§Ø¨Ùƒ ÙˆØªÙØ¶ÙŠÙ„Ø§ØªÙƒ.</div>
        
        <div class="settings-layout">
            <div class="settings-sidebar">
                <div class="settings-sidebar-title"><i class="fa-regular fa-user"></i> Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„Ø¹Ø§Ù…Ø©</div>
                <div class="settings-sidebar-subtitle">ØªØ­ÙƒÙ… Ø¨Ù…Ù„ÙÙƒ Ø§Ù„Ø´Ø®ØµÙŠ ÙˆØ§Ù„Ø£Ù…Ø§Ù†</div>
                <div class="settings-nav-item active" onclick="window.switchSettingsTab(this, 'profile')">
                    <i class="fa-regular fa-user"></i> Ù…Ø¸Ù‡Ø± Ø§Ù„Ù…Ù„Ù Ø§Ù„Ø´Ø®ØµÙŠ
                </div>
                <div class="settings-nav-item" onclick="window.switchSettingsTab(this, 'security')">
                    <i class="fa-solid fa-lock"></i> Ø§Ù„Ø£Ù…Ø§Ù†
                </div>
                <div class="settings-nav-item" onclick="window.switchSettingsTab(this, 'notifications')">
                    <i class="fa-regular fa-bell"></i> Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª
                </div>
                <div class="settings-nav-item" onclick="window.switchSettingsTab(this, 'privacy')">
                    <i class="fa-solid fa-shield-halved"></i> Ø§Ù„Ø®ØµÙˆØµÙŠØ© ÙˆØ§Ù„Ø¨ÙŠØ§Ù†Ø§Øª
                </div>
            </div>
            
            <div class="settings-content">
                ${profileHtml}
                ${securityHtml}
                ${notifHtml}
                ${privacyHtml}
            </div>
        </div>
    </div>
    `;
}
window.navigateView = function(view) {
    state.currentView = view;
    if (view === 'settings') state.settingsTab = 'profile';
    renderApp();
};
window.toggleTopDropdown = function(id) {
    document.querySelectorAll('.top-dropdown').forEach(d => {
        if (d.id !== id) d.classList.remove('show');
    });
    const el = document.getElementById(id);
    if(el) el.classList.toggle('show');
};
window.applyTheme = function(theme) {
    document.documentElement.setAttribute('data-theme', theme);
};

// GLOBAL HELPERS
if (typeof window.navigateSettings === 'undefined') {
    window.navigateSettings = function(tab) {
        state.settingsTab = tab;
        state.currentView = 'settings';
        renderApp();
    };
}

// GLOBAL PROFILE TAB SWITCHER
if (typeof window.switchProfileViewTab === 'undefined') {
    window.switchProfileViewTab = function(element, tabName) {
        if (!element || !element.parentElement) return;
        const tabs = element.parentElement.children;
        for(let i=0; i<tabs.length; i++) tabs[i].classList.remove('active');
        element.classList.add('active');
        
        const contentBox = document.getElementById('profile-content-box');
        if (!contentBox) return;
        
        if(tabName === 'activity') {
            contentBox.innerHTML = '<i class="fa-solid fa-ghost"></i><div>Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ø£ÙŠ Ù†Ø´Ø§Ø· Ø­ØªÙ‰ Ø§Ù„Ø¢Ù†</div>';
        } else if(tabName === 'library') {
            contentBox.innerHTML = '<i class="fa-solid fa-book-open"></i><div>Ø§Ù„Ù…ÙƒØªØ¨Ø© ÙØ§Ø±ØºØ©</div>';
        } else if(tabName === 'reviews') {
            contentBox.innerHTML = '<i class="fa-solid fa-star"></i><div>Ù„Ø§ ØªÙˆØ¬Ø¯ Ù…Ø±Ø§Ø¬Ø¹Ø§Øª</div>';
        } else if(tabName === 'chapters') {
            contentBox.innerHTML = '<i class="fa-solid fa-file-lines"></i><div>Ù„Ù… ØªÙ‚Ù… Ø¨Ù‚Ø±Ø§Ø¡Ø© Ø£ÙŠ ÙØµÙˆÙ„ Ø¨Ø¹Ø¯</div>';
        } else if(tabName === 'ratings') {
            contentBox.innerHTML = '<i class="fa-solid fa-thumbs-up"></i><div>Ù„Ù… ØªÙ‚Ù… Ø¨ØªÙ‚ÙŠÙŠÙ… Ø£ÙŠ Ù…Ø§Ù†Ø¬Ø§</div>';
        }
    };
}

if (typeof window.switchSettingsTab === 'undefined') {
    window.switchSettingsTab = function(element, tabId) {
        if (!element || !element.parentElement) return;
        const tabs = element.parentElement.children;
        for(let i=0; i<tabs.length; i++) {
            if (tabs[i].classList.contains('settings-nav-item')) {
                tabs[i].classList.remove('active');
            }
        }
        element.classList.add('active');
        
        const contents = document.querySelectorAll('.settings-tab-pane');
        contents.forEach(c => c.style.display = 'none');
        
        const activeTab = document.getElementById('settings-pane-' + tabId);
        if (activeTab) activeTab.style.display = 'block';
    };
}


async function fetchMangaDetails(mangaId) {
    const manga = state.mangas.find(m => String(m.id) === String(mangaId));
    if (!manga) return;
    if (manga.chapters && manga.chapters.length > 0) return;
    if (manga.isFetching) return;
    manga.isFetching = true;
    try {
        const response = await fetch('./mangas_data/' + mangaId + '.json');
        if (response.ok) {
            const data = await response.json();
            Object.assign(manga, data);
        }
    } catch (e) { console.error(e); }
    manga.isFetching = false;
}



function SuggestionsViewComponent() {
    const backBtn = `
        <div style="padding:16px 0 0 0;">
            <button onclick="window.navigateView('home')" style="background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.12); color:var(--text-main); padding:10px 22px; border-radius:30px; cursor:pointer; font-family:inherit; font-size:0.95rem; display:inline-flex; align-items:center; gap:8px; transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.13)'" onmouseout="this.style.background='rgba(255,255,255,0.07)'">
                <i class="fa-solid fa-arrow-right"></i> Ø§Ù„Ø¹ÙˆØ¯Ø© Ù„Ù„Ø±Ø¦ÙŠØ³ÙŠØ©
            </button>
        </div>`;

    if (!state.userEmail) {
        return `
        <div class="container" style="max-width:800px; padding-top:20px; padding-bottom:60px;">
            ${backBtn}
            <div style="text-align:center; padding:80px 20px;">
                <i class="fa-solid fa-lock" style="font-size:3rem; color:var(--color-primary); margin-bottom:20px; display:block;"></i>
                <h2 style="margin-bottom:15px;">ÙŠØ¬Ø¨ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„</h2>
                <p style="color:var(--text-muted); margin-bottom:25px;">Ø¹Ø°Ø±Ø§Ù‹ØŒ ÙŠØ¬Ø¨ Ø¹Ù„ÙŠÙƒ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ù„ØªØªÙ…ÙƒÙ† Ù…Ù† Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ø§Ù‚ØªØ±Ø§Ø­Ø§Øª Ø£Ùˆ Ø§Ù„Ø´ÙƒØ§ÙˆÙŠ.</p>
                <button class="primary-btn" onclick="state.showAuthModal=true; state.authModalTab='login'; renderApp();">
                    <i class="fa-solid fa-right-to-bracket"></i> ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„
                </button>
            </div>
        </div>`;
    }
    return `
    <div class="container" style="max-width:800px; padding-top:20px; padding-bottom:60px;">
        ${backBtn}
        <div style="text-align:center; margin:30px 0 40px;">
            <h1 style="font-size:2.2rem; margin-bottom:12px; color:var(--color-primary);">
                <i class="fa-solid fa-envelope-open-text"></i> Ø§Ù„Ø§Ù‚ØªØ±Ø§Ø­Ø§Øª ÙˆØ§Ù„Ø´ÙƒØ§ÙˆÙŠ
            </h1>
            <p style="color:var(--text-muted); font-size:1rem;">Ù†Ø­Ù† Ù†Ø³ØªÙ…Ø¹ Ø¥Ù„ÙŠÙƒ! Ø£Ø±Ø³Ù„ Ù„Ù†Ø§ Ø£ÙÙƒØ§Ø±Ùƒ Ù„ØªØ·ÙˆÙŠØ± Ø§Ù„Ù…ÙˆÙ‚Ø¹ØŒ Ø£Ùˆ Ø£ÙŠ Ù…Ø´ÙƒÙ„Ø© ØªÙˆØ§Ø¬Ù‡Ùƒ ÙˆØ³Ù†Ù‚ÙˆÙ… Ø¨Ø­Ù„Ù‡Ø§ ÙÙˆØ±Ø§Ù‹.</p>
        </div>
        
        <div style="background:var(--secondary-color); padding:30px; border-radius:15px; border:1px solid rgba(255,255,255,0.05);">
            <div class="form-group" style="margin-bottom:20px;">
                <label style="display:block; margin-bottom:10px; font-weight:bold;">Ù†ÙˆØ¹ Ø§Ù„Ø±Ø³Ø§Ù„Ø©</label>
                <select id="sug-type" style="width:100%; padding:15px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); border-radius:10px; color:#fff; font-family:inherit; font-size:1rem; outline:none;">
                    <option value="suggestion" style="background:var(--secondary-color);">ðŸ’¡ Ø§Ù‚ØªØ±Ø§Ø­ Ù„ØªØ·ÙˆÙŠØ± Ø§Ù„Ù…ÙˆÙ‚Ø¹</option>
                    <option value="complaint" style="background:var(--secondary-color);">âš ï¸ Ø´ÙƒÙˆÙ‰ Ø£Ùˆ Ù…Ø´ÙƒÙ„Ø© ÙÙ†ÙŠØ©</option>
                </select>
            </div>
            
            <div class="form-group" style="margin-bottom:25px;">
                <label style="display:block; margin-bottom:10px; font-weight:bold;">Ù†Øµ Ø§Ù„Ø±Ø³Ø§Ù„Ø©</label>
                <textarea id="sug-content" rows="6" placeholder="Ø§ÙƒØªØ¨ Ø±Ø³Ø§Ù„ØªÙƒ Ù‡Ù†Ø§ Ø¨Ø§Ù„ØªÙØµÙŠÙ„..." style="width:100%; padding:15px; box-sizing:border-box; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); border-radius:10px; color:#fff; font-family:inherit; font-size:1rem; outline:none; resize:vertical;"></textarea>
            </div>
            
            <button id="sug-submit-btn" class="primary-btn" style="width:100%; padding:15px; font-size:1.1rem; border-radius:10px;" onclick="window.submitSuggestion()">
                <i class="fa-solid fa-paper-plane"></i> Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ø±Ø³Ø§Ù„Ø©
            </button>
        </div>
    </div>
    `;
}

window.submitSuggestion = async function() {
    const type = document.getElementById('sug-type').value;
    const content = document.getElementById('sug-content').value.trim();
    const btn = document.getElementById('sug-submit-btn');
    
    if (!content) {
        alert('Ø§Ù„Ø±Ø¬Ø§Ø¡ ÙƒØªØ§Ø¨Ø© Ù†Øµ Ø§Ù„Ø±Ø³Ø§Ù„Ø© Ø£ÙˆÙ„Ø§Ù‹!');
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Ø¬Ø§Ø±ÙŠ Ø§Ù„Ø¥Ø±Ø³Ø§Ù„...';
    
    try {
        const response = await fetch('/api/suggestions', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({type: type, content: content})
        });
        
        const data = await response.json();
        if (response.ok) {
            alert('ØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ø±Ø³Ø§Ù„ØªÙƒ Ø¨Ù†Ø¬Ø§Ø­! Ø´ÙƒØ±Ø§Ù‹ Ù„ØªÙˆØ§ØµÙ„Ùƒ Ù…Ø¹Ù†Ø§.');
            document.getElementById('sug-content').value = '';
            navigate('home');
        } else {
            alert(data.error || 'Ø­Ø¯Ø« Ø®Ø·Ø£ Ø£Ø«Ù†Ø§Ø¡ Ø§Ù„Ø¥Ø±Ø³Ø§Ù„');
        }
    } catch (e) {
        alert('Ø®Ø·Ø£ ÙÙŠ Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù…');
    }
    
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ø±Ø³Ø§Ù„Ø©';
};


window.startLiveScrape = function() {
    const url = document.getElementById('live-scrape-url').value.trim();
    if (!url) return alert('ÙŠØ±Ø¬Ù‰ Ø¥Ø¯Ø®Ø§Ù„ Ø§Ù„Ø±Ø§Ø¨Ø· Ø£ÙˆÙ„Ø§Ù‹!');
    
    const terminal = document.getElementById('terminal-output');
    const btn = document.getElementById('live-scrape-btn');
    
    terminal.innerHTML = '<span style="color:#0f0;">$ Starting scrape for: ' + url + '</span>\n';
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Ø¬Ø§Ø±ÙŠ Ø§Ù„Ø³Ø­Ø¨...';
    
    // Connect to SSE Endpoint
    const eventSource = new EventSource(`/api/admin/scrape_stream?url=${encodeURIComponent(url)}&token=${state.sessionToken}`);
    
    eventSource.onmessage = function(event) {
        const data = event.data;
        if (data === '[DONE]') {
            terminal.innerHTML += '\n<span style="color:#0f0;">$ Process Finished!</span>\n';
            eventSource.close();
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-play"></i> Ø§Ø¨Ø¯Ø£ Ø§Ù„Ø³Ø­Ø¨';
            return;
        }
        
        // Auto scroll to bottom
        terminal.innerHTML += data + '\n';
        terminal.scrollTop = terminal.scrollHeight;
    };
    
    eventSource.onerror = function(e) {
        terminal.innerHTML += '\n<span style="color:red;">$ Connection Error or Process Terminated.</span>\n';
        eventSource.close();
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-play"></i> Ø§Ø¨Ø¯Ø£ Ø§Ù„Ø³Ø­Ø¨';
    };
};

window.checkAutoUpdaterStatus = async function() {
    try {
        const res = await fetch('/api/admin/updater_status');
        const data = await res.json();
        const toggle = document.getElementById('auto-updater-toggle');
        const statusText = document.getElementById('auto-updater-status');
        
        if (data.enabled) {
            toggle.checked = true;
            statusText.textContent = 'ÙŠØ¹Ù…Ù„ Ø§Ù„Ø¢Ù† (Active)';
            statusText.style.color = '#00E676';
        } else {
            toggle.checked = false;
            statusText.textContent = 'Ù…ØªÙˆÙ‚Ù (Paused)';
            statusText.style.color = '#ff4444';
        }
    } catch(e) {}
};

window.toggleAutoUpdater = async function() {
    const toggle = document.getElementById('auto-updater-toggle');
    const newState = toggle.checked;
    const statusText = document.getElementById('auto-updater-status');
    
    statusText.textContent = 'Ø¬Ø§Ø±ÙŠ Ø§Ù„Ø­ÙØ¸...';
    
    try {
        const res = await fetch('/api/admin/updater_toggle', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.sessionToken}`
            },
            body: JSON.stringify({enabled: newState})
        });
        const data = await res.json();
        
        if (data.enabled) {
            statusText.textContent = 'ÙŠØ¹Ù…Ù„ Ø§Ù„Ø¢Ù† (Active)';
            statusText.style.color = '#00E676';
        } else {
            statusText.textContent = 'Ù…ØªÙˆÙ‚Ù (Paused)';
            statusText.style.color = '#ff4444';
        }
    } catch (e) {
        alert('Ø­Ø¯Ø« Ø®Ø·Ø£');
        toggle.checked = !newState;
    }
};
