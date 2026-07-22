import Link from 'next/link'
import { Clock, Droplet, Utensils } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { MediaPlaceholder, Price, RxBadge, StockIndicator } from '@/components/shared/primitives'
import { AddToCart } from '@/features/cart/components/add-to-cart'
import { QuickViewButton, WishlistHeart } from './card-extras'
import { defaultVariant, getBrandName, isInStock } from '@/lib/data/queries'
import { turnaroundLabel } from '@/lib/utils'
import type { HealthPackage, LabTest, Product } from '@/types'

/**
 * Fixed 1:1 media and a two-line title clamp keep every card the same height,
 * which is what stops the grid reflowing as content loads — the main source of
 * layout shift on listing pages.
 *
 * Hover: a soft lift (shadow + translate) plus wishlist/quick-view controls
 * fading in — visible on touch devices where hover does not exist.
 */
export function ProductCard({ product }: { product: Product }) {
  const variant = defaultVariant(product)
  const stocked = isInStock(product)
  const brandName = getBrandName(product.brandId)
  const imageUrl = product.images?.[0]?.url
  const discount =
    variant.compareAtPricePaisa && variant.compareAtPricePaisa > variant.pricePaisa
      ? Math.round(
          ((variant.compareAtPricePaisa - variant.pricePaisa) / variant.compareAtPricePaisa) * 100,
        )
      : 0

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-md border border-gray-200 bg-white transition-all duration-medium hover:-translate-y-0.5 hover:border-blue-600/25 hover:shadow-e2">
      <Link href={`/products/${product.slug}`} className="relative block" tabIndex={-1} aria-hidden="true">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            className="aspect-square w-full object-cover transition-transform duration-slow group-hover:scale-[1.03]"
          />
        ) : (
          <MediaPlaceholder icon={product.icon} className="aspect-square" />
        )}
        <span className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
          {discount > 0 && (
            <span className="rounded-full bg-green-600 px-2 py-0.5 text-[11px] font-bold text-white">
              {discount}% OFF
            </span>
          )}
          {product.requiresPrescription && <RxBadge compact />}
        </span>
      </Link>

      {/* Card controls: fade in on hover, always reachable on touch. */}
      <span className="absolute right-2.5 top-2.5 z-10 flex flex-col gap-1.5 opacity-100 transition-opacity duration-medium md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
        <WishlistHeart slug={product.slug} />
        <QuickViewButton
          product={{
            slug: product.slug,
            name: product.name,
            brandName,
            packSize: variant.packSize,
            icon: product.icon,
            imageUrl,
            description: product.shortDescription,
            pricePaisa: variant.pricePaisa,
            compareAtPricePaisa: variant.compareAtPricePaisa,
            requiresPrescription: product.requiresPrescription,
            inStock: stocked,
            variantId: variant.id,
          }}
        />
      </span>

      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <p className="text-caption uppercase tracking-[0.045em] text-gray-500">{brandName}</p>

        <h3 className="text-[15px] font-semibold leading-snug text-gray-900">
          <Link
            href={`/products/${product.slug}`}
            className="line-clamp-2 rounded-sm after:absolute after:inset-0 hover:text-blue-600"
          >
            {product.name}
          </Link>
        </h3>

        <p className="line-clamp-2 text-body-sm text-gray-500">
          {product.genericName ?? product.shortDescription}
          {variant.packSize ? ` · ${variant.packSize}` : ''}
        </p>

        <Price
          pricePaisa={variant.pricePaisa}
          compareAtPaisa={variant.compareAtPricePaisa}
          className="mt-0.5"
        />

        <StockIndicator inStock={stocked} />

        <div className="relative z-10 mt-auto pt-2">
          <AddToCart
            disabled={!stocked}
            item={{ kind: 'product', slug: product.slug, variantId: variant.id }}
          />
        </div>
      </div>
    </article>
  )
}

export function LabTestCard({ test }: { test: LabTest }) {
  return (
    <article className="group relative flex flex-col gap-2.5 rounded-md border border-gray-200 bg-white p-5 transition-shadow duration-fast hover:shadow-e1">
      <div className="flex items-start justify-between gap-3">
        <Badge tone="info">{test.shortCode}</Badge>
        {test.fastingRequired ? (
          <Badge tone="rx">
            <Utensils className="h-3 w-3" aria-hidden="true" />
            {test.fastingHours}h fasting
          </Badge>
        ) : (
          <Badge tone="success">No fasting</Badge>
        )}
      </div>

      <h3 className="text-h3">
        <Link href={`/lab-tests/${test.slug}`} className="rounded-sm after:absolute after:inset-0 hover:text-blue-600">
          {test.name}
        </Link>
      </h3>

      <p className="line-clamp-2 text-body-sm text-gray-500">{test.description}</p>

      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-body-sm text-gray-500">
        <div className="flex items-center gap-1.5">
          <Droplet className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
          <dt className="sr-only">Sample</dt>
          <dd>{test.sampleType}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
          <dt className="sr-only">Turnaround</dt>
          <dd>{turnaroundLabel(test.turnaroundHours)}</dd>
        </div>
      </dl>

      <p className="text-body-sm text-gray-500">{test.labName}</p>

      <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-2">
        <Price pricePaisa={test.pricePaisa} compareAtPaisa={test.compareAtPricePaisa} />
        <div className="relative z-10">
          <AddToCart full={false} label="Book test" item={{ kind: 'test', slug: test.slug }} />
        </div>
      </div>
    </article>
  )
}

export function PackageCard({ pkg, testCount }: { pkg: HealthPackage; testCount: number }) {
  const saving = pkg.compareAtPricePaisa ? pkg.compareAtPricePaisa - pkg.pricePaisa : 0

  return (
    <article className="group relative flex flex-col gap-3 overflow-hidden rounded-md border border-gray-200 bg-white transition-shadow duration-fast hover:shadow-e1">
      <MediaPlaceholder icon={pkg.icon} className="aspect-[16/7]" />

      <div className="flex flex-1 flex-col gap-2.5 px-5 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info">{testCount} tests included</Badge>
          {saving > 0 && <Badge tone="success">Save {Math.round((saving / pkg.compareAtPricePaisa!) * 100)}%</Badge>}
        </div>

        <h3 className="text-h3">
          <Link
            href={`/health-packages/${pkg.slug}`}
            className="rounded-sm after:absolute after:inset-0 hover:text-blue-600"
          >
            {pkg.name}
          </Link>
        </h3>

        <p className="line-clamp-2 text-body-sm text-gray-500">{pkg.description}</p>

        <p className="text-body-sm text-gray-500">
          {pkg.labName} · {pkg.suitableFor}
          {pkg.fastingRequired ? ' · Fasting required' : ''}
        </p>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-2">
          <Price pricePaisa={pkg.pricePaisa} compareAtPaisa={pkg.compareAtPricePaisa} />
          <div className="relative z-10">
            <AddToCart full={false} label="Book package" item={{ kind: 'package', slug: pkg.slug }} />
          </div>
        </div>
      </div>
    </article>
  )
}
