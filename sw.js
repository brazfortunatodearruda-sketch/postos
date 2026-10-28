/* Guarda o app no aparelho para abrir sem internet. Ao abrir com sinal, baixa a versão nova em segundo plano. */
var CACHE="postos-20";
var ARQS=["./","index.html","config.js","dados.js?v=2","bases.js","consulta-cnpj.html","manifest.webmanifest","icon-192.png","icon-512.png","icon-maskable-512.png"];
self.addEventListener("install",function(e){e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(ARQS)}).then(function(){return self.skipWaiting()}))});
self.addEventListener("activate",function(e){e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k!==CACHE}).map(function(k){return caches.delete(k)}))}).then(function(){return self.clients.claim()}))});
self.addEventListener("fetch",function(e){
 var r=e.request,u=new URL(r.url);
 if(r.method!=="GET"||u.origin!==self.location.origin)return;
 var nome=u.pathname.split("/").pop(),chave=r.mode==="navigate"?(nome&&nome!=="index.html"?nome:"index.html"):r;
 e.respondWith(caches.open(CACHE).then(function(c){
  return c.match(chave).then(function(guardado){
   var rede=fetch(r).then(function(resp){if(resp&&resp.ok)c.put(chave,resp.clone());return resp}).catch(function(){return guardado});
   if(guardado){e.waitUntil(rede.catch(function(){}));return guardado}
   return rede})}))});
