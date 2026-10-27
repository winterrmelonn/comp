// Offline support for the installed app: pages and data come from the network when online (so updates show
// right away) and from this cache when offline. Supabase requests always go to the network.
const CACHE = 'comp-v1';
const CORE = ['home.html', 'calendar.html', 'log.html', 'profile.html', 'scholarships.html', 'programs.html', 'colleges.html',
  'discover.html', 'study.html', 'resume.html', 'settings.html', 'style.css', 'shell.js', 'theme.js', 'app.js', 'track.js',
  'study.js', 'resume.js', 'home.js', 'settings.js', 'db.js', 'data/catalog.json', 'data/study.json', 'data/roadmap.json', 'icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(CORE.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Supabase, CDNs: straight to the network
  e.respondWith(fetch(e.request).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
