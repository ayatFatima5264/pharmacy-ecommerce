import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Clock, FlaskConical, Users, Utensils } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Breadcrumbs, MediaPlaceholder, Price } from '@/components/shared/primitives'
import { AddToCart } from '@/features/cart/components/add-to-cart'
import { getHealthPackageBySlug, getHealthPackages, getLabTests } from '@/lib/data/queries'
import { formatPrice, turnaroundLabel } from '@/lib/utils'

export const revalidate = 3600

type Params = Promise<{ slug: string }>

export async function generateStaticParams() {
  const packages = await getHealthPackages()
  return packages.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  const pkg = await getHealthPackageBySlug(slug)
  if (!pkg) return { title: 'Package not found' }
  return {
    title: pkg.name,
    description: pkg.description.slice(0, 155),
    alternates: { canonical: `/health-packages/${pkg.slug}` },
  }
}

export default async function HealthPackagePage({ params }: { params: Params }) {
  const { slug } = await params
  const pkg = await getHealthPackageBySlug(slug)
  if (!pkg) notFound()

  const allTests = await getLabTests()
  const includedTests = allTests.filter((t) => pkg.includedTestSlugs.includes(t.slug))

  // The saving is the product, so it is stated explicitly rather than implied.
  const individualTotal = includedTests.reduce((sum, t) => sum + t.pricePaisa, 0)
  const saving = individualTotal - pkg.pricePaisa

  return (
    <div className="container py-8">
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Health Packages', href: '/health-packages' },
          { label: pkg.name },
        ]}
      />

      <div className="grid gap-10 lg:grid-cols-[1fr_380px] lg:gap-14">
        <div>
          <MediaPlaceholder
            icon={pkg.icon}
            size="lg"
            className="aspect-[16/6] rounded-lg border border-gray-200"
          />

          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <Badge tone="info">{includedTests.length} tests included</Badge>
            {pkg.fastingRequired ? (
              <Badge tone="rx">
                <Utensils className="h-3 w-3" aria-hidden="true" />
                Fasting required
              </Badge>
            ) : (
              <Badge tone="success">No fasting required</Badge>
            )}
          </div>

          <h1 className="mt-4 text-h1">{pkg.name}</h1>
          <p className="mt-3 max-w-2xl text-body text-gray-700">{pkg.description}</p>

          <dl className="mt-7 grid gap-5 border-y border-gray-200 py-6 sm:grid-cols-3">
            <div className="flex gap-3">
              <Users className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
              <div>
                <dt className="text-body-sm text-gray-500">Suitable for</dt>
                <dd className="font-semibold text-gray-900">{pkg.suitableFor}</dd>
              </div>
            </div>
            <div className="flex gap-3">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
              <div>
                <dt className="text-body-sm text-gray-500">Report</dt>
                <dd className="font-semibold text-gray-900">
                  {turnaroundLabel(pkg.turnaroundHours)}
                </dd>
              </div>
            </div>
            <div className="flex gap-3">
              <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
              <div>
                <dt className="text-body-sm text-gray-500">Processed by</dt>
                <dd className="font-semibold text-gray-900">{pkg.labName}</dd>
              </div>
            </div>
          </dl>

          <h2 className="mt-10 text-h2">What is included</h2>
          <ul className="mt-5 flex flex-col divide-y divide-gray-200 border-y border-gray-200">
            {includedTests.map((test) => (
              <li key={test.id} className="flex items-center gap-4 py-4">
                <Badge tone="info">{test.shortCode}</Badge>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-semibold text-gray-900">
                    <Link href={`/lab-tests/${test.slug}`} className="rounded-sm hover:text-blue-600">
                      {test.name}
                    </Link>
                  </h3>
                  <p className="mt-0.5 text-body-sm text-gray-500">
                    {test.parameters.length} parameters · {test.sampleType}
                  </p>
                </div>
                <span className="tabular shrink-0 text-body-sm text-gray-400 line-through">
                  {formatPrice(test.pricePaisa)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <aside>
          <div className="lg:sticky lg:top-32">
            <div className="rounded-md border border-gray-200 p-5">
              <Price
                pricePaisa={pkg.pricePaisa}
                compareAtPaisa={pkg.compareAtPricePaisa}
                size="lg"
              />

              {saving > 0 && (
                <p className="mt-3 rounded-sm bg-green-50 p-3 text-body-sm font-semibold text-green-700">
                  You save {formatPrice(saving)} compared with booking these {includedTests.length}{' '}
                  tests separately.
                </p>
              )}

              <div className="mt-5">
                <AddToCart
                  variant="primary"
                  size="lg"
                  label="Book this package"
                  item={{ kind: 'package', slug: pkg.slug }}
                />
              </div>

              <p className="mt-4 text-body-sm text-gray-500">
                Home sample collection included. Choose your slot at checkout.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
