/**
 * USW OFFLINE RUNTIME KERNEL v14.0
 * Strategy: Cache-First Strategy with Explicit CDN Asset Interception
 */

const CACHE_NAME = 'usw-absolute-offline-v14';

// App core components to cache instantly on install
const CORE_ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './storage.js',
    './manifest.json',
    './icon-512.png'
];

// Explicitly capture external engines during runtime requests
const EXTERNAL_CDN_ASSETS = [
    'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/loader.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/editor/editor.main.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/editor/editor.main.js',
    'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/editor/editor.main.nls.js',
    'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js',
    'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.asm.js',
    'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.asm.wasm',
    'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide-lock.json'
];

// 1. INSTALL LIFECYCLE: Cache all core files
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('USW_KERNEL: Seeding local drive partitions...');
            return cache.addAll(CORE_ASSETS);
        })
    );
});

// 2. ACTIVATE LIFECYCLE: Clean up stale legacy cache builds
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('USW_KERNEL: Purging older storage blocks:', key);
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// 3. PROXY INTERCEPTION: Read directly from cache if offline
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                // If it's already cached, return it instantly with zero network delay
                return cachedResponse;
            }

            return fetch(event.request).then((networkResponse) => {
                // Secure a clone of the stream if it's one of our key dependencies
                const requestUrl = event.request.url;
                const matchesCDN = EXTERNAL_CDN_ASSETS.some(assetUrl => requestUrl.includes(assetUrl)) || 
                                   requestUrl.includes('monaco-editor') || 
                                   requestUrl.includes('pyodide');

                if (networkResponse.status === 200 && matchesCDN) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                        console.log(`USW_KERNEL: Securely localized remote asset context -> ${requestUrl}`);
                    });
                }
                return networkResponse;
            }).catch((err) => {
                // Fallback for navigation requests when network is dead
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
                throw err;
            });
        })
    );
});
