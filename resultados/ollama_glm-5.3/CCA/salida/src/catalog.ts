import type { Product } from './domain/product.js';

/**
 * Catálogo inicial de la tienda. En un sistema real vendría de un gestor de
 * catálogo externo; aquí se siembra en el adaptador de persistencia al
 * arrancar, de forma idempotente (INSERT OR IGNORE: no machaca el stock entre
 * reinicios).
 */
export const CATALOG: Product[] = [
  {
    id: 'p-auriculares',
    name: 'Auriculares Bluetooth ANC',
    description: 'Cancelación activa de ruido, 30 h de batería, estuche rígido incluido.',
    priceCents: 5999,
    currency: 'EUR',
    stock: 25,
    category: 'Audio',
    emoji: '🎧',
  },
  {
    id: 'p-teclado',
    name: 'Teclado mecánico TKL',
    description: 'Switches rojos lineales, keycaps PBT doble inyección, cable desmontable.',
    priceCents: 8990,
    currency: 'EUR',
    stock: 12,
    category: 'Periféricos',
    emoji: '⌨️',
  },
  {
    id: 'p-raton',
    name: 'Ratón ergonómico vertical',
    description: 'Sensor de 8000 dpi, inalámbrico, 6 botones programables.',
    priceCents: 2999,
    currency: 'EUR',
    stock: 40,
    category: 'Periféricos',
    emoji: '🖱️',
  },
  {
    id: 'p-monitor',
    name: 'Monitor 27" QHD 165 Hz',
    description: 'Panel IPS, 1 ms, HDR400, soporte ajustable en altura.',
    priceCents: 24900,
    currency: 'EUR',
    stock: 8,
    category: 'Pantallas',
    emoji: '🖥️',
  },
  {
    id: 'p-altavoz',
    name: 'Altavoz portátil IPX7',
    description: 'Resistente al agua, 12 h de batería, emparejamiento estéreo.',
    priceCents: 4550,
    currency: 'EUR',
    stock: 30,
    category: 'Audio',
    emoji: '🔊',
  },
  {
    id: 'p-webcam',
    name: 'Webcam 1080p',
    description: 'Autoenfoque rápido, micrófono con reducción de ruido.',
    priceCents: 3500,
    currency: 'EUR',
    stock: 18,
    category: 'Vídeo',
    emoji: '📷',
  },
  {
    id: 'p-mando',
    name: 'Mando inalámbrico',
    description: 'Compatibilidad PC y consola, vibración háptica, giroscopio.',
    priceCents: 4990,
    currency: 'EUR',
    stock: 15,
    category: 'Gaming',
    emoji: '🎮',
  },
  {
    id: 'p-hub',
    name: 'Hub USB-C 7 en 1',
    description: 'HDMI 4K, 2× USB 3.0, lector SD/microSD, LAN Gigabit, PD 100 W.',
    priceCents: 2495,
    currency: 'EUR',
    stock: 50,
    category: 'Accesorios',
    emoji: '🔌',
  },
];
