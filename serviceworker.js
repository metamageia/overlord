const CACHE_VERSION = "v2.1.0";
const CACHE_NAME = "pwa-cache-" + CACHE_VERSION;
const ASSETS = [
    "./index.html",
    "./main.js",
    "./styles.css",
    "./manifest.json"
];

// Install event - cache assets
self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS);
        }).then(() => self.skipWaiting()) // Force activation
    );
});

// Activate event - clean up old caches
self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(name => name.startsWith("pwa-cache-") && name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        }).then(() => self.clients.claim()) // Take control of clients
    );
});

// Fetch event - network-first approach for HTML, cache-first for other assets
self.addEventListener("fetch", event => {
    // Don't intercept WebSocket connections
    if (event.request.url.includes('ws:') || event.request.url.includes('wss:')) {
        return;
    }

    const url = new URL(event.request.url);
    
    // For HTML documents, try network first and fall back to cache
    if (event.request.mode === 'navigate' || 
        (event.request.method === 'GET' && 
         (event.request.headers.get('accept').includes('text/html') ||
          event.request.url.endsWith('.js') ||
          event.request.url.endsWith('.mjs')))) {
        event.respondWith(
            fetch(event.request).then(response => {
                // Clone the response before using it
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseClone);
                });
                return response;
            }).catch(() => {
                return caches.match(event.request);
            })
        );
    } else {
        // For other assets, check cache first then network
        event.respondWith(
            caches.match(event.request).then(response => {
                return response || fetch(event.request).then(networkResponse => {
                    // Cache the new version
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                    return networkResponse;
                });
            })
        );
    }
});
