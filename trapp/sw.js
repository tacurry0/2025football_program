
const cacheName = 'football-app-v21-nocache-schedule';
const assetsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './scoreboard.html',
  './scoreboard-display.html',
  './scoreboard.css',
  './scoreboard.js',
  './vendor/html2canvas.min.js',
  './schedule/schedule.js',
  './schedule.json',
  './club_emblems.json',
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

  e.respondWith(
    caches.match(e.request).then(response => {
      return response || fetch(e.request);
    })
  );
});
