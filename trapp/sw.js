
const cacheName = 'football-app-v20-source';
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
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(response => {
      return response || fetch(e.request);
    })
  );
});
