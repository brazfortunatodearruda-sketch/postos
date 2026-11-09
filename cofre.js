/* Cofre do app: pede a senha ao abrir, guarda os dados do aparelho criptografados (AES-GCM, chave
   derivada da senha) e bloqueia depois de 15 minutos sem uso. A senha não fica guardada em lugar nenhum.
   O restante do app só é carregado depois do desbloqueio (scripts marcados com type="text/cofre"). */
(function(){
 "use strict";
 var META="cofre_meta",PREFIXO="cofre1:",PREFIXO_SEM_GZ="cofre0:",ITERACOES=600000,LIMITE=15*60*1000,MINIMO=8;
 var armaz;try{armaz=window.localStorage}catch(e){armaz=null}
 var P=Storage.prototype,rawGet=P.getItem,rawSet=P.setItem,rawDel=P.removeItem;
 function lerRaw(k){return rawGet.call(armaz,k)}
 function porRaw(k,v){rawSet.call(armaz,k,v)}
 function delRaw(k){rawDel.call(armaz,k)}
 document.documentElement.classList.add("cofre-fechado");
 var est=document.createElement("style");
 est.textContent='html.cofre-fechado body>*:not(#cofre){display:none!important}#cofre{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;background:#f3f5f4;color:#17211d;font:16px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow:auto}#cofre form{width:100%;max-width:360px;background:#fff;border:1px solid #d5dcd8;border-radius:14px;padding:24px;box-sizing:border-box}#cofre img{width:56px;height:56px;border-radius:12px;display:block;margin:0 auto 12px}#cofre h1{font-size:20px;margin:0 0 6px;text-align:center}#cofre p{margin:0 0 14px;color:#5b6963;font-size:14px;text-align:center}#cofre label{display:block;font-size:14px;font-weight:600;margin:10px 0 4px}#cofre input[type=password],#cofre input[type=text]{width:100%;box-sizing:border-box;font-size:16px;padding:11px;border:1px solid #d5dcd8;border-radius:9px}#cofre .ver{display:flex;gap:6px;align-items:center;font-weight:400;margin-top:10px}#cofre button{width:100%;font-size:16px;font-weight:600;padding:12px;border-radius:9px;border:0;background:#0b6b4f;color:#fff;margin-top:14px;cursor:pointer}#cofre button:disabled{opacity:.6}#cofre button.sec{background:none;color:#5b6963;font-weight:400;font-size:14px;padding:8px;margin-top:8px}#cofre button.perigo{background:#a52a1f}#cofre .erro{color:#a52a1f;font-size:14px;min-height:20px;margin-top:10px;text-align:center}#cofre-aviso{position:fixed;left:12px;right:12px;bottom:12px;z-index:99998;background:#a52a1f;color:#fff;padding:12px;border-radius:9px;font:14px system-ui,sans-serif}';
 document.head.appendChild(est);

 var chave=null,cache=new Map(),versoes=new Map(),contador=0,fila=Promise.resolve(),ultimo=Date.now(),canal=null;
 var cod=new TextEncoder(),dec=new TextDecoder();
 function paraB64(b){var s="",i;for(i=0;i<b.length;i+=32766)s+=String.fromCharCode.apply(null,b.subarray(i,i+32766));return btoa(s)}
 function deB64(t){var s=atob(t),b=new Uint8Array(s.length),i;for(i=0;i<s.length;i++)b[i]=s.charCodeAt(i);return b}
 function aleatorio(n){return crypto.getRandomValues(new Uint8Array(n))}
 function passaPor(fluxo,bytes){return new Response(new Blob([bytes]).stream().pipeThrough(fluxo)).arrayBuffer().then(function(a){return new Uint8Array(a)})}
 function derivar(senha,sal,it){return crypto.subtle.importKey("raw",cod.encode(senha),"PBKDF2",false,["deriveKey"]).then(function(m){return crypto.subtle.deriveKey({name:"PBKDF2",hash:"SHA-256",salt:sal,iterations:it},m,{name:"AES-GCM",length:256},false,["encrypt","decrypt"])})}
 function cifrar(k,texto){var gz=typeof CompressionStream==="function",b=cod.encode(texto);
  return (gz?passaPor(new CompressionStream("gzip"),b):Promise.resolve(b)).then(function(d){var iv=aleatorio(12);
   return crypto.subtle.encrypt({name:"AES-GCM",iv:iv},k,d).then(function(c){var u=new Uint8Array(12+c.byteLength);u.set(iv);u.set(new Uint8Array(c),12);return (gz?PREFIXO:PREFIXO_SEM_GZ)+paraB64(u)})})}
 function cifrado(v){return typeof v==="string"&&(v.indexOf(PREFIXO)===0||v.indexOf(PREFIXO_SEM_GZ)===0)}
 function decifrar(k,v){var gz=v.indexOf(PREFIXO)===0,u=deB64(v.slice(PREFIXO.length));
  return crypto.subtle.decrypt({name:"AES-GCM",iv:u.subarray(0,12)},k,u.subarray(12)).then(function(d){d=new Uint8Array(d);return gz?passaPor(new DecompressionStream("gzip"),d):d}).then(function(b){return dec.decode(b)})}
 function lerMeta(){try{var m=JSON.parse(lerRaw(META)||"null");return m&&m.sal&&m.ok?m:null}catch(e){return null}}
 function chaveValida(k,m){return decifrar(k,m.ok).then(function(t){return t==="cofre-ok"},function(){return false})}

 function aviso(t){var a=document.getElementById("cofre-aviso");if(!a){a=document.createElement("div");a.id="cofre-aviso";document.body.appendChild(a)}a.textContent=t}
 function gravar(k){var v=++contador;versoes.set(k,v);
  fila=fila.then(function(){if(versoes.get(k)!==v||!cache.has(k))return;return cifrar(chave,cache.get(k)).then(function(c){if(versoes.get(k)===v)porRaw(k,c)})}).catch(function(){aviso("Não foi possível guardar um dado neste aparelho (memória cheia?).")})}
 function instalarCamada(){
  P.getItem=function(k){if(this!==armaz)return rawGet.call(this,k);k=String(k);if(k===META)return rawGet.call(this,k);return cache.has(k)?cache.get(k):null};
  P.setItem=function(k,v){if(this!==armaz)return rawSet.call(this,k,v);k=String(k);if(k===META)return;cache.set(k,String(v));gravar(k)};
  P.removeItem=function(k){if(this!==armaz)return rawDel.call(this,k);k=String(k);if(k===META)return;cache.delete(k);versoes.set(k,++contador);rawDel.call(this,k)};
  window.addEventListener("storage",function(e){if(e.storageArea!==armaz||!e.key||e.key===META)return;var k=e.key,v0=versoes.get(k);
   if(e.newValue===null){cache.delete(k);return}
   if(cifrado(e.newValue))decifrar(chave,e.newValue).then(function(t){if(versoes.get(k)===v0)cache.set(k,t)},function(){})})}
 /* Lê tudo para a memória. O que ainda estiver aberto (dados anteriores à senha) é criptografado aqui. */
 function abrirDados(){var chaves=[],i,erros=0;for(i=0;i<armaz.length;i++){var n=rawKey(i);if(n!==META)chaves.push(n)}
  return chaves.reduce(function(p,k){return p.then(function(){var v=lerRaw(k);
    if(cifrado(v))return decifrar(chave,v).then(function(t){cache.set(k,t)},function(){erros++});
    cache.set(k,v);return cifrar(chave,v).then(function(c){porRaw(k,c)})}).catch(function(){erros++})},Promise.resolve()).then(function(){if(erros)console.warn("cofre: itens com problema:",erros)})}
 function rawKey(i){return Storage.prototype.key.call(armaz,i)}

 function pronto(fn){if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",fn,{once:true});else fn()}
 function carregarApp(){var lista=[].slice.call(document.querySelectorAll('script[type="text/cofre"]'));
  return lista.reduce(function(p,o){return p.then(function(){return new Promise(function(res){var s=document.createElement("script");
    if(o.src){s.src=o.getAttribute("src");s.async=false;s.onload=res;s.onerror=res;document.head.appendChild(s)}else{s.text=o.textContent;o.parentNode.insertBefore(s,o);res()}})})},Promise.resolve())}
 function entrar(k){chave=k;
  return abrirDados().then(function(){instalarCamada();abrirCanal();vigiar();return carregarApp()}).then(function(){var c=document.getElementById("cofre");if(c)c.remove();document.documentElement.classList.remove("cofre-fechado")})}

 /* Outra aba do app já aberta (ex.: Consulta de CNPJs) entrega a chave, para não pedir a senha de novo. */
 function abrirCanal(){if(!canal&&window.BroadcastChannel)canal=new BroadcastChannel("cofre");if(!canal)return;
  canal.onmessage=function(e){if(e.data&&e.data.t==="pede"&&chave&&Date.now()-ultimo<LIMITE)canal.postMessage({t:"chave",id:e.data.id,k:chave,u:ultimo})}}
 function pedirChaveAbas(m){if(!window.BroadcastChannel)return Promise.resolve(null);
  return new Promise(function(res){var c=new BroadcastChannel("cofre"),id=paraB64(aleatorio(9)),fim=false;
   function acaba(k){if(fim)return;fim=true;c.close();res(k)}
   c.onmessage=function(e){if(e.data&&e.data.t==="chave"&&e.data.id===id)chaveValida(e.data.k,m).then(function(ok){if(ok)ultimo=e.data.u;acaba(ok?e.data.k:null)})};
   c.postMessage({t:"pede",id:id});setTimeout(function(){acaba(null)},350)})}

 function bloquear(){document.documentElement.classList.add("cofre-fechado");fila.then(function(){location.reload()},function(){location.reload()})}
 function confere(){if(Date.now()-ultimo>=LIMITE)bloquear()}
 function vigiar(){function uso(){ultimo=Date.now()}
  ["pointerdown","pointermove","keydown","touchstart","scroll","input"].forEach(function(n){window.addEventListener(n,uso,{capture:true,passive:true})});
  setInterval(confere,20000);document.addEventListener("visibilitychange",function(){if(!document.hidden)confere()});window.addEventListener("focus",confere)}

 function tela(html){var c=document.getElementById("cofre");if(!c){c=document.createElement("div");c.id="cofre";document.body.appendChild(c)}c.innerHTML='<form novalidate autocomplete="on"><img src="icon-192.png" alt="">'+html+"</form>";return c.firstChild}
 function ligaMostrar(f){var cb=f.querySelector("#cofre-ver");if(cb)cb.onchange=function(){[].forEach.call(f.querySelectorAll(".sn"),function(i){i.type=cb.checked?"text":"password"})}}
 var ajudaVer='<label class="ver"><input type="checkbox" id="cofre-ver"> Mostrar senha</label><div class="erro" id="cofre-erro" role="alert"></div>';
 function falha(t){document.getElementById("cofre-erro").textContent=t}
 function telaCriar(){var f=tela('<h1>Crie a senha do app</h1><p>Ela protege os dados guardados neste aparelho. Não fica registrada em nenhum lugar: anote em local seguro.</p><label for="cofre-s1">Nova senha</label><input class="sn" id="cofre-s1" type="password" autocomplete="new-password" autofocus><label for="cofre-s2">Repita a senha</label><input class="sn" id="cofre-s2" type="password" autocomplete="new-password">'+ajudaVer+'<button type="submit">Criar senha e proteger os dados</button>');
  ligaMostrar(f);f.onsubmit=function(e){e.preventDefault();var a=f.querySelector("#cofre-s1").value,b=f.querySelector("#cofre-s2").value;
   if(a.length<MINIMO||!/[0-9]/.test(a)||!/[^0-9\s]/.test(a))return falha("Use ao menos "+MINIMO+" caracteres, com letras e números.");
   if(a!==b)return falha("As duas senhas não são iguais.");
   var bt=f.querySelector("button");bt.disabled=true;bt.textContent="Protegendo seus dados…";var sal=aleatorio(16),k;
   derivar(a,sal,ITERACOES).then(function(x){k=x;return cifrar(k,"cofre-ok")}).then(function(ok){porRaw(META,JSON.stringify({v:1,sal:paraB64(sal),it:ITERACOES,ok:ok}));return entrar(k)}).catch(function(){bt.disabled=false;bt.textContent="Criar senha e proteger os dados";falha("Não foi possível criar a senha neste aparelho.")})}}
 function telaEntrar(m){var f=tela('<h1>Gestor de Carteira Arla 32</h1><p>Digite sua senha para abrir.</p><label for="cofre-s1">Senha</label><input class="sn" id="cofre-s1" type="password" autocomplete="current-password" autofocus>'+ajudaVer+'<button type="submit">Entrar</button><button type="button" class="sec" id="cofre-esqueci">Esqueci a senha</button>');
  ligaMostrar(f);f.querySelector("#cofre-esqueci").onclick=function(){telaEsqueci(m)};
  f.onsubmit=function(e){e.preventDefault();var s=f.querySelector("#cofre-s1").value;if(!s)return falha("Digite a senha.");var bt=f.querySelector('button[type=submit]');bt.disabled=true;bt.textContent="Abrindo…";falha("");
   derivar(s,deB64(m.sal),m.it).then(function(k){return chaveValida(k,m).then(function(ok){if(!ok){bt.disabled=false;bt.textContent="Entrar";f.querySelector("#cofre-s1").value="";f.querySelector("#cofre-s1").focus();return falha("Senha incorreta.")}return entrar(k)})}).catch(function(){bt.disabled=false;bt.textContent="Entrar";falha("Não foi possível abrir os dados.")})}}
 function telaEsqueci(m){var f=tela('<h1>Esqueceu a senha?</h1><p>Sem a senha, os dados deste aparelho não podem ser lidos. Para continuar, eles serão apagados daqui. Depois crie uma senha nova e conecte ao Google para baixar tudo do Drive de novo. O que ainda não tiver sido enviado ao Drive será perdido.</p><button type="button" class="perigo" id="cofre-apaga">Apagar os dados deste aparelho</button><button type="button" class="sec" id="cofre-volta">Voltar</button>');
  f.querySelector("#cofre-volta").onclick=function(){telaEntrar(m)};
  f.querySelector("#cofre-apaga").onclick=function(){var n=[],i;for(i=0;i<armaz.length;i++)n.push(rawKey(i));n.forEach(delRaw);location.reload()}}

 pronto(function(){
  if(!armaz||!window.crypto||!crypto.subtle){tela("<h1>Não foi possível abrir</h1><p>Este navegador não permite proteger os dados. Abra o app pelo Chrome atualizado.</p>");return}
  var m=lerMeta();if(!m){telaCriar();return}
  pedirChaveAbas(m).then(function(k){if(k)entrar(k);else telaEntrar(m)})});
})();
