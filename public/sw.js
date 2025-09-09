// public/sw.js

const CACHE_NAME = "jibzo-app-cache-v1";
const urlsToCache = [
  "/",
  "/index.html",
  "/favicon.svg",
  "/manifest.webmanifest",
  "/logo192.png",
  "/logo512.png"
];

// Install event – cache core assets
self.addEventListener("install", (event) => {
  console.log("[Service Worker] Installing...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching app shell");
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// Activate event – clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[Service Worker] Activating...");
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("[Service Worker] Deleting old cache:", cache);
            return caches.delete(cache);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// Fetch event – serve cached content when offline
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return; // only cache GET requests

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse; // serve from cache
      }

      // Fetch from network and cache dynamically
      return fetch(event.request)
        .then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          // fallback if offline and resource not cached
          if (event.request.destination === "document") {
            return caches.match("/index.html");
          }
        });
    })
  );
});
