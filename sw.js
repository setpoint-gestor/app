const CACHE_NAME = 'setpoint-gestor-v6'; // 🔄 Subimos para v6 para incluir o sorteio por potes

const urlsToCache = [
  './',
  './index.html',
  './painel.html',
  './manifest-console.json',
  './css/global.css?v=4',
  './css/cadastro.css?v=4',
  './css/quadras.css?v=4',
  './css/planilha.css?v=4',
  './css/config.css?v=4',
  './css/regras.css?v=4',
  './css/logs.css?v=4',
  './css/ranking.css?v=4',
  './js/core.js?v=4',
  './js/autenticacao.js?v=4', 
  './js/cadastro.js?v=4',
  './js/quadras.js?v=4',
  './js/planilha.js?v=4',
  './js/config.js?v=4',
  './js/regras.js?v=4',
  './js/logs.js?v=4',
  './js/ranking-core.js?v=4',
  './js/ranking-torneio.js?v=4',
  './js/ranking-ui-pdf.js?v=4',
  './js/sorteio-potes.js?v=4'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

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
    }).then(() => self.clients.claim())
  );
});

// 🔥 Estratégia Network-First (Rede Primeiro) para TUDO
self.addEventListener('fetch', event => {
  // Ignora requisições que não sejam GET (ex: salvamentos no Firebase ou GitHub)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // 1. A internet funcionou! Pegamos o arquivo fresquinho do servidor.
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // 2. A internet caiu ou falhou! Usa o cache como plano B (Modo Offline).
        return caches.match(event.request);
      })
  );
});