/**
 * Business limits applied to every mutation. They are injected (instead of
 * hard coded) so the same domain code can be reused by other tenants,
 * countries or channels with different rules.
 */
export interface CartPolicies {
  /** Maximum units allowed on a single line. */
  readonly maxQuantityPerLine: number;
  /** Maximum number of distinct products in a cart. */
  readonly maxDistinctLines: number;
  /** Maximum total units in a cart. */
  readonly maxUnitsPerCart: number;
  /** How quantities are combined when a guest cart is merged into a user cart. */
  readonly mergeStrategy: 'sum' | 'max';
  /** Time to live of an abandoned cart. */
  readonly ttlSeconds: number;
}

export const defaultCartPolicies: CartPolicies = {
  maxQuantityPerLine: 10,
  maxDistinctLines: 50,
  maxUnitsPerCart: 100,
  mergeStrategy: 'sum',
  ttlSeconds: 60 * 60 * 24 * 30,
};

export function mergePolicies(base: CartPolicies, overrides: Partial<CartPolicies>): CartPolicies {
  return { ...base, ...overrides };
}
