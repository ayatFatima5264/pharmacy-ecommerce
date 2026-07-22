import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { FlaskConical, HeartPulse, Pill, SearchX, type LucideIcon } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/primitives'
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

/** Section header: icon tile + title + result count as a small pill. */
function ResultsHeader({ icon: Icon, title, count }: { icon: LucideIcon; title: string; count: number }) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-blue-600">
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <h2 className="text-h2">{title}</h2>
      <span className="tabular rounded-full bg-blue-50 px-2.5 py-0.5 text-caption font-semibold text-blue-700">
        {count}
      </span>
    </div>
  )
}

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
    <div className="flex flex-col gap-12 md:gap-14">
      <p className="-mb-6 text-body-sm text-gray-500" aria-live="polite">
        <span className="font-semibold text-gray-900">{total}</span>{' '}
        {total === 1 ? 'result' : 'results'} for &ldquo;{query}&rdquo;
      </p>

      {products.length > 0 && (
        <section aria-label="Medicines and products">
          <ResultsHeader icon={Pill} title="Medicines & products" count={products.length} />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {tests.length > 0 && (
        <section aria-label="Lab tests">
          <ResultsHeader icon={FlaskConical} title="Lab tests" count={tests.length} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tests.map((test) => (
              <LabTestCard key={test.id} test={test} />
            ))}
          </div>
        </section>
      )}

      {packages.length > 0 && (
        <section aria-label="Health packages">
          <ResultsHeader icon={HeartPulse} title="Health packages" count={packages.length} />
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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
    <div className="container py-8 md:py-12">
      <div className="mb-8">
        <h1 className="text-h1">{query ? `Results for “${query}”` : 'Search'}</h1>
        {query && (
          <p className="mt-2 max-w-3xl text-body text-gray-500">
            Across medicines, lab tests, and health packages.
          </p>
        )}
      </div>

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
