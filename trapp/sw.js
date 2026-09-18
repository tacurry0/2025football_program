
const cacheName = 'football-app-v102-match-detail';
const assetsToCache = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./league-data.js",
  "./league-ui.js",
  "./ui-v6.js",
  "./ui-v6.css",
  "./features.css",
  "./home.css",
  "./match-detail.css",
  "./home-view.js",
  "./schedule-view.css",
  "./schedule-view.js",
  "./data/assets/fonts/schedule-jp.woff",
  "./home-motion.js",
  "./data/assets/home/poster-grain.svg",
  "./data/assets/fonts/poster-jp.woff2",
  "./data/assets/fonts/poster-date.woff2",
  "./features-model.js",
  "./features.js",
  "./analysis-data.js",
  "./pwa.js",
  "./schedule/schedule.js",
  "./data/schedule/2026_2027.json",
  "./manifest.json",
  "./data/assets/icons/icon-192.png"
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(cacheName).then(cache => {
      return cache.addAll(assetsToCache);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith('football-app-') && key !== cacheName).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  // GAS redirects remain network-only: query parameters identify league/season.
  if (url.hostname === 'script.google.com' || url.hostname === 'script.googleusercontent.com') return;
  if (url.origin === location.origin && /\/data\/(standings|results|details|generated|insights)\//.test(url.pathname)) {
    e.respondWith(
      fetch(e.request).then(response => {
        if (!response.ok) throw new Error('League snapshot HTTP ' + response.status);
        const copy = response.clone();
        return caches.open(cacheName).then(cache => cache.put(url.pathname, copy)).then(() => response);
      }).catch(() => caches.match(url.pathname, { ignoreSearch: true }))
    );
    return;
  }
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(response => {
        const copy = response.clone();
        return caches.open(cacheName)
          .then(cache => cache.put(e.request, copy))
          .then(() => response);
      }).catch(() => (
        caches.match(e.request, { ignoreSearch: true })
          .then(response => response || caches.match('./index.html'))
      ))
    );
    return;
  }

  if (url.origin === location.origin && url.pathname.endsWith('/data/schedule/2026_2027.json')) {
    e.respondWith(fetch(e.request).then(response => {
      if (!response.ok) throw new Error('Schedule HTTP ' + response.status);
      const copy = response.clone();
      e.waitUntil(caches.open(cacheName).then(cache => cache.put('./data/schedule/2026_2027.json', copy)));
      return response;
    }).catch(() => caches.match('./data/schedule/2026_2027.json')));
    return;
  }

  if (url.origin === location.origin && /\/data\/history\/(?:niigata|kumamoto)\/(?:\d{4}|2026_2027)\.json$/.test(url.pathname)) {
    e.respondWith(
      fetch(e.request).then(response => {
        const copy = response.clone();
        caches.open(cacheName).then(cache => cache.put(e.request, copy));
        return response;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  if (url.origin === location.origin && /\.(?:js|css)$/.test(url.pathname)) {
    e.respondWith(
      fetch(e.request).then(response => {
        const copy = response.clone();
        caches.open(cacheName).then(cache => cache.put(e.request, copy));
        return response;
      }).catch(() => caches.match(e.request, { ignoreSearch: true }))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(response => {
      return response || fetch(e.request).then(fresh => {
        if (fresh.ok && url.origin === location.origin) {
          const copy = fresh.clone();
          e.waitUntil(caches.open(cacheName).then(cache => cache.put(e.request, copy)));
        }
        return fresh;
      });
    })
  );
});
