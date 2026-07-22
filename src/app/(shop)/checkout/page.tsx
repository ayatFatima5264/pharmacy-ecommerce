'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertCircle, ChevronDown, Loader2, Lock, ShieldCheck } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/primitives'
import { useCart } from '@/features/cart/cart-context'
import { placeOrder } from '@/features/checkout/actions/place-order'
import { idlePlaceOrderState } from '@/features/orders/action-state'
import { AppointmentSection } from '@/features/lab/components/appointment-section'
import { PAYMENT_METHODS, PROVINCES, citiesFor } from '@/config/locations'
import { cn, formatPrice } from '@/lib/utils'

export default function CheckoutPage() {
  const router = useRouter()
  const cart = useCart()
  const [state, formAction] = useActionState(placeOrder, idlePlaceOrderState)

  const [province, setProvince] = React.useState<string>('Sindh')
  const [city, setCity] = React.useState<string>('Karachi')
  const [paymentMethod, setPaymentMethod] = React.useState<string>('cod')
  const [summaryOpen, setSummaryOpen] = React.useState(false)
  const [prescriptionName, setPrescriptionName] = React.useState<string | null>(null)

  // One key per checkout session. The server dedupes on it, so a double-click
  // or a retry after a dropped connection cannot create two orders.
  const [idempotencyKey] = React.useState(() =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now()) + Math.random().toString(36).slice(2),
  )

  const cities = citiesFor(province)
  const totals = cart.totals

  // Keep the cart's shipping quote in step with the address chosen here.
  React.useEffect(() => {
    cart.setCity(city)
  }, [city]) // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    cart.setPaymentMethod(paymentMethod === 'cod' ? 'cod' : 'online')
  }, [paymentMethod]) // eslint-disable-line react-hooks/exhaustive-deps

  // Changing province must not leave a city from the previous one selected.
  React.useEffect(() => {
    if (!cities.includes(city)) setCity(cities[0] ?? '')
  }, [province]) // eslint-disable-line react-hooks/exhaustive-deps

  // On success: clear the cart, then hand off to the confirmation page.
  React.useEffect(() => {
    if (state.status === 'success') {
      cart.clear()
      router.push(`/checkout/success?order=${encodeURIComponent(state.orderNumber)}`)
    }
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  const err = (key: string) =>
    state.status === 'error' ? state.fieldErrors?.[key] : undefined

  if (!cart.hydrated) {
    return (
      <div className="container py-8">
        <div className="h-96 animate-pulse rounded-md bg-gray-100" />
      </div>
    )
  }

  if (cart.lines.length === 0 && state.status !== 'success') {
    return (
      <div className="container py-8">
        <h1 className="mb-8 text-h1">Checkout</h1>
        <EmptyState
          icon={<Lock className="h-10 w-10" />}
          title="There is nothing to check out"
          description="Add medicines or a lab test to your cart first."
          action={
            <Link href="/pharmacy" className={cn(buttonVariants({ variant: 'primary' }))}>
              Browse medicines
            </Link>
          }
        />
      </div>
    )
  }

  const itemsPayload = JSON.stringify(
    cart.lines
      .filter((line) => line.entry && !line.issue)
      .map((line) => ({
        kind: line.kind,
        slug: line.slug,
        variantId: line.variantId,
        quantity: line.quantity,
      })),
  )

  const codUnavailable = totals.shipping ? !totals.shipping.supportsCod : false

  // Fasting is a property of the visit, not of one test: the longest
  // requirement across everything booked governs the whole appointment.
  const labLines = cart.lines.filter((l) => l.kind === 'test' || l.kind === 'package')
  const labTestNames = labLines.map((l) => l.entry?.name ?? '').filter(Boolean)
  const fastingValues = labLines
    .map((l) => l.entry?.fastingHours)
    .filter((h): h is number => typeof h === 'number')
  const labFastingHours = fastingValues.length > 0 ? Math.max(...fastingValues) : null

  return (
    <div className="container max-w-5xl py-8">
      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-h1">Checkout</h1>
        <span className="flex items-center gap-1.5 text-body-sm font-semibold text-green-700">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Secure checkout
        </span>
      </div>

      {state.status === 'error' && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-2.5 rounded-md bg-red-50 p-4 text-body-sm text-red-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{state.message}</span>
        </div>
      )}

      <form action={formAction} noValidate className="grid gap-8 lg:grid-cols-[1fr_340px]">
        {/* Cart contents travel as refs and quantities only. The server prices
            them: a total submitted by a browser is a total a browser can edit. */}
        <input type="hidden" name="items" value={itemsPayload} />
        <input type="hidden" name="couponCode" value={cart.coupon?.code ?? ''} />
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

        <div className="flex flex-col gap-5">
          <Section number={1} title="Contact details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" htmlFor="firstName" error={err('firstName')} required>
                <Input
                  id="firstName"
                  name="firstName"
                  autoComplete="given-name"
                  aria-invalid={!!err('firstName')}
                  required
                />
              </Field>

              <Field label="Last name" htmlFor="lastName" error={err('lastName')} required>
                <Input
                  id="lastName"
                  name="lastName"
                  autoComplete="family-name"
                  aria-invalid={!!err('lastName')}
                  required
                />
              </Field>

              <Field
                label="Mobile number"
                htmlFor="phone"
                error={err('phone')}
                hint="We send order updates here, and it is how you track your order"
                required
              >
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="03001234567"
                  autoComplete="tel"
                  aria-invalid={!!err('phone')}
                  required
                />
              </Field>

              <Field
                label="Email"
                htmlFor="email"
                error={err('email')}
                hint="Optional, for your confirmation email"
              >
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  aria-invalid={!!err('email')}
                />
              </Field>
            </div>
          </Section>

          <Section number={2} title="Delivery address">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Province" htmlFor="province" error={err('province')} required>
                <Select
                  id="province"
                  name="province"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  required
                >
                  {PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </Field>

              {/* City options depend on province, so the two can never disagree. */}
              <Field label="City" htmlFor="city" error={err('city')} required>
                <Select
                  id="city"
                  name="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                >
                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Street address"
                htmlFor="address"
                error={err('address')}
                hint="House or flat number, street, area"
                className="sm:col-span-2"
                required
              >
                <Input
                  id="address"
                  name="address"
                  placeholder="House 12, Block B, DHA Phase 5"
                  autoComplete="street-address"
                  aria-invalid={!!err('address')}
                  required
                />
              </Field>

              <Field
                label="Postal code"
                htmlFor="postalCode"
                error={err('postalCode')}
                hint="Optional, 5 digits"
              >
                <Input
                  id="postalCode"
                  name="postalCode"
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="75500"
                  autoComplete="postal-code"
                  className="tabular"
                  aria-invalid={!!err('postalCode')}
                />
              </Field>
            </div>

            {totals.shipping && (
              <p className="mt-4 rounded-sm bg-gray-50 p-3 text-body-sm text-gray-500">
                <span className="font-semibold text-gray-900">{totals.shipping.zoneName}</span>
                {' · '}
                {totals.shipping.carrier}
                {' · '}
                {totals.shipping.minDays === 0
                  ? 'Same day'
                  : `${totals.shipping.minDays}-${totals.shipping.maxDays} days`}
              </p>
            )}
          </Section>

          {/* Appears only when the cart contains diagnostic items. */}
          {totals.hasLabItems && (
            <Section number={3} title="Lab appointment">
              <AppointmentSection
                city={city}
                fastingHours={labFastingHours}
                testNames={labTestNames}
                errors={err}
              />
            </Section>
          )}

          {totals.hasPrescriptionItems && (
            <Section number={totals.hasLabItems ? 4 : 3} title="Prescription">
              <div className="rounded-md bg-amber-50 p-4">
                <p className="flex gap-2.5 text-body-sm text-amber-700">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    Your cart contains prescription-only medicine. A licensed pharmacist reviews
                    your prescription, usually within 30 minutes, before your order ships.
                  </span>
                </p>
              </div>

              <label
                htmlFor="prescription"
                className="mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed border-gray-200 p-8 text-center hover:border-blue-600 hover:bg-blue-50"
              >
                <span className="text-body-sm font-semibold text-gray-900">
                  {prescriptionName ?? 'Tap to upload or take a photo'}
                </span>
                <span className="text-body-sm text-gray-500">JPG, PNG or PDF, up to 10 MB</span>
                <input
                  id="prescription"
                  type="file"
                  accept="image/*,application/pdf"
                  capture="environment"
                  className="sr-only"
                  onChange={(e) => setPrescriptionName(e.target.files?.[0]?.name ?? null)}
                />
              </label>
              <p className="mt-2 text-body-sm text-gray-500">
                You can also send it on WhatsApp after ordering. We will call you either way.
              </p>
            </Section>
          )}

          <Section
            number={3 + (totals.hasLabItems ? 1 : 0) + (totals.hasPrescriptionItems ? 1 : 0)}
            title="Payment method"
          >
            <div className="flex flex-col gap-2.5">
              {PAYMENT_METHODS.map((option) => {
                const disabled = option.id === 'cod' && codUnavailable
                return (
                  <label
                    key={option.id}
                    className={cn(
                      'flex min-h-11 cursor-pointer items-center gap-3.5 rounded-sm border p-4 transition-colors duration-fast',
                      paymentMethod === option.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-400',
                      disabled && 'cursor-not-allowed opacity-60 hover:border-gray-200',
                    )}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={option.id}
                      checked={paymentMethod === option.id}
                      onChange={() => setPaymentMethod(option.id)}
                      disabled={disabled}
                      className="h-[18px] w-[18px] shrink-0 cursor-pointer border-gray-200 text-blue-600 focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-body-sm font-semibold text-gray-900">
                        {option.icon} {option.label}
                      </span>
                      <span className="block text-body-sm text-gray-500">
                        {disabled ? `Not available for delivery to ${city}` : option.detail}
                      </span>
                    </span>
                    {option.recommended && !disabled && <Badge tone="success">Most popular</Badge>}
                  </label>
                )
              })}
            </div>

            {err('paymentMethod') && (
              <p className="mt-2 text-body-sm text-red-600">{err('paymentMethod')}</p>
            )}

            {paymentMethod === 'bank_transfer' && (
              <p className="mt-4 rounded-sm bg-blue-50 p-3.5 text-body-sm text-blue-700">
                We will email you our bank details. Your order is prepared once the transfer
                clears, usually the same working day.
              </p>
            )}

            <Field label="Order notes" htmlFor="notes" className="mt-5" error={err('notes')}>
              <Textarea
                id="notes"
                name="notes"
                placeholder="Landmark, gate code, or a preferred delivery time"
              />
            </Field>
          </Section>
        </div>

        <aside aria-label="Order summary">
          <div className="lg:sticky lg:top-32">
            <div className="rounded-md border border-gray-200">
              <button
                type="button"
                onClick={() => setSummaryOpen((o) => !o)}
                aria-expanded={summaryOpen}
                className="flex w-full items-center justify-between gap-3 p-5 text-left lg:cursor-default"
              >
                <span className="text-h3">Order summary</span>
                <span className="tabular flex items-center gap-2 text-body font-bold text-gray-900">
                  {formatPrice(totals.totalPaisa)}
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 text-gray-400 transition-transform duration-fast lg:hidden',
                      summaryOpen && 'rotate-180',
                    )}
                    aria-hidden="true"
                  />
                </span>
              </button>

              <div className={cn('px-5 pb-5', !summaryOpen && 'hidden lg:block')}>
                <ul className="mb-4 flex flex-col gap-3 border-b border-gray-200 pb-4">
                  {cart.lines.map((line) => (
                    <li key={line.key} className="flex gap-3 text-body-sm">
                      <span className="text-xl" aria-hidden="true">
                        {line.entry?.icon ?? '📦'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-gray-900">{line.entry?.name}</p>
                        <p className="truncate text-gray-500">
                          {line.entry?.subtitle}
                          {line.kind === 'product' && ` × ${line.quantity}`}
                        </p>
                      </div>
                      <span className="tabular shrink-0 text-gray-900">
                        {formatPrice(line.lineSubtotalPaisa)}
                      </span>
                    </li>
                  ))}
                </ul>

                <dl className="tabular flex flex-col gap-2.5 text-body-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Subtotal</dt>
                    <dd className="text-gray-900">{formatPrice(totals.subtotalPaisa)}</dd>
                  </div>
                  {totals.discountPaisa > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Discount · {cart.coupon?.code}</dt>
                      <dd className="text-green-700">− {formatPrice(totals.discountPaisa)}</dd>
                    </div>
                  )}
                  {totals.taxPaisa > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Tax</dt>
                      <dd className="text-gray-900">{formatPrice(totals.taxPaisa)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Delivery</dt>
                    <dd className={totals.shippingPaisa === 0 ? 'text-green-700' : 'text-gray-900'}>
                      {!totals.hasPhysicalItems
                        ? 'Not required'
                        : totals.shippingPaisa === 0
                          ? 'Free'
                          : formatPrice(totals.shippingPaisa)}
                    </dd>
                  </div>
                  <div className="mt-2 flex justify-between border-t border-gray-200 pt-3 text-h3">
                    <dt className="text-gray-900">Total</dt>
                    <dd className="text-gray-900">{formatPrice(totals.totalPaisa)}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <PlaceOrderButton />

            <p className="mt-3 text-center text-body-sm text-gray-500">
              By placing this order you agree to our terms of service.
            </p>
          </div>
        </aside>
      </form>
    </div>
  )
}

/** Separate component so useFormStatus can read the enclosing form's state. */
function PlaceOrderButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" full loading={pending} className="mt-5">
      {pending ? 'Placing order' : 'Place order'}
    </Button>
  )
}

function Section({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-md border border-gray-200 p-5 md:p-6">
      <h2 className="mb-5 flex items-center gap-3 text-caption uppercase tracking-[0.07em] text-gray-500">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  )
}
