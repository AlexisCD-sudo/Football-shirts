/* Service worker de Football Shirt Collection.
 *
 * Fa NOMÉS això: deixar l'aplicació (HTML, JS, CSS i icones del mateix domini) disponible sense connexió.
 * MAI toca res que no sigui del mateix origen: les dades i la sessió de Supabase, les fotos (enllaços signats
 * o externs) i les tipografies van sempre directes a la xarxa i no es desen a la memòria cau.
 * Sense connexió es veu l'aplicació però no les dades: cal Internet per llegir i desar la col·lecció.
 */
const VERSION = 'v1';
const SHELL = `fsc-shell-${VERSION}`;
const ASSETS = `fsc-assets-${VERSION}`;
const PRECACHE = ['/', '/favicon.svg', '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase, fotos, tipografies: mai
  if (url.pathname === '/sw.js') return;

  if (request.mode === 'navigate') {
    // Xarxa primer (sempre l'última versió); sense connexió, l'última pàgina vàlida.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(SHELL).then((c) => c.put('/', copy));
          }
          return response;
        })
        .catch(() => caches.match('/').then((r) => r || Response.error())),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    // Fitxers amb hash al nom: immutables, memòria cau primer.
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              void caches.open(ASSETS).then((c) => c.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
