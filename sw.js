const CACHE_NAME = 'setpoint-gestor-v8'; // 🔄 Atualizado para v8 (Compatibilidade estrita WebKit iOS)

const urlsToCache = [
  './',
  './index.html',
  './painel.html',
  './manifest-console.json',
  './css/global.css?v=4',
  './css/cadastro.css?v=4',
  './css/quadras.css?v=4',
  './js/planilha-core.js?v=4',
  './js/planilha-agendamento.js?v=4',
  './js/planilha-acoes.js?v=4',
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
  './js/piramide.js?v=4',
  './js/grupos.js?v=4',
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

// ==========================================
// 📲 RECEBIMENTO DE PUSH NOTIFICATIONS (WEB PWA / SAFARI IOS)
// ==========================================
self.addEventListener('push', event => {
  let titulo = 'SetPoint Gestor';
  let corpo = 'Nova notificação da arena.';
  let dadosExtras = {};

  if (event.data) {
    try {
      const payload = event.data.json();
      const notif = payload.notification || {};
      dadosExtras = payload.data || {};

      titulo = notif.title || dadosExtras.titulo || dadosExtras.title || titulo;
      corpo = notif.body || dadosExtras.mensagem || dadosExtras.message || dadosExtras.body || corpo;
    } catch (e) {
      try {
        corpo = event.data.text() || corpo;
      } catch (err) {}
    }
  }

  // Opções estritas suportadas pelo WebKit do Safari iOS (sem vibrate/badge)
  const options = {
    body: corpo,
    data: dadosExtras,
    tag: 'setpoint-notif-' + Date.now(),
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(titulo, options).catch(err => {
      console.error("[SW] Erro ao renderizar notificação nativa no iOS:", err);
    })
  );
});


// ==========================================
// 👆 CLIQUE NA NOTIFICAÇÃO NATIVA (WEB PWA / SAFARI IOS)
// ==========================================
self.addEventListener('notificationclick', event => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Se houver uma janela/aba do SetPoint aberta, foca nela
      for (let client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      // Se o app estiver fechado no iPhone/Desktop, abre a aplicação
      if (clients.openWindow) {
        return clients.openWindow('./');
      }
    })
  );
});