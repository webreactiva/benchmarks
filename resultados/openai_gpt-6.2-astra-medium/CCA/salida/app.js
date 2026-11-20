const paths={bag:'<path d="M5 7h14l1 14H4L5 7Z M9 8V6a3 3 0 0 1 6 0v2"/>',trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7"/>',truck:'<path d="M2 5h12v12H2zM14 9h4l4 5v3h-8"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',back:'<path d="M20 12H5m6-6-6 6 6 6"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',heart:'<path d="M12 20 3.8 12A5 5 0 0 1 12 5.8 5 5 0 0 1 20.2 12Z"/>'};
const icon=k=>'<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+paths[k]+'</svg>';
document.querySelector('[data-icon]').innerHTML=icon('bag');
document.querySelector('.brandmark').innerHTML='<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.4"><ellipse cx="20" cy="20" rx="10" ry="15" transform="rotate(36 20 20)"/><path d="M28 8c-14 6-2 15-16 24"/></svg>';
let cart=loadCart(),timer;
const app=document.querySelector('#app'),dialog=document.querySelector('#dialog'),body=document.querySelector('#dialogBody');
function notify(t){const n=document.querySelector('#notice');n.textContent=t;n.classList.add('show');clearTimeout(timer);timer=setTimeout(()=>n.classList.remove('show'),2500)}
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(cart))}catch{notify('Tu navegador solo permite guardar los cambios en esta sesión.')}render()}
function button(action,id,label,content,cls='',disabled=false){return '<button class="'+cls+'" data-action="'+action+'" data-id="'+id+'" aria-label="'+label+'" '+(disabled?'disabled':'')+'>'+content+'</button>'}
function row(p,saved=false){
 const q=cart.items[p.id]||0;
 return '<article class="row"><img src="'+p.image+'" alt="'+p.name+'"><div class="info"><small>'+p.category+'</small><h2>'+p.name+'</h2><p>'+p.detail+'</p>'+(saved?button('add',p.id,'Añadir '+p.name,'Añadir al carrito','textbutton'): '<div class="step">'+button('minus',p.id,'Restar una unidad de '+p.name,'−','',q===1)+'<span>'+q+'</span>'+button('plus',p.id,'Sumar una unidad de '+p.name,'+','',q>=99)+'</div>')+'</div><div class="rowend"><strong>'+money(p.price*(saved?1:q))+'</strong><div class="tools">'+(saved?'':button('save',p.id,'Guardar '+p.name+' para después',icon('heart')))+button(saved?'forget':'remove',p.id,'Eliminar '+p.name,icon('trash'))+'</div></div></article>'
}
function summary(t){return '<aside><div class="summary"><h2>Resumen del pedido</h2><div class="line"><span>Subtotal</span><span>'+money(t.subtotal)+'</span></div><div class="line"><span>Envío estándar</span><span>'+(t.shipping?money(t.shipping):'Gratis')+'</span></div><div class="total"><b>Total</b><strong>'+money(t.total)+'</strong></div><small>IVA incluido</small><button class="primary" data-action="checkout" '+(!t.count?'disabled':'')+'>Finalizar compra '+icon('arrow')+'</button><div class="secure">'+icon('lock')+' Pago seguro</div></div><div class="shipping"><div class="truck">'+icon('truck')+'</div><h3>Envío gratuito</h3><p>'+(t.subtotal>=6000?'Tu pedido tiene envío gratuito.':'Te faltan <b>'+money(6000-t.subtotal)+'</b> para conseguirlo.')+'</p><progress value="'+Math.min(t.subtotal,6000)+'" max="6000" aria-label="Progreso para el envío gratuito"></progress></div></aside>'}
function render(){
 const t=totals(cart),page=location.hash.slice(1),shop=['tienda','cafe','accesorios'].includes(page);
 const title=shop?({tienda:'Tienda',cafe:'Café',accesorios:'Accesorios'})[page]:'Tu carrito';
 document.querySelector('#count').textContent=t.count;
 app.innerHTML='<div class="crumb"><a href="#tienda">Tienda</a><span>/</span>'+title+'</div><div class="heading"><h1>'+title+'<em>.</em></h1>'+(!shop?'<span class="badge">'+t.count+' '+(t.count===1?'artículo':'artículos')+'</span>':'')+'</div>'+(shop?'<section class="products">'+catalog.filter(p=>page==='tienda'||p.group===page).map(p=>'<article><img src="'+p.image+'" alt="'+p.name+'"><small>'+p.category+'</small><h2>'+p.name+'</h2><p>'+p.detail+'</p><b>'+money(p.price)+'</b>'+button('add',p.id,'Añadir '+p.name,'Añadir al carrito','primary')+'</article>').join('')+'</section>':'<div class="layout"><section><div class="rows">'+(t.count?catalog.filter(p=>cart.items[p.id]).map(p=>row(p)).join(''):'<div class="empty"><h2>Tu carrito está vacío</h2><a href="#tienda">Explorar la tienda →</a></div>')+'</div><a class="continue" href="#tienda">'+icon('back')+' Seguir comprando</a>'+(cart.saved.length?'<h2>Guardado para después</h2><div class="rows">'+catalog.filter(p=>cart.saved.includes(p.id)).map(p=>row(p,true)).join('')+'</div>':'')+'</section>'+summary(t)+'</div>');
}
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-action]');if(!b)return;
 const {action,id}=b.dataset;
 if(action==='checkout'){
  body.innerHTML='<h2>Revisar pedido</h2>'+catalog.filter(p=>cart.items[p.id]).map(p=>'<div class="line"><span>'+cart.items[p.id]+' × '+p.name+'</span><b>'+money(p.price*cart.items[p.id])+'</b></div>').join('')+'<div class="line"><span>Envío</span>'+money(totals(cart).shipping)+'</div><div class="total"><b>Total</b><b>'+money(totals(cart).total)+'</b></div><p>Pedido de demostración, sin cargo.</p><button class="primary" data-action="confirm">Confirmar pedido</button>';dialog.showModal();return
 }
 if(action==='confirm'){cart.items={};persist();body.innerHTML='<h2>Pedido de prueba confirmado</h2><p>Gracias por elegir Origen.</p><a class="continue" href="#tienda" onclick="this.closest(\'dialog\').close()">Volver a la tienda →</a>';return}
 if(!catalog.some(p=>p.id===id))return;
 const q=cart.items[id]||0;
 if(action==='plus'||action==='add'){if(q>=99){notify('Máximo de 99 unidades por producto.');return}cart.items[id]=q+1;if(action==='add'){cart.saved=cart.saved.filter(x=>x!==id);notify('Producto añadido al carrito')}}
 if(action==='minus'&&q>1)cart.items[id]=q-1;
 if(action==='remove'||action==='save')delete cart.items[id];
 if(action==='save'&&!cart.saved.includes(id))cart.saved.push(id);
 if(action==='forget')cart.saved=cart.saved.filter(x=>x!==id);
 persist();
 const next=Array.from(app.querySelectorAll('[data-action]')).find(el=>el.dataset.action===action&&el.dataset.id===id&&!el.disabled);next?.focus({preventScroll:true});
});
window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0)});
window.addEventListener('storage',e=>{if(e.key===storageKey){cart=loadCart();dialog.close();render()}});
render();
