import type { Metadata } from 'next'
import Link from 'next/link'
import { MessageCircle, PhoneCall } from 'lucide-react'
import { Accordion, AccordionItem } from '@/components/ui/accordion'
import { Breadcrumbs } from '@/components/shared/primitives'
import { faqSections } from '@/config/faq'
import { siteConfig } from '@/config/site'
import { whatsappLink } from '@/lib/whatsapp'

export const metadata: Metadata = {
  title: 'Frequently Asked Questions',
  description:
    'Answers about delivery across Lahore, ordering, prescriptions, lab tests, payments, and returns at AR Medical Store.',
  alternates: { canonical: '/faq' },
}

export default function FaqPage() {
  // FAQPage structured data — built from the same config the page renders,
  // so the rich snippet always matches the visible answers.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqSections.flatMap((section) =>
      section.items.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    ),
  }

  return (
    <div className="bg-gradient-to-b from-blue-50/40 to-white">
      {/* XSS: same escape chain as the product page — JSON.stringify alone is
          not safe inside a <script> block. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd)
            .replace(/</g, '\\u003c')
            .replace(/>/g, '\\u003e')
            .replace(/&/g, '\\u0026'),
        }}
      />

      <div className="container max-w-4xl py-10 md:py-14">
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'FAQs' }]} />

        <div className="mt-6">
          <span className="inline-flex rounded-full bg-blue-100 px-3.5 py-1 text-caption font-semibold text-blue-900">
            Help Center
          </span>
          <h1 className="mt-4 text-h1">
            Frequently Asked <span className="text-blue-600">Questions</span>
          </h1>
          <p className="mt-3 max-w-2xl text-body leading-relaxed text-gray-500">
            Everything about ordering medicines, prescriptions, lab tests, delivery across
            Lahore, payments, and returns. Can&rsquo;t find your answer? Our team is one message
            away.
          </p>
        </div>

        <div className="mt-10 flex flex-col gap-8">
          {faqSections.map((section) => (
            <section key={section.id} aria-labelledby={`faq-${section.id}`}>
              <h2
                id={`faq-${section.id}`}
                className="mb-3 text-[11.5px] font-bold uppercase tracking-[0.08em] text-gray-500"
              >
                {section.title}
              </h2>
              <Accordion className="bg-white">
                {section.items.map((item) => (
                  <AccordionItem key={item.question} title={item.question}>
                    <p className="max-w-2xl leading-relaxed">{item.answer}</p>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          ))}
        </div>

        {/* Escape hatch for everything the page does not answer. */}
        <div className="mt-12 flex flex-col items-start gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-e1 sm:flex-row sm:items-center sm:justify-between md:p-8">
          <div>
            <h2 className="text-h3 text-gray-900">Still have a question?</h2>
            <p className="mt-1 text-body-sm text-gray-500">
              Our support team replies within a few hours during opening times ({siteConfig.hours}).
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <a
              href={whatsappLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-md bg-green-600 px-5 text-body-sm font-semibold text-white transition-colors duration-fast hover:bg-green-700"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              WhatsApp us
            </a>
            <Link
              href="/contact"
              className="inline-flex h-11 items-center gap-2 rounded-md border border-gray-200 px-5 text-body-sm font-semibold text-gray-700 transition-colors duration-fast hover:border-blue-600/40 hover:text-blue-600"
            >
              <PhoneCall className="h-4 w-4" aria-hidden="true" />
              Contact us
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
