/** Product catalog. Replace this module with an API adapter when connecting a backend. */
export const categories = ['Todo', 'Casa', 'Accesorios', 'Papel'];

export const products = [
  { id: 'jarron-arcilla', name: 'Jarrón Arcilla', detail: 'Cerámica artesanal · Arena', price: 38, category: 'Casa', tag: 'Más querido', image: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=720&q=80', imageAlt: 'Jarrón de cerámica artesanal de tono arena' },
  { id: 'lampara-lino', name: 'Lámpara Lino', detail: 'Lino natural · Roble', price: 89, category: 'Casa', tag: 'Edición pequeña', image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=720&q=80', imageAlt: 'Lámpara de mesa de diseño cálido' },
  { id: 'bolso-diario', name: 'Bolso Diario', detail: 'Algodón orgánico · Oliva', price: 42, category: 'Accesorios', tag: '', image: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=720&q=80', imageAlt: 'Bolso de tela color natural' },
  { id: 'cuaderno-calma', name: 'Cuaderno Calma', detail: 'Papel reciclado · A5', price: 16, category: 'Papel', tag: 'Hecho aquí', image: 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&w=720&q=80', imageAlt: 'Cuaderno y papelería sobre una mesa' },
  { id: 'taza-origen', name: 'Taza Origen', detail: 'Gres esmaltado · Crema', price: 24, category: 'Casa', tag: '', image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=720&q=80', imageAlt: 'Taza de cerámica artesanal' },
  { id: 'vela-pausa', name: 'Vela Pausa', detail: 'Cera vegetal · Cedro', price: 28, category: 'Casa', tag: 'Nuevo', image: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=720&q=80', imageAlt: 'Vela aromática para el hogar' },
  { id: 'estuche-trazo', name: 'Estuche Trazo', detail: 'Lona recuperada · Tierra', price: 19, category: 'Accesorios', tag: '', image: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=720&q=80', imageAlt: 'Materiales para dibujo en un estuche' },
  { id: 'lamina-botanica', name: 'Lámina Botánica', detail: 'Impresión risográfica · A4', price: 22, category: 'Papel', tag: 'Hecho aquí', image: 'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=720&q=80', imageAlt: 'Lámina botánica enmarcada' },
];

export const formatPrice = (amount) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);
