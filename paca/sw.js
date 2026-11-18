/* پاکای آفلاین (وب): اول شبکه، اگر نبود از کش — تا برنامه بدون اینترنت هم باز شود. */
const CACHE = 'paca-offline-v1';
const CORE = ['./', './index.html', './styles.css', './config.js', './jalali.js', './store.js', './sync.js', './app.js', './boot.js', './icon.png', './manifest.webmanifest', './fonts/Vazirmatn-Regular.ttf', './fonts/Vazirmatn-Medium.ttf', './fonts/Vazirmatn-Bold.ttf'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}); return res; })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html'))),
  );
});
