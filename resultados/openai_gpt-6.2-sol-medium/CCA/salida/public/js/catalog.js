export const categories = [
  { id: 'mesa', name: 'Mesa y cocina', cover: 'taza', description: 'Para el primer café y las sobremesas largas.' },
  { id: 'textiles', name: 'Textiles', cover: 'pano', description: 'Fibras naturales para acompañarte a diario.' },
  { id: 'hogar', name: 'Hogar', cover: 'vela', description: 'Pequeños rituales que hacen de una casa tu hogar.' },
];

export const products = [
  { id: 'taza', name: 'Taza Alba', detail: 'Gres artesanal · Arena', price: 1800, stock: 12, category: 'mesa' },
  { id: 'pano', name: 'Paño de lino Oliva', detail: 'Lino lavado · Verde oliva', price: 1600, stock: 8, category: 'textiles' },
  { id: 'vela', name: 'Vela Ámbar', detail: 'Cera vegetal · Cedro y ámbar', price: 2400, stock: 10, category: 'hogar' },
  { id: 'cuenco', name: 'Cuenco Calma', detail: 'Gres esmaltado · Marfil', price: 2200, stock: 16, category: 'mesa' },
  { id: 'bolsa', name: 'Bolsa de algodón Crudo', detail: 'Algodón orgánico · Natural', price: 1900, stock: 20, category: 'textiles' },
  { id: 'jarra', name: 'Jarra Bruma', detail: 'Vidrio reciclado · Verde humo', price: 3200, stock: 6, category: 'mesa' },
];

export const catalog = new Map(products.map(product => [product.id, product]));
export const sampleItems = { taza: 1, pano: 1, vela: 1 };
