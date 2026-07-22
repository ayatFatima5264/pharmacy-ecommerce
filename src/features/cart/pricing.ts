import type {
  CartCatalog,
  CartLine,
  CartRef,
  CartTotals,
  CouponRule,
  ResolvedShipping,
  ShippingContext,
  ShippingZoneSnapshot,
} from './types'

/**
 * The cart money engine. Pure functions, integer paisa throughout, no React.
 *
 * Kept separate from the provider so the arithmetic can be tested directly —
 * see scripts/cart-check.ts. Money logic buried in a component is money logic
 * nobody verifies.
 */

export function entryKey(kind: string, slug: string, variantId?: string): string {
  return `${kind}:${slug}:${variantId ?? '-'}`
}

/** Joins persisted refs to live catalog data and flags anything unfulfillable. */
export function resolveLines(refs: CartRef[], catalog: CartCatalog): CartLine[] {
  return refs.map((ref) => {
    const entry = catalog.entries[entryKey(ref.kind, ref.slug, ref.variantId)] ?? null

    if (!entry || !entry.isAvailable) {
      return {
        ...ref,
        entry,
        lineSubtotalPaisa: 0,
        issue: {
          type: 'unavailable',
          message: 'This item is no longer available and will not be charged.',
        },
      }
    }

    if (entry.availableStock !== null && entry.availableStock <= 0) {
      return {
        ...ref,
        entry,
        lineSubtotalPaisa: 0,
        issue: { type: 'out_of_stock', message: 'Out of stock — remove it to continue.' },
      }
    }

    // Cap rather than reject: silently dropping a line the customer chose is
    // worse than charging for what can actually be shipped and saying so.
    if (entry.availableStock !== null && ref.quantity > entry.availableStock) {
      return {
        ...ref,
        entry,
        lineSubtotalPaisa: entry.unitPricePaisa * entry.availableStock,
        issue: {
          type: 'quantity_capped',
          message: `Only ${entry.availableStock} left — quantity reduced.`,
          maxQuantity: entry.availableStock,
        },
      }
    }

    return {
      ...ref,
      entry,
      lineSubtotalPaisa: entry.unitPricePaisa * ref.quantity,
      issue: null,
    }
  })
}

/** Quantity actually chargeable on a line, after any stock cap. */
export function chargeableQuantity(line: CartLine): number {
  if (!line.entry || line.issue?.type === 'unavailable' || line.issue?.type === 'out_of_stock') {
    return 0
  }
  if (line.issue?.type === 'quantity_capped') return line.issue.maxQuantity
  return line.quantity
}

/**
 * Distributes a discount across lines proportionally, in integer paisa.
 *
 * Naive per-line rounding loses or invents paisa; the largest-remainder method
 * guarantees the parts sum exactly to the whole. It matters because tax is
 * charged on the discounted line amount.
 */
export function allocateDiscount(lineTotals: number[], discountPaisa: number): number[] {
  const subtotal = lineTotals.reduce((a, b) => a + b, 0)
  if (subtotal <= 0 || discountPaisa <= 0) return lineTotals.map(() => 0)

  const capped = Math.min(discountPaisa, subtotal)
  const exact = lineTotals.map((total) => (total * capped) / subtotal)
  const floors = exact.map(Math.floor)

  let remainder = capped - floors.reduce((a, b) => a + b, 0)
  // Hand the leftover paisa to the largest fractional parts first.
  const order = exact
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac)

  const result = [...floors]
  for (const { index } of order) {
    if (remainder <= 0) break
    result[index] += 1
    remainder -= 1
  }
  return result
}

export function computeCouponDiscount(
  coupon: CouponRule | null,
  subtotalPaisa: number,
): number {
  if (!coupon) return 0
  if (subtotalPaisa < coupon.minOrderPaisa) return 0
  // Free shipping is not a line discount — it is applied in the shipping step.
  if (coupon.discountType === 'free_shipping') return 0

  const raw =
    coupon.discountType === 'percentage'
      ? Math.round((subtotalPaisa * coupon.discountValue) / 100)
      : Math.round(coupon.discountValue * 100)

  // Percentage coupons must be capped, or a large order is an unbounded
  // liability. Mirrors coupons.max_discount_paisa.
  const capped = coupon.maxDiscountPaisa !== null ? Math.min(raw, coupon.maxDiscountPaisa) : raw
  return Math.min(capped, subtotalPaisa)
}

export function findZone(
  zones: ShippingZoneSnapshot[],
  city: string | null,
): ShippingZoneSnapshot | null {
  if (!city) return null
  return zones.find((zone) => zone.cities.includes(city)) ?? null
}

export function computeShipping({
  zone,
  hasPhysicalItems,
  weightGrams,
  subtotalAfterDiscountPaisa,
  freeShippingCoupon,
  freeDeliveryThresholdPaisa,
}: {
  zone: ShippingZoneSnapshot | null
  hasPhysicalItems: boolean
  weightGrams: number
  subtotalAfterDiscountPaisa: number
  freeShippingCoupon: boolean
  freeDeliveryThresholdPaisa: number
}): ResolvedShipping | null {
  // A lab-only order has nothing to ship, so it carries no delivery fee at all.
  if (!hasPhysicalItems) {
    return zone
      ? {
          zoneName: zone.name,
          carrier: '—',
          minDays: 0,
          maxDays: 0,
          costPaisa: 0,
          isFree: true,
          freeReason: 'no_physical_items',
          supportsCod: true,
        }
      : null
  }

  if (!zone) return null

  // Courier tariffs here are stepped, not linear: a base rate covers the first
  // kilogram, then a surcharge per additional kilogram (rounded up).
  const extraKg = Math.max(0, Math.ceil(weightGrams / 1000) - 1)
  const base = zone.ratePaisa + extraKg * zone.perKgSurchargePaisa

  const threshold = zone.freeAbovePaisa ?? freeDeliveryThresholdPaisa
  // Threshold is measured AFTER discount — a coupon must not conjure free
  // delivery the order no longer qualifies for.
  const meetsThreshold = zone.freeAbovePaisa !== null || threshold > 0
    ? subtotalAfterDiscountPaisa >= threshold
    : false

  const isFree = freeShippingCoupon || meetsThreshold

  return {
    zoneName: zone.name,
    carrier: zone.carrier,
    minDays: zone.minDays,
    maxDays: zone.maxDays,
    costPaisa: isFree ? 0 : base,
    isFree,
    freeReason: isFree ? (freeShippingCoupon ? 'coupon' : 'threshold') : null,
    supportsCod: zone.supportsCod,
  }
}

/**
 * The full cart calculation.
 *
 * Order of operations, which is the part that actually matters:
 *   1. line subtotals        (unit price × chargeable quantity)
 *   2. subtotal              (sum)
 *   3. discount              (coupon, capped, allocated proportionally)
 *   4. tax                   (per line, on the DISCOUNTED line amount)
 *   5. shipping              (zone + weight; free above threshold post-discount)
 *   6. total                 (subtotal − discount + tax + shipping)
 *
 * Tax is charged per line rather than on the whole basket because rates differ
 * per item — medicines are frequently zero-rated while devices are not. Shipping
 * is not taxed.
 */
export function computeTotals({
  lines,
  coupon,
  context,
  catalog,
}: {
  lines: CartLine[]
  coupon: CouponRule | null
  context: ShippingContext
  catalog: CartCatalog
}): CartTotals {
  const chargeable = lines.map((line) => ({
    line,
    quantity: chargeableQuantity(line),
  }))

  const lineTotals = chargeable.map(({ line, quantity }) =>
    line.entry ? line.entry.unitPricePaisa * quantity : 0,
  )
  const subtotalPaisa = lineTotals.reduce((a, b) => a + b, 0)

  const discountPaisa = computeCouponDiscount(coupon, subtotalPaisa)
  const perLineDiscount = allocateDiscount(lineTotals, discountPaisa)

  // Tax on the discounted amount, per line, at that item's rate.
  const taxPaisa = chargeable.reduce((sum, { line }, i) => {
    const rate = line.entry?.taxRatePercent ?? 0
    if (rate === 0) return sum
    const taxable = lineTotals[i] - perLineDiscount[i]
    return sum + Math.round((taxable * rate) / 100)
  }, 0)

  const hasPhysicalItems = chargeable.some(({ line, quantity }) => line.kind === 'product' && quantity > 0)
  const hasLabItems = chargeable.some(
    ({ line, quantity }) => (line.kind === 'test' || line.kind === 'package') && quantity > 0,
  )

  const totalWeightGrams = chargeable.reduce(
    (sum, { line, quantity }) => sum + (line.entry?.weightGrams ?? 0) * quantity,
    0,
  )

  const zone = findZone(catalog.zones, context.city)
  const shipping = computeShipping({
    zone,
    hasPhysicalItems,
    weightGrams: totalWeightGrams,
    subtotalAfterDiscountPaisa: subtotalPaisa - discountPaisa,
    freeShippingCoupon: coupon?.discountType === 'free_shipping' && subtotalPaisa >= coupon.minOrderPaisa,
    freeDeliveryThresholdPaisa: catalog.freeDeliveryThresholdPaisa,
  })

  const shippingPaisa = shipping?.costPaisa ?? 0
  const threshold = zone?.freeAbovePaisa ?? catalog.freeDeliveryThresholdPaisa

  return {
    itemCount: chargeable.reduce((n, { quantity }) => n + quantity, 0),
    subtotalPaisa,
    discountPaisa,
    taxPaisa,
    shippingPaisa,
    totalPaisa: Math.max(0, subtotalPaisa - discountPaisa + taxPaisa + shippingPaisa),
    shipping,
    freeDeliveryRemainingPaisa:
      hasPhysicalItems && !shipping?.isFree
        ? Math.max(0, threshold - (subtotalPaisa - discountPaisa))
        : 0,
    hasPhysicalItems,
    hasLabItems,
    hasPrescriptionItems: chargeable.some(
      ({ line, quantity }) => quantity > 0 && line.entry?.requiresPrescription,
    ),
    totalWeightGrams,
  }
}
