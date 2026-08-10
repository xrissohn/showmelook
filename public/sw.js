// Self-destructing service worker (cache kill-switch).
// Older visitors may still have a previous service worker that serves stale
// HTML/assets. Browsers re-fetch this file on navigation, so shipping this
// version makes those clients drop every cache and reload with fresh content.

// skipWaiting: activate this worker immediately, without waiting for old tabs to close.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
        // clientsClaim: take control of already-open pages right away.
        await self.clients.claim();
        const clientList = await self.clients.matchAll({ type: 'window' });
        await Promise.allSettled(clientList.map((client) => client.navigate(client.url)));
      } finally {
        await self.registration.unregister();
      }
    })()
  );
});

// Never serve anything from cache while this worker is still controlling pages.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
