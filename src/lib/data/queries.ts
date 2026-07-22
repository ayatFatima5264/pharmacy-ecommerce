import { healthPackages, labTests } from './catalog'
import { allBrands, allCategories, allProducts, findProductBySlug, sellableStock } from './store'
import { useDb } from './source'
import { getBrandsDb, getCategoriesDb, getProductsDb } from './db/catalog-db'
import type { Brand, Category, HealthPackage, LabTest, Product } from '@/types'

/**
 * Read paths for the storefront — the seam where the database replaces the
 * scaffold (see ./source.ts).
 *
 * PHARMACY catalog (products/categories/brands) reads Postgres when Supabase
 * is configured, the in-memory store otherwise. The DB mappers return the
 * same domain types, so nothing below this file knows which backend served
 * the data.
 *
 * LAB tests and packages deliberately stay scaffold-served here: the seeded
 * database mirrors this data exactly, and the lab content pages flip together
 * with the lab admin module (Step 5). The CART and CHECKOUT already price lab
 * items from the database via the catalog snapshot.
 */

export async function getCategories(): Promise<Category[]> {
  if (useDb()) return getCategoriesDb()
  return allCategories()
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  return (await getCategories()).find((c) => c.slug === slug) ?? null
}

export async function getBrands(): Promise<Brand[]> {
  if (useDb()) return getBrandsDb()
  return allBrands()
}

export function getBrandName(brandId: string): string {
  return allBrands().find((b) => b.id === brandId)?.name ?? 'Unbranded'
}

export interface ProductFilters {
  category?: string
  brand?: string[]
  otcOnly?: boolean
  inStockOnly?: boolean
  sort?: 'relevance' | 'price-asc' | 'price-desc' | 'name'
}

export async function getProducts(filters: ProductFilters = {}): Promise<Product[]> {
  let result = useDb() ? [...(await getProductsDb())] : [...allProducts()]

  if (filters.category) {
    result = result.filter((p) => p.categorySlugs.includes(filters.category!))
  }
  if (filters.brand?.length) {
    const slugs = new Set(filters.brand)
    const brandList = await getBrands()
    result = result.filter((p) => {
      const brand = brandList.find((b) => b.id === p.brandId)
      return brand ? slugs.has(brand.slug) : false
    })
  }
  if (filters.otcOnly) {
    result = result.filter((p) => !p.requiresPrescription)
  }
  if (filters.inStockOnly) {
    result = result.filter((p) => p.variants.some((v) => v.inStock))
  }

  switch (filters.sort) {
    case 'price-asc':
      result.sort((a, b) => lowestPrice(a) - lowestPrice(b))
      break
    case 'price-desc':
      result.sort((a, b) => lowestPrice(b) - lowestPrice(a))
      break
    case 'name':
      result.sort((a, b) => a.name.localeCompare(b.name))
      break
  }

  return result
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (useDb()) return (await getProductsDb()).find((p) => p.slug === slug) ?? null
  return findProductBySlug(slug) ?? null
}

export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  const all = useDb() ? await getProductsDb() : allProducts()
  return all
    .filter((p) => p.id !== product.id && p.categorySlugs.some((c) => product.categorySlugs.includes(c)))
    .slice(0, limit)
}

/** Same molecule, different brand — the "cheaper equivalent" surface. */
export async function getSimilarGenerics(product: Product, limit = 3): Promise<Product[]> {
  if (!product.genericName) return []
  const all = useDb() ? await getProductsDb() : allProducts()
  return all
    .filter((p) => p.id !== product.id && p.genericName === product.genericName)
    .slice(0, limit)
}

export async function getLabTests(): Promise<LabTest[]> {
  if (useDb()) {
    const { getLabTestsDb } = await import('./db/lab-catalog-db')
    return getLabTestsDb()
  }
  return labTests
}

export async function getLabTestBySlug(slug: string): Promise<LabTest | null> {
  return (await getLabTests()).find((t) => t.slug === slug) ?? null
}

export async function getHealthPackages(): Promise<HealthPackage[]> {
  if (useDb()) {
    const { getHealthPackagesDb } = await import('./db/lab-catalog-db')
    return getHealthPackagesDb()
  }
  return healthPackages
}

export async function getHealthPackageBySlug(slug: string): Promise<HealthPackage | null> {
  return (await getHealthPackages()).find((p) => p.slug === slug) ?? null
}

export interface SearchResults {
  products: Product[]
  tests: LabTest[]
  packages: HealthPackage[]
  total: number
}

/**
 * Searches trade name, generic name, and description. Generic name matters:
 * customers frequently arrive with a doctor's note listing a molecule.
 * Replaced by a Postgres trigram query (pg_trgm) against the real catalog.
 */
export async function search(query: string): Promise<SearchResults> {
  const q = query.trim().toLowerCase()
  if (!q) return { products: [], tests: [], packages: [], total: 0 }

  const [productList, testList, packageList] = await Promise.all([
    useDb() ? getProductsDb() : Promise.resolve(allProducts()),
    getLabTests(),
    getHealthPackages(),
  ])
  const matchedProducts = productList.filter((p) =>
    [p.name, p.genericName ?? '', p.shortDescription, getBrandName(p.brandId)]
      .join(' ')
      .toLowerCase()
      .includes(q),
  )
  const matchedTests = testList.filter((t) =>
    [t.name, t.shortCode, t.description].join(' ').toLowerCase().includes(q),
  )
  const matchedPackages = packageList.filter((p) =>
    [p.name, p.description].join(' ').toLowerCase().includes(q),
  )

  return {
    products: matchedProducts,
    tests: matchedTests,
    packages: matchedPackages,
    total: matchedProducts.length + matchedTests.length + matchedPackages.length,
  }
}

export function lowestPrice(product: Product): number {
  return Math.min(...product.variants.map((v) => v.pricePaisa))
}

export function defaultVariant(product: Product) {
  return product.variants.find((v) => v.inStock) ?? product.variants[0]
}

export function isInStock(product: Product): boolean {
  return product.variants.some((v) => v.inStock)
}

/** Sellable units across unexpired batches. */
export function stockFor(productId: string): number {
  return sellableStock(productId)
}
