// Offline cache for the app shell. Only the app's own files and the Supabase
// library are cached; database requests always go to the network.
const CACHE = 'vwg-staff-v10';
const ASSETS = ['./', './index.html', './hq.html', './styles.css', './config.js', './app.js', './logo.png', './icon-192.png', './apple-touch-icon.png', './favicon.png', './manifest.webmanifest', './hq.webmanifest'];

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

// Phone alerts (Web Push). The browser decrypts the payload, which the vwg-push Supabase
// function encrypted for this device only.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'VWG', {
    body: d.body || '', tag: d.tag || undefined, renotify: !!d.tag,
    icon: './icon-192.png', badge: './icon-192.png', data: { url: d.url || './index.html' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './index.html', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) if (c.url.startsWith(self.registration.scope) && 'focus' in c) { if (c.navigate) c.navigate(url).catch(() => {}); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
