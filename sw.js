const CACHE_NAME = 'asset-manager-v6-2-darkmode-fix-20260627';
const ASSETS = ['./','./index.html','./app.js','./styles.css','./manifest.json','./sw.js'];
self.addEventListener('install', e=>{ self.skipWaiting(); e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS))); });
self.addEventListener('activate', e=>{ e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e=>{ e.respondWith(fetch(e.request).then(r=>{ const copy=r.clone(); caches.open(CACHE_NAME).then(c=>c.put(e.request,copy)); return r; }).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html')))); });
