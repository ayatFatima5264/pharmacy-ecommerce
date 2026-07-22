import 'server-only'
import { allBatches, allBrands, allCategories, allProducts, sellableStock } from './store'
import { unitsSoldFor, type AdminBatch } from './admin'
import { useDb } from './source'
import {
  getAdminBrandsDb,
  getAdminCategoriesDb,
  getAdminProductsDb,
  getBatchRowsDb,
  getInventorySummaryDb,
  getVariantOptionsDb,
} from './db/admin-catalog-db'
import { getTopProductsDb } from './db/admin-db'

/**
 * Admin projections — the seam where the console flips from the mutable
 * in-memory store to Postgres (see ./source.ts). Same shapes either way.
 */

export const PHARMACIES = ['Karachi — Clifton', 'Lahore — Gulberg', 'Islamabad — F-7'] as const

export const LOW_STOCK_THRESHOLD = 200
export const EXPIRY_WARNING_DAYS = 90

export interface AdminProductRow {
  id: string
  name: string
  slug: string
  icon: string
  sku: string
  brandId: string
  brandName: string
  categoryName: string
  categorySlugs: string[]
  pricePaisa: number
  compareAtPricePaisa: number | null
  stock: number
  requiresPrescription: boolean
  inStock: boolean
  variantCount: number
  imageCount: number
}

export async function getAdminProducts(): Promise<AdminProductRow[]> {
  if (useDb()) return getAdminProductsDb()
  const brands = allBrands()
  const categories = allCategories()

  return allProducts().map((product) => {
    const variant = product.variants[0]
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      icon: product.icon,
      sku: variant?.sku ?? '—',
      brandId: product.brandId,
      brandName: brands.find((b) => b.id === product.brandId)?.name ?? 'Unbranded',
      categoryName:
        categories.find((c) => c.slug === product.categorySlugs[0])?.name ?? 'Uncategorised',
      categorySlugs: product.categorySlugs,
      pricePaisa: variant?.pricePaisa ?? 0,
      compareAtPricePaisa: variant?.compareAtPricePaisa ?? null,
      // Stock is sellable units from unexpired batches, not a stored counter.
      stock: product.variants.some((v) => v.inStock) ? sellableStock(product.id) : 0,
      requiresPrescription: product.requiresPrescription,
      inStock: product.variants.some((v) => v.inStock),
      variantCount: product.variants.length,
      imageCount: product.images?.length ?? 0,
    }
  })
}

export async function getAdminCategories() {
  if (useDb()) return getAdminCategoriesDb()
  const products = allProducts()
  const categories = allCategories()

  return categories.map((category) => ({
    ...category,
    productCount: products.filter((p) => p.categorySlugs.includes(category.slug)).length,
    childCount: categories.filter((c) => c.parentId === category.id).length,
    parentName: category.parentId
      ? (categories.find((c) => c.id === category.parentId)?.name ?? null)
      : null,
    isActive: true,
  }))
}

export async function getAdminBrands() {
  if (useDb()) return getAdminBrandsDb()
  const products = allProducts()
  return allBrands().map((brand) => ({
    ...brand,
    productCount: products.filter((p) => p.brandId === brand.id).length,
    isActive: true,
  }))
}

export interface BatchRow extends AdminBatch {
  daysToExpiry: number
  state: 'expired' | 'expiring' | 'healthy'
  available: number
}

export async function getBatchRows(now = Date.now()): Promise<BatchRow[]> {
  if (useDb()) return getBatchRowsDb(now)
  const DAY = 86_400_000
  return allBatches()
    .map((batch) => {
      const daysToExpiry = Math.round((new Date(batch.expiryDate).getTime() - now) / DAY)
      return {
        ...batch,
        daysToExpiry,
        state:
          daysToExpiry <= 0
            ? ('expired' as const)
            : daysToExpiry <= EXPIRY_WARNING_DAYS
              ? ('expiring' as const)
              : ('healthy' as const),
        available: Math.max(0, batch.quantityOnHand - batch.quantityReserved),
      }
    })
    .sort((a, b) => a.daysToExpiry - b.daysToExpiry)
}

export async function getInventorySummary(now = Date.now()) {
  if (useDb()) return getInventorySummaryDb(now)
  const rows = await getBatchRows(now)
  return {
    batchCount: rows.length,
    expired: rows.filter((r) => r.state === 'expired'),
    expiring: rows.filter((r) => r.state === 'expiring'),
    totalUnits: rows.reduce((sum, r) => sum + r.quantityOnHand, 0),
    reservedUnits: rows.reduce((sum, r) => sum + r.quantityReserved, 0),
    // Units sitting in expired batches are a write-off waiting to happen.
    unitsAtRisk: rows
      .filter((r) => r.state !== 'healthy')
      .reduce((sum, r) => sum + r.quantityOnHand, 0),
  }
}

export async function getTopProducts(limit = 5) {
  if (useDb()) return getTopProductsDb(limit)
  return (await getAdminProducts())
    .map((product, i) => {
      const unitsSold = unitsSoldFor(i)
      return { ...product, unitsSold, revenuePaisa: unitsSold * product.pricePaisa }
    })
    .sort((a, b) => b.revenuePaisa - a.revenuePaisa)
    .slice(0, limit)
}

/** Pack-size options for the batch form, grouped by product. */
export async function getVariantOptions() {
  if (useDb()) return getVariantOptionsDb()
  return allProducts().map((product) => ({
    productId: product.id,
    productName: product.name,
    variants: product.variants.map((v) => ({
      id: v.id,
      label: `${v.packSize} · ${v.sku}`,
    })),
  }))
}
