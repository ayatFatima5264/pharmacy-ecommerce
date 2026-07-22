import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { SearchX } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState, SectionHeading } from '@/components/shared/primitives'
import { ProductGridSkeleton } from '@/components/ui/skeleton'
import { LabTestCard, PackageCard, ProductCard } from '@/features/catalog/components/cards'
import { search } from '@/lib/data/queries'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Search',
  // Search result pages carry no SEO value and would dilute the crawl budget.
  robots: { index: false, follow: true },
}

type SearchParams = Promise<{ q?: string }>

async function Results({ query }: { query: string }) {
  const { products, tests, packages, total } = await search(query)

  if (total === 0) {
    return (
      <EmptyState
        icon={<SearchX className="h-10 w-10" />}
        title={`No results for "${query}"`}
        description="Check the spelling, or try the generic name of the medicine — for example “paracetamol” instead of a brand name."
        action={
          <>
            <Link href="/pharmacy" className={cn(buttonVariants({ variant: 'primary' }))}>
              Browse medicines
            </Link>
            <Link href="/lab-tests" className={cn(buttonVariants({ variant: 'secondary' }))}>
              Browse lab tests
            </Link>
          </>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-14">
      <p className="text-body-sm text-gray-500" aria-live="polite">
        {total} {total === 1 ? 'result' : 'results'} for &ldquo;{query}&rdquo;
      </p>

      {products.length > 0 && (
        <section>
          <SectionHeading title={`Medicines & products (${products.length})`} />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {tests.length > 0 && (
        <section>
          <SectionHeading title={`Lab tests (${tests.length})`} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tests.map((test) => (
              <LabTestCard key={test.id} test={test} />
            ))}
          </div>
        </section>
      )}

      {packages.length > 0 && (
        <section>
          <SectionHeading title={`Health packages (${packages.length})`} />
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {packages.map((pkg) => (
              <PackageCard key={pkg.id} pkg={pkg} testCount={pkg.includedTestSlugs.length} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const { q } = await searchParams
  const query = q?.trim() ?? ''

  return (
    <div className="container py-8">
      <h1 className="mb-8 text-h1">{query ? `Results for “${query}”` : 'Search'}</h1>

      {!query ? (
        <EmptyState
          icon={<SearchX className="h-10 w-10" />}
          title="What are you looking for?"
          description="Search by brand name, generic name, or test — for example “Panadol”, “paracetamol”, or “CBC”."
          action={
            <Link href="/pharmacy" className={cn(buttonVariants({ variant: 'primary' }))}>
              Browse medicines
            </Link>
          }
        />
      ) : (
        <Suspense key={query} fallback={<ProductGridSkeleton />}>
          <Results query={query} />
        </Suspense>
      )}
    </div>
  )
}
