import type { Metadata } from 'next'
import Link from 'next/link'
import { BadgeCheck, FileCheck2, ShieldCheck, Thermometer, Truck, Users } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Breadcrumbs } from '@/components/shared/primitives'
import { siteConfig } from '@/config/site'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'About us',
  description:
    'A DRAP-licensed online pharmacy in Pakistan. How we source genuine medicine, verify prescriptions, and protect the cold chain.',
}

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
    <div className="container max-w-4xl py-8">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'About' }]} />

      <h1 className="text-h1">Medicine you can trust, delivered</h1>
      <p className="mt-4 max-w-2xl text-lg text-gray-500">
        {siteConfig.name} is a DRAP-licensed pharmacy operating online across Pakistan. We started
        because getting genuine medicine reliably should not depend on which neighbourhood you
        live in.
      </p>

      <section className="mt-12 rounded-lg border border-gray-200 bg-gray-50 p-8">
        <h2 className="text-h2">Why we exist</h2>
        <div className="mt-4 flex flex-col gap-4 text-body text-gray-700">
          <p>
            Counterfeit and substandard medicine is a real problem in Pakistan, and it is hardest
            on the people least able to absorb the risk. The usual advice — &ldquo;buy from a
            pharmacy you trust&rdquo; — is not much help if there is no such pharmacy nearby, or if
            the one nearby is out of stock.
          </p>
          <p>
            We built a supply chain that can prove where every pack came from, and put a licensed
            pharmacist between the prescription and the parcel. That combination is not
            remarkable in principle. It is just uncommon in practice, and it is the whole point of
            what we do.
          </p>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-h2">What we commit to</h2>
        <ul className="mt-7 grid gap-8 sm:grid-cols-2">
          {commitments.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.title} className="flex flex-col gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="text-h3">{item.title}</h3>
                <p className="text-body-sm text-gray-500">{item.body}</p>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="mt-14 grid gap-6 sm:grid-cols-3">
        {[
          { icon: Users, stat: '40,000+', label: 'Orders delivered' },
          { icon: Truck, stat: '10 cities', label: 'Same-day or next-day delivery' },
          { icon: ShieldCheck, stat: '100%', label: 'Prescriptions pharmacist-verified' },
        ].map((item) => {
          const Icon = item.icon
          return (
            <div key={item.label} className="rounded-md border border-gray-200 p-6">
              <Icon className="h-5 w-5 text-gray-400" aria-hidden="true" />
              <p className="tabular mt-3 text-h1 text-gray-900">{item.stat}</p>
              <p className="mt-1 text-body-sm text-gray-500">{item.label}</p>
            </div>
          )
        })}
      </section>

      <section className="mt-14 rounded-lg border border-gray-200 p-8">
        <h2 className="text-h2">Licensing and regulation</h2>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-body-sm text-gray-500">DRAP pharmacy licence</dt>
            <dd className="tabular mt-1 font-semibold text-gray-900">{siteConfig.drapLicense}</dd>
          </div>
          <div>
            <dt className="text-body-sm text-gray-500">Superintendent pharmacist</dt>
            <dd className="mt-1 font-semibold text-gray-900">{siteConfig.pharmacist}</dd>
          </div>
          <div>
            <dt className="text-body-sm text-gray-500">Registered address</dt>
            <dd className="mt-1 font-semibold text-gray-900">{siteConfig.address}</dd>
          </div>
          <div>
            <dt className="text-body-sm text-gray-500">Operating hours</dt>
            <dd className="mt-1 font-semibold text-gray-900">{siteConfig.hours}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-14 flex flex-col items-start gap-5 rounded-lg bg-blue-50 p-8">
        <h2 className="text-h2">Questions before you order?</h2>
        <p className="max-w-xl text-body text-gray-700">
          Our pharmacists answer questions about dosage, interactions, and substitutions — no
          purchase necessary.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/contact" className={cn(buttonVariants({ variant: 'primary' }))}>
            Contact us
          </Link>
          <a
            href={`tel:${siteConfig.phone.replace(/\s/g, '')}`}
            className={cn(buttonVariants({ variant: 'secondary' }))}
          >
            Call {siteConfig.phone}
          </a>
        </div>
      </section>
    </div>
  )
}
