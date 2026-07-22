'use client'

import * as React from 'react'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Check, Circle, Lock, MapPin, PackageSearch, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Field, Input } from '@/components/ui/field'
import { Breadcrumbs, MediaPlaceholder } from '@/components/shared/primitives'
import { trackOrder, type TrackedOrderView } from '@/features/checkout/actions/track-order'
import { siteConfig } from '@/config/site'
import { cn, formatDateTime, formatPrice } from '@/lib/utils'

function TrackOrderContent() {
  const params = useSearchParams()
  const [orderNumber, setOrderNumber] = React.useState(params.get('order') ?? '')
  const [phone, setPhone] = React.useState('')
  const [order, setOrder] = React.useState<TrackedOrderView | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await trackOrder(orderNumber, phone)
      if (result.ok) {
        setOrder(result.order)
      } else {
        setOrder(null)
        setError(result.message)
      }
    })
  }

  return (
    <div className="container max-w-3xl py-8">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Track Order' }]} />

      <h1 className="text-h1">Track your order</h1>
      <p className="mt-2 text-body text-gray-500">
        Enter your order number and the mobile number you ordered with. Both are needed — it is
        what keeps your order details private.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-7 rounded-md border border-gray-200 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Order number" htmlFor="orderNumber" required>
            <Input
              id="orderNumber"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="HC-100001"
              autoComplete="off"
              className="tabular"
              aria-invalid={!!error}
            />
          </Field>
          <Field label="Mobile number" htmlFor="trackPhone" required>
            <Input
              id="trackPhone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="03001234567"
              autoComplete="tel"
              aria-invalid={!!error}
            />
          </Field>
        </div>

        {error && (
          <p role="alert" className="mt-3 flex items-start gap-1.5 text-body-sm text-red-600">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        <Button type="submit" loading={pending} className="mt-5">
          {pending ? 'Looking up order' : 'Track order'}
        </Button>
      </form>

      {order && (
        <section className="mt-8 animate-fade-in" aria-live="polite">
          <div className="rounded-md border border-gray-200">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-5">
              <div>
                <h2 className="tabular text-h3">{order.orderNumber}</h2>
                <p className="mt-0.5 text-body-sm text-gray-500">
                  Placed {formatDateTime(order.placedAt)} · {order.customerName}
                </p>
              </div>
              <Badge tone={order.status === 'delivered' ? 'success' : 'info'}>
                {order.statusLabel}
              </Badge>
            </div>

            <div className="border-b border-gray-200 bg-blue-50 p-5">
              <p className="text-[15px] font-semibold text-gray-900">
                Arriving {order.estimatedDelivery}
              </p>
              <p className="mt-1 flex items-start gap-1.5 text-body-sm text-gray-500">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {order.address}
              </p>
            </div>

            {order.requiresPrescription && (
              <div className="border-b border-gray-200 bg-amber-50 p-5">
                <p className="flex gap-2.5 text-body-sm text-amber-700">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    A licensed pharmacist is reviewing your prescription. We will call you if
                    anything needs clarifying, then dispatch.
                  </span>
                </p>
              </div>
            )}

            <div className="p-5">
              <h3 className="mb-5 text-caption uppercase tracking-[0.06em] text-gray-900">
                Progress
              </h3>
              <ol className="flex flex-col">
                {order.timeline.map((step, index) => {
                  const isLast = index === order.timeline.length - 1
                  return (
                    <li key={step.key} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <span
                          className={cn(
                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                            step.done ? 'bg-green-600 text-white' : 'border-2 border-gray-200 bg-white',
                          )}
                        >
                          {step.done ? (
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <Circle className="h-2 w-2 text-gray-400" aria-hidden="true" />
                          )}
                        </span>
                        {!isLast && (
                          <span
                            className={cn('w-0.5 flex-1', step.done ? 'bg-green-600' : 'bg-gray-200')}
                            aria-hidden="true"
                          />
                        )}
                      </div>
                      <div className={cn('pb-6', isLast && 'pb-0')}>
                        <p
                          className={cn(
                            'text-body-sm font-semibold',
                            step.done ? 'text-gray-900' : 'text-gray-400',
                          )}
                        >
                          {step.label}
                        </p>
                        <p className="mt-0.5 text-body-sm text-gray-500">
                          {step.at ? formatDateTime(step.at) : 'Pending'}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </div>

            <div className="border-t border-gray-200 p-5">
              <h3 className="mb-4 text-caption uppercase tracking-[0.06em] text-gray-900">Items</h3>
              <ul className="flex flex-col gap-3">
                {order.items.map((item, i) => (
                  <li key={`${item.name}-${i}`} className="flex items-center gap-3.5">
                    <MediaPlaceholder
                      icon={item.icon}
                      size="sm"
                      className="h-12 w-12 shrink-0 rounded-sm border border-gray-200"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-sm text-gray-900">{item.name}</p>
                      <p className="truncate text-body-sm text-gray-500">{item.subtitle}</p>
                    </div>
                    <span className="tabular text-body-sm text-gray-500">× {item.quantity}</span>
                  </li>
                ))}
              </ul>
              <div className="tabular mt-5 flex justify-between border-t border-gray-200 pt-4 text-h3">
                <span>Total</span>
                <span>{formatPrice(order.totalPaisa)}</span>
              </div>
              <p className="mt-2 text-body-sm text-gray-500">Paying by {order.paymentLabel.toLowerCase()}.</p>
            </div>
          </div>

          <p className="mt-5 flex items-center justify-center gap-2 text-body-sm text-gray-500">
            <Phone className="h-4 w-4" aria-hidden="true" />
            Something wrong? Call{' '}
            <a
              href={`tel:${siteConfig.phone.replace(/\s/g, '')}`}
              className="rounded-sm font-semibold text-blue-600 hover:underline"
            >
              {siteConfig.phone}
            </a>
          </p>
        </section>
      )}

      {!order && !error && (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-md border border-gray-200 px-6 py-14 text-center">
          <PackageSearch className="h-10 w-10 text-gray-400" aria-hidden="true" />
          <h2 className="text-h3">Your order status will appear here</h2>
          <p className="max-w-sm text-body text-gray-500">
            You will also get an SMS at every step, from confirmation through to delivery.
          </p>
        </div>
      )}
    </div>
  )
}

export default function TrackOrderPage() {
  return (
    <Suspense fallback={<div className="container py-8" />}>
      <TrackOrderContent />
    </Suspense>
  )
}
