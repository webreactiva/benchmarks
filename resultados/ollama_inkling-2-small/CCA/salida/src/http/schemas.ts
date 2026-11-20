import { z } from "zod";

export const createCartSchema = z.object({
  ownerId: z.string().min(1).max(128).nullish(),
});

export const addItemSchema = z.object({
  productId: z.string().min(1).max(128),
  quantity: z.number().int().min(1).max(99),
  expectedVersion: z.number().int().min(0).optional(),
});

export const updateItemSchema = z.object({
  quantity: z.number().int().min(0).max(99),
  expectedVersion: z.number().int().min(0).optional(),
});

export const applyCouponSchema = z.object({
  code: z.string().min(1).max(64),
  expectedVersion: z.number().int().min(0).optional(),
});

export const expectedVersionQuerySchema = z.object({
  expectedVersion: z.coerce.number().int().min(0).optional(),
});

export const cartIdParamsSchema = z.object({
  cartId: z.string().min(1).max(128),
});

export const cartItemParamsSchema = cartIdParamsSchema.extend({
  productId: z.string().min(1).max(128),
});
