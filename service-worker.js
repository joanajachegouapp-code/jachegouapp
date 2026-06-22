const CACHE = 'chegou-v2';
const FILES = ['./index.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});

// ── NOTIFICAÇÕES ──────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url && 'focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow('./');
    })
  );
});

// Recebe mensagem da app para agendar verificação
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'CHECK_NOTIFS') {
    verificarENotificar(e.data.orders);
  }
});

function verificarENotificar(orders) {
  if (!orders || !Array.isArray(orders)) return;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  orders.filter(o => o.estado !== 'entregue').forEach(o => {
    const isCasa = o.tipo === 'casa';
    const ds = isCasa ? (o.data || o.dataLimite) : o.dataLimite;
    if (!ds) return;

    const d = parseData(ds);
    if (!d) return;
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((d - hoje) / 86400000);

    let titulo = '', corpo = '';

    if (isCasa) {
      if (diff === 0) {
        titulo = '📦 Entrega hoje!';
        corpo = (o.loja || 'Encomenda') + ' — fica em casa!';
      } else if (diff === 1) {
        titulo = '📦 Entrega amanhã';
        corpo = (o.loja || 'Encomenda') + ' — confirma que estás em casa.';
      }
    } else {
      if (diff < 0) {
        titulo = '🚨 Prazo passou!';
        corpo = (o.loja || 'Encomenda') + ' — prazo expirou há ' + Math.abs(diff) + ' dia(s)!' + (o.pin ? ' PIN: ' + o.pin : '');
      } else if (diff === 0) {
        titulo = '⚠️ Último dia!';
        corpo = (o.loja || 'Encomenda') + ' — vai buscar hoje!' + (o.pin ? ' PIN: ' + o.pin : '');
      } else if (diff === 1) {
        titulo = '📬 Amanhã é o último dia';
        corpo = (o.loja || 'Encomenda') + (o.pin ? ' · PIN: ' + o.pin : '');
      }
    }

    if (titulo) {
      self.registration.showNotification(titulo, {
        body: corpo,
        icon: './icon-192.png',
        badge: './icon-192.png',
        tag: 'enc-' + (o.codigo || o.loja || Math.random()),
        renotify: false,
        vibrate: [200, 100, 200],
      });
    }
  });
}

function parseData(s) {
  if (!s) return null;
  let m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) return new Date(+m[3].length === 2 ? '20' + m[3] : m[3], +m[2] - 1, +m[1]);
  m = s.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return null;
}
