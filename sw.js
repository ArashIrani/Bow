// Manshoor PWA Service Worker - Complete Offline Support
const CACHE_NAME = "manshoor-cache-v3";

const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/letters.html",
  "/acronyms.html",
  "/timeline.html",
  "/admin.html",
  "/styles/tokens.css",
  "/styles/base.css",
  "/styles/components.css",
  "/styles/pages.css",
  "/scripts/main.js",
  "/scripts/admin.js",
  "/data/content.json",
  "/data/settings.json",
  "/manifest.json",
  "/icon.svg",
  "/apple-touch-icon.png",
  "/pwa-192x192.png",
  "/pwa-512x512.png",
  "/pwa-maskable-512x512.png"
];

// Install Event: Cache Core Assets
self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_ASSETS).catch(err => {
        console.warn("Some precache assets failed to cache:", err);
      });
    })
  );
});

// Activate Event: Clean up outdated caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Cache-First for static assets, Network-First with Cache Fallback for data & HTML
self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests or GitHub API requests (always network for commits)
  if (req.method !== "GET" || url.origin.includes("api.github.com")) {
    return;
  }

  // 1. Data JSON files: Stale-While-Revalidate or Network-First with cache fallback
  if (url.pathname.includes("/data/")) {
    event.respondWith(
      fetch(req)
        .then(networkRes => {
          if (networkRes.ok) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 2. Google Fonts & CDN: Cache-First
  if (url.origin.includes("fonts.googleapis.com") || url.origin.includes("fonts.gstatic.com")) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
          return res;
        });
      })
    );
    return;
  }

  // 3. App Shell & Static Assets: Cache-First with Network fallback
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(networkRes => {
        if (networkRes.ok && networkRes.status === 200) {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return networkRes;
      }).catch(() => {
        // Offline fallback for HTML navigation
        if (req.mode === "navigate") {
          return caches.match("/index.html");
        }
      });
    })
  );
});
