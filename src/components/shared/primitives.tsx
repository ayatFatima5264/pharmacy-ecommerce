import Link from 'next/link'
import { ChevronRight, Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn, discountPercent, formatPrice } from '@/lib/utils'

/**
 * Cross-feature display pieces. Anything used by only one feature belongs in
 * that feature's own components/ folder.
 */

/** Product imagery is not available in the dummy data phase; a tinted tile with
 *  the category glyph holds the exact aspect ratio a real image will occupy, so
 *  swapping in next/image later causes no layout shift. */
export function MediaPlaceholder({
  icon,
  className,
  size = 'md',
}: {
  icon: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const textSize = size === 'lg' ? 'text-6xl' : size === 'sm' ? 'text-2xl' : 'text-4xl'
  return (
    <div
      className={cn('flex items-center justify-center bg-gray-50', textSize, className)}
      aria-hidden="true"
    >
      {icon}
    </div>
  )
}

export function RxBadge({ compact = false }: { compact?: boolean }) {
  return (
    <Badge tone="rx">
      <Lock className="h-3 w-3" aria-hidden="true" />
      {compact ? 'Rx' : 'Rx required'}
    </Badge>
  )
}

export function Price({
  pricePaisa,
  compareAtPaisa,
  size = 'md',
  className,
}: {
  pricePaisa: number
  compareAtPaisa?: number | null
  size?: 'md' | 'lg'
  className?: string
}) {
  const percent = discountPercent(pricePaisa, compareAtPaisa ?? null)
  return (
    <div className={cn('tabular flex flex-wrap items-baseline gap-2', className)}>
      {/* Price is gray-900, never green — green is reserved for success states. */}
      <span className={cn('text-gray-900', size === 'lg' ? 'text-price-lg' : 'text-price')}>
        {formatPrice(pricePaisa)}
      </span>
      {percent !== null && (
        <>
          <span className="text-body-sm text-gray-400 line-through">
            {formatPrice(compareAtPaisa!)}
          </span>
          <Badge tone="sale">−{percent}%</Badge>
        </>
      )}
    </div>
  )
}

export function StockIndicator({ inStock, label }: { inStock: boolean; label?: string }) {
  return (
    <p
      className={cn(
        'flex items-center gap-2 text-body-sm',
        inStock ? 'text-green-700' : 'text-gray-500',
      )}
    >
      <span
        className={cn('h-[7px] w-[7px] shrink-0 rounded-full', inStock ? 'bg-green-600' : 'bg-gray-400')}
        aria-hidden="true"
      />
      {label ?? (inStock ? 'In stock' : 'Out of stock')}
    </p>
  )
}

export function SectionHeading({
  title,
  description,
  href,
  linkLabel = 'View all',
}: {
  title: string
  description?: string
  href?: string
  linkLabel?: string
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="text-h2">{title}</h2>
        {description && <p className="mt-1.5 max-w-2xl text-body text-gray-500">{description}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="flex shrink-0 items-center gap-1 rounded-sm text-body-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline"
        >
          {linkLabel}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  )
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex flex-wrap items-center gap-1.5 text-body-sm text-gray-500">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />}
            {item.href ? (
              <Link href={item.href} className="rounded-sm hover:text-blue-600 hover:underline">
                {item.label}
              </Link>
            ) : (
              <span className="text-gray-700" aria-current="page">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-gray-200 px-6 py-16 text-center">
      <div className="text-4xl text-gray-400" aria-hidden="true">
        {icon}
      </div>
      <h3 className="text-h3 text-gray-900">{title}</h3>
      <p className="max-w-sm text-body text-gray-500">{description}</p>
      {action && <div className="mt-2 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  )
}
