// オフラインでも開けるように、アプリ本体だけ保存（動画・音楽は端末内の保存領域）
const C='media-app-v2';
const A=['./','index.html','core.js?v=2','player.js?v=2','app.js?v=2','opfs-worker.js?v=2','manifest.json?v=1','icon.png?v=1','icon-512.png?v=1'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(A)).catch(()=>{}));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.origin!==location.origin||!u.pathname.startsWith(new URL('./',self.registration.scope).pathname))return;
 e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(r,cp))}return res}).catch(()=>caches.match(r).then(m=>m||caches.match(r,{ignoreSearch:true})).then(m=>m||(r.mode==='navigate'?caches.match('index.html'):Response.error()))))});
