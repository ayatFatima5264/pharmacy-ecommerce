import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Clock, Droplet, FlaskConical, Utensils } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionItem } from '@/components/ui/accordion'
import { Breadcrumbs, Price, SectionHeading } from '@/components/shared/primitives'
import { LabTestCard } from '@/features/catalog/components/cards'
import { AddToCart } from '@/features/cart/components/add-to-cart'
import { getLabTestBySlug, getLabTests } from '@/lib/data/queries'
import { formatPrice, turnaroundLabel } from '@/lib/utils'

export const revalidate = 3600

type Params = Promise<{ slug: string }>

export async function generateStaticParams() {
  const tests = await getLabTests()
  return tests.map((t) => ({ slug: t.slug }))
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  const test = await getLabTestBySlug(slug)
  if (!test) return { title: 'Test not found' }
  return {
    title: test.name,
    description: test.description.slice(0, 155),
    alternates: { canonical: `/lab-tests/${test.slug}` },
  }
}

export default async function LabTestPage({ params }: { params: Params }) {
  const { slug } = await params
  const test = await getLabTestBySlug(slug)
  if (!test) notFound()

  const all = await getLabTests()
  const related = all.filter((t) => t.slug !== test.slug).slice(0, 3)

  return (
    <div className="container py-8 md:py-12">
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Lab Tests', href: '/lab-tests' },
          { label: test.name },
        ]}
      />

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_400px] xl:gap-12">
        <div>
          {/* Hero card: identity, description, and the facts that decide a
              booking — sample, fasting, turnaround — as icon chips. */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-e1 md:p-8">
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge tone="info">{test.shortCode}</Badge>
              {test.fastingRequired ? (
                <Badge tone="rx">
                  <Utensils className="h-3 w-3" aria-hidden="true" />
                  {test.fastingHours} hours fasting required
                </Badge>
              ) : (
                <Badge tone="success">No fasting required</Badge>
              )}
            </div>

            <h1 className="mt-4 text-h1">{test.name}</h1>
            <p className="mt-3 max-w-3xl text-body text-gray-700">{test.description}</p>

            <dl className="mt-6 flex flex-wrap gap-2.5">
              <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3.5 py-2">
                <Droplet className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
                <dt className="text-body-sm text-gray-500">Sample</dt>
                <dd className="text-body-sm font-semibold text-gray-900">{test.sampleType}</dd>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3.5 py-2">
                <Clock className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
                <dt className="text-body-sm text-gray-500">Report</dt>
                <dd className="text-body-sm font-semibold text-gray-900">
                  {turnaroundLabel(test.turnaroundHours)}
                </dd>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3.5 py-2">
                <FlaskConical className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
                <dt className="text-body-sm text-gray-500">Processed by</dt>
                <dd className="text-body-sm font-semibold text-gray-900">{test.labName}</dd>
              </div>
            </dl>
          </div>

          <Accordion className="mt-8">
            <AccordionItem title={`Included parameters (${test.parameters.length})`} defaultOpen>
              <ul className="grid gap-2 sm:grid-cols-2">
                {test.parameters.map((parameter) => (
                  <li key={parameter} className="flex items-center gap-2 text-body-sm">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" aria-hidden="true" />
                    {parameter}
                  </li>
                ))}
              </ul>
            </AccordionItem>

            <AccordionItem title="Who should take this test">
              <ul className="flex list-disc flex-col gap-1.5 pl-5">
                {test.whoShouldTake.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </AccordionItem>

            <AccordionItem title="How to prepare">
              {test.fastingRequired ? (
                <p>
                  Do not eat or drink anything except water for {test.fastingHours} hours before
                  your sample is collected. Morning slots are easiest — most of the fasting
                  happens while you sleep. Continue any prescribed medication unless your doctor
                  says otherwise.
                </p>
              ) : (
                <p>
                  No special preparation is needed. You can eat and drink normally before your
                  sample is collected.
                </p>
              )}
            </AccordionItem>
          </Accordion>
        </div>

        {/* Booking panel */}
        <aside>
          <div className="lg:sticky lg:top-32">
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-e2">
              <Price
                pricePaisa={test.pricePaisa}
                compareAtPaisa={test.compareAtPricePaisa}
                size="lg"
              />
              <p className="mt-1.5 text-body-sm text-gray-500">
                Home collection + {formatPrice(test.homeCollectionFeePaisa)}, or free if you visit
                the lab.
              </p>

              <div className="mt-5">
                <AddToCart
                  variant="primary"
                  size="lg"
                  label="Book this test"
                  item={{ kind: 'test', slug: test.slug }}
                />
              </div>

              <p className="mt-4 border-t border-gray-200 pt-4 text-body-sm text-gray-500">
                Choose your collection date and time slot at checkout.
              </p>
            </div>
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="mt-14 border-t border-gray-200 pt-10 md:mt-16">
          <SectionHeading title="Other popular tests" href="/lab-tests" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {related.map((item) => (
              <LabTestCard key={item.id} test={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
