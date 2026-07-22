import { ProductGridSkeleton } from '@/components/ui/skeleton'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Route-level fallback. Mirrors the common listing layout so the transition
 * reads as the page filling in rather than a blank screen.
 */
export default function Loading() {
  return (
    <div className="container py-8">
      <Skeleton className="mb-6 h-4 w-48" />
      <Skeleton className="mb-3 h-9 w-64" />
      <Skeleton className="mb-8 h-5 w-full max-w-xl" />
      <ProductGridSkeleton />
    </div>
  )
}
