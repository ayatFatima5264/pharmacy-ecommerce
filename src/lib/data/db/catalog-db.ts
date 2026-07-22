import 'server-only'
import { cache } from 'react'
import { supabaseService } from '@/lib/supabase/server'
import { deterministicId } from '@/lib/supabase/deterministic-id'
import { categoryIcon, DEFAULT_ICONS } from '@/config/icons'
import { PHARMACIES } from '@/lib/data/admin-catalog'
import {
  brands as scaffoldBrands,
  categories as scaffoldCategories,
  products as scaffoldProducts,
} from '@/lib/data/catalog'
import type { Brand, Category, Product } from '@/types'

/**
 * Pharmacy catalog reads, database-backed. Every function returns the SAME
 * domain types the scaffold serves, so pages and components change not at all
 * when the seam (lib/data/source.ts) flips to the database.
 *
 * CONTENT OVERLAY: fields the schema deliberately does not model — emoji
 * icons (owner decision: no icon column) and the scaffold's brand ids that
 * sync helpers like getBrandName() key on — are resolved from the scaffold
 * BY SLUG. Seeded rows therefore render pixel-identical; rows created later
 * through the admin console fall back to config/icons.ts defaults.
 *
 * All reads run once per request (React cache) against the service client:
 * catalog data is public (RLS grants anon SELECT on active rows), but the
 * service client keeps the read path uniform and free of session plumbing.
 */

/** The fulfilling branch: first entry of the seeded branch list. */
export function mainPharmacyId(): string {
  return deterministicId('pharmacy', PHARMACIES[0])
}

const scaffoldBrandBySlug = new Map(scaffoldBrands.map((b) => [b.slug, b]))
const scaffoldCategoryBySlug = new Map(scaffoldCategories.map((c) => [c.slug, c]))
const scaffoldProductBySlug = new Map(scaffoldProducts.map((p) => [p.slug, p]))

interface ProductRow {
  id: string
  slug: string
  name: string
  generic_name: string | null
  description: string | null
  short_description: string | null
  requires_prescription: boolean
  dosage_form: string | null
  strength: string | null
  storage_instructions: string | null
  clinical_info: {
    composition?: string | null
    side_effects?: string[]
    warnings?: string[]
  } | null
  brands: { slug: string; name: string } | null
  product_categories: { is_primary: boolean; categories: { slug: string } | null }[]
  product_variants: {
    id: string
    sku: string
    pack_size: string
    units_per_pack: number | null
    price_paisa: number
    compare_at_price_paisa: number | null
    is_active: boolean
  }[]
  product_images: { url: string; alt_text: string | null; position: number }[]
}

const PRODUCT_SELECT = `
  id, slug, name, generic_name, description, short_description,
  requires_prescription, dosage_form, strength, storage_instructions,
  clinical_info,
  brands ( slug, name ),
  product_categories ( is_primary, categories ( slug ) ),
  product_variants ( id, sku, pack_size, units_per_pack, price_paisa, compare_at_price_paisa, is_active ),
  product_images ( url, alt_text, position )
`

/** variant_id -> sellable units at the main branch (unexpired, unreserved). */
export const fetchStockMap = cache(async (): Promise<Map<string, number>> => {
  const { data, error } = await supabaseService()
    .from('inventory_batches')
    .select('variant_id, quantity_on_hand, quantity_reserved')
    .eq('pharmacy_id', mainPharmacyId())
    .gt('expiry_date', new Date().toISOString().slice(0, 10))
  if (error) throw new Error(`stock query failed: ${error.message}`)

  const map = new Map<string, number>()
  for (const row of data ?? []) {
    const available = Math.max(0, row.quantity_on_hand - row.quantity_reserved)
    map.set(row.variant_id, (map.get(row.variant_id) ?? 0) + available)
  }
  return map
})

function mapProduct(row: ProductRow, stock: Map<string, number>): Product {
  const scaffold = scaffoldProductBySlug.get(row.slug)
  const categorySlugs = row.product_categories
    .slice()
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
    .map((pc) => pc.categories?.slug)
    .filter((slug): slug is string => Boolean(slug))

  return {
    // DB uuid: used for exclusion in related-product queries, never joined
    // back into the scaffold.
    id: row.id,
    slug: row.slug,
    name: row.name,
    images: row.product_images
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((img) => ({ url: img.url, alt: img.alt_text ?? row.name })),
    genericName: row.generic_name,
    // Overlay: the scaffold's brand id (by slug), so the sync getBrandName()
    // helper keeps resolving. New DB-only brands read as 'Unbranded' until
    // the brand surface flips in Step 5.
    brandId: (row.brands && scaffoldBrandBySlug.get(row.brands.slug)?.id) ?? '',
    categorySlugs,
    icon:
      scaffold?.icon ?? (categorySlugs[0] ? categoryIcon(categorySlugs[0]) : DEFAULT_ICONS.product),
    shortDescription: row.short_description ?? '',
    description: row.description ?? '',
    requiresPrescription: row.requires_prescription,
    dosageForm: row.dosage_form,
    strength: row.strength,
    storageInstructions: row.storage_instructions,
    composition: row.clinical_info?.composition ?? null,
    sideEffects: row.clinical_info?.side_effects ?? [],
    warnings: row.clinical_info?.warnings ?? [],
    variants: row.product_variants
      .filter((v) => v.is_active)
      .map((v) => ({
        id: v.id,
        sku: v.sku,
        packSize: v.pack_size,
        unitsPerPack: v.units_per_pack,
        pricePaisa: v.price_paisa,
        compareAtPricePaisa: v.compare_at_price_paisa,
        inStock: (stock.get(v.id) ?? 0) > 0,
      })),
  }
}

const fetchAllProducts = cache(async (): Promise<Product[]> => {
  const [{ data, error }, stock] = await Promise.all([
    supabaseService().from('products').select(PRODUCT_SELECT).eq('is_active', true).order('name'),
    fetchStockMap(),
  ])
  if (error) throw new Error(`products query failed: ${error.message}`)
  return ((data ?? []) as unknown as ProductRow[]).map((row) => mapProduct(row, stock))
})

export const getProductsDb = fetchAllProducts

export async function getProductBySlugDb(slug: string): Promise<Product | null> {
  // Served from the per-request product list: the catalog is small, and one
  // cached fetch beats a second round trip on pages that render both a
  // product and its related lists.
  return (await fetchAllProducts()).find((p) => p.slug === slug) ?? null
}

export const getCategoriesDb = cache(async (): Promise<Category[]> => {
  const { data, error } = await supabaseService()
    .from('categories')
    .select('id, parent_id, name, slug, description')
    .eq('is_active', true)
    .order('position')
  if (error) throw new Error(`categories query failed: ${error.message}`)

  return (data ?? []).map((row) => {
    const scaffold = scaffoldCategoryBySlug.get(row.slug)
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      icon: scaffold?.icon ?? categoryIcon(row.slug),
      description: row.description ?? scaffold?.description ?? '',
      parentId: row.parent_id,
    }
  })
})

export const getBrandsDb = cache(async (): Promise<Brand[]> => {
  const { data, error } = await supabaseService()
    .from('brands')
    .select('id, name, slug')
    .eq('is_active', true)
    .order('name')
  if (error) throw new Error(`brands query failed: ${error.message}`)
  // Overlay ids for the same reason as mapProduct.
  return (data ?? []).map((row) => ({
    id: scaffoldBrandBySlug.get(row.slug)?.id ?? row.id,
    name: row.name,
    slug: row.slug,
  }))
})
