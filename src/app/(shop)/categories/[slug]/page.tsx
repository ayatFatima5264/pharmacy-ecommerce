import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Breadcrumbs } from '@/components/shared/primitives'
import { ProductGrid } from '@/features/catalog/components/product-grid'
import { DesktopSort, ProductFilters } from '@/features/catalog/components/filters'
import { ProductGridSkeleton } from '@/components/ui/skeleton'
import {
  getBrands,
  getCategories,
  getCategoryBySlug,
  getProducts,
  type ProductFilters as Filters,
} from '@/lib/data/queries'

export const revalidate = 3600

type Params = Promise<{ slug: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>

/** Pre-renders every category at build time. */
export async function generateStaticParams() {
  const categories = await getCategories()
  return categories.map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  const category = await getCategoryBySlug(slug)
  if (!category) return { title: 'Category not found' }
  return {
    title: category.name,
    description: category.description,
    alternates: { canonical: `/categories/${category.slug}` },
  }
}

async function Results({
  slug,
  params,
}: {
  slug: string
  params: Record<string, string | string[] | undefined>
}) {
  const brand = params.brand
  const filters: Filters = {
    category: slug,
    brand: Array.isArray(brand) ? brand : brand ? [brand] : undefined,
    otcOnly: params.otc === '1',
    inStockOnly: params.stock === '1',
    sort: (params.sort as Filters['sort']) ?? 'relevance',
  }
  const products = await getProducts(filters)

  return (
    <>
      <p className="mb-5 text-body-sm text-gray-500" aria-live="polite">
        {products.length} {products.length === 1 ? 'product' : 'products'}
      </p>
      <ProductGrid products={products} />
    </>
  )
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { slug } = await params
  const category = await getCategoryBySlug(slug)
  if (!category) notFound()

  const [brands, query] = await Promise.all([getBrands(), searchParams])

  return (
    <div className="container py-8">
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Pharmacy', href: '/pharmacy' },
          { label: category.name },
        ]}
      />

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="text-4xl" aria-hidden="true">
            {category.icon}
          </span>
          <div>
            <h1 className="text-h1">{category.name}</h1>
            <p className="mt-2 max-w-2xl text-body text-gray-500">{category.description}</p>
          </div>
        </div>
        <DesktopSort />
      </div>

      <div className="grid gap-x-10 gap-y-6 lg:grid-cols-[260px_1fr]">
        <ProductFilters brands={brands} />
        <div>
          <Suspense key={JSON.stringify(query)} fallback={<ProductGridSkeleton />}>
            <Results slug={slug} params={query} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
