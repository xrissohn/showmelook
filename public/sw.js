// Self-destructing service worker (cache kill-switch).
// Older visitors may still have a previous service worker that serves stale
// HTML/assets. Browsers re-fetch this file on navigation, so shipping this
// version makes those clients drop every cache and reload with fresh content.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const clientList = await self.clients.matchAll({ type: 'window' });
      clientList.forEach((client) => client.navigate(client.url));
    })()
  );
});

// Never serve anything from cache while this worker is still controlling pages.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
