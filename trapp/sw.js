
const cacheName = 'football-app-v38-actual-vision';
const assetsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './vendor/html2canvas.min.js',
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
  './vision/club_emblems.json',
  './vision/orange-bg.svg',
  './vision/top_back.png',
  './vision/icons/100l.png',
  './vision/icons/j1.png',
  './vision/icons/j2.png',
  './vision/vendor/html2canvas.min.js',
  './vision/fonts/jleaguekick-bold.woff2',
  './vision/fonts/BIZUDPGothic-Regular.ttf',
  './vision/fonts/BIZUDPGothic-Bold.ttf',
  './vision/fonts/AOTFShinGoProDeBold.otf',
  './schedule/schedule.js',
  './schedule.json',
  './club_emblems.json',
  './data/history/2026.json',
  './emblems/アルビレックス新潟.png',
  './emblems/ロアッソ熊本.png',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
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
      keys.filter(key => key !== cacheName).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin === location.origin && url.pathname.endsWith('/schedule.json')) {
    e.respondWith(fetch(e.request).catch(() => caches.match('./schedule.json')));
    return;
  }

  if (url.origin === location.origin && /\/data\/history\/\d{4}\.json$/.test(url.pathname)) {
    e.respondWith(
      fetch(e.request).then(response => {
        const copy = response.clone();
        caches.open(cacheName).then(cache => cache.put(e.request, copy));
        return response;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(response => {
      return response || fetch(e.request);
    })
  );
});
