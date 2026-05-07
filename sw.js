const CACHE_NAME = 'epitesnaplo-ai-pro-v171-scroll-header-speed-fix';
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
  './project-v149-performance-upload-optimizer.js',
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
  const data = event.data ? event.data.json() : { title: 'Ă‰pĂ­tĂ©sNaplĂł AI PRO', body: 'Ăšj Ă©rtesĂ­tĂ©s Ă©rkezett.' };
  event.waitUntil(self.registration.showNotification(data.title || 'Ă‰pĂ­tĂ©sNaplĂł AI PRO', {
    body: data.body || data.message || 'Ăšj Ă©rtesĂ­tĂ©s Ă©rkezett.',
    icon: './favicon.svg',
    badge: './favicon.svg'
  }));
});
