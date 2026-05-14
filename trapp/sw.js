
const cacheName = 'football-app-v8';
const assetsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './schedule/schedule.js',
  './schedule/schedule.json',
  './schedule/niigata_2024_schedule.json',
  './club_emblems.json',
  './data/results.json',
  './icons/img_club_gunma.png',
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

navigator.serviceWorker.register('/2025football_program/jstest/sw.js')
