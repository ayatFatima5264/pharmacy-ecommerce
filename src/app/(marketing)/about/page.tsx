import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
  BadgeCheck,
  FileCheck2,
  HeartPulse,
  ShieldCheck,
  Thermometer,
  Truck,
} from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Breadcrumbs } from '@/components/shared/primitives'
import { siteConfig } from '@/config/site'
import { DELIVERY_CITY, areasFor } from '@/config/locations'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'About us',
  description:
    'A DRAP-licensed online medical store serving Lahore. How we source genuine medicine, verify prescriptions, and protect the cold chain.',
  alternates: { canonical: '/about' },
}

const highlights = [
  { icon: BadgeCheck, label: '100% genuine medicines' },
  { icon: Truck, label: 'Fast & reliable delivery' },
  { icon: FileCheck2, label: 'Expert pharmacist support' },
  { icon: ShieldCheck, label: 'Secure & private' },
]

const commitments = [
  {
    icon: BadgeCheck,
    title: 'Genuine medicine, traceable to its batch',
    body: 'We buy only from manufacturers and their authorised distributors — never from the open market. Every pack we dispense is recorded against its batch number and expiry date, so if a recall is ever issued we know exactly who received it.',
  },
  {
    icon: FileCheck2,
    title: 'A pharmacist reviews every prescription',
    body: 'Prescription-only medicine is dispensed only after a licensed pharmacist has read your prescription and checked it against what you have ordered. If something does not match, we call you rather than guess.',
  },
  {
    icon: Thermometer,
    title: 'The cold chain is not optional',
    body: 'Insulin, vaccines, and other temperature-sensitive products travel in validated cold boxes with temperature monitoring. If the chain breaks, the product does not go out.',
  },
  {
    icon: ShieldCheck,
    title: 'Your health data stays private',
    body: 'Prescriptions and lab reports are encrypted, stored separately from the rest of our systems, and accessible only to the pharmacist handling your order. Every access is logged.',
  },
]

export default function AboutPage() {
  return (
    <>
      <section className="border-b border-gray-200 bg-gradient-to-b from-blue-50/50 to-white">
        <div className="container py-10 md:py-16">
          <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'About' }]} />

          <div className="mt-6 grid items-center gap-10 lg:grid-cols-[1fr_400px]">
            <div>
              <span className="inline-flex rounded-full bg-blue-100 px-3.5 py-1 text-caption font-semibold text-blue-900">
                About Us
              </span>
              <h1 className="mt-4 max-w-xl text-h1 md:text-display">
                Caring for Your <span className="text-blue-600">Health</span>, Every Step of the
                Way
              </h1>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-gray-500">
                {siteConfig.name} is your trusted online medical store and lab-testing partner in
                Lahore. We are committed to 100% genuine medicines, reliable lab tests, and
                expert healthcare support — all from the comfort of your home.
              </p>

              <ul className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
                {highlights.map((h) => (
                  <li key={h.label} className="flex flex-col items-start gap-2.5">
                    <span className="flex h-11 w-11 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                      <h.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="text-body-sm font-semibold leading-snug text-gray-900">
                      {h.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Brand visual with the floating licence card, per the design. */}
            <div className="relative hidden lg:block" aria-hidden="true">
              <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-blue-50">
                <Image
                  src={siteConfig.logo}
                  alt=""
                  width={190}
                  height={190}
                  className="h-44 w-44 object-contain"
                />
              </div>
              <div className="absolute -bottom-6 -right-4 w-60 rounded-md border border-gray-200 bg-white p-4 shadow-e2">
                <ShieldCheck className="h-5 w-5 text-blue-600" />
                <p className="mt-2 text-body-sm font-bold text-gray-900">DRAP Licensed</p>
                <p className="mt-1 text-caption leading-relaxed text-gray-500">
                  A licensed medical store ({siteConfig.drapLicense}) held to the highest standards of
                  quality and safety.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats band — real platform facts, not invented volume. */}
      <section className="border-b border-gray-200 bg-gray-50" aria-label="At a glance">
        <div className="container grid grid-cols-2 gap-6 py-10 text-center md:grid-cols-4">
          {[
            { value: `${areasFor(DELIVERY_CITY).length}+`, label: 'Lahore areas served' },
            { value: '24h', label: 'Typical lab report time' },
            { value: '100%', label: 'Batch-tracked stock' },
            { value: '9am–11pm', label: 'Support, every day' },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-price-lg text-blue-600">{stat.value}</p>
              <p className="mt-1 text-body-sm text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container py-12 md:py-16" aria-labelledby="about-commitments">
        <h2 id="about-commitments" className="text-center text-h2">
          What we hold ourselves to
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {commitments.map((item) => (
            <div
              key={item.title}
              className="flex gap-4 rounded-md border border-gray-200 bg-white p-6 transition-shadow duration-medium hover:shadow-e1"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                <item.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-body font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-1.5 text-body-sm leading-relaxed text-gray-500">{item.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center gap-4 rounded-lg bg-blue-50 p-8 text-center">
          <HeartPulse className="h-7 w-7 text-blue-600" aria-hidden="true" />
          <p className="max-w-lg text-body text-gray-700">
            Superintendent pharmacist: <strong>{siteConfig.pharmacist}</strong>. Questions about a
            medicine? Our pharmacists answer clinical questions every day, {siteConfig.hours.toLowerCase()}.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/contact" className={cn(buttonVariants({ variant: 'primary' }))}>
              Contact us
            </Link>
            <Link href="/pharmacy" className={cn(buttonVariants({ variant: 'secondary' }))}>
              Browse medicines
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
