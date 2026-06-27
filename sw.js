const CACHE_NAME = 'asset-manager-v6-13-4-transaction-edit-delete-20260628';
const ASSETS = ['./','./index.html','./app.js','./styles.css','./manifest.json','./sw.js'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if(event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if(event.data && event.data.type === 'CLEAR_CACHE'){
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))));
  }
});

self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  if(!isSameOrigin) return;

  event.respondWith((async()=>{
    try{
      const fresh = await fetch(event.request, {cache:'no-store'});
      const cache = await caches.open(CACHE_NAME);
      cache.put(event.request, fresh.clone());
      return fresh;
    }catch(e){
      const cached = await caches.match(event.request);
      return cached || caches.match('./index.html');
    }
  })());
});
