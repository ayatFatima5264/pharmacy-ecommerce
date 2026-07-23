'use client'

import * as React from 'react'
import { Check, Clock, Mail, MapPin, Navigation, Phone, PhoneCall, Send } from 'lucide-react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Breadcrumbs } from '@/components/shared/primitives'
import { WhatsAppIcon } from '@/components/shared/social-icons'
import { siteConfig } from '@/config/site'
import { whatsappLink } from '@/lib/whatsapp'

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name'),
  phone: z
    .string()
    .trim()
    .regex(/^(?:\+92|0)3\d{9}$/, 'Enter a valid mobile number, e.g. 03001234567'),
  email: z.string().trim().email('Enter a valid email address').or(z.literal('')).optional(),
  topic: z.enum(['order', 'prescription', 'lab', 'product', 'other']),
  message: z.string().trim().min(10, 'Tell us a little more — at least 10 characters'),
})

type ContactValues = z.infer<typeof contactSchema>
type Errors = Partial<Record<keyof ContactValues, string>>

const topics = [
  { value: 'order', label: 'An existing order' },
  { value: 'prescription', label: 'A prescription question' },
  { value: 'lab', label: 'Lab tests or reports' },
  { value: 'product', label: 'Product availability' },
  { value: 'other', label: 'Something else' },
] as const

export default function ContactPage() {
  const [values, setValues] = React.useState<ContactValues>({
    name: '',
    phone: '',
    email: '',
    topic: 'order',
    message: '',
  })
  const [errors, setErrors] = React.useState<Errors>({})
  const [submitting, setSubmitting] = React.useState(false)
  const [sent, setSent] = React.useState(false)

  function set<K extends keyof ContactValues>(key: K, value: ContactValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = contactSchema.safeParse(values)

    if (!parsed.success) {
      const fieldErrors: Errors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof ContactValues
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      document.getElementById(Object.keys(fieldErrors)[0])?.focus()
      return
    }

    setSubmitting(true)
    // Stands in for a Server Action that sends via Resend.
    await new Promise((resolve) => setTimeout(resolve, 800))
    setSubmitting(false)
    setSent(true)
  }

  const info = [
    { icon: Phone, label: 'Phone', value: siteConfig.phone, href: `tel:${siteConfig.phone.replace(/\s/g, '')}` },
    { icon: WhatsAppIcon, label: 'WhatsApp', value: siteConfig.whatsapp, href: whatsappLink() },
    { icon: Mail, label: 'Email', value: siteConfig.email, href: `mailto:${siteConfig.email}` },
    { icon: Clock, label: 'Hours', value: siteConfig.hours },
    { icon: MapPin, label: 'Address', value: siteConfig.address },
  ]

  // PLACEHOLDER pin (config/site.ts) — the standard keyless Maps embed, so
  // swapping coordinates in config moves both the map and the directions link.
  const { lat, lng } = siteConfig.location
  const mapEmbedUrl = `https://www.google.com/maps?q=${lat},${lng}&z=15&output=embed`
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`

  return (
    <div className="bg-gradient-to-b from-blue-50/40 to-white">
      <div className="container py-10 md:py-14">
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Contact' }]} />

        <div className="mt-6 grid gap-10 lg:grid-cols-[400px_1fr]">
          {/* ============ Left: intro + contact details ============ */}
          <div>
            <span className="inline-flex rounded-full bg-blue-100 px-3.5 py-1 text-caption font-semibold text-blue-900">
              Contact Us
            </span>
            <h1 className="mt-4 text-h1">
              We&rsquo;re Here to <span className="text-blue-600">Help</span>
            </h1>
            <p className="mt-3 text-body leading-relaxed text-gray-500">
              Our pharmacists answer clinical questions, and our support team handles orders and
              deliveries. We reply within a few hours during opening times.
            </p>

            <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-5 rounded-md border border-gray-200 bg-white p-6 sm:grid-cols-2">
              {info.map((item) => (
                <div key={item.label} className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <item.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-caption text-gray-500">{item.label}</p>
                    {item.href ? (
                      <a
                        href={item.href}
                        className="break-words rounded-sm text-body-sm font-semibold text-blue-600 hover:underline"
                      >
                        {item.value}
                      </a>
                    ) : (
                      <p className="text-body-sm font-semibold text-gray-900">{item.value}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-3 rounded-md border border-red-600/20 bg-red-50 p-5">
              <PhoneCall className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
              <div>
                <h2 className="text-body-sm font-bold text-red-700">Medical emergency?</h2>
                <p className="mt-1 text-body-sm leading-relaxed text-gray-600">
                  We are a medical store, not an emergency service. For urgent medical help call Rescue
                  1122 or go to your nearest hospital.
                </p>
              </div>
            </div>
          </div>

          {/* ============ Right: message form card ============ */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-e1 md:p-8">
            {sent ? (
              <div
                className="flex flex-col items-start gap-3 rounded-md bg-green-50 p-8"
                role="status"
                aria-live="polite"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-green-600 text-white">
                  <Check className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="text-h2 text-green-700">Message sent</h2>
                <p className="max-w-md text-body text-gray-700">
                  Thanks {values.name.split(' ')[0]} — we have your message and will reply on{' '}
                  {values.phone} within a few hours. If it is urgent, calling is faster.
                </p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSent(false)
                    setValues({ name: '', phone: '', email: '', topic: 'order', message: '' })
                  }}
                  className="mt-2"
                >
                  Send another message
                </Button>
              </div>
            ) : (
              <>
                <h2 className="text-h2">Send us a message</h2>
                <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Your name" htmlFor="name" error={errors.name} required>
                      <Input
                        id="name"
                        value={values.name}
                        onChange={(e) => set('name', e.target.value)}
                        autoComplete="name"
                        placeholder="Enter your full name"
                        aria-invalid={!!errors.name}
                        aria-describedby={errors.name ? 'name-error' : undefined}
                      />
                    </Field>

                    <Field label="Mobile number" htmlFor="phone" error={errors.phone} required>
                      <Input
                        id="phone"
                        type="tel"
                        inputMode="tel"
                        value={values.phone}
                        onChange={(e) => set('phone', e.target.value)}
                        placeholder="03XXXXXXXXX"
                        autoComplete="tel"
                        aria-invalid={!!errors.phone}
                        aria-describedby={errors.phone ? 'phone-error' : undefined}
                      />
                    </Field>
                  </div>

                  <Field label="Email" htmlFor="email" error={errors.email} hint="Optional">
                    <Input
                      id="email"
                      type="email"
                      value={values.email}
                      onChange={(e) => set('email', e.target.value)}
                      placeholder="your@email.com"
                      autoComplete="email"
                      aria-invalid={!!errors.email}
                    />
                  </Field>

                  <Field label="What is this about?" htmlFor="topic">
                    <Select
                      id="topic"
                      value={values.topic}
                      onChange={(e) => set('topic', e.target.value as ContactValues['topic'])}
                    >
                      {topics.map((topic) => (
                        <option key={topic.value} value={topic.value}>
                          {topic.label}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Message" htmlFor="message" error={errors.message} required>
                    <Textarea
                      id="message"
                      value={values.message}
                      onChange={(e) => set('message', e.target.value)}
                      placeholder="Include your order number if your question is about an order."
                      aria-invalid={!!errors.message}
                      aria-describedby={errors.message ? 'message-error' : undefined}
                    />
                  </Field>

                  <Button type="submit" size="lg" loading={submitting} className="self-start">
                    <Send className="h-4 w-4" aria-hidden="true" />
                    {submitting ? 'Sending' : 'Send message'}
                  </Button>

                  <p className="rounded-md bg-gray-50 p-3.5 text-body-sm text-gray-500">
                    Please do not include full medical history here. For clinical questions,
                    calling a pharmacist is faster and more private.
                  </p>
                </form>
              </>
            )}
          </div>
        </div>

        {/* ============ Store location: map + visit card ============ */}
        <section aria-labelledby="visit-store" className="mt-14">
          <h2 id="visit-store" className="text-h2">
            Visit Our <span className="text-blue-600">Store</span>
          </h2>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
            {/* PLACEHOLDER coordinates — swap in config/site.ts. */}
            <div className="overflow-hidden rounded-lg border border-gray-200 shadow-e1">
              <iframe
                src={mapEmbedUrl}
                title={`Map showing the location of ${siteConfig.name}`}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                className="h-[320px] w-full border-0 md:h-[400px]"
              />
            </div>

            <div className="flex h-fit flex-col gap-5 rounded-lg border border-gray-200 bg-white p-6 shadow-e1">
              <div className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-body font-semibold text-gray-900">{siteConfig.name}</h3>
                  <p className="mt-1 text-body-sm leading-relaxed text-gray-600">
                    {siteConfig.address}
                  </p>
                </div>
              </div>

              <dl className="flex flex-col gap-3 border-t border-gray-100 pt-5 text-body-sm">
                <div className="flex items-center gap-2.5">
                  <Clock className="h-4 w-4 shrink-0 text-blue-600/70" aria-hidden="true" />
                  <dt className="text-gray-500">Hours</dt>
                  <dd className="ml-auto font-semibold text-gray-900">{siteConfig.hours}</dd>
                </div>
                <div className="flex items-center gap-2.5">
                  <Phone className="h-4 w-4 shrink-0 text-blue-600/70" aria-hidden="true" />
                  <dt className="text-gray-500">Phone</dt>
                  <dd className="ml-auto">
                    <a
                      href={`tel:${siteConfig.phone.replace(/\s/g, '')}`}
                      className="rounded-sm font-semibold text-blue-600 hover:underline"
                    >
                      {siteConfig.phone}
                    </a>
                  </dd>
                </div>
                <div className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 shrink-0 text-blue-600/70" aria-hidden="true" />
                  <dt className="text-gray-500">Email</dt>
                  <dd className="ml-auto">
                    <a
                      href={`mailto:${siteConfig.email}`}
                      className="break-all rounded-sm font-semibold text-blue-600 hover:underline"
                    >
                      {siteConfig.email}
                    </a>
                  </dd>
                </div>
              </dl>

              <div className="flex flex-col gap-2.5 border-t border-gray-100 pt-5">
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-blue-600 px-5 text-body-sm font-semibold text-white transition-colors duration-fast hover:bg-blue-700"
                >
                  <Navigation className="h-4 w-4" aria-hidden="true" />
                  Get Directions
                </a>
                <a
                  href={whatsappLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-green-600 px-5 text-body-sm font-semibold text-white transition-colors duration-fast hover:bg-green-700"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                  Chat on WhatsApp
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
