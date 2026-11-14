// Service worker de VentasIQ: guarda la app en el equipo para que abra sin internet.
// No toca las llamadas a Supabase: las ventas sin conexión las maneja la cola de la app.
const V = 'vq-v1';
const BASE = ['/', '/index.html', '/manifest.webmanifest', '/logo-claro.png', '/logo.png', '/icon.svg', '/favicon.ico'];

self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(BASE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  if (r.mode === 'navigate') {
    // La pantalla: primero internet (siempre la última versión); sin internet, la copia guardada
    e.respondWith(fetch(r).then(x => { caches.open(V).then(c => c.put('/index.html', x.clone())); return x; }).catch(() => caches.match('/index.html')));
    return;
  }
  // Archivos de la app: primero la copia guardada, y se actualiza en segundo plano
  e.respondWith(caches.match(r).then(hit => {
    const red = fetch(r).then(x => { if (x.ok) caches.open(V).then(c => c.put(r, x.clone())); return x; }).catch(() => hit);
    return hit || red;
  }));
});
