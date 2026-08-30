// Service Worker for Remix PDF PWA - Full Offline Engine
const CACHE_NAME = 'remix-pdf-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg',
];

// Install Event: Pre-cache shell assets & skip waiting immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Pre-cache error during SW install:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up old caches and claim all clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Cache-first for static assets, Network-first with cache fallback for navigation
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Ignore browser extensions or unsupported schemes
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // API endpoints that require live server (e.g. Gemini AI OCR)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ 
            error: 'You are currently offline. Cloud AI features require internet, but all offline PDF tools (organize, split, merge, compress, edit, security) work offline!' 
          }), 
          { 
            status: 503, 
            headers: { 'Content-Type': 'application/json' } 
          }
        );
      })
    );
    return;
  }

  // 1. Navigation requests (HTML page) -> Network First with immediate Cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, copy);
              cache.put('/', networkResponse.clone());
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const rootCached = await caches.match('/');
          if (rootCached) return rootCached;
          const indexCached = await caches.match('/index.html');
          if (indexCached) return indexCached;
          return new Response('Offline - Remix PDF is loading from cache', {
            headers: { 'Content-Type': 'text/html' }
          });
        })
    );
    return;
  }

  // 2. Static scripts, styles, images, fonts, workers -> Stale While Revalidate / Cache First
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Fetch in background to update cache
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, copy);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Ignore network errors if we already had cachedResponse
          return cachedResponse;
        });

      // Return cached response instantly if available, else wait for network
      return cachedResponse || fetchPromise;
    })
  );
});
