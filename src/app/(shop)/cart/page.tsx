'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  AlertTriangle,
  Lock,
  MapPin,
  ShoppingCart,
  Trash2,
  Truck,
} from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Breadcrumbs, EmptyState, MediaPlaceholder } from '@/components/shared/primitives'
import { QuantityStepper } from '@/features/cart/components/add-to-cart'
import { useCart } from '@/features/cart/cart-context'
import { DELIVERY_CITY } from '@/config/locations'
import { cn, formatPrice } from '@/lib/utils'

export default function CartPage() {
  const cart = useCart()

  // Nothing renders from localStorage until after hydration, so server and
  // client HTML agree on the first paint.
  if (!cart.hydrated) {
    return (
      <div className="container py-8">
        <div className="h-64 animate-pulse rounded-md bg-gray-100" />
      </div>
    )
  }

  if (cart.lines.length === 0) {
    return (
      <div className="container py-8">
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Cart' }]} />
        <h1 className="mb-8 text-h1">Your cart</h1>
        <EmptyState
          icon={<ShoppingCart className="h-10 w-10" />}
          title="Your cart is empty"
          description="Browse medicines, or book a lab test with home sample collection."
          action={
            <>
              <Link href="/pharmacy" className={cn(buttonVariants({ variant: 'primary' }))}>
                Browse medicines
              </Link>
              <Link href="/lab-tests" className={cn(buttonVariants({ variant: 'secondary' }))}>
                Book a lab test
              </Link>
            </>
          }
        />
      </div>
    )
  }

  const { totals } = cart
  const problemLines = cart.lines.filter(
    (line) => line.issue?.type === 'unavailable' || line.issue?.type === 'out_of_stock',
  )
  const canCheckout = totals.itemCount > 0

  return (
    <div className="bg-gray-50">
      <div className="container py-8 md:py-10">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Cart' }]} />

      <h1 className="mb-8 text-h1">
        Your cart{' '}
        <span className="tabular text-gray-500">
          ({totals.itemCount} {totals.itemCount === 1 ? 'item' : 'items'})
        </span>
      </h1>

      {problemLines.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-md border border-red-600/20 bg-red-50 p-4" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
          <p className="flex-1 text-body-sm text-red-700">
            {problemLines.length} item{problemLines.length === 1 ? '' : 's'} in your cart{' '}
            {problemLines.length === 1 ? 'is' : 'are'} no longer available and will not be charged.
          </p>
          <Button variant="secondary" size="sm" onClick={cart.removeUnavailable}>
            Remove them
          </Button>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        <section aria-label="Cart items">
          <ul className="flex flex-col gap-4">
            {cart.lines.map((line) => {
              const entry = line.entry
              const unavailable =
                line.issue?.type === 'unavailable' || line.issue?.type === 'out_of_stock'

              return (
                <li
                  key={line.key}
                  className={cn(
                    'flex gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-e1 transition-shadow duration-medium hover:shadow-e2 sm:p-5',
                    unavailable && 'opacity-60',
                  )}
                >
                  <MediaPlaceholder
                    icon={entry?.icon ?? '📦'}
                    size="sm"
                    className="h-20 w-20 shrink-0 rounded-md border border-gray-200"
                  />

                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-[15px] font-semibold text-gray-900">
                          {entry ? (
                            <Link href={entry.href} className="rounded-sm hover:text-blue-600">
                              {entry.name}
                            </Link>
                          ) : (
                            'Item no longer available'
                          )}
                        </h2>
                        <p className="mt-0.5 text-body-sm text-gray-500">{entry?.subtitle}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => cart.remove(line.key)}
                        aria-label={`Remove ${entry?.name ?? 'item'} from cart`}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-gray-400 hover:bg-gray-100 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>

                    {entry?.requiresPrescription && (
                      <p className="flex items-center gap-1.5 text-body-sm text-amber-700">
                        <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        Prescription required — upload at checkout
                      </p>
                    )}

                    {/* Stock and availability problems are surfaced on the line
                        itself, one screen before checkout, where they are still
                        cheap to resolve. */}
                    {line.issue && (
                      <p
                        className={cn(
                          'flex items-center gap-1.5 text-body-sm',
                          unavailable ? 'text-red-600' : 'text-amber-700',
                        )}
                      >
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        {line.issue.message}
                      </p>
                    )}

                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-3">
                      {line.kind === 'product' && !unavailable ? (
                        <QuantityStepper
                          value={line.quantity}
                          onChange={(q) => cart.updateQuantity(line.key, q)}
                          min={0}
                          max={entry?.availableStock ?? 99}
                        />
                      ) : line.kind !== 'product' ? (
                        <Badge tone="info">1 booking</Badge>
                      ) : (
                        <span />
                      )}

                      <div className="tabular text-right">
                        <span className="text-price text-gray-900">
                          {formatPrice(line.lineSubtotalPaisa)}
                        </span>
                        {entry && line.quantity > 1 && (
                          <p className="text-body-sm text-gray-500">
                            {formatPrice(entry.unitPricePaisa)} each
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="mt-6">
            <Link href="/pharmacy" className={cn(buttonVariants({ variant: 'ghost' }))}>
              Continue shopping
            </Link>
          </div>
        </section>

        <aside aria-label="Order summary">
          <div className="flex flex-col gap-4 lg:sticky lg:top-32">
            {/* Delivery quote — Version 1 serves Lahore only, so there is
                nothing to choose; the estimate is always for Lahore. */}
            {totals.hasPhysicalItems && (
              <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-e1 md:p-6">
                <h2 className="mb-3 flex items-center gap-2 text-h3">
                  <Truck className="h-4 w-4 text-blue-600" aria-hidden="true" />
                  Delivery
                </h2>

                <p className="flex items-center gap-1.5 text-body-sm font-semibold text-gray-900">
                  <MapPin className="h-4 w-4 text-blue-600" aria-hidden="true" />
                  {DELIVERY_CITY}
                </p>
                <p className="mt-1 text-body-sm text-gray-500">
                  We currently deliver only within Lahore.
                </p>

                {totals.shipping && (
                  <div className="mt-3 rounded-sm bg-gray-50 p-3 text-body-sm">
                    <p className="font-semibold text-gray-900">{totals.shipping.zoneName}</p>
                    <p className="mt-0.5 text-gray-500">
                      {totals.shipping.carrier} ·{' '}
                      {totals.shipping.minDays === 0
                        ? 'Same day'
                        : `${totals.shipping.minDays}–${totals.shipping.maxDays} days`}
                    </p>
                    {!totals.shipping.supportsCod && (
                      <p className="mt-1.5 flex items-start gap-1.5 text-amber-700">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        Cash on delivery is not available for this area — payment is online only.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-e1 md:p-6">
              <h2 className="mb-4 text-h3">Order summary</h2>

              <dl className="tabular flex flex-col gap-2.5 text-body-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Subtotal</dt>
                  <dd className="text-gray-900">{formatPrice(totals.subtotalPaisa)}</dd>
                </div>

                {/* The tax row appears only when tax is actually charged. Showing
                    "Tax Rs 0" on every order is noise, but the engine computes
                    it per line at whatever rate the catalog carries. */}
                {totals.taxPaisa > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Tax</dt>
                    <dd className="text-gray-900">{formatPrice(totals.taxPaisa)}</dd>
                  </div>
                )}

                <div className="flex justify-between">
                  <dt className="text-gray-500">Delivery</dt>
                  <dd
                    className={
                      totals.shipping?.isFree || !totals.hasPhysicalItems
                        ? 'text-green-700'
                        : 'text-gray-900'
                    }
                  >
                    {!totals.hasPhysicalItems
                      ? 'Not required'
                      : !totals.shipping
                        ? 'Calculated at checkout'
                        : totals.shipping.isFree
                          ? 'Free'
                          : formatPrice(totals.shippingPaisa)}
                  </dd>
                </div>

                <div className="mt-2 flex justify-between border-t border-gray-200 pt-3 text-h3">
                  <dt className="text-gray-900">Total</dt>
                  <dd className="text-gray-900">{formatPrice(totals.totalPaisa)}</dd>
                </div>
              </dl>

              <Link
                href="/checkout"
                aria-disabled={!canCheckout}
                onClick={(e) => {
                  if (!canCheckout) e.preventDefault()
                }}
                className={cn(
                  buttonVariants({ variant: 'primary', size: 'lg', full: true }),
                  'mt-5',
                  !canCheckout && 'pointer-events-none bg-gray-100 text-gray-400',
                )}
              >
                Proceed to checkout
              </Link>

              {totals.hasPrescriptionItems && (
                <p className="mt-3 flex gap-2 text-body-sm text-amber-700">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Your cart contains prescription items. You will be asked to upload a
                  prescription at checkout.
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>
      </div>
    </div>
  )
}
