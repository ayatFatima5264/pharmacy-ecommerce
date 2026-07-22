'use client'

import * as React from 'react'
import Link from 'next/link'
import { Eye, Heart, X } from 'lucide-react'
import { useWishlist } from '@/features/wishlist/use-wishlist'
import { AddToCart } from '@/features/cart/components/add-to-cart'
import { Price, RxBadge } from '@/components/shared/primitives'
import { cn } from '@/lib/utils'

/** Client-side card affordances: wishlist heart + quick-view dialog. */

export function WishlistHeart({ slug, className }: { slug: string; className?: string }) {
  const { has, toggle, hydrated } = useWishlist()
  const saved = hydrated && has(slug)
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        toggle(slug)
      }}
      aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
      aria-pressed={saved}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-full border bg-white shadow-e1 transition-all duration-fast',
        saved
          ? 'border-red-600/30 text-red-600'
          : 'border-gray-200 text-gray-400 hover:border-blue-600/40 hover:text-blue-600',
        className,
      )}
    >
      <Heart className={cn('h-4 w-4', saved && 'fill-current')} aria-hidden="true" />
    </button>
  )
}

export interface QuickViewData {
  slug: string
  name: string
  brandName: string
  packSize: string
  icon: string
  imageUrl?: string
  description: string
  pricePaisa: number
  compareAtPricePaisa: number | null
  requiresPrescription: boolean
  inStock: boolean
  variantId: string
}

export function QuickViewButton({ product }: { product: QuickViewData }) {
  const [open, setOpen] = React.useState(false)
  const closeRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          setOpen(true)
        }}
        aria-haspopup="dialog"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-e1 transition-all duration-fast hover:border-blue-600/40 hover:text-blue-600"
        aria-label={`Quick view: ${product.name}`}
      >
        <Eye className="h-4 w-4" aria-hidden="true" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
          <div
            className="absolute inset-0 animate-fade-in bg-gray-900/50"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={product.name}
            className="relative w-full max-w-md animate-slide-up rounded-t-lg bg-white p-6 shadow-e3 sm:rounded-lg"
          >
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close quick view"
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>

            <div className="flex items-start gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md bg-gray-50 text-4xl">
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.imageUrl} alt="" className="h-full w-full rounded-md object-cover" />
                ) : (
                  <span aria-hidden="true">{product.icon}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-caption uppercase tracking-[0.045em] text-gray-500">
                  {product.brandName}
                </p>
                <h2 className="mt-0.5 text-h3">{product.name}</h2>
                <p className="mt-0.5 text-body-sm text-gray-500">{product.packSize}</p>
              </div>
            </div>

            <p className="mt-3 line-clamp-3 text-body-sm text-gray-500">{product.description}</p>

            <div className="mt-4 flex items-center justify-between gap-3">
              <Price pricePaisa={product.pricePaisa} compareAtPaisa={product.compareAtPricePaisa} />
              {product.requiresPrescription && <RxBadge compact />}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <div className="flex-1">
                <AddToCart
                  disabled={!product.inStock}
                  item={{ kind: 'product', slug: product.slug, variantId: product.variantId }}
                />
              </div>
              <Link
                href={`/products/${product.slug}`}
                className="flex h-11 items-center rounded-md border border-gray-200 px-4 text-body-sm font-semibold text-gray-700 transition-colors duration-fast hover:border-blue-600 hover:text-blue-600"
              >
                Details
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
