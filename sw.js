const CACHE_NAME = 'epitesnaplo-ai-pro-v60-evidence-first-ai';
const APP_SHELL = [
  './',
  './index.html',
  './view.html',
  './project.html',
  './project-finance.html',
  './profile.html',
  './logout.html',
  './admin-messages.html',
  './admin-panel.html',
  './style.css',
  './script.js',
  './project.js',
  './project-finance.js',
  './profile.js',
  './header-v40.js',
  './v19-pro-features.js',
  './supabase-adapter.js',
  './favicon.svg',
  './manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req).then(cached => cached || caches.match('./index.html')))
  );
});

self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : { title: 'ÉpítésNapló AI PRO', body: 'Új értesítés érkezett.' };
  event.waitUntil(self.registration.showNotification(data.title || 'ÉpítésNapló AI PRO', {
    body: data.body || data.message || 'Új értesítés érkezett.',
    icon: './favicon.svg',
    badge: './favicon.svg'
  }));
});
