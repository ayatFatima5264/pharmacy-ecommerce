'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Lock, RotateCcw, ShieldCheck, Truck, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Price, RxBadge, StockIndicator } from '@/components/shared/primitives'
import { RatingStars } from '@/components/shared/rating-stars'
import { AddToCart, QuantityStepper } from '@/features/cart/components/add-to-cart'
import { useCart } from '@/features/cart/cart-context'
import { cn, deliveryEstimate, formatUnitPrice } from '@/lib/utils'
import type { Product } from '@/types'

/**
 * "Buy now" is the same add call the cart button makes — identity plus
 * quantity — followed by a straight jump to checkout. One tap for the customer
 * who already knows what they came for.
 */
function BuyNowButton({
  item,
  quantity,
  disabled,
}: {
  item: { kind: 'product'; slug: string; variantId: string }
  quantity: number
  disabled?: boolean
}) {
  const { add } = useCart()
  const router = useRouter()
  const [pending, setPending] = React.useState(false)

  function handleBuyNow() {
    add(item, quantity)
    setPending(true)
    router.push('/checkout')
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="lg"
      full
      disabled={disabled}
      loading={pending}
      onClick={handleBuyNow}
    >
      <Zap className="h-4 w-4" aria-hidden="true" />
      Buy now
    </Button>
  )
}

/**
 * The buy box owns variant selection, quantity, and add-to-cart.
 *
 * It is the only client surface on the PDP besides the gallery and tabs — the
 * description content and related products all stay server-rendered.
 */
export function BuyBox({ product, brandName }: { product: Product; brandName: string }) {
  const firstAvailable = product.variants.find((v) => v.inStock) ?? product.variants[0]
  const [variantId, setVariantId] = React.useState(firstAvailable.id)
  const [quantity, setQuantity] = React.useState(1)

  const variant = product.variants.find((v) => v.id === variantId) ?? firstAvailable
  const unitPrice = formatUnitPrice(variant.pricePaisa, variant.unitsPerPack)

  const item = { kind: 'product' as const, slug: product.slug, variantId: variant.id }

  return (
    <div className="flex flex-col gap-5 rounded-lg border border-gray-200 bg-white p-6 shadow-e1 md:p-7">
      <div>
        <div className="flex flex-wrap items-center gap-2.5">
          <p className="text-caption uppercase tracking-[0.045em] text-gray-500">{brandName}</p>
          {product.requiresPrescription && <RxBadge />}
        </div>
        <h1 className="mt-2 text-h1">{product.name}</h1>
        {/* Generic name sits directly under the trade name — many customers
            arrive holding a note that lists a molecule, not a brand. */}
        {product.genericName && (
          <p className="mt-1.5 text-body text-gray-500">{product.genericName}</p>
        )}
        {/* Aggregate rating links to the reviews section further down. */}
        {product.rating && product.rating.count > 0 && (
          <a
            href="#reviews"
            className="mt-2.5 flex w-fit items-center gap-1.5 rounded-sm text-body-sm text-gray-500 transition-colors duration-fast hover:text-blue-600"
          >
            <RatingStars rating={product.rating.average} />
            <span className="font-semibold text-gray-900">{product.rating.average.toFixed(1)}</span>
            <span>
              ({product.rating.count} review{product.rating.count === 1 ? '' : 's'})
            </span>
          </a>
        )}
      </div>

      <div className="rounded-md bg-blue-50/70 p-4">
        <Price pricePaisa={variant.pricePaisa} compareAtPaisa={variant.compareAtPricePaisa} size="lg" />
        {unitPrice && <p className="mt-1 text-body-sm text-gray-500">{unitPrice}</p>}
      </div>

      {product.variants.length > 1 && (
        <fieldset>
          <legend className="mb-2.5 text-body-sm font-semibold text-gray-700">Pack size</legend>
          <div className="flex flex-wrap gap-2.5">
            {product.variants.map((v) => {
              const selected = v.id === variantId
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVariantId(v.id)}
                  disabled={!v.inStock}
                  aria-pressed={selected}
                  className={cn(
                    'min-h-11 rounded-sm border px-4 py-2 text-body-sm font-semibold transition-colors duration-fast',
                    selected
                      ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                      : 'border-gray-200 text-gray-700 hover:border-gray-400',
                    !v.inStock && 'cursor-not-allowed border-gray-200 text-gray-400 line-through hover:border-gray-200',
                  )}
                >
                  {v.packSize}
                </button>
              )
            })}
          </div>
        </fieldset>
      )}

      <StockIndicator
        inStock={variant.inStock}
        label={variant.inStock ? `In stock · Delivery by ${deliveryEstimate(2)}` : 'Out of stock'}
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {variant.inStock && (
            <QuantityStepper value={quantity} onChange={setQuantity} max={10} />
          )}
          <div className="min-w-[200px] flex-1">
            <AddToCart
              item={item}
              quantity={quantity}
              disabled={!variant.inStock}
              variant="primary"
              size="lg"
              label={product.requiresPrescription ? 'Add — prescription required' : 'Add to cart'}
            />
          </div>
        </div>
        {variant.inStock && <BuyNowButton item={item} quantity={quantity} />}
      </div>

      {/* The requirement is disclosed here, not sprung at checkout. */}
      {product.requiresPrescription && (
        <div className="flex gap-3 rounded-md bg-amber-50 p-4 text-body-sm text-amber-700">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            <strong className="font-semibold">Prescription needed.</strong> Upload it during
            checkout and a licensed pharmacist will review it, usually within 30 minutes. Your
            order ships as soon as it clears.
          </p>
        </div>
      )}

      <ul className="flex flex-col gap-2.5 border-t border-gray-200 pt-5 text-body-sm text-gray-500">
        <li className="flex items-center gap-2.5">
          <Truck className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
          Fast delivery across Lahore
        </li>
        <li className="flex items-center gap-2.5">
          <RotateCcw className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
          7-day returns on sealed, unopened items
        </li>
        <li className="flex items-center gap-2.5">
          <ShieldCheck className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
          Genuine stock with batch and expiry tracking
        </li>
      </ul>
    </div>
  )
}

/**
 * Mobile sticky buy bar — appears once the main buy box scrolls out of view.
 * On a long PDP the purchase action should never be more than a thumb away.
 */
export function StickyBuyBar({ product }: { product: Product }) {
  const variant = product.variants.find((v) => v.inStock) ?? product.variants[0]
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    const sentinel = document.getElementById('buy-box-sentinel')
    if (!sentinel) return
    const observer = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting), {
      rootMargin: '-80px 0px 0px 0px',
    })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  if (!visible) return null

  return (
    <div className="fixed inset-x-0 bottom-14 z-40 animate-slide-up border-t border-gray-200 bg-white p-3 shadow-e3 md:hidden">
      <div className="flex items-center gap-3">
        <div className="min-w-0">
          <p className="truncate text-caption text-gray-500">{variant.packSize}</p>
          <Price pricePaisa={variant.pricePaisa} />
        </div>
        <div className="ml-auto min-w-[150px]">
          <AddToCart
            variant="primary"
            disabled={!variant.inStock}
            label="Add to cart"
            item={{ kind: 'product', slug: product.slug, variantId: variant.id }}
          />
        </div>
      </div>
    </div>
  )
}
