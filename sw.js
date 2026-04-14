// Diggory Service Worker — controls caching for PWA mode
// Strategy: API calls always hit the network (server-side caching handles speed).
//           Static assets use stale-while-revalidate — serve from cache instantly,
//           then update the cache in the background for next time.

const CACHE_NAME = 'diggory-v2';
const STATIC_ASSETS = [
  '/dashboard.html',
  '/js/app.js',
  '/js/state.js',
  '/js/sales.js',
  '/js/inventory.js',
  '/js/customers.js',
  '/js/chat.js',
  '/js/utils.js',
  '/diggory_favicon2.png',
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
    return; // fall through to default browser fetch
  }

  // Static assets — stale-while-revalidate
  // Serve cached version immediately (instant load), then fetch fresh copy
  // in the background and update the cache for next time.
  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(cached => {
        const networkFetch = fetch(event.request).then(response => {
          cache.put(event.request, response.clone());
          return response;
        });
        // Return cached immediately if available, otherwise wait for network
        return cached || networkFetch;
      })
    )
  );
});
