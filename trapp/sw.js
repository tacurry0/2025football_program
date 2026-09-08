
const cacheName = 'football-app-v87-cups-details';
const assetsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './league-data.js',
  './league-ui.js',
  './ui-v6.js',
  './ui-v6.css',
  './pwa.js',
  './vision/index.html',
  './vision/display.html',
  './vision/result.html',
  './vision/attendance.html',
  './vision/top.html',
  './vision/referees.html',
  './vision/starting.html',
  './vision/reserve.html',
  './vision/preview.html',
  './vision/styles.css',
  './vision/app.js',
  './data/assets/vision/orange-bg.svg',
  './data/assets/vision/top_back.png',
  './data/assets/icons/100l.png',
  './data/assets/icons/adidas-default.png',
  './data/assets/icons/adidas.png',
  './data/assets/icons/j1.png',
  './data/assets/icons/j2.png',
  './data/assets/icons/alb_logo1.png',
  './data/assets/icons/roasso_logo1.png',
  './data/assets/icons/j2_2.png',
  './data/assets/icons/j3_2.png',
  './data/assets/icons/ylc_logo1.jpg',
  './vision/vendor/html2canvas.min.js',
  './data/assets/fonts/jleaguekick-bold.woff2',
  './data/assets/fonts/BIZUDPGothic-Regular.ttf',
  './data/assets/fonts/BIZUDPGothic-Bold.ttf',
  './data/assets/fonts/AOTFShinGoProDeBold.otf',
  './schedule/schedule.js',
  './data/schedule/2026_2027.json',
  './data/clubs/club_emblems.json',
  './data/clubs/official_sites.json',
  './data/standings/current.json',
  './data/standings/2026_2027/j2.json',
  './data/standings/2026_2027/j3.json',
  './data/results/2026_2027/j2.json',
  './data/results/2026_2027/j3.json',
  './data/results/2026_2027/leaguecup.json',
  './data/results/2026_2027/emperor.json',
  './data/details/2026_2027/j2/2026090613.json',
  './data/details/2026_2027/j3/2026090616.json',
  './data/details/2026_2027/emperor/2026082624.json',
  './data/details/2026_2027/emperor/2026081902.json',
  './data/details/2026_2027/leaguecup/2026090202.json',
  './data/details/2026_2027/leaguecup/2026090209.json',
  './data/results/results.json',
  './data/standings/archive/2026_hundred.json',
  './data/players/niigata.json',
  './data/players/kumamoto.json',
  './data/history/niigata/2026.json',
  './data/history/kumamoto/2026.json',
  './data/assets/emblems/アルビレックス新潟.png',
  './data/assets/emblems/ロアッソ熊本.png',
  './data/assets/emblems/熊本学園大学.gif',
  './manifest.json',
  './data/assets/icons/icon-192.png',
  './data/assets/icons/icon-512.png'
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
  if (url.origin === location.origin && /\/data\/(standings|results|details)\//.test(url.pathname)) {
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
    e.respondWith(fetch(e.request).catch(() => caches.match('./data/schedule/2026_2027.json')));
    return;
  }

  if (url.origin === location.origin && /\/data\/history\/(?:niigata|kumamoto)\/\d{4}\.json$/.test(url.pathname)) {
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
      return response || fetch(e.request);
    })
  );
});
