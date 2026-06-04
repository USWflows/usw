/**
 * USW OFFLINE RUNTIME KERNEL v14.2
 * Strategy: Cache-First Dynamic Capture Engine
 * Drop-in ready. Handles absolute offline execution flawlessly.
 */

const CACHE_NAME = 'usw-absolute-offline-v14';

// App core local files cached immediately during installation
const CORE_ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './storage.js',
    './manifest.json',
    './icon-512.png'
];

// 1. INSTALL LIFECYCLE: Cache application baseline partitions
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('USW_KERNEL: Seeding local app partitions...');
            return cache.addAll(CORE_ASSETS);
        })
    );
});

// 2. ACTIVATION LIFECYCLE: Purge stale infrastructure cache blocks
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('USW_KERNEL: Dropping legacy cache frame:', key);
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// 3. PROXY INTERCEPTION: Complete offline redirection and on-the-fly dynamic caching
self.addEventListener('fetch', (event) => {
    // Keep internal browser extension or web-socket metrics out of the pipeline
    if (!event.request.url.startsWith('http')) return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                // Asset found locally. Serve instantly with 0ms network latency.
                return cachedResponse;
            }

            return fetch(event.request).then((networkResponse) => {
                // Fallback validation check
                if (!networkResponse || networkResponse.status !== 200) {
                    return networkResponse;
                }

                const requestUrl = event.request.url;
                
                // DYNAMIC SCAN: Intercept and store ANY file chunk requested by Monaco or Pyodide CDNs
                const isExternalEngine = requestUrl.includes('cdnjs.cloudflare.com') || 
                                         requestUrl.includes('cdn.jsdelivr.net') ||
                                         requestUrl.includes('monaco-editor') || 
                                         requestUrl.includes('pyodide');

                if (isExternalEngine) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                        console.log(`USW_KERNEL: Securely localized runtime asset -> ${requestUrl}`);
                    });
                }

                return networkResponse;
            }).catch((err) => {
                // Fallback for navigation route failures when offline
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
                throw err;
            });
        })
    );
});
