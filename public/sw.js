// One-release kill switch for the former Workbox app service worker.
function isAppWorkboxCache(name) {
  return /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-/.test(name)
    || name.startsWith('workbox-')
    || ['google-fonts-cache', 'gstatic-fonts-cache', 'jsdelivr-cache',
      'cdn-jsdelivr-cache', 'supabase-storage-cache'].includes(name);
}

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const cacheNames = await caches.keys();
      await Promise.allSettled(
        cacheNames.filter(isAppWorkboxCache).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
      const clients = await self.clients.matchAll({ type: 'window' });
      await Promise.allSettled(clients.map((client) => client.navigate(client.url)));
    } finally {
      await self.registration.unregister();
    }
  })());
});

// Intentionally no fetch handler: requests go directly to the network.
