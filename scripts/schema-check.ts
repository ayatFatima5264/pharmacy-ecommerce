/**
 * Verification for the pharmacy module's validation rules.
 * Run with: npx tsx scripts/schema-check.ts
 */
import { productSchema, batchSchema, stockAdjustmentSchema } from '../src/features/catalog/schemas/product-schema'

let passed = 0
let failed = 0

function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const baseVariant = {
  sku: 'TEST-10',
  packSize: 'Strip of 10',
  unitsPerPack: '10',
  pricePaisa: '450',
  compareAtPricePaisa: '',
  inStock: true,
}

const baseProduct = {
  name: 'Test Product',
  slug: '',
  genericName: 'Paracetamol',
  brandId: 'b1',
  categorySlugs: ['pain-relief'],
  icon: '💊',
  shortDescription: 'A short description that is long enough.',
  description: 'A much longer description that comfortably passes the minimum length rule.',
  requiresPrescription: false,
  isControlled: false,
  dosageForm: 'Tablet',
  strength: '500mg',
  storageInstructions: '',
  composition: '',
  sideEffects: [],
  warnings: [],
  images: [],
  variants: [baseVariant],
}

console.log('\nMoney conversion')
{
  const r = productSchema.safeParse(baseProduct)
  check('rupees "450" become 45000 paisa', r.success && r.data.variants[0].pricePaisa === 45000,
    r.success ? String(r.data.variants[0].pricePaisa) : 'parse failed')

  const decimal = productSchema.safeParse({
    ...baseProduct,
    variants: [{ ...baseVariant, pricePaisa: '450.75' }],
  })
  check('rupees "450.75" become 45075 paisa',
    decimal.success && decimal.data.variants[0].pricePaisa === 45075)

  const bad = productSchema.safeParse({
    ...baseProduct,
    variants: [{ ...baseVariant, pricePaisa: '45.999' }],
  })
  check('three decimal places rejected', !bad.success)

  const nonNumeric = productSchema.safeParse({
    ...baseProduct,
    variants: [{ ...baseVariant, pricePaisa: 'free' }],
  })
  check('non-numeric price rejected', !nonNumeric.success)
}

console.log('\nDiscount / sale price')
{
  const ok = productSchema.safeParse({
    ...baseProduct,
    variants: [{ ...baseVariant, pricePaisa: '450', compareAtPricePaisa: '500' }],
  })
  check('compare-at above price accepted', ok.success)

  const inverted = productSchema.safeParse({
    ...baseProduct,
    variants: [{ ...baseVariant, pricePaisa: '500', compareAtPricePaisa: '450' }],
  })
  check('compare-at BELOW price rejected', !inverted.success)

  const equal = productSchema.safeParse({
    ...baseProduct,
    variants: [{ ...baseVariant, pricePaisa: '500', compareAtPricePaisa: '500' }],
  })
  check('compare-at EQUAL to price rejected', !equal.success)

  const blank = productSchema.safeParse({
    ...baseProduct,
    variants: [{ ...baseVariant, compareAtPricePaisa: '' }],
  })
  check('blank compare-at becomes null', blank.success && blank.data.variants[0].compareAtPricePaisa === null)
}

console.log('\nRegulatory rules')
{
  const controlled = productSchema.safeParse({
    ...baseProduct,
    isControlled: true,
    requiresPrescription: false,
  })
  check('controlled drug without Rx flag rejected', !controlled.success)

  const valid = productSchema.safeParse({
    ...baseProduct,
    isControlled: true,
    requiresPrescription: true,
  })
  check('controlled + Rx accepted', valid.success)
}

console.log('\nVariants')
{
  const dupes = productSchema.safeParse({
    ...baseProduct,
    variants: [baseVariant, { ...baseVariant, packSize: 'Box of 100' }],
  })
  check('duplicate SKUs across pack sizes rejected', !dupes.success)

  const distinct = productSchema.safeParse({
    ...baseProduct,
    variants: [baseVariant, { ...baseVariant, sku: 'TEST-100', packSize: 'Box of 100' }],
  })
  check('distinct SKUs accepted', distinct.success)

  const none = productSchema.safeParse({ ...baseProduct, variants: [] })
  check('product with no pack sizes rejected', !none.success)
}

console.log('\nCategories and images')
{
  const noCat = productSchema.safeParse({ ...baseProduct, categorySlugs: [] })
  check('product with no category rejected', !noCat.success)

  const noAlt = productSchema.safeParse({
    ...baseProduct,
    images: [{ url: 'https://example.com/a.jpg', alt: '' }],
  })
  check('image without alt text rejected', !noAlt.success)

  const badUrl = productSchema.safeParse({
    ...baseProduct,
    images: [{ url: 'not-a-url', alt: 'Box front' }],
  })
  check('invalid image URL rejected', !badUrl.success)

  const goodImage = productSchema.safeParse({
    ...baseProduct,
    images: [{ url: 'https://example.com/a.jpg', alt: 'Box front' }],
  })
  check('valid image accepted', goodImage.success)
}

console.log('\nInventory')
{
  const over = batchSchema.safeParse({
    productId: 'p1', variantId: 'v1', batchNumber: 'B-1', pharmacy: 'Karachi — Clifton',
    expiryDate: '2027-01-01', quantityOnHand: '10', quantityReserved: '20',
  })
  check('reserved greater than on-hand rejected', !over.success)

  const fine = batchSchema.safeParse({
    productId: 'p1', variantId: 'v1', batchNumber: 'B-1', pharmacy: 'Karachi — Clifton',
    expiryDate: '2027-01-01', quantityOnHand: '100', quantityReserved: '20',
  })
  check('valid batch accepted', fine.success)

  const zero = stockAdjustmentSchema.safeParse({ batchId: 'b1', delta: '0', reason: 'adjustment', note: '' })
  check('zero stock adjustment rejected', !zero.success)

  const negative = stockAdjustmentSchema.safeParse({ batchId: 'b1', delta: '-25', reason: 'damage', note: '' })
  check('negative adjustment accepted', negative.success && negative.data.delta === -25)

  const noReason = stockAdjustmentSchema.safeParse({ batchId: 'b1', delta: '5', reason: '', note: '' })
  check('adjustment without a reason rejected', !noReason.success)
}

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
