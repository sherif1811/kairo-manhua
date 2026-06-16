// Monetag Push Notifications & Verification
self.options = {
    "domain": "5gvci.com",
    "zoneId": 11158922
}
self.lary = ""
importScripts('https://5gvci.com/act/files/service-worker.min.js?r=sw')

const CACHE_NAME = 'kairo-cache-v33';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/app.js',
    '/style.css',
    '/manifest.json',
    '/icon-192.svg',
    '/offline.html'
];

// Fonts & CDN origins to cache
const CDN_ORIGINS = [
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    'https://cdnjs.cloudflare.com'
];

// Install: cache the app shell
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(STATIC_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: Cache First for static, Network First for API, Cache First for images
self.addEventListener('fetch', event => {
    // Skip non-HTTP(S) requests (chrome-extension, file, data, etc.)
    if (!event.request.url.startsWith('http')) return;
    const url = new URL(event.request.url);

    // Bypass cache completely for API calls or versioned requests
    if (url.pathname.startsWith('/api/') || url.search.includes('v=')) {
        return;
    }
    const isDoc = url.pathname === '/' || url.pathname === '/index.html';
    const isStaticAsset = STATIC_ASSETS.includes(url.pathname);
    const isCDN = CDN_ORIGINS.some(o => event.request.url.startsWith(o));
    const isImage = event.request.destination === 'image' ||
        url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)$/i);
    const isAPI = url.pathname.startsWith('/api/');

    if (isDoc) {
        // Network First for the document to always serve fresh HTML
        event.respondWith(networkFirst(event.request));
    } else if (isStaticAsset) {
        // Stale-While-Revalidate: serve cached instantly, fetch latest in background
        event.respondWith(staleWhileRevalidate(event.request));
    } else if (isImage) {
        // Cache First for images with network fallback
        event.respondWith(cacheFirst(event.request));
    } else {
        // Network First for everything else
        event.respondWith(networkFirst(event.request));
    }
});

async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
        const response = await fetch(request);
        if (response.ok && request.method === 'GET') {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch (e) {
        return caches.match('/offline.html');
    }
}

async function staleWhileRevalidate(request) {
    const cached = await caches.match(request);
    const fetchPromise = fetch(request).then(response => {
        if (response.ok && request.method === 'GET') {
            const cache = caches.open(CACHE_NAME);
            cache.then(c => c.put(request, response.clone()));
        }
        return response;
    }).catch(() => cached);
    return cached || fetchPromise;
}

async function networkFirst(request) {
    try {
        const response = await fetch(request);
        if (response.ok && request.method === 'GET') {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch (e) {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.destination === 'document') {
            return caches.match('/offline.html');
        }
        return new Response('', { status: 503, statusText: 'Offline' });
    }
}
