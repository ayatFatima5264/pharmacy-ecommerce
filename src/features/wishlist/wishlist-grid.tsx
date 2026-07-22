'use client'

import Link from 'next/link'
import { Heart } from 'lucide-react'
import { useWishlist } from './use-wishlist'
import { AddToCart } from '@/features/cart/components/add-to-cart'
import { Price, RxBadge } from '@/components/shared/primitives'

export interface WishlistProduct {
  slug: string
  name: string
  icon: string
  imageUrl?: string
  packSize: string
  pricePaisa: number
  compareAtPricePaisa: number | null
  inStock: boolean
  variantId: string
  requiresPrescription: boolean
}

export function WishlistGrid({ products }: { products: WishlistProduct[] }) {
  const { slugs, toggle, hydrated } = useWishlist()
  const saved = products.filter((p) => slugs.includes(p.slug))

  if (!hydrated) {
    return (
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-[3/4] animate-pulse rounded-md bg-gray-100" />
        ))}
      </div>
    )
  }

  if (saved.length === 0) {
    return (
      <div className="mt-8 rounded-lg border border-gray-200 bg-white p-10 text-center">
        <Heart className="mx-auto h-8 w-8 text-gray-300" aria-hidden="true" />
        <p className="mt-3 text-body font-semibold text-gray-900">Nothing saved yet</p>
        <p className="mt-1 text-body-sm text-gray-500">
          Tap the heart on any product to keep it here.
        </p>
        <Link
          href="/pharmacy"
          className="mt-5 inline-flex h-11 items-center rounded-md bg-blue-600 px-6 text-body-sm font-semibold text-white transition-colors duration-fast hover:bg-blue-700"
        >
          Browse medicines
        </Link>
      </div>
    )
  }

  return (
    <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {saved.map((product) => (
        <article
          key={product.slug}
          className="group relative flex flex-col overflow-hidden rounded-md border border-gray-200 bg-white transition-all duration-medium hover:-translate-y-0.5 hover:shadow-e2"
        >
          <Link href={`/products/${product.slug}`} className="relative block" tabIndex={-1}>
            <div className="flex aspect-square items-center justify-center bg-gray-50 text-5xl">
              {product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span aria-hidden="true">{product.icon}</span>
              )}
            </div>
            {product.requiresPrescription && (
              <span className="absolute left-2.5 top-2.5">
                <RxBadge compact />
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => toggle(product.slug)}
            aria-label={`Remove ${product.name} from wishlist`}
            className="absolute right-2.5 top-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-red-600/30 bg-white text-red-600 shadow-e1"
          >
            <Heart className="h-4 w-4 fill-current" aria-hidden="true" />
          </button>

          <div className="flex flex-1 flex-col gap-1.5 p-3.5">
            <h2 className="text-[15px] font-semibold leading-snug text-gray-900">
              <Link
                href={`/products/${product.slug}`}
                className="line-clamp-2 after:absolute after:inset-0 hover:text-blue-600"
              >
                {product.name}
              </Link>
            </h2>
            <p className="text-body-sm text-gray-500">{product.packSize}</p>
            <Price pricePaisa={product.pricePaisa} compareAtPaisa={product.compareAtPricePaisa} />
            <div className="relative z-10 mt-auto pt-2">
              <AddToCart
                disabled={!product.inStock}
                item={{ kind: 'product', slug: product.slug, variantId: product.variantId }}
              />
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}
