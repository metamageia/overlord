const CACHE_NAME = "pwa-cache-v1";
const ASSETS = [
    "index.html",
    "main.js",
    "styles.css",
    "manifest.json"
    // External icons are intentionally excluded
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener("fetch", event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});
