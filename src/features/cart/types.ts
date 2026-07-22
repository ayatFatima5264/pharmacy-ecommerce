/**
 * Cart types.
 *
 * The central rule: what we PERSIST is identity and quantity only — never
 * price. `cart_items` has no price column for the same reason. A cart left open
 * for a week must not honour last week's price, and a product that was deleted
 * or went out of stock must surface as unavailable rather than silently
 * checking out at a remembered price.
 *
 * Prices are resolved at render from a catalog snapshot the server passes in.
 */

export type CartItemKind = 'product' | 'test' | 'package'

/** Persisted to localStorage. Deliberately minimal. */
export interface CartRef {
  key: string
  kind: CartItemKind
  slug: string
  variantId?: string
  quantity: number
}

/** A catalog entry the cart can resolve a ref against. */
export interface CatalogEntry {
  kind: CartItemKind
  slug: string
  variantId?: string
  name: string
  subtitle: string
  icon: string
  unitPricePaisa: number
  compareAtPricePaisa: number | null
  requiresPrescription: boolean
  /** Per-item tax rate as a percentage. 0 today; the engine is already wired. */
  taxRatePercent: number
  /** Used for weight-banded courier rates. Zero for lab items — nothing ships. */
  weightGrams: number
  /** Sellable units. `null` means not stock-tracked (lab tests). */
  availableStock: number | null
  isAvailable: boolean
  href: string
  /** Fasting hours required, for diagnostic items. Null when not applicable. */
  fastingHours?: number | null
}

/** Serializable snapshot handed from a Server Component to the cart provider. */
export interface CartCatalog {
  entries: Record<string, CatalogEntry>
  zones: ShippingZoneSnapshot[]
  freeDeliveryThresholdPaisa: number
}

export interface ShippingZoneSnapshot {
  id: string
  name: string
  cities: string[]
  carrier: string
  ratePaisa: number
  freeAbovePaisa: number | null
  minDays: number
  maxDays: number
  supportsCod: boolean
  /** Surcharge applied per kilogram above the first kilogram. */
  perKgSurchargePaisa: number
}

/** A resolved line: the persisted ref joined to live catalog data. */
export interface CartLine extends CartRef {
  entry: CatalogEntry | null
  lineSubtotalPaisa: number
  /** Set when the ref cannot be fulfilled as requested. */
  issue: CartLineIssue | null
}

export type CartLineIssue =
  | { type: 'unavailable'; message: string }
  | { type: 'out_of_stock'; message: string }
  | { type: 'quantity_capped'; message: string; maxQuantity: number }
  | { type: 'price_changed'; message: string }

export interface CouponRule {
  code: string
  discountType: 'percentage' | 'fixed_amount' | 'free_shipping'
  discountValue: number
  minOrderPaisa: number
  maxDiscountPaisa: number | null
}

export interface ShippingContext {
  city: string | null
  paymentMethod: 'cod' | 'online'
}

export interface CartTotals {
  itemCount: number
  subtotalPaisa: number
  discountPaisa: number
  taxPaisa: number
  shippingPaisa: number
  totalPaisa: number
  /** Non-null once a city is chosen and a zone matches. */
  shipping: ResolvedShipping | null
  freeDeliveryRemainingPaisa: number
  hasPhysicalItems: boolean
  hasLabItems: boolean
  hasPrescriptionItems: boolean
  totalWeightGrams: number
}

export interface ResolvedShipping {
  zoneName: string
  carrier: string
  minDays: number
  maxDays: number
  costPaisa: number
  isFree: boolean
  freeReason: 'threshold' | 'coupon' | 'no_physical_items' | null
  supportsCod: boolean
}
