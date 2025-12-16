const CACHE_NAME = "consumption-tracker-v2";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./privacy.html",
  "./status.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./favicon.ico",
  "./css/main.css",
  "./css/base.css",
  "./css/components/layout.css",
  "./css/components/card.css",
  "./css/components/button.css",
  "./css/components/forms.css",
  "./css/components/calendar.css",
  "./css/components/badge.css",
  "./css/components/modal.css",
  "./css/components/history.css",
  "./css/components/footer.css",
  "./js/app.js",
  "./js/state.js",
  "./js/ui.js",
  "./js/calendar.js",
  "./js/charts.js",
  "./js/auth.js",
  "./js/db.js",
  "./js/utils.js",
  "./config.js"
];

// External resources to cache on first use
const EXTERNAL_CACHE = [
  "https://cdn.jsdelivr.net/npm/chart.js",
  "https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js"
];

// Install: Cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Caching static assets");
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate: Clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log("[SW] Removing old cache:", key);
            return caches.delete(key);
          })
      )
    )
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// Fetch: Network-first with cache fallback for HTML, cache-first for assets
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== "GET") return;

  // Skip Firebase and other API requests
  if (url.hostname.includes("firebase") ||
    url.hostname.includes("googleapis.com")) {
    return;
  }

  // For navigation requests (HTML), use network-first
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone and cache the response
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // Fall back to cache
          return caches.match(event.request);
        })
    );
    return;
  }

  // For other assets, use cache-first with network fallback
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached version and update cache in background
        fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, response.clone());
            });
          }
        }).catch(() => { }); // Ignore network errors for background update
        return cachedResponse;
      }

      // Not in cache, fetch from network
      return fetch(event.request).then((response) => {
        // Cache external resources on first fetch
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      });
    })
  );
});

// Listen for messages from main thread
self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") {
    self.skipWaiting();
  }
});
