/* Junta as bases que vêm no app com as que o app baixou da pasta do Drive (guardadas no aparelho) */
(function(){
 var P=window.BASES_PADRAO;
 function ler(k){try{var t=localStorage.getItem("base_"+k);return t?JSON.parse(t):null}catch(e){return null}}
 var a=ler("anp"),c=ler("carteira"),g=ler("agenda"),f=ler("consumidores");
 window.BASES={
  prods:a?a.prods:P.prods, anp:a?a.dados:P.anp, carteira:c?c.dados:P.carteira, agenda:g?g.dados:P.agenda, consumidores:f?f.dados:[],
  datas:{anp:(a&&a.data)||P.datas.anp, carteira:(c&&c.data)||P.datas.carteira, agenda:(g&&g.data)||P.datas.agenda, consumidores:(f&&f.data)||"(conecte ao Drive)"},
  origem:{anp:a?"do Drive":"do app", carteira:c?"do Drive":"ainda não baixada", agenda:g?"do Drive":"ainda não baixada", consumidores:f?"do Drive":"ainda não baixada"}
 };
})();
