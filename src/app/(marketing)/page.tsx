import Link from 'next/link'
import {
  BadgeCheck,
  Banknote,
  Clock3,
  FileCheck2,
  ShieldCheck,
  Truck,
} from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { SectionHeading } from '@/components/shared/primitives'
import { HeroSearch } from '@/features/catalog/components/hero-search'
import { LabTestCard, PackageCard, ProductCard } from '@/features/catalog/components/cards'
import { getCategories, getHealthPackages, getLabTests, getProducts } from '@/lib/data/queries'
import { cn } from '@/lib/utils'

// Fully static — nothing here is personalised, so it is generated at build time
// and revalidated hourly.
export const revalidate = 3600

const trustPoints = [
  {
    icon: ShieldCheck,
    title: 'DRAP licensed',
    body: 'A registered pharmacy with a named superintendent pharmacist on every order.',
  },
  {
    icon: BadgeCheck,
    title: 'Genuine medicine',
    body: 'Sourced directly from manufacturers and authorised distributors. Batch and expiry tracked.',
  },
  {
    icon: FileCheck2,
    title: 'Pharmacist verified',
    body: 'Every prescription is reviewed by a licensed pharmacist before your order ships.',
  },
  {
    icon: Banknote,
    title: 'Cash on delivery',
    body: 'Pay when it reaches your door. JazzCash and Easypaisa also accepted.',
  },
]

export default async function HomePage() {
  const [categories, products, tests, packages] = await Promise.all([
    getCategories(),
    getProducts(),
    getLabTests(),
    getHealthPackages(),
  ])

  return (
    <>
      {/* Hero — one sentence, generous space, no carousel. Rotating carousels
          measurably hurt LCP, cause layout shift, and get ignored. */}
      <section className="border-b border-gray-200">
        <div className="container flex flex-col items-start gap-6 py-16 md:py-24">
          <h1 className="max-w-3xl text-h1 md:text-display">Healthcare, delivered.</h1>
          <p className="max-w-xl text-lg text-gray-500">
            Genuine medicines, lab tests, and health packages — at your door across Pakistan,
            with a pharmacist checking every prescription.
          </p>

          <HeroSearch />

          <div className="flex flex-wrap gap-3">
            <Link href="/pharmacy" className={cn(buttonVariants({ variant: 'primary', size: 'lg' }))}>
              Browse medicines
            </Link>
            <Link
              href="/lab-tests"
              className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }))}
            >
              Book a lab test
            </Link>
          </div>

          <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-body-sm font-medium text-green-700">
            <li className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" /> DRAP licensed
            </li>
            <li className="flex items-center gap-1.5">
              <BadgeCheck className="h-4 w-4" aria-hidden="true" /> Genuine medicine
            </li>
            <li className="flex items-center gap-1.5">
              <Truck className="h-4 w-4" aria-hidden="true" /> Free delivery over Rs 2,000
            </li>
          </ul>
        </div>
      </section>

      {/* Categories */}
      <section className="container py-14">
        <SectionHeading title="Shop by category" href="/pharmacy" linkLabel="All medicines" />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {categories.map((category) => (
            <li key={category.id}>
              <Link
                href={`/categories/${category.slug}`}
                className="flex h-full flex-col items-center gap-2.5 rounded-md border border-gray-200 p-4 text-center transition-shadow duration-fast hover:shadow-e1"
              >
                <span className="text-3xl" aria-hidden="true">
                  {category.icon}
                </span>
                <span className="text-body-sm font-semibold text-gray-700">{category.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Prescription upload — the highest-intent entry point after search. */}
      <section className="bg-gray-50 py-14">
        <div className="container">
          <div className="grid items-center gap-8 rounded-lg border border-gray-200 bg-blue-50 p-8 md:grid-cols-2 md:p-12">
            <div>
              <h2 className="text-h2">Have a prescription?</h2>
              <p className="mt-3 max-w-md text-body text-gray-700">
                Upload a photo and a licensed pharmacist will review it, usually within
                30 minutes. We will call you if anything needs clarifying.
              </p>
              <Link
                href="/pharmacy"
                className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'mt-6')}
              >
                Upload prescription
              </Link>
              <p className="mt-3 flex items-center gap-1.5 text-body-sm text-gray-500">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Your prescription is private and encrypted.
              </p>
            </div>

            <ol className="flex flex-col gap-4">
              {[
                { n: 1, title: 'Upload a photo', body: 'Snap your prescription with your phone camera.' },
                { n: 2, title: 'Pharmacist reviews it', body: 'A licensed pharmacist checks it, usually in 30 minutes.' },
                { n: 3, title: 'We deliver', body: 'Your medicine arrives the same day in most cities.' },
              ].map((step) => (
                <li key={step.n} className="flex gap-4 rounded-md bg-white p-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-body-sm font-bold text-white">
                    {step.n}
                  </span>
                  <div>
                    <h3 className="text-[15px] font-semibold text-gray-900">{step.title}</h3>
                    <p className="mt-0.5 text-body-sm text-gray-500">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Popular lab tests */}
      <section className="container py-14">
        <SectionHeading
          title="Popular lab tests"
          description="Home sample collection across major cities, with reports delivered digitally."
          href="/lab-tests"
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tests.slice(0, 4).map((test) => (
            <LabTestCard key={test.id} test={test} />
          ))}
        </div>
      </section>

      {/* Health packages */}
      <section className="bg-gray-50 py-14">
        <div className="container">
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
        </div>
      </section>

      {/* Trending products */}
      <section className="container py-14">
        <SectionHeading title="Trending now" href="/pharmacy" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {products.slice(0, 5).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* Why us */}
      <section className="border-t border-gray-200 py-14">
        <div className="container">
          <SectionHeading title="Why order from us" />
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {trustPoints.map((point) => {
              const Icon = point.icon
              return (
                <li key={point.title} className="flex flex-col gap-2.5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-h3">{point.title}</h3>
                  <p className="text-body-sm text-gray-500">{point.body}</p>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      {/* Delivery promise */}
      <section className="border-t border-gray-200 bg-gray-50 py-10">
        <div className="container flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-body-sm text-gray-500">
          <span className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-gray-400" aria-hidden="true" />
            Same-day delivery in Karachi, Lahore, and Islamabad
          </span>
          <span className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-gray-400" aria-hidden="true" />
            Nationwide shipping in 2–3 days
          </span>
          <span className="flex items-center gap-2">
            <Banknote className="h-4 w-4 text-gray-400" aria-hidden="true" />
            Cash on delivery available everywhere
          </span>
        </div>
      </section>
    </>
  )
}
