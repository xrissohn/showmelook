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

// No fetch handler on purpose.
// Intercepting requests here (even with a pass-through fetch) makes the worker a
// "cross-world" resource owner: preloaded module/CSS requests get re-issued by the
// worker and can fail with ERR_CONNECTION_RESET, leaving a blank page.
// Without a fetch handler the browser bypasses this worker entirely for network
// requests, while install/activate still purge caches and unregister it.
