import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Check, Landmark, Lock, Mail, MapPin, Microscope, Truck, Utensils } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { findOrderByNumber } from '@/lib/data/orders-store'
import { findBookingsByOrder } from '@/lib/data/lab-store'
import { BANK_DETAILS, PAYMENT_METHODS } from '@/config/locations'
import { siteConfig } from '@/config/site'
import { cn, formatDate, formatPrice } from '@/lib/utils'

export const metadata = {
  title: 'Order confirmed',
  robots: { index: false, follow: false },
}

type SearchParams = Promise<{ order?: string }>

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { order: orderNumber } = await searchParams
  if (!orderNumber) notFound()

  const order = findOrderByNumber(orderNumber)
  // The in-memory store does not survive a restart, so a valid-looking number
  // may legitimately not resolve. Say so plainly rather than 404-ing someone
  // who just paid.
  if (!order) {
    return (
      <div className="container max-w-2xl py-16 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-600">
          <Check className="h-8 w-8" aria-hidden="true" />
        </span>
        <h1 className="mt-6 text-h1">Order placed</h1>
        <p className="tabular mt-2 text-body text-gray-500">Order {orderNumber}</p>
        <p className="mx-auto mt-4 max-w-md text-body text-gray-500">
          We could not load the full details of this order right now, but it has been placed.
          Call us on {siteConfig.phone} and quote your order number if you need anything.
        </p>
        <Link
          href="/pharmacy"
          className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'mt-8')}
        >
          Continue shopping
        </Link>
      </div>
    )
  }

  const method = PAYMENT_METHODS.find((m) => m.id === order.paymentMethod)
  const bookings = findBookingsByOrder(order.orderNumber)

  return (
    <div className="container max-w-2xl py-16">
      <div className="text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-600">
          <Check className="h-8 w-8" aria-hidden="true" />
        </span>

        <h1 className="mt-6 text-h1">Order confirmed</h1>
        <p className="tabular mt-2 text-body text-gray-500">Order {order.orderNumber}</p>
        <p className="mx-auto mt-4 max-w-md text-body text-gray-500">
          Thanks {order.firstName} — we have your order and will send updates to {order.phone}.
        </p>
      </div>

      {/* Each fulfilment path is confirmed separately: one order can carry two
          different promises. */}
      <div className="mt-9 flex flex-col gap-px overflow-hidden rounded-md border border-gray-200 bg-gray-200 text-left">
        <div className="flex items-start gap-4 bg-blue-50 p-5">
          <Truck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
          <div>
            <h2 className="text-[15px] font-semibold text-gray-900">
              Arriving {order.estimatedDeliveryFrom} – {order.estimatedDeliveryTo}
            </h2>
            <p className="mt-1 flex items-start gap-1.5 text-body-sm text-gray-500">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {order.address}, {order.city}, {order.province}
              {order.postalCode ? ` ${order.postalCode}` : ''}
            </p>
          </div>
        </div>

        {bookings.map((booking) => (
          <div key={booking.id} className="flex items-start gap-4 bg-white p-5">
            <Microscope className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[15px] font-semibold text-gray-900">Lab appointment</h2>
                <span className="tabular text-body-sm text-gray-500">{booking.bookingNumber}</span>
              </div>
              <p className="mt-1 text-body-sm text-gray-900">
                {formatDate(booking.slotDate)} · {booking.slotLabel}
              </p>
              <p className="mt-1 text-body-sm text-gray-500">
                {booking.collectionMode === 'home'
                  ? `Home collection for ${booking.patientName} (${booking.patientAge})`
                  : `Lab visit — ${booking.labName}, ${booking.city}`}
              </p>
              <p className="mt-1.5 text-body-sm text-gray-500">
                {booking.tests.length} {booking.tests.length === 1 ? 'test' : 'tests'}:{' '}
                {booking.tests.map((t) => t.shortCode).join(', ')}
              </p>
              {booking.fastingHours !== null && (
                <p className="mt-2 flex items-start gap-1.5 rounded-sm bg-amber-50 p-2.5 text-body-sm text-amber-700">
                  <Utensils className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Fast for {booking.fastingHours} hours before your appointment — water is fine.
                </p>
              )}
            </div>
          </div>
        ))}

        {order.requiresPrescription && (
          <div className="flex items-start gap-4 bg-amber-50 p-5">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
            <div>
              <h2 className="text-[15px] font-semibold text-amber-700">Prescription review</h2>
              <p className="mt-1 text-body-sm text-amber-700/90">
                Your order contains prescription-only medicine. A licensed pharmacist reviews it
                before dispatch — usually within 30 minutes. We will call if anything needs
                clarifying.
              </p>
            </div>
          </div>
        )}

        {order.paymentMethod === 'bank_transfer' && (
          <div className="flex items-start gap-4 bg-white p-5">
            <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-gray-900">Transfer the amount</h2>
              <dl className="tabular mt-2 flex flex-col gap-1 text-body-sm text-gray-500">
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0">Bank</dt>
                  <dd className="text-gray-900">{BANK_DETAILS.bankName}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0">Title</dt>
                  <dd className="text-gray-900">{BANK_DETAILS.accountTitle}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0">Account</dt>
                  <dd className="text-gray-900">{BANK_DETAILS.accountNumber}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0">IBAN</dt>
                  <dd className="break-all text-gray-900">{BANK_DETAILS.iban}</dd>
                </div>
              </dl>
              <p className="mt-2.5 text-body-sm text-gray-500">
                Send the receipt to {siteConfig.email} quoting {order.orderNumber}. We dispatch
                once it clears.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Order summary */}
      <div className="mt-6 rounded-md border border-gray-200 p-5">
        <h2 className="mb-4 text-h3">Order summary</h2>
        <ul className="flex flex-col gap-3 border-b border-gray-200 pb-4">
          {order.items.map((item) => (
            <li key={`${item.kind}-${item.slug}-${item.variantId ?? ''}`} className="flex gap-3 text-body-sm">
              <span className="text-xl" aria-hidden="true">
                {item.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-gray-900">{item.name}</p>
                <p className="truncate text-gray-500">
                  {item.subtitle}
                  {item.kind === 'product' && ` × ${item.quantity}`}
                </p>
              </div>
              <span className="tabular shrink-0 text-gray-900">
                {formatPrice(item.lineTotalPaisa)}
              </span>
            </li>
          ))}
        </ul>

        <dl className="tabular mt-4 flex flex-col gap-2.5 text-body-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Subtotal</dt>
            <dd className="text-gray-900">{formatPrice(order.subtotalPaisa)}</dd>
          </div>
          {order.discountPaisa > 0 && (
            <div className="flex justify-between">
              <dt className="text-gray-500">Discount · {order.couponCode}</dt>
              <dd className="text-green-700">− {formatPrice(order.discountPaisa)}</dd>
            </div>
          )}
          {order.taxPaisa > 0 && (
            <div className="flex justify-between">
              <dt className="text-gray-500">Tax</dt>
              <dd className="text-gray-900">{formatPrice(order.taxPaisa)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-gray-500">Delivery</dt>
            <dd className={order.shippingPaisa === 0 ? 'text-green-700' : 'text-gray-900'}>
              {order.shippingPaisa === 0 ? 'Free' : formatPrice(order.shippingPaisa)}
            </dd>
          </div>
          <div className="mt-2 flex justify-between border-t border-gray-200 pt-3 text-h3">
            <dt className="text-gray-900">Total</dt>
            <dd className="text-gray-900">{formatPrice(order.totalPaisa)}</dd>
          </div>
        </dl>

        <p className="mt-4 text-body-sm text-gray-500">
          Paying by {method?.label.toLowerCase() ?? order.paymentMethod}.
        </p>

        {order.email && (
          <p className="mt-3 flex items-start gap-2 text-body-sm text-gray-500">
            <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {order.emailStatus === 'sent'
              ? `A confirmation has been sent to ${order.email}.`
              : `We could not email ${order.email} just now — your order is confirmed regardless, and we will call you.`}
          </p>
        )}
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href={`/track-order?order=${encodeURIComponent(order.orderNumber)}`}
          className={cn(buttonVariants({ variant: 'primary', size: 'lg' }))}
        >
          Track order
        </Link>
        <Link href="/pharmacy" className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }))}>
          Continue shopping
        </Link>
      </div>

      <p className="mt-8 text-center text-body-sm text-gray-500">
        Questions? Call{' '}
        <a
          href={`tel:${siteConfig.phone.replace(/\s/g, '')}`}
          className="rounded-sm font-semibold text-blue-600 hover:underline"
        >
          {siteConfig.phone}
        </a>
      </p>
    </div>
  )
}
