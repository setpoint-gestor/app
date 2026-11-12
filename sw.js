const CACHE_NAME = 'setpoint-gestor-v11'; // 🔄 Atualizado para v11 (Roteamento de clique Web Push no Safari iOS)
const PUSH_BRIDGE_CACHE = 'setpoint-push-bridge';

const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './css/global.css?v=4',
  './css/cadastro.css?v=4',
  './css/quadras.css?v=4',
  './css/planilha.css?v=4',
  './css/config.css?v=4',
  './css/regras.css?v=4',
  './css/logs.css?v=4',
  './css/ranking.css?v=4',
  './css/ia-concierge.css?v=4',
  './js/core.js?v=6',
  './js/autenticacao.js?v=4',
  './js/cadastro.js?v=4',
  './js/quadras.js?v=4',
  './js/planilha-core.js?v=6',
  './js/planilha-agendamento.js?v=4',
  './js/planilha-acoes.js?v=4',
  './js/config.js?v=4',
  './js/regras.js?v=4',
  './js/logs.js?v=4',
  './js/ranking-core.js?v=4',
  './js/ranking-torneio.js?v=4',
  './js/ranking-ui-pdf.js?v=4',
  './js/piramide.js?v=4',
  './js/grupos.js?v=4',
  './js/sorteio-potes.js?v=4',
  './js/ia-jogador.js?v=4'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        urlsToCache.map(url => cache.add(url).catch(() => {}))
      );
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== PUSH_BRIDGE_CACHE) {
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
  if (event.request.method !== 'GET') return;

  // Ponte interna para leitura de push pendente no Cold Start do iOS
  if (event.request.url.includes('__push_pendente__')) {
    event.respondWith(
      caches.open(PUSH_BRIDGE_CACHE)
        .then(cache => cache.match(event.request))
        .then(res => res || new Response('null', { headers: { 'Content-Type': 'application/json' } }))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
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

  event.waitUntil((async () => {
    try {
      const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      const appEmPrimeiroPlano = clientList.some(
        client => client.visibilityState === 'visible' || client.focused === true
      );

      // 🔕 Se o PWA já estiver aberto e visível na tela do iPhone, não exibe o banner externo
      if (appEmPrimeiroPlano) {
        return;
      }
    } catch (e) {}

    return self.registration.showNotification(titulo, options).catch(err => {
      console.error("[SW] Erro ao renderizar notificação nativa no iOS:", err);
    });
  })());
});

// ==========================================
// 👆 CLIQUE NA NOTIFICAÇÃO NATIVA (WEB PWA / SAFARI IOS)
// ==========================================
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const dadosPush = event.notification.data || {};

  event.waitUntil((async () => {
    // 1. Salva os metadados no cofre temporário para leitura caso o app esteja totalmente fechado (Cold Start)
    try {
      const cache = await caches.open(PUSH_BRIDGE_CACHE);
      await cache.put(
        new Request('./__push_pendente__'),
        new Response(JSON.stringify({
          dados: dadosPush,
          timestamp: Date.now()
        }), {
          headers: { 'Content-Type': 'application/json' }
        })
      );
    } catch (e) {
      console.error('[SW] Erro ao gravar dados do push no cofre:', e);
    }

    // 2. Se o PWA estiver minimizado em segundo plano (Warm Resume), envia postMessage e foca a janela
    const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientList) {
      if ('focus' in client) {
        try {
          client.postMessage({
            tipoAcao: 'PUSH_CLICADO_IOS',
            dados: dadosPush
          });
        } catch (err) {}
        return client.focus();
      }
    }

    // 3. Se o PWA estiver fechado no iPhone, abre a aplicação na raiz
    if (clients.openWindow) {
      return clients.openWindow('./');
    }
  })());
});