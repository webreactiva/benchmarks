const products = [
  {id:'alpes',name:'Cumbres alpinas',series:'Montaña',price:3200},
  {id:'bosque',name:'Bosque en calma',series:'Bosque',price:2800},
  {id:'lago',name:'Reflejo del lago',series:'Agua',price:3200},
  {id:'valle',name:'Vida silvestre',series:'Fauna',price:3000}
];
const key='forma-estudio.cart.v1';
const money=cents=>(cents/100).toLocaleString('es-ES',{style:'currency',currency:'EUR'});
const el=id=>document.getElementById(id);
const paths={trash:'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',truck:'M2 5h13v12H8m-4 0H2V5m13 4h4l3 4v4h-2m-5 0h1 M8 18a2 2 0 11-4 0 2 2 0 014 0zm12 0a2 2 0 11-4 0 2 2 0 014 0z',lock:'M6 10h12v11H6zM8 10V7a4 4 0 018 0v3'};
const icon=name=>'<svg aria-hidden="true" viewBox="0 0 24 24"><path d="'+paths[name]+'"/></svg>';
function readCart(){
  try{
    const raw=localStorage.getItem(key);
    if(raw!==null){
      const data=JSON.parse(raw);
      return Object.fromEntries(products.filter(p=>Number.isInteger(data?.[p.id])&&data[p.id]>0).map(p=>[p.id,Math.min(99,data[p.id])]));
    }
  }catch{}
  return {alpes:1,bosque:1,lago:1};
}
let cart=readCart();
function save(){try{localStorage.setItem(key,JSON.stringify(cart))}catch{} render()}
function totals(){
  const count=Object.values(cart).reduce((a,b)=>a+b,0);
  const subtotal=products.reduce((s,p)=>s+p.price*(cart[p.id]||0),0);
  const shipping=subtotal>0&&subtotal<7500?490:0;
  return {count,subtotal,shipping,total:subtotal+shipping};
}
const art=p=>`<div class="art ${p.id}"><img src="media/${p.id}.jpg" alt="${p.name}, lámina enmarcada"></div>`;
const tag=p=>`<span class="tag">SERIE ${p.series.toUpperCase()}</span>`;
function row(p){
  const qty=cart[p.id];
  return `<article class="row">${art(p)}<div class="details">${tag(p)}<h3>${p.name}</h3><div class="meta">30 × 40 cm · Papel mate</div><div class="actions"><div class="step"><button data-action="minus" data-id="${p.id}" aria-label="Restar una unidad de ${p.name}" ${qty===1?'disabled':''}>−</button>${qty}<button data-action="plus" data-id="${p.id}" aria-label="Añadir una unidad de ${p.name}" ${qty===99?'disabled':''}>+</button></div><button class="trash" data-action="remove" data-id="${p.id}" aria-label="Eliminar ${p.name}">${icon('trash')}</button></div></div><strong class="price">${money(qty*p.price)}</strong></article>`;
}
function render(){
  const {count,subtotal,shipping,total}=totals();
  const collection=location.hash==='#coleccion';
  el('badge').textContent=count;
  el('trail').textContent=collection?'Colección':'Carrito';
  const heading=`<div class="eyebrow">${collection?'FORMA ESTUDIO':'TU SELECCIÓN'}</div><div class="title"><h1>${collection?'Colección':'Tu carrito'}</h1>${collection?'':'<span class="count">'+count+(count===1?' artículo':' artículos')+'</span>'}</div>`;
  if(collection){
    el('view').innerHTML=heading+'<div class="grid">'+products.map(p=>`<article class="card">${art(p)}${tag(p)}<h3>${p.name}</h3><span class="meta">30 × 40 cm · ${money(p.price)}</span><button class="primary" data-action="plus" data-id="${p.id}" ${cart[p.id]===99?'disabled':''}>Añadir al carrito</button></article>`).join('')+'</div>';
    return;
  }
  el('view').innerHTML=heading+`<div class="layout"><div><div class="items"><div class="head"><span>PRODUCTO</span><span>IMPORTE</span></div>${products.filter(p=>cart[p.id]).map(row).join('')||'<p class="empty">Tu carrito está vacío.</p>'}</div><a class="back" href="#coleccion">←　Seguir comprando</a></div><aside><div class="summary"><h2>Resumen del pedido</h2><div class="sum">Subtotal <span>${money(subtotal)}</span></div><div class="sum">Envío <span class="green">${shipping?money(shipping):count?'Gratis':'—'}</span></div><div class="total">Total <b>${money(total)}</b></div><div class="muted">IVA incluido</div><button class="primary" data-action="checkout" ${count?'':'disabled'}>Finalizar compra　→</button><div class="hint">${icon('lock')}　Compra segura</div></div><div class="banner">${icon('truck')}<div><strong>Envío gratuito</strong><span class="muted">En pedidos desde 75 €</span></div></div></aside></div>`;
}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-action]');
  if(!button)return;
  const {action,id}=button.dataset;
  if(action==='checkout'){
    el('review').innerHTML=`<h2>Revisar pedido</h2>${products.filter(p=>cart[p.id]).map(p=>`<p>${cart[p.id]} × ${p.name}</p>`).join('')}<strong>Total　${money(totals().total)}</strong><p>Pedido de demostración sin cobro.</p><button class="primary" data-action="confirm">Confirmar pedido de prueba</button>`;
    el('checkout').showModal();
  }else if(action==='confirm'){
    cart={};save();el('review').innerHTML='<h2>Pedido confirmado</h2><p>Tu pedido de prueba se ha completado.</p><form method="dialog"><button class="primary">Volver al carrito</button></form>';
  }else{
    if(action==='remove')delete cart[id];
    else cart[id]=Math.max(1,Math.min(99,(cart[id]||0)+(action==='plus'?1:-1)));
    save();el('status').textContent='Carrito actualizado. '+totals().count+' artículos.';
    document.querySelector('[data-action="'+action+'"][data-id="'+id+'"]:not(:disabled)')?.focus();
  }
});
window.addEventListener('hashchange',render);
window.addEventListener('storage',event=>{if(event.key===key){cart=readCart();if(el('checkout').open)el('checkout').close();render()}});
render();