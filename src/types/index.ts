/**
 * Domain types for the storefront.
 *
 * These mirror the database schema in supabase/migrations. When the Supabase
 * client lands, generated types replace these and the dummy data layer is the
 * only thing that changes — pages and components already speak this shape.
 *
 * All money is BIGINT PAISA, exactly as stored. Formatting to "Rs 450" happens
 * only at the presentation layer via lib/utils/format.
 */

export interface Brand {
  id: string
  name: string
  slug: string
}

export interface Category {
  id: string
  name: string
  slug: string
  icon: string
  description: string
  parentId: string | null
}

export interface ProductVariant {
  id: string
  sku: string
  packSize: string
  unitsPerPack: number | null
  pricePaisa: number
  compareAtPricePaisa: number | null
  inStock: boolean
}

export interface ProductImage {
  url: string
  alt: string
}

/** Aggregate of APPROVED reviews. Absent (undefined) when a product has no
 *  approved reviews yet or the catalog is scaffold-served — the UI hides
 *  rating rows entirely rather than showing a fake zero. */
export interface RatingSummary {
  /** Mean of approved ratings, one decimal (e.g. 4.3). */
  average: number
  count: number
}

export interface Product {
  id: string
  slug: string
  name: string
  /** Optional because the seeded catalog rows predate image support; every
   *  product created through the admin form carries an (possibly empty) array. */
  images?: ProductImage[]
  genericName: string | null
  brandId: string
  categorySlugs: string[]
  icon: string
  shortDescription: string
  description: string
  requiresPrescription: boolean
  dosageForm: string | null
  strength: string | null
  storageInstructions: string | null
  composition: string | null
  sideEffects: string[]
  warnings: string[]
  variants: ProductVariant[]
  rating?: RatingSummary
}

export interface LabTest {
  id: string
  slug: string
  name: string
  shortCode: string
  description: string
  sampleType: string
  fastingRequired: boolean
  fastingHours: number | null
  turnaroundHours: number
  pricePaisa: number
  compareAtPricePaisa: number | null
  homeCollectionFeePaisa: number
  labName: string
  parameters: string[]
  whoShouldTake: string[]
}

export interface HealthPackage {
  id: string
  slug: string
  name: string
  description: string
  icon: string
  pricePaisa: number
  compareAtPricePaisa: number | null
  fastingRequired: boolean
  turnaroundHours: number
  labName: string
  suitableFor: string
  includedTestSlugs: string[]
}

/** A cart line. Exactly one of variantId / testSlug / packageSlug is set — the
 *  same disjoint-subtype rule the `cart_items` table enforces with a CHECK. */
export interface CartLine {
  key: string
  kind: 'product' | 'test' | 'package'
  slug: string
  variantId?: string
  name: string
  subtitle: string
  icon: string
  unitPricePaisa: number
  quantity: number
  requiresPrescription: boolean
}

export type OrderStatus =
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'

export interface TrackedOrder {
  orderNumber: string
  placedAt: string
  status: OrderStatus
  estimatedDelivery: string
  address: string
  items: { name: string; quantity: number; icon: string }[]
  totalPaisa: number
  timeline: { status: OrderStatus; label: string; at: string | null }[]
}
