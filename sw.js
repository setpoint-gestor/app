const CACHE_NAME = 'setpoint-gestor-v3'; // 🔄 Mudamos para a V3 para forçar a limpeza
const urlsToCache = [
  './',
  './index.html',
  './css/global.css?v=3',
  './css/cadastro.css?v=3',
  './css/quadras.css?v=3',
  './css/planilha.css?v=3',
  './css/config.css?v=3',
  './css/regras.css?v=3',
  './js/core.js?v=3',
  './js/autenticacao.js?v=3',
  './js/cadastro.js?v=3',
  './js/quadras.js?v=3',
  './js/planilha.js?v=3',
  './js/config.js?v=3',
  './js/regras.js?v=3'
];

self.addEventListener('install', event => {
  // 🚀 Força o novo Service Worker a assumir o controle imediatamente
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// 🧹 O LIXEIRO: Quando a V3 assumir, apaga as versões anteriores para liberar memória
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

// 🔥 ESTRATÉGIA NETWORK-FIRST (Rede Primeiro para Lógica e Estilo)
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Se for arquivo de Lógica (.js) ou Estilo (.css), a prioridade absoluta é a REDE (Servidor)
  if (url.endsWith('.js') || url.endsWith('.css')) {
      event.respondWith(
          fetch(event.request).catch(() => caches.match(event.request))
      );
  } else {
      // Para o resto (HTML, Imagens, Ícones), usa o Cache Primeiro para ser rápido
      event.respondWith(
          caches.match(event.request).then(response => response || fetch(event.request))
      );
  }
});