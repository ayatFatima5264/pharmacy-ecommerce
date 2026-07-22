import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { Breadcrumbs } from '@/components/shared/primitives'
import { ProductGrid } from '@/features/catalog/components/product-grid'
import { DesktopSort, ProductFilters } from '@/features/catalog/components/filters'
import { ProductGridSkeleton } from '@/components/ui/skeleton'
import { getBrands, getCategories, getProducts, type ProductFilters as Filters } from '@/lib/data/queries'

export const metadata: Metadata = {
  title: 'Pharmacy — all medicines',
  description:
    'Browse genuine medicines, supplements, and medical devices. DRAP-licensed medical store with cash on delivery in Lahore.',
  alternates: { canonical: '/pharmacy' },
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function parseFilters(params: Record<string, string | string[] | undefined>): Filters {
  const brand = params.brand
  return {
    brand: Array.isArray(brand) ? brand : brand ? [brand] : undefined,
    otcOnly: params.otc === '1',
    inStockOnly: params.stock === '1',
    sort: (params.sort as Filters['sort']) ?? 'relevance',
  }
}

async function Results({ params }: { params: Record<string, string | string[] | undefined> }) {
  const products = await getProducts(parseFilters(params))
  return (
    <ProductGrid
      products={products}
      toolbar={
        <p className="text-body-sm text-gray-500" aria-live="polite">
          <span className="font-semibold text-gray-900">{products.length}</span>{' '}
          {products.length === 1 ? 'product' : 'products'}
        </p>
      }
      controls={<DesktopSort />}
    />
  )
}

export default async function PharmacyPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const [brands, categories] = await Promise.all([getBrands(), getCategories()])

  return (
    <div className="container py-8 md:py-12">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Pharmacy' }]} />

      <div className="mb-8">
        <h1 className="text-h1">Pharmacy</h1>
        <p className="mt-2 max-w-3xl text-body text-gray-500">
          Genuine medicines, supplements, and home medical devices. Prescription items are
          dispensed only after a licensed pharmacist reviews your prescription.
        </p>
      </div>

      {/* The one place customers browse categories — the old standalone
          categories listing redirects here. */}
      <section id="categories" aria-labelledby="pharmacy-categories" className="mb-10">
        <h2 id="pharmacy-categories" className="text-h3">
          Shop by category
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/categories/${category.slug}`}
              className="group flex items-center gap-3 rounded-md border border-gray-200 bg-white p-3.5 transition-all duration-medium hover:-translate-y-0.5 hover:border-blue-600/30 hover:shadow-e2"
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xl transition-colors duration-medium group-hover:bg-blue-100"
                aria-hidden="true"
              >
                {category.icon}
              </span>
              <span className="text-body-sm font-semibold text-gray-900 group-hover:text-blue-600">
                {category.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Rendered once: the component emits the mobile control bar, the mobile
          sheet, and the desktop sidebar, each visible at its own breakpoint. */}
      <div className="grid items-start gap-x-8 gap-y-6 lg:grid-cols-[260px_1fr]">
        <ProductFilters brands={brands} />
        <div>
          {/* Suspense key restarts the boundary on filter change, so the
              skeleton shows instead of stale results. */}
          <Suspense key={JSON.stringify(params)} fallback={<ProductGridSkeleton />}>
            <Results params={params} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
