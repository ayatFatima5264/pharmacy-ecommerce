import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Breadcrumbs } from '@/components/shared/primitives'
import { ProductGrid } from '@/features/catalog/components/product-grid'
import { DesktopSort, ProductFilters } from '@/features/catalog/components/filters'
import { ProductGridSkeleton } from '@/components/ui/skeleton'
import { getBrands, getProducts, type ProductFilters as Filters } from '@/lib/data/queries'

export const metadata: Metadata = {
  title: 'Pharmacy — all medicines',
  description:
    'Browse genuine medicines, supplements, and medical devices. DRAP-licensed pharmacy with cash on delivery across Pakistan.',
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
  const brands = await getBrands()

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
