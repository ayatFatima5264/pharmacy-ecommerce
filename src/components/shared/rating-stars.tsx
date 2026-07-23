import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Read-only star row. Matches the testimonial stars on the home page (green,
 * fill-current) so ratings read as one system across the store.
 *
 * Fractional averages render via a clipped overlay — 4.3 shows 4.3 stars, not
 * a rounded 4 — and the accessible name always carries the exact number.
 */
export function RatingStars({
  rating,
  size = 'sm',
  className,
}: {
  rating: number
  size?: 'sm' | 'md'
  className?: string
}) {
  const clamped = Math.max(0, Math.min(5, rating))
  const starClass = size === 'md' ? 'h-[18px] w-[18px]' : 'h-3.5 w-3.5'

  return (
    <span
      className={cn('relative inline-flex shrink-0', className)}
      role="img"
      aria-label={`${clamped} out of 5 stars`}
    >
      <span className="flex gap-0.5 text-gray-300" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} className={cn(starClass, 'fill-current')} />
        ))}
      </span>
      <span
        className="absolute inset-0 flex gap-0.5 overflow-hidden text-green-600"
        style={{ width: `${(clamped / 5) * 100}%` }}
        aria-hidden="true"
      >
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} className={cn(starClass, 'shrink-0 fill-current')} />
        ))}
      </span>
    </span>
  )
}
