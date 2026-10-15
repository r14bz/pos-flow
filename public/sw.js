const CACHE = 'semar-shell-v2';
const APP_SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/resources/icon.png'];
self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL))));
self.addEventListener('activate', (event) => event.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
    return response;
  }).catch(() => caches.match(event.request).then(cached => cached || caches.match('/'))));
});
self.addEventListener('push', (event) => {
  let data = { title: 'SEMAR', body: 'Ada pembaruan toko Anda.', url: '/' };
  try { data = { ...data, ...(event.data ? event.data.json() : {}) }; } catch {}
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, icon: '/icons/icon-192.png', badge: '/icons/badge-96.png', data: { url: data.url || '/' },
    vibrate: [100, 50, 100], tag: data.tag || 'semar-notice'
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    const existing = clients.find(client => 'focus' in client);
    if (existing) { existing.navigate(event.notification.data?.url || '/'); return existing.focus(); }
    return self.clients.openWindow(event.notification.data?.url || '/');
  }));
});
