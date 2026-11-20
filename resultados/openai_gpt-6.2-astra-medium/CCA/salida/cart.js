const catalog = [
 {id:'colombia',name:'Colombia Huila',category:'Café de especialidad',group:'cafe',detail:'En grano · 250 g',price:1450,image:'assets/product0.webp'},
 {id:'v60',name:'Dripper V60',category:'Métodos de preparación',group:'accesorios',detail:'Cerámica · Blanco',price:2400,image:'assets/product1.webp'},
 {id:'taza',name:'Taza de gres',category:'Menaje',group:'accesorios',detail:'Arena · 200 ml',price:1600,image:'assets/product2.webp'}
];
const storageKey='origen.cart.v1';
const initialCart=()=>({items:Object.fromEntries(catalog.map(p=>[p.id,1])),saved:[]});
function loadCart(){
 try{
  const raw=localStorage.getItem(storageKey);
  if(!raw)return initialCart();
  const value=JSON.parse(raw);
  const items={},saved=[];
  for(const {id} of catalog){
   const q=value.items?.[id];
   if(Number.isSafeInteger(q)&&q>0)items[id]=Math.min(q,99);
   if(value.saved?.includes(id))saved.push(id);
  }
  return {items,saved};
 }catch{return initialCart()}
}
function totals(cart){
 const subtotal=catalog.reduce((s,p)=>s+p.price*(cart.items[p.id]||0),0);
 const shipping=subtotal>0&&subtotal<6000?395:0;
 return {subtotal,shipping,total:subtotal+shipping,count:Object.values(cart.items).reduce((a,b)=>a+b,0)};
}
const money=n=>(n/100).toFixed(2).replace('.',',')+' €';
