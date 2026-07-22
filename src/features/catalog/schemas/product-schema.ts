import { z } from 'zod'

/**
 * Catalog validation. One schema per operation, used by the form and re-run
 * inside the Server Action — a Server Action is a public POST endpoint and can
 * never trust that client validation ran.
 *
 * Money arrives from the form in RUPEES (what a human types) and is converted
 * to integer PAISA here, so nothing downstream ever handles a float.
 */

/** "450.50" → 45050 paisa. Rejects anything that is not money. */
const rupeesToPaisa = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), `${label} must be a number, e.g. 450 or 450.50`)
    .transform((v) => Math.round(Number.parseFloat(v) * 100))

const optionalRupeesToPaisa = (label: string) =>
  z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : v))
    .refine((v) => v === null || /^\d+(\.\d{1,2})?$/.test(v), `${label} must be a number`)
    .transform((v) => (v === null ? null : Math.round(Number.parseFloat(v) * 100)))

export const variantSchema = z
  .object({
    id: z.string().optional(),
    sku: z
      .string()
      .trim()
      .min(2, 'SKU is required')
      .max(40, 'SKU is too long')
      .regex(/^[A-Za-z0-9._-]+$/, 'SKU can contain letters, numbers, dot, dash and underscore only'),
    packSize: z.string().trim().min(1, 'Pack size is required').max(60),
    unitsPerPack: z
      .string()
      .trim()
      .transform((v) => (v === '' ? null : Number.parseInt(v, 10)))
      .refine((v) => v === null || (Number.isFinite(v) && v > 0), 'Units per pack must be a whole number'),
    pricePaisa: rupeesToPaisa('Price'),
    compareAtPricePaisa: optionalRupeesToPaisa('Sale compare-at price'),
    inStock: z.boolean(),
  })
  // The struck-through price must be HIGHER than what is charged. Inverting
  // these silently advertises a price increase as a discount.
  .refine(
    (v) => v.compareAtPricePaisa === null || v.compareAtPricePaisa > v.pricePaisa,
    {
      message: 'Compare-at price must be higher than the selling price',
      path: ['compareAtPricePaisa'],
    },
  )

export const productSchema = z
  .object({
    name: z.string().trim().min(3, 'Product name is required').max(120, 'Name is too long'),
    slug: z
      .string()
      .trim()
      .max(140)
      .regex(/^[a-z0-9-]*$/, 'Slug can contain lowercase letters, numbers and dashes only')
      .optional(),
    genericName: z.string().trim().max(120).optional(),
    brandId: z.string().trim().min(1, 'Choose a brand'),
    categorySlugs: z.array(z.string()).min(1, 'Choose at least one category'),
    icon: z.string().trim().min(1).max(8).default('💊'),

    shortDescription: z
      .string()
      .trim()
      .min(10, 'Write a short description of at least 10 characters')
      .max(200, 'Keep the short description under 200 characters'),
    description: z.string().trim().min(20, 'Write a fuller description').max(4000),

    requiresPrescription: z.boolean(),
    isControlled: z.boolean().default(false),

    dosageForm: z.string().trim().max(60).optional(),
    strength: z.string().trim().max(60).optional(),
    storageInstructions: z.string().trim().max(300).optional(),
    composition: z.string().trim().max(600).optional(),

    // One per line in the form; split before parsing.
    sideEffects: z.array(z.string().trim().min(1)).max(20).default([]),
    warnings: z.array(z.string().trim().min(1)).max(20).default([]),

    images: z
      .array(
        z.object({
          url: z.string().trim().url('Enter a valid image URL'),
          alt: z.string().trim().min(1, 'Alt text is required for every image').max(160),
        }),
      )
      .max(8, 'Up to 8 images')
      .default([]),

    variants: z.array(variantSchema).min(1, 'Add at least one pack size'),
  })
  // A controlled drug is prescription-only by definition. Enforced here as well
  // as by the CHECK constraint, so the form can explain it rather than the
  // database rejecting it with an opaque error.
  .refine((v) => !v.isControlled || v.requiresPrescription, {
    message: 'A controlled drug must also be marked prescription-only',
    path: ['requiresPrescription'],
  })
  .refine(
    (v) => new Set(v.variants.map((variant) => variant.sku.toUpperCase())).size === v.variants.length,
    { message: 'Each pack size needs its own unique SKU', path: ['variants'] },
  )

export type ProductInput = z.input<typeof productSchema>
export type ProductParsed = z.output<typeof productSchema>

export const categorySchema = z.object({
  name: z.string().trim().min(2, 'Category name is required').max(80),
  slug: z
    .string()
    .trim()
    .max(100)
    .regex(/^[a-z0-9-]*$/, 'Slug can contain lowercase letters, numbers and dashes only')
    .optional(),
  icon: z.string().trim().min(1, 'Pick an icon').max(8),
  description: z.string().trim().min(10, 'Describe the category').max(300),
  parentId: z.string().trim().optional(),
})

export const brandSchema = z.object({
  name: z.string().trim().min(2, 'Brand name is required').max(80),
  slug: z
    .string()
    .trim()
    .max(100)
    .regex(/^[a-z0-9-]*$/, 'Slug can contain lowercase letters, numbers and dashes only')
    .optional(),
})

export const batchSchema = z
  .object({
    productId: z.string().trim().min(1, 'Choose a product'),
    variantId: z.string().trim().min(1, 'Choose a pack size'),
    batchNumber: z.string().trim().min(2, 'Batch number is required').max(40),
    pharmacy: z.string().trim().min(1, 'Choose a branch'),
    expiryDate: z
      .string()
      .trim()
      .min(1, 'Expiry date is required')
      .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date'),
    quantityOnHand: z
      .string()
      .trim()
      .transform((v) => Number.parseInt(v, 10))
      .refine((v) => Number.isFinite(v) && v >= 0, 'Quantity must be zero or more'),
    quantityReserved: z
      .string()
      .trim()
      .transform((v) => (v === '' ? 0 : Number.parseInt(v, 10)))
      .refine((v) => Number.isFinite(v) && v >= 0, 'Reserved must be zero or more'),
  })
  .refine((v) => v.quantityReserved <= v.quantityOnHand, {
    message: 'Reserved cannot exceed quantity on hand',
    path: ['quantityReserved'],
  })

/** Stock adjustments are signed and always carry a reason — this is a ledger. */
export const stockAdjustmentSchema = z.object({
  batchId: z.string().trim().min(1),
  delta: z
    .string()
    .trim()
    .transform((v) => Number.parseInt(v, 10))
    .refine((v) => Number.isFinite(v) && v !== 0, 'Enter a non-zero adjustment'),
  reason: z.enum(['purchase', 'return', 'damage', 'expiry', 'adjustment'], {
    errorMap: () => ({ message: 'Choose a reason' }),
  }),
  note: z.string().trim().max(200).optional(),
})
