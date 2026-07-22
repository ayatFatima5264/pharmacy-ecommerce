import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  FileCheck2,
  FlaskConical,
  Quote,
  ShieldCheck,
  Star,
  Truck,
} from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { HeroSearch } from '@/features/catalog/components/hero-search'
import { LabTestCard, PackageCard, ProductCard } from '@/features/catalog/components/cards'
import { NewsletterForm } from '@/components/shared/newsletter'
import { getCategories, getHealthPackages, getLabTests, getProducts } from '@/lib/data/queries'
import { siteConfig } from '@/config/site'
import { cn } from '@/lib/utils'

// Fully static — nothing here is personalised, so it is generated at build
// time and revalidated hourly.
export const revalidate = 3600

const whyChooseUs = [
  {
    icon: ShieldCheck,
    title: 'DRAP licensed',
    body: 'A registered pharmacy with a named superintendent pharmacist on every order.',
  },
  {
    icon: BadgeCheck,
    title: '100% genuine medicine',
    body: 'Sourced from manufacturers and authorised distributors. Batch and expiry tracked.',
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

// Demo testimonials for the demo catalog — replaced by real reviews when a
// review system exists (deliberately not fabricated as data anywhere else).
const testimonials = [
  {
    quote:
      'Ordered my father’s blood-pressure medicine at night and it arrived the next morning. The pharmacist even called to confirm the dosage.',
    name: 'Amna R.',
    city: 'Karachi',
  },
  {
    quote:
      'Booked a full-body checkup for home collection. The phlebotomist came on time and the report was in my email the next day.',
    name: 'Bilal S.',
    city: 'Lahore',
  },
  {
    quote:
      'Finally a pharmacy that takes prescriptions seriously. Upload, quick review, delivered sealed. Exactly how it should work.',
    name: 'H. Qureshi',
    city: 'Islamabad',
  },
]

function SectionHeader({
  title,
  subtitle,
  href,
  linkLabel,
}: {
  title: string
  subtitle?: string
  href?: string
  linkLabel?: string
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-h2">{title}</h2>
        {subtitle && <p className="mt-1 text-body-sm text-gray-500">{subtitle}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="flex items-center gap-1 rounded-sm text-body-sm font-semibold text-blue-600 hover:underline"
        >
          {linkLabel ?? 'View all'}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  )
}

export default async function HomePage() {
  const [categories, products, tests, packages] = await Promise.all([
    getCategories(),
    getProducts(),
    getLabTests(),
    getHealthPackages(),
  ])

  const onSale = products.filter((p) =>
    p.variants.some((v) => v.compareAtPricePaisa && v.compareAtPricePaisa > v.pricePaisa),
  )
  const featured = products.slice(0, 8)
  const latest = products.slice(-4)

  return (
    <>
      {/* ================= Hero ================= */}
      <section className="border-b border-gray-200 bg-gradient-to-b from-blue-50/60 to-white">
        <div className="container grid items-center gap-10 py-12 md:grid-cols-[1fr_380px] md:py-20">
          <div className="flex flex-col items-start gap-6">
            <span className="flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-caption font-semibold text-blue-900">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              DRAP-licensed · {siteConfig.drapLicense}
            </span>

            <h1 className="max-w-2xl text-h1 md:text-display">
              Your Trusted Online <span className="text-blue-600">Pharmacy</span> &amp;{' '}
              <span className="text-blue-600">Lab</span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-gray-500">
              Genuine medicines and certified lab tests, delivered across Pakistan — with a
              licensed pharmacist checking every prescription.
            </p>

            <HeroSearch />

            <div className="flex flex-wrap gap-3">
              <Link href="/pharmacy" className={cn(buttonVariants({ variant: 'primary', size: 'lg' }))}>
                Shop Medicines
              </Link>
              <Link
                href="/lab-tests"
                className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }))}
              >
                Book Lab Tests
              </Link>
            </div>

            <ul className="mt-1 flex flex-wrap gap-x-6 gap-y-2 text-body-sm font-medium text-green-700">
              <li className="flex items-center gap-1.5">
                <Truck className="h-4 w-4" aria-hidden="true" /> Free delivery over Rs 2,000
              </li>
              <li className="flex items-center gap-1.5">
                <BadgeCheck className="h-4 w-4" aria-hidden="true" /> Genuine medicine
              </li>
              <li className="flex items-center gap-1.5">
                <Banknote className="h-4 w-4" aria-hidden="true" /> Cash on delivery
              </li>
            </ul>
          </div>

          {/* Clean brand visual: the mark on a soft field with floating trust chips. */}
          <div className="relative hidden md:block" aria-hidden="true">
            <div className="flex aspect-square items-center justify-center rounded-xl bg-blue-50">
              <Image
                src={siteConfig.logo}
                alt=""
                width={220}
                height={220}
                priority
                className="h-52 w-52 object-contain drop-shadow-sm"
              />
            </div>
            <div className="absolute -left-6 top-8 flex items-center gap-2 rounded-md bg-white px-3.5 py-2.5 shadow-e2">
              <FileCheck2 className="h-4 w-4 text-blue-600" />
              <span className="text-caption font-semibold text-gray-900">Pharmacist verified</span>
            </div>
            <div className="absolute -right-4 bottom-10 flex items-center gap-2 rounded-md bg-white px-3.5 py-2.5 shadow-e2">
              <FlaskConical className="h-4 w-4 text-blue-600" />
              <span className="text-caption font-semibold text-gray-900">Reports in 24h</span>
            </div>
          </div>
        </div>
      </section>

      {/* ================= Popular categories ================= */}
      <section className="container py-12 md:py-16" aria-labelledby="home-categories">
        <div id="home-categories">
          <SectionHeader
            title="Shop by category"
            subtitle="Everything a pharmacy shelf holds, organised the way you look for it"
            href="/pharmacy"
            linkLabel="All medicines"
          />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/categories/${category.slug}`}
              className="group flex flex-col items-center gap-3 rounded-md border border-gray-200 bg-white p-5 text-center transition-all duration-medium hover:-translate-y-0.5 hover:border-blue-600/30 hover:shadow-e2"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-2xl transition-colors duration-medium group-hover:bg-blue-100">
                {category.icon}
              </span>
              <span className="text-body-sm font-semibold text-gray-900 group-hover:text-blue-600">
                {category.name}
              </span>
            </Link>
          ))}
          <Link
            href="/lab-tests"
            className="group flex flex-col items-center gap-3 rounded-md border border-gray-200 bg-white p-5 text-center transition-all duration-medium hover:-translate-y-0.5 hover:border-blue-600/30 hover:shadow-e2"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-2xl transition-colors duration-medium group-hover:bg-blue-100">
              🔬
            </span>
            <span className="text-body-sm font-semibold text-gray-900 group-hover:text-blue-600">
              Lab Tests
            </span>
          </Link>
        </div>
      </section>

      {/* ================= Featured products ================= */}
      <section className="border-y border-gray-200 bg-gray-50">
        <div className="container py-12 md:py-16" aria-labelledby="home-featured">
          <div id="home-featured">
            <SectionHeader
              title="Featured products"
              subtitle="Pharmacy essentials our customers reorder"
              href="/pharmacy"
            />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {featured.slice(0, 4).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* ================= Today's offers ================= */}
      {onSale.length > 0 && (
        <section className="container py-12 md:py-16" aria-labelledby="home-offers">
          <div id="home-offers">
            <SectionHeader
              title="Today’s offers"
              subtitle="Genuine stock, real discounts"
              href="/offers"
              linkLabel="All offers"
            />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {onSale.slice(0, 4).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* ================= New arrivals ================= */}
      <section className="border-y border-gray-200 bg-gray-50">
        <div className="container py-12 md:py-16" aria-labelledby="home-latest">
          <div id="home-latest">
            <SectionHeader title="New arrivals" subtitle="Recently added to the shelf" href="/pharmacy" />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {latest.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* ================= Popular lab tests ================= */}
      <section className="container py-12 md:py-16" aria-labelledby="home-tests">
        <div id="home-tests">
          <SectionHeader
            title="Popular lab tests"
            subtitle="Home sample collection by trained phlebotomists"
            href="/lab-tests"
            linkLabel="All tests"
          />
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {tests.slice(0, 4).map((test) => (
            <LabTestCard key={test.id} test={test} />
          ))}
        </div>

        {packages.length > 0 && (
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {packages.slice(0, 2).map((pkg) => (
              <PackageCard key={pkg.id} pkg={pkg} testCount={pkg.includedTestSlugs.length} />
            ))}
          </div>
        )}
      </section>

      {/* ================= Why choose us ================= */}
      <section className="border-y border-gray-200 bg-gray-50">
        <div className="container py-12 md:py-16" aria-labelledby="home-why">
          <h2 id="home-why" className="text-center text-h2">
            Why choose {siteConfig.name}
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {whyChooseUs.map((point) => (
              <div
                key={point.title}
                className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-6 transition-shadow duration-medium hover:shadow-e1"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                  <point.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="text-body font-semibold text-gray-900">{point.title}</h3>
                <p className="text-body-sm leading-relaxed text-gray-500">{point.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= Customer voices ================= */}
      <section className="container py-12 md:py-16" aria-labelledby="home-reviews">
        <h2 id="home-reviews" className="text-center text-h2">
          What customers say
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure
              key={t.name}
              className="flex flex-col gap-4 rounded-md border border-gray-200 bg-white p-6"
            >
              <Quote className="h-5 w-5 text-blue-100" aria-hidden="true" />
              <blockquote className="text-body-sm leading-relaxed text-gray-700">
                {t.quote}
              </blockquote>
              <figcaption className="mt-auto flex items-center justify-between">
                <span className="text-body-sm font-semibold text-gray-900">
                  {t.name} <span className="font-normal text-gray-500">· {t.city}</span>
                </span>
                <span className="flex gap-0.5 text-green-600" aria-label="5 out of 5 stars">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                  ))}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ================= Newsletter ================= */}
      <section className="bg-blue-600" aria-labelledby="home-newsletter">
        <div className="container flex flex-col items-center gap-4 py-12 text-center md:py-14">
          <h2 id="home-newsletter" className="text-h2 text-white">
            Health tips &amp; offers, monthly
          </h2>
          <p className="max-w-md text-body-sm text-blue-100">
            No spam — one useful email a month with seasonal health advice and current offers.
          </p>
          <NewsletterForm />
        </div>
      </section>
    </>
  )
}
