// Diggory Service Worker — controls caching for PWA mode
// Strategy: API calls always hit the network (server caching handles speed).
//           Static assets use network-first with cache fallback.

const CACHE_NAME = 'diggory-v1';
const STATIC_ASSETS = [
  '/dashboard.html',
  '/diggory_favicon2.png',
  '/DIGGORY_icon.png',
  '/diggory_logo_amber.png',
  '/manifest.json'
];

// Pre-cache static shell on install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Clean up old caches on activate
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API calls, login POST, SSE streams — ALWAYS network, never cache
  if (url.pathname.startsWith('/api/') ||
      event.request.method !== 'GET' ||
      url.pathname === '/login') {
    return; // fall through to default browser fetch (no service worker involvement)
  }

  // Static assets — network first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clone and cache the fresh response
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => {
        // Network failed — serve from cache if available
        return caches.match(event.request);
      })
  );
});
