const CACHE_NAME = 'setpoint-gestor-v1';
const urlsToCache = [
  './',
  './index.html',
  './css/global.css',
  './css/cadastro.css',
  './css/quadras.css',
  './css/planilha.css',
  './css/config.css',
  './css/regras.css',
  './js/core.js',
  './js/autenticacao.js',
  './js/cadastro.js',
  './js/quadras.js',
  './js/planilha.js',
  './js/config.js',
  './js/regras.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});