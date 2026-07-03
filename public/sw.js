const CACHE = 'almani-v1';
const ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Only cache GET requests
  if (e.request.method !== 'GET') return;
  // Don't cache API calls
  if (e.request.url.includes('/api/') || e.request.url.includes('socket.io')) {
    return fetch(e.request);
  }
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
