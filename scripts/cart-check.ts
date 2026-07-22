/**
 * Verification for the cart money engine.
 * Run with: npm run check:cart
 */
import {
  allocateDiscount,
  computeCouponDiscount,
  computeShipping,
  computeTotals,
  entryKey,
  findZone,
  resolveLines,
} from '../src/features/cart/pricing'
import type { CartCatalog, CatalogEntry, CouponRule, ShippingZoneSnapshot } from '../src/features/cart/types'

let passed = 0
let failed = 0

function check(name: string, condition: boolean, detail = '') {
  if (condition) { passed++; console.log(`  PASS  ${name}`) }
  else { failed++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`) }
}

function entry(over: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    kind: 'product', slug: 'test', variantId: 'v1', name: 'Test', subtitle: 'Strip of 10',
    icon: '💊', unitPricePaisa: 45000, compareAtPricePaisa: null, requiresPrescription: false,
    taxRatePercent: 0, weightGrams: 60, availableStock: 100, isAvailable: true, href: '/x',
    ...over,
  }
}

const zone: ShippingZoneSnapshot = {
  id: 'z1', name: 'Karachi Metro', cities: ['Karachi'], carrier: 'In-house',
  ratePaisa: 9_900, freeAbovePaisa: 200_000, minDays: 0, maxDays: 1,
  supportsCod: true, perKgSurchargePaisa: 5_000,
}

function catalogWith(entries: Record<string, CatalogEntry>): CartCatalog {
  return { entries, zones: [zone], freeDeliveryThresholdPaisa: 200_000 }
}

console.log('\nDiscount allocation (integer paisa)')
{
  const parts = allocateDiscount([33333, 33333, 33334], 10000)
  check('allocated parts sum exactly to the discount',
    parts.reduce((a, b) => a + b, 0) === 10000, `got ${parts.reduce((a, b) => a + b, 0)}`)

  const uneven = allocateDiscount([100, 200, 700], 101)
  check('uneven split still sums exactly',
    uneven.reduce((a, b) => a + b, 0) === 101, `got ${uneven.reduce((a, b) => a + b, 0)}`)

  const capped = allocateDiscount([500, 500], 5000)
  check('discount larger than subtotal is capped at subtotal',
    capped.reduce((a, b) => a + b, 0) === 1000)

  check('zero discount allocates nothing',
    allocateDiscount([100, 200], 0).every((v) => v === 0))
}

console.log('\nCoupon rules')
{
  const pct: CouponRule = { code: 'SAVE10', discountType: 'percentage', discountValue: 10, minOrderPaisa: 100_000, maxDiscountPaisa: 50_000 }
  check('10% of Rs 3,000 is Rs 300', computeCouponDiscount(pct, 300_000) === 30_000)
  check('percentage discount respects its cap',
    computeCouponDiscount(pct, 10_000_000) === 50_000,
    String(computeCouponDiscount(pct, 10_000_000)))
  check('below minimum order yields no discount', computeCouponDiscount(pct, 50_000) === 0)

  const fixed: CouponRule = { code: 'FLAT', discountType: 'fixed_amount', discountValue: 200, minOrderPaisa: 0, maxDiscountPaisa: null }
  check('fixed Rs 200 becomes 20000 paisa', computeCouponDiscount(fixed, 500_000) === 20_000)
  check('fixed discount never exceeds subtotal', computeCouponDiscount(fixed, 5_000) === 5_000)

  const ship: CouponRule = { code: 'FREESHIP', discountType: 'free_shipping', discountValue: 100, minOrderPaisa: 0, maxDiscountPaisa: null }
  check('free-shipping coupon is not a line discount', computeCouponDiscount(ship, 500_000) === 0)
  check('no coupon yields no discount', computeCouponDiscount(null, 500_000) === 0)
}

console.log('\nShipping')
{
  check('city maps to its zone', findZone([zone], 'Karachi')?.id === 'z1')
  check('unknown city maps to nothing', findZone([zone], 'Gilgit') === null)
  check('no city maps to nothing', findZone([zone], null) === null)

  const under = computeShipping({ zone, hasPhysicalItems: true, weightGrams: 500, subtotalAfterDiscountPaisa: 150_000, freeShippingCoupon: false, freeDeliveryThresholdPaisa: 200_000 })
  check('below threshold charges the base rate', under?.costPaisa === 9_900, String(under?.costPaisa))

  const over = computeShipping({ zone, hasPhysicalItems: true, weightGrams: 500, subtotalAfterDiscountPaisa: 250_000, freeShippingCoupon: false, freeDeliveryThresholdPaisa: 200_000 })
  check('above threshold is free', over?.isFree === true && over?.costPaisa === 0)

  const heavy = computeShipping({ zone, hasPhysicalItems: true, weightGrams: 3200, subtotalAfterDiscountPaisa: 100_000, freeShippingCoupon: false, freeDeliveryThresholdPaisa: 200_000 })
  check('weight surcharge applies above 1kg (3.2kg → base + 3×surcharge)',
    heavy?.costPaisa === 9_900 + 3 * 5_000, String(heavy?.costPaisa))

  const coupon = computeShipping({ zone, hasPhysicalItems: true, weightGrams: 500, subtotalAfterDiscountPaisa: 50_000, freeShippingCoupon: true, freeDeliveryThresholdPaisa: 200_000 })
  check('free-shipping coupon overrides the threshold',
    coupon?.isFree === true && coupon?.freeReason === 'coupon')

  const labOnly = computeShipping({ zone, hasPhysicalItems: false, weightGrams: 0, subtotalAfterDiscountPaisa: 50_000, freeShippingCoupon: false, freeDeliveryThresholdPaisa: 200_000 })
  check('lab-only order carries no delivery fee',
    labOnly?.costPaisa === 0 && labOnly?.freeReason === 'no_physical_items')
}

console.log('\nLine resolution (stale-cart protection)')
{
  const key = entryKey('product', 'test', 'v1')
  const cat = catalogWith({ [key]: entry() })

  const ok = resolveLines([{ key, kind: 'product', slug: 'test', variantId: 'v1', quantity: 2 }], cat)
  check('resolved line prices from live catalog, not storage',
    ok[0].lineSubtotalPaisa === 90_000 && ok[0].issue === null)

  const gone = resolveLines([{ key: 'product:ghost:-', kind: 'product', slug: 'ghost', quantity: 1 }], cat)
  check('deleted product flagged unavailable and charged zero',
    gone[0].issue?.type === 'unavailable' && gone[0].lineSubtotalPaisa === 0)

  const oos = catalogWith({ [key]: entry({ availableStock: 0 }) })
  const outOfStock = resolveLines([{ key, kind: 'product', slug: 'test', variantId: 'v1', quantity: 1 }], oos)
  check('out-of-stock line flagged and charged zero',
    outOfStock[0].issue?.type === 'out_of_stock' && outOfStock[0].lineSubtotalPaisa === 0)

  const low = catalogWith({ [key]: entry({ availableStock: 3 }) })
  const capped = resolveLines([{ key, kind: 'product', slug: 'test', variantId: 'v1', quantity: 10 }], low)
  check('quantity above stock is capped, not rejected',
    capped[0].issue?.type === 'quantity_capped' && capped[0].lineSubtotalPaisa === 135_000,
    String(capped[0].lineSubtotalPaisa))
}

console.log('\nTax engine')
{
  const key = entryKey('product', 'test', 'v1')
  const taxed = catalogWith({ [key]: entry({ taxRatePercent: 17 }) })
  const lines = resolveLines([{ key, kind: 'product', slug: 'test', variantId: 'v1', quantity: 2 }], taxed)

  const noDiscount = computeTotals({ lines, coupon: null, context: { city: 'Karachi', paymentMethod: 'cod' }, catalog: taxed })
  check('17% tax on Rs 900 is Rs 153', noDiscount.taxPaisa === 15_300, String(noDiscount.taxPaisa))

  const pct: CouponRule = { code: 'X', discountType: 'percentage', discountValue: 10, minOrderPaisa: 0, maxDiscountPaisa: null }
  const withDiscount = computeTotals({ lines, coupon: pct, context: { city: 'Karachi', paymentMethod: 'cod' }, catalog: taxed })
  check('tax is charged on the DISCOUNTED amount, not the gross',
    withDiscount.taxPaisa === 13_770, String(withDiscount.taxPaisa))

  const zeroRated = catalogWith({ [key]: entry({ taxRatePercent: 0 }) })
  const zeroLines = resolveLines([{ key, kind: 'product', slug: 'test', variantId: 'v1', quantity: 2 }], zeroRated)
  const zero = computeTotals({ lines: zeroLines, coupon: null, context: { city: 'Karachi', paymentMethod: 'cod' }, catalog: zeroRated })
  check('zero-rated items produce no tax', zero.taxPaisa === 0)
}

console.log('\nTotals')
{
  const key = entryKey('product', 'test', 'v1')
  const cat = catalogWith({ [key]: entry({ unitPricePaisa: 50_000 }) })
  const lines = resolveLines([{ key, kind: 'product', slug: 'test', variantId: 'v1', quantity: 3 }], cat)
  const pct: CouponRule = { code: 'X', discountType: 'percentage', discountValue: 10, minOrderPaisa: 0, maxDiscountPaisa: null }

  const t = computeTotals({ lines, coupon: pct, context: { city: 'Karachi', paymentMethod: 'cod' }, catalog: cat })
  // 150000 subtotal − 15000 discount = 135000; below 200000 threshold → 9900 shipping
  check('subtotal is Rs 1,500', t.subtotalPaisa === 150_000)
  check('discount is Rs 150', t.discountPaisa === 15_000)
  check('shipping charged because post-discount total is below threshold', t.shippingPaisa === 9_900)
  check('total = subtotal − discount + tax + shipping',
    t.totalPaisa === 150_000 - 15_000 + 0 + 9_900, String(t.totalPaisa))
  check('free-delivery remaining reflects post-discount subtotal',
    t.freeDeliveryRemainingPaisa === 65_000, String(t.freeDeliveryRemainingPaisa))

  const noCity = computeTotals({ lines, coupon: null, context: { city: null, paymentMethod: 'cod' }, catalog: cat })
  check('no city selected means no shipping quote', noCity.shipping === null && noCity.shippingPaisa === 0)

  const unavailable = resolveLines([{ key: 'product:ghost:-', kind: 'product', slug: 'ghost', quantity: 5 }], cat)
  const zeroTotals = computeTotals({ lines: unavailable, coupon: null, context: { city: 'Karachi', paymentMethod: 'cod' }, catalog: cat })
  check('unavailable items contribute nothing to the total',
    zeroTotals.totalPaisa === 0 && zeroTotals.itemCount === 0)
}

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
