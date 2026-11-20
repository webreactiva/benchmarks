import type {
  CatalogInventoryPort,
  CatalogProduct,
  StockReservation,
  StockReservationLine,
} from '../../application/ports.ts';
import { InsufficientStockError, NotFoundError } from '../../domain/errors.ts';
import type { CouponDefinition } from '../../domain/pricing.ts';

interface MutableProduct {
  sku: string;
  name: string;
  description: string;
  unitPriceMinor: number;
  currency: CatalogProduct['currency'];
  physicalStock: number;
  reservedStock: number;
  active: boolean;
  imageUrl?: string;
}

interface InternalReservation {
  reservationId: string;
  lines: ReadonlyArray<StockReservationLine>;
  expiresAtMs: number;
  status: 'PENDING' | 'COMMITTED' | 'RELEASED';
}

export const DEFAULT_CATALOG_PRODUCTS: ReadonlyArray<CatalogProduct> = [
  {
    sku: 'LAPTOP-PRO-14',
    name: 'Portátil Ultrabook Pro 14" M-Series',
    description: '16GB RAM, 512GB NVMe SSD, Pantalla Retina 120Hz',
    unitPriceMinor: 129900,
    currency: 'EUR',
    availableStock: 25,
    active: true,
  },
  {
    sku: 'MECH-KEY-ES',
    name: 'Teclado Mecánico Inalámbrico ISO-ES',
    description: 'Switches táctiles silenciosos, chasis de aluminio CNC',
    unitPriceMinor: 11950,
    currency: 'EUR',
    availableStock: 60,
    active: true,
  },
  {
    sku: 'MOUSE-ERGO-WL',
    name: 'Ratón Ergonómico de Precisión 8K',
    description: 'Sensor óptico 26000 DPI, USB-C y Bluetooth multipunto',
    unitPriceMinor: 7990,
    currency: 'EUR',
    availableStock: 80,
    active: true,
  },
  {
    sku: 'MON-4K-27',
    name: 'Monitor 27" 4K UHD IPS USB-C 90W',
    description: 'Calibración de fábrica Delta E < 2, Hub USB integrado',
    unitPriceMinor: 38900,
    currency: 'EUR',
    availableStock: 15,
    active: true,
  },
  {
    sku: 'USB-HUB-7IN1',
    name: 'Docking Station USB-C 7-en-1',
    description: 'HDMI 4K60, Ethernet Gigabit, Power Delivery 100W',
    unitPriceMinor: 3495,
    currency: 'EUR',
    availableStock: 120,
    active: true,
  },
  {
    sku: 'HEADSET-ANC',
    name: 'Auriculares Over-Ear con Cancelación Activa',
    description: '40h de autonomía, audio espacial y micrófono beamforming',
    unitPriceMinor: 19900,
    currency: 'EUR',
    availableStock: 40,
    active: true,
  },
];

export const DEFAULT_COUPONS: ReadonlyArray<CouponDefinition> = [
  {
    code: 'BIENVENIDA10',
    description: '10% de descuento de bienvenida',
    kind: 'PERCENTAGE',
    percentageBps: 1000,
    minSubtotalMinor: 3000,
    maxDiscountMinor: 15000,
    active: true,
  },
  {
    code: 'AHORRA25',
    description: '25.00 EUR de descuento en compras superiores a 150.00 EUR',
    kind: 'FIXED_AMOUNT',
    fixedAmountMinor: 2500,
    currency: 'EUR',
    minSubtotalMinor: 15000,
    active: true,
  },
  {
    code: 'VIP15',
    description: '15% de descuento VIP (tope 300.00 EUR)',
    kind: 'PERCENTAGE',
    percentageBps: 1500,
    maxDiscountMinor: 30000,
    active: true,
  },
];

export class InMemoryCatalogInventory implements CatalogInventoryPort {
  private readonly products = new Map<string, MutableProduct>();
  private readonly reservations = new Map<string, InternalReservation>();

  constructor(seed: ReadonlyArray<CatalogProduct> = DEFAULT_CATALOG_PRODUCTS) {
    for (const item of seed) {
      this.products.set(item.sku, {
        sku: item.sku,
        name: item.name,
        description: item.description,
        unitPriceMinor: item.unitPriceMinor,
        currency: item.currency,
        physicalStock: item.availableStock,
        reservedStock: 0,
        active: item.active,
        imageUrl: item.imageUrl,
      });
    }
  }

  async listProducts(): Promise<ReadonlyArray<CatalogProduct>> {
    this.releaseExpiredReservations();
    return Array.from(this.products.values())
      .filter((p) => p.active)
      .map((p) => this.toPublicProduct(p));
  }

  async getProduct(sku: string): Promise<CatalogProduct | null> {
    this.releaseExpiredReservations();
    const p = this.products.get(sku);
    return p ? this.toPublicProduct(p) : null;
  }

  async getProducts(skus: ReadonlyArray<string>): Promise<Map<string, CatalogProduct>> {
    this.releaseExpiredReservations();
    const result = new Map<string, CatalogProduct>();
    for (const sku of skus) {
      const p = this.products.get(sku);
      if (p) {
        result.set(sku, this.toPublicProduct(p));
      }
    }
    return result;
  }

  upsertProduct(product: CatalogProduct): void {
    const existing = this.products.get(product.sku);
    this.products.set(product.sku, {
      sku: product.sku,
      name: product.name,
      description: product.description,
      unitPriceMinor: product.unitPriceMinor,
      currency: product.currency,
      physicalStock: product.availableStock + (existing?.reservedStock ?? 0),
      reservedStock: existing?.reservedStock ?? 0,
      active: product.active,
      imageUrl: product.imageUrl,
    });
  }

  async reserveStock(
    reservationId: string,
    lines: ReadonlyArray<StockReservationLine>,
    ttlMs = 15 * 60 * 1000,
  ): Promise<StockReservation> {
    this.releaseExpiredReservations();

    const existing = this.reservations.get(reservationId);
    if (existing && existing.status === 'PENDING') {
      return {
        reservationId: existing.reservationId,
        lines: existing.lines,
        expiresAt: new Date(existing.expiresAtMs).toISOString(),
      };
    }

    // Fase 1: Validar disponibilidad completa antes de mutar (atomicidad todo-o-nada)
    for (const line of lines) {
      const product = this.products.get(line.sku);
      if (!product || !product.active) {
        throw new NotFoundError(
          'PRODUCT_NOT_FOUND',
          `Producto '${line.sku}' no disponible para reserva.`,
        );
      }
      const available = product.physicalStock - product.reservedStock;
      if (line.quantity > available) {
        throw new InsufficientStockError(line.sku, line.quantity, available);
      }
    }

    // Fase 2: Aplicar reserva
    for (const line of lines) {
      const product = this.products.get(line.sku)!;
      product.reservedStock += line.quantity;
    }

    const expiresAtMs = Date.now() + ttlMs;
    this.reservations.set(reservationId, {
      reservationId,
      lines: lines.map((l) => ({ ...l })),
      expiresAtMs,
      status: 'PENDING',
    });

    return {
      reservationId,
      lines,
      expiresAt: new Date(expiresAtMs).toISOString(),
    };
  }

  async commitReservation(reservationId: string): Promise<void> {
    const res = this.reservations.get(reservationId);
    if (!res || res.status !== 'PENDING') return;

    for (const line of res.lines) {
      const product = this.products.get(line.sku);
      if (product) {
        product.reservedStock = Math.max(0, product.reservedStock - line.quantity);
        product.physicalStock = Math.max(0, product.physicalStock - line.quantity);
      }
    }
    res.status = 'COMMITTED';
  }

  async releaseReservation(reservationId: string): Promise<void> {
    const res = this.reservations.get(reservationId);
    if (!res || res.status !== 'PENDING') return;

    for (const line of res.lines) {
      const product = this.products.get(line.sku);
      if (product) {
        product.reservedStock = Math.max(0, product.reservedStock - line.quantity);
      }
    }
    res.status = 'RELEASED';
  }

  releaseExpiredReservations(nowMs = Date.now()): void {
    for (const res of this.reservations.values()) {
      if (res.status === 'PENDING' && res.expiresAtMs <= nowMs) {
        for (const line of res.lines) {
          const product = this.products.get(line.sku);
          if (product) {
            product.reservedStock = Math.max(0, product.reservedStock - line.quantity);
          }
        }
        res.status = 'RELEASED';
      }
    }
  }

  private toPublicProduct(p: MutableProduct): CatalogProduct {
    return {
      sku: p.sku,
      name: p.name,
      description: p.description,
      unitPriceMinor: p.unitPriceMinor,
      currency: p.currency,
      availableStock: Math.max(0, p.physicalStock - p.reservedStock),
      active: p.active,
      imageUrl: p.imageUrl,
    };
  }
}
