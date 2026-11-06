// Dev-only no-op service worker for the local farmOS Asset Link instance.
//
// The stock farmOS Asset Link service worker is a Workbox precache/network-first
// SW. In a *production* deployment that is desirable (offline support, instant
// app-shell loads). In our *dev* workflow it is actively harmful:
//
//   * It precaches the entire app shell (index.html + all JS/CSS) and serves it
//     from cache, so edited plugin code appears "old" until the SW is updated.
//   * It intercepts the same-origin /alink/backend/models.json request and
//     re-issues it from the SW context, which drops the session on some paths
//     and returns a 403 HTML page. The Asset Link app cannot parse that, so it
//     hangs forever on "Loading models...".
//
// This replacement registers successfully but does NOT cache or intercept
// anything: every request falls through to the network with the page's normal
// credentials, and it purges any stale caches left by the stock SW on activate.
//
// Applied by scripts/setup-farmos.sh (the farmOS container is image-baked, so
// this must be re-copied whenever the container is recreated).

self.addEventListener('install', () => {
  // Activate immediately instead of waiting for all clients to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop any precache/runtime entries left behind by the stock SW.
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// Intentionally NO fetch handler: requests pass straight through to the network.
