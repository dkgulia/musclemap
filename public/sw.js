// MuscleMap Service Worker
// Caches static assets for offline use. Does NOT cache any image data.

const CACHE_NAME = "musclemap-v1";
const STATIC_ASSETS = [
  "/app/scan",
  "/app/trends",
  "/poses/front-biceps.svg",
  "/poses/back-lats.svg",
  "/poses/side-glute.svg",
  "/poses/back-glute.svg",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip MediaPipe model/WASM files (let them load from CDN fresh)
  if (
    request.url.includes("cdn.jsdelivr.net") ||
    request.url.includes("storage.googleapis.com")
  ) {
    return;
  }

  // Network-first for navigation, cache-first for assets
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
  } else {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
  }
});
