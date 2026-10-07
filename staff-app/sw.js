// Offline cache for the app shell. Only the app's own files and the Supabase
// library are cached; database requests always go to the network.
const CACHE = 'vwg-staff-v6';
const ASSETS = ['./', './index.html', './styles.css', './config.js', './app.js', './icon.svg', './manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const cacheable = url.origin === self.location.origin || url.hostname === 'cdn.jsdelivr.net';
  if (!cacheable) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Only full responses: videos stream as partial (206) responses, which can't be cached.
        if (res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
