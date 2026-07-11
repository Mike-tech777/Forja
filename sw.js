/* FORJA — service worker: funcionamiento 100 % sin conexión.
   Estrategia: sirve la copia en caché al instante y actualiza en segundo plano.
   La versión nueva se activa sola (skipWaiting), así quien cierra y reabre la
   app recibe lo último sin hacer nada. Además, si la tiene abierta, la página
   muestra un aviso "Nueva versión" con botón Actualizar (recarga al momento).
   Sube el número de CACHE en cada release para que se detecte la actualización. */
'use strict';

const CACHE = 'forja-v30';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  // activa la versión nueva en cuanto se instala: al reabrir se ve lo último
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

// Respaldo: si el navegador la dejó en espera, la página puede forzar el relevo.
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Recordatorios de entreno (Web Push)
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) {}
  e.waitUntil(self.registration.showNotification(d.title || 'FORJA', {
    body: d.body || 'Hoy toca entrenar. La barra espera.',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: 'forja-recordatorio',
    data: { url: './' },
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    for (const w of ws) if ('focus' in w) return w.focus();
    return clients.openWindow('./');
  }));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(cached => {
      const fresh = fetch(e.request).then(resp => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return resp;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});
