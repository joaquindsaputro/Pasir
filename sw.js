const CACHE_NAME = 'monster-pasir-cache-v1';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/script.js',
  '/style.css',
  '/manifest.json',
  '/images/icons/icon192.png',
  '/images/icons/icon512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

// Fetch handler: try cache first for pre-cached assets, and use runtime cache for images
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Prefer cache for navigation and known assets
  if (request.mode === 'navigate' || PRECACHE_URLS.includes(new URL(request.url).pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((res) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, res.clone());
          return res;
        });
      })).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Runtime cache for images
  if (request.destination === 'image' || new URL(request.url).pathname.startsWith('/images/')) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((res) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, res.clone());
          return res;
        });
      })).catch(() => new Response(null, { status: 404 }))
    );
    return;
  }

  // Default: network first, fallback to cache
  event.respondWith(
    fetch(request).then((res) => res).catch(() => caches.match(request))
  );
});
