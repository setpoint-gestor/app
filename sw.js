const CACHE_NAME = 'setpoint-gestor-v2'; // 🔄 Mudamos para a V2
const urlsToCache = [
  './',
  './index.html',
  './css/global.css?v=2',
  './css/cadastro.css?v=2',
  './css/quadras.css?v=2',
  './css/planilha.css?v=2',
  './css/config.css?v=2',
  './css/regras.css?v=2',
  './js/core.js?v=2',
  './js/autenticacao.js?v=2',
  './js/cadastro.js?v=2',
  './js/quadras.js?v=2',
  './js/planilha.js?v=2',
  './js/config.js?v=2',
  './js/regras.js?v=2'
];

self.addEventListener('install', event => {
  // 🚀 Força o novo Service Worker a assumir o controle imediatamente
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// 🧹 O LIXEIRO: Quando a V2 assumir, apaga a V1 para liberar memória e tirar o código velho
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🧹 [Service Worker] Deletando cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Assume o controle das abas abertas na hora
  );
});

// Responde com o cache atualizado ou busca na rede
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});