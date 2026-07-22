import type { Metadata } from 'next'
import Link from 'next/link'
import { Home, Microscope, ShieldCheck } from 'lucide-react'
import { Breadcrumbs, EmptyState, SectionHeading } from '@/components/shared/primitives'
import { buttonVariants } from '@/components/ui/button'
import { LabTestCard, PackageCard } from '@/features/catalog/components/cards'
import {
  countTestsPerCategory,
  getLabTestsWithCategory,
  labCategories,
} from '@/lib/data/lab-catalog'
import { getHealthPackages } from '@/lib/data/queries'
import { cn } from '@/lib/utils'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Lab tests — home sample collection',
  description:
    'Book blood tests with home sample collection across Pakistan. Digital reports from Chughtai Lab, Shaukat Khanum, and Excel Labs.',
}

type SearchParams = Promise<{ category?: string; fasting?: string; lab?: string }>

const points = [
  { icon: Home, title: 'Home collection', body: 'A trained phlebotomist visits you at a time you choose.' },
  { icon: Microscope, title: 'Accredited labs', body: 'Samples processed by Chughtai, Shaukat Khanum, and Excel Labs.' },
  { icon: ShieldCheck, title: 'Digital reports', body: 'Reports delivered securely, usually within 24 hours.' },
]

export default async function LabTestsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const allTests = getLabTestsWithCategory()
  const counts = countTestsPerCategory()
  const packages = await getHealthPackages()

  const tests = allTests.filter((test) => {
    if (params.category && test.categorySlug !== params.category) return false
    if (params.fasting === 'no' && test.fastingRequired) return false
    if (params.fasting === 'yes' && !test.fastingRequired) return false
    if (params.lab && test.labName !== params.lab) return false
    return true
  })

  const activeCategory = params.category
    ? labCategories.find((c) => c.slug === params.category)
    : null

  return (
    <div className="container py-8">
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          ...(activeCategory
            ? [{ label: 'Lab Tests', href: '/lab-tests' }, { label: activeCategory.name }]
            : [{ label: 'Lab Tests' }]),
        ]}
      />

      <h1 className="text-h1">{activeCategory ? activeCategory.name : 'Lab tests'}</h1>
      <p className="mt-2 max-w-2xl text-body text-gray-500">
        {activeCategory
          ? activeCategory.description
          : 'Book a test online and a phlebotomist will collect your sample at home. Reports arrive digitally, usually within 24 hours.'}
      </p>

      {!activeCategory && (
        <ul className="mt-8 grid gap-6 border-y border-gray-200 py-7 sm:grid-cols-3">
          {points.map((point) => {
            const Icon = point.icon
            return (
              <li key={point.title} className="flex gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-[15px] font-semibold text-gray-900">{point.title}</h2>
                  <p className="mt-0.5 text-body-sm text-gray-500">{point.body}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Category chips are links, so a filtered view is shareable and the page
          stays a Server Component. */}
      <nav aria-label="Test categories" className="mt-8">
        <ul className="flex flex-wrap gap-2.5">
          <li>
            <Link
              href="/lab-tests"
              aria-current={!params.category ? 'page' : undefined}
              className={cn(
                'flex min-h-11 items-center gap-2 rounded-full border px-4 text-body-sm font-semibold',
                !params.category
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-700 hover:border-gray-400',
              )}
            >
              All tests
              <span className="tabular text-gray-500">{allTests.length}</span>
            </Link>
          </li>
          {labCategories.map((category) => {
            const active = params.category === category.slug
            return (
              <li key={category.slug}>
                <Link
                  href={`/lab-tests?category=${category.slug}`}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-11 items-center gap-2 rounded-full border px-4 text-body-sm font-semibold',
                    active
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-700 hover:border-gray-400',
                  )}
                >
                  <span aria-hidden="true">{category.icon}</span>
                  {category.name}
                  <span className="tabular text-gray-500">{counts[category.slug] ?? 0}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <p className="mb-5 mt-6 text-body-sm text-gray-500" aria-live="polite">
        {tests.length} {tests.length === 1 ? 'test' : 'tests'}
      </p>

      {tests.length === 0 ? (
        <EmptyState
          icon={<Microscope className="h-10 w-10" />}
          title="No tests in this category yet"
          description="Browse all tests, or take a look at our bundled health packages."
          action={
            <Link href="/lab-tests" className={cn(buttonVariants({ variant: 'primary' }))}>
              View all tests
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tests.map((test) => (
            <LabTestCard key={test.id} test={test} />
          ))}
        </div>
      )}

      {!activeCategory && (
        <section className="mt-16">
          <SectionHeading
            title="Health packages"
            description="Bundled screening at a lower price than booking each test separately."
            href="/health-packages"
          />
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {packages.slice(0, 3).map((pkg) => (
              <PackageCard key={pkg.id} pkg={pkg} testCount={pkg.includedTestSlugs.length} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
