import 'server-only'
import { brands as seedBrands, categories as seedCategories, products as seedProducts } from './catalog'
import { adminBatches as seedBatches, type AdminBatch } from './admin'
import type { Brand, Category, Product } from '@/types'

/**
 * Mutable in-memory catalog store.
 *
 * This is the seam Supabase replaces. Every function here maps 1:1 onto a
 * Supabase query, and nothing outside this module touches the arrays — so
 * swapping the implementation changes this file and nothing else.
 *
 * LIMITATION, stated plainly: this is process memory. It survives navigation
 * and hot reload, but NOT a redeploy, a server restart, or a second serverless
 * instance. Two Vercel lambdas would each hold their own divergent copy. It is
 * correct for developing and demonstrating the module; it is not persistence.
 */

interface CatalogStore {
  products: Product[]
  categories: Category[]
  brands: Brand[]
  batches: AdminBatch[]
}

// Stashed on globalThis so Next's dev hot-reload does not reset edits on every
// file save — a fresh module instance would otherwise discard all mutations.
const globalStore = globalThis as unknown as { __catalogStore?: CatalogStore }

function createStore(): CatalogStore {
  return {
    // Deep clones: the seed arrays are shared with the storefront's static
    // imports, and mutating them in place would corrupt the seed data.
    products: structuredClone(seedProducts),
    categories: structuredClone(seedCategories),
    brands: structuredClone(seedBrands),
    batches: structuredClone(seedBatches),
  }
}

function store(): CatalogStore {
  globalStore.__catalogStore ??= createStore()
  return globalStore.__catalogStore
}

// ---------------------------------------------------------------------------
// Identity helpers
// ---------------------------------------------------------------------------

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Appends -2, -3… until the slug is free. Mirrors the UNIQUE constraint. */
export function uniqueSlug(base: string, taken: string[], ignore?: string): string {
  const slug = slugify(base)
  const others = taken.filter((s) => s !== ignore)
  if (!others.includes(slug)) return slug

  let n = 2
  while (others.includes(`${slug}-${n}`)) n++
  return `${slug}-${n}`
}

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export function allProducts(): Product[] {
  return store().products
}

export function findProduct(productId: string): Product | undefined {
  return store().products.find((p) => p.id === productId)
}

export function findProductBySlug(slug: string): Product | undefined {
  return store().products.find((p) => p.slug === slug)
}

export function productSlugs(): string[] {
  return store().products.map((p) => p.slug)
}

export function insertProduct(product: Omit<Product, 'id'>): Product {
  const created: Product = { ...product, id: id('prd') }
  store().products.unshift(created)
  return created
}

export function replaceProduct(productId: string, next: Product): Product | undefined {
  const products = store().products
  const index = products.findIndex((p) => p.id === productId)
  if (index === -1) return undefined
  products[index] = next
  return next
}

export function removeProduct(productId: string): boolean {
  const products = store().products
  const index = products.findIndex((p) => p.id === productId)
  if (index === -1) return false

  products.splice(index, 1)
  // Batches reference a product by name; drop them so stock reports do not
  // count inventory for a product that no longer exists.
  const batches = store().batches
  const orphaned = batches.filter((b) => b.productId === productId)
  orphaned.forEach((batch) => batches.splice(batches.indexOf(batch), 1))
  return true
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export function allCategories(): Category[] {
  return store().categories
}

export function findCategory(categoryId: string): Category | undefined {
  return store().categories.find((c) => c.id === categoryId)
}

export function categorySlugs(): string[] {
  return store().categories.map((c) => c.slug)
}

export function insertCategory(category: Omit<Category, 'id'>): Category {
  const created: Category = { ...category, id: id('cat') }
  store().categories.push(created)
  return created
}

export function replaceCategory(categoryId: string, next: Category): Category | undefined {
  const categories = store().categories
  const index = categories.findIndex((c) => c.id === categoryId)
  if (index === -1) return undefined

  const previousSlug = categories[index].slug
  categories[index] = next

  // Products reference categories by slug, so a slug change must cascade.
  if (previousSlug !== next.slug) {
    for (const product of store().products) {
      product.categorySlugs = product.categorySlugs.map((s) =>
        s === previousSlug ? next.slug : s,
      )
    }
  }
  return next
}

export function removeCategory(categoryId: string): { ok: boolean; reason?: string } {
  const categories = store().categories
  const category = categories.find((c) => c.id === categoryId)
  if (!category) return { ok: false, reason: 'That category no longer exists.' }

  // Mirrors `on delete restrict` on the self-referencing FK.
  if (categories.some((c) => c.parentId === categoryId)) {
    return { ok: false, reason: 'Move or delete its subcategories first.' }
  }

  const inUse = store().products.filter((p) => p.categorySlugs.includes(category.slug))
  if (inUse.length > 0) {
    return {
      ok: false,
      reason: `${inUse.length} product${inUse.length === 1 ? '' : 's'} still use this category.`,
    }
  }

  categories.splice(categories.indexOf(category), 1)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------

export function allBrands(): Brand[] {
  return store().brands
}

export function findBrand(brandId: string): Brand | undefined {
  return store().brands.find((b) => b.id === brandId)
}

export function brandSlugs(): string[] {
  return store().brands.map((b) => b.slug)
}

export function insertBrand(brand: Omit<Brand, 'id'>): Brand {
  const created: Brand = { ...brand, id: id('brd') }
  store().brands.push(created)
  return created
}

export function replaceBrand(brandId: string, next: Brand): Brand | undefined {
  const brands = store().brands
  const index = brands.findIndex((b) => b.id === brandId)
  if (index === -1) return undefined
  brands[index] = next
  return next
}

export function removeBrand(brandId: string): { ok: boolean; reason?: string } {
  const brands = store().brands
  const brand = brands.find((b) => b.id === brandId)
  if (!brand) return { ok: false, reason: 'That brand no longer exists.' }

  const inUse = store().products.filter((p) => p.brandId === brandId)
  if (inUse.length > 0) {
    return {
      ok: false,
      reason: `${inUse.length} product${inUse.length === 1 ? '' : 's'} still reference this brand.`,
    }
  }

  brands.splice(brands.indexOf(brand), 1)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Inventory batches
// ---------------------------------------------------------------------------

export function allBatches(): AdminBatch[] {
  return store().batches
}

export function findBatch(batchId: string): AdminBatch | undefined {
  return store().batches.find((b) => b.id === batchId)
}

export function insertBatch(batch: Omit<AdminBatch, 'id'>): AdminBatch {
  const created: AdminBatch = { ...batch, id: id('bat') }
  store().batches.unshift(created)
  return created
}

export function replaceBatch(batchId: string, next: AdminBatch): AdminBatch | undefined {
  const batches = store().batches
  const index = batches.findIndex((b) => b.id === batchId)
  if (index === -1) return undefined
  batches[index] = next
  return next
}

export function removeBatch(batchId: string): boolean {
  const batches = store().batches
  const index = batches.findIndex((b) => b.id === batchId)
  if (index === -1) return false
  batches.splice(index, 1)
  return true
}

/**
 * Sellable stock for a product: on-hand minus reserved, counting unexpired
 * batches only. Expired stock physically exists but must never be sold, so it
 * is excluded here rather than filtered at each call site.
 */
export function sellableStock(productId: string, now = Date.now()): number {
  return store()
    .batches.filter((b) => b.productId === productId && new Date(b.expiryDate).getTime() > now)
    .reduce((sum, b) => sum + Math.max(0, b.quantityOnHand - b.quantityReserved), 0)
}

/** Development helper — resets the store to seed data. */
export function resetStore(): void {
  globalStore.__catalogStore = createStore()
}
