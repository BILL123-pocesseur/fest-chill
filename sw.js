/* Fest&Chill — service worker (appli installable)
   Règle d'or : on ne touche JAMAIS aux paiements, à Supabase ni aux pages admin.
   Stratégie : réseau d'abord (le site est toujours à jour), cache seulement en secours hors ligne. */
const CACHE = 'fc-static-v2';
const PRECACHE = ['offline.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.searchParams.has('ping')) return;                       // test de connexion : toujours le vrai réseau               // Supabase, FedaPay, Unsplash… : jamais interceptés
  if (/festchill-admin|admin-(core|tools|users)|admin\.css|sw\.js$/.test(url.pathname)) return;   // admin : jamais en cache
  e.respondWith(
    fetch(req).then((res) => {
      if (res && res.status === 200 && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('offline.html') : Response.error())))
  );
});
