import { z } from 'zod';

export const currencySchema = z.enum(['EUR', 'USD', 'GBP']);

export const createCartSchema = z.object({
  currency: currencySchema.optional(),
});

export const addItemSchema = z.object({
  productId: z.string().min(1).max(128),
  variantId: z.string().min(1).max(128).nullish(),
  quantity: z.number().int().min(1).max(10_000),
});

export const setQuantitySchema = z.object({
  quantity: z.number().int().min(0).max(10_000),
});

export const promoSchema = z.object({
  code: z.string().min(1).max(64),
});

export const mergeSchema = z.object({
  sourceCartId: z.string().min(1).max(64),
});

export const lineIdSchema = z.object({
  lineId: z.string().min(1).max(64),
});

export const promoCodeSchema = z.object({
  code: z.string().min(1).max(64),
});

export const cartIdSchema = z.object({
  cartId: z.string().min(1).max(64),
});

export type CreateCartBody = z.infer<typeof createCartSchema>;
export type AddItemBody = z.infer<typeof addItemSchema>;
export type SetQuantityBody = z.infer<typeof setQuantitySchema>;
export type PromoBody = z.infer<typeof promoSchema>;
export type MergeBody = z.infer<typeof mergeSchema>;
