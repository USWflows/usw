/**
 * USW PASS-THROUGH OFFLINE RUNTIME v14.3
 * Fixes: "NetworkError when attempting to fetch resource"
 */

const CACHE_NAME = 'usw-absolute-offline-v14';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './storage.js',
    './manifest.json',
    './icon-512.png'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) return caches.delete(key);
                })
            );
        })
    );
    return self.clients.claim();
});

// Optimized fetch strategy to prevent WASM blocking
self.addEventListener('fetch', (event) => {
    if (!event.request.url.startsWith('http')) return;

    // Handle CDN dependencies with an absolute pass-through + cache save
    if (event.request.url.includes('cdnjs') || event.request.url.includes('cdn.jsdelivr')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Offline fallback: serve from cache if available
                    return caches.match(event.request);
                })
        );
        return;
    }

    // Default strategy for local app assets
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return fetch(event.request);
        })
    );
});
