const CACHE_NAME = 'epitesnaplo-v197-import-account-feedback-20261022';
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
  './ajanlatok.html',
  './ajanlat.html',
  './style.css',
  './script.js',
  './project.js',
  './project-v149-performance-upload-optimizer.js',
  './project-v173-client-collab-cleanup.js',
  './view-v173-client-collab.js',
  './project-finance.js',
  './profile.js',
  './header-v40.js',
  './ajanlatok.css',
  './ajanlatok.js',
  './ajanlat-public.js',
  './permissions-v187.js',
  './important-notifications-v188.js',
  './v19-pro-features.js',
  './supabase-adapter.js',
  './epitesi-naplo-favicon-2026.ico',
  './epitesi-naplo-icon-192-2026.png',
  './epitesi-naplo-icon-512-2026.png',
  './og-epitesi-naplo-logo-2026.png',
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
    icon: './epitesi-naplo-icon-192-2026.png',
    badge: './epitesi-naplo-icon-192-2026.png'
  }));
});
