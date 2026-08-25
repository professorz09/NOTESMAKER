const CACHE_NAME = 'notesmaker-v2';

// Core shell assets to pre-cache
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-maskable.svg',
];

// Install: cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  // Activate immediately without waiting for old tabs to close
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  // Take control of all open clients immediately
  self.clients.claim();
});

// Fetch strategy:
//   - HTML (navigations, "/", "/index.html") → NETWORK-FIRST. This is the
//     one response that names which JS/CSS bundle to load next; Vite gives
//     every build's bundle a new content hash, so serving even a SLIGHTLY
//     stale index.html permanently pins the browser to an old bundle — every
//     future visit re-fetches that same old (still-cached, still "working")
//     bundle and the user never sees a single further deploy, no matter how
//     many times the app is actually fixed and redeployed. Falls back to
//     cache only when the network is unreachable (offline support).
//   - Everything else (the hashed /assets/*.js, *.css, images) → CACHE-FIRST
//     with a background refresh. These filenames change when their content
//     does, so a cached copy is never stale for a given URL — safe to serve
//     instantly, and old-hash entries simply stop being requested after the
//     next deploy rather than needing to be invalidated.
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip cross-origin requests (Google Fonts, APIs, etc.)
  if (url.origin !== self.location.origin) return;

  // Skip API calls and Supabase
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase')) return;

  const isHtmlRequest = event.request.mode === 'navigate'
    || url.pathname === '/'
    || url.pathname === '/index.html';

  if (isHtmlRequest) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // Serve from cache and update in background (stale-while-revalidate)
        const fetchPromise = fetch(event.request)
          .then((response) => {
            if (response.ok) {
              caches.open(CACHE_NAME).then((cache) =>
                cache.put(event.request, response.clone())
              );
            }
            return response;
          })
          .catch(() => cached); // If network fails, cached version is fine
        return cached;
      }

      // Not in cache — fetch from network and cache it
      return fetch(event.request)
        .then((response) => {
          if (!response.ok || response.type === 'opaque') return response;
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) =>
            cache.put(event.request, clone)
          );
          return response;
        })
        .catch(() => {
          // Offline fallback: serve index.html for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
    })
  );
});
