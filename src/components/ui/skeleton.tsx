import { cn } from '@/lib/utils'

/**
 * Skeletons match the final layout's dimensions so nothing jumps when content
 * arrives. A centred spinner gives no layout hint and reads slower even when
 * it is not.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-sm bg-gray-100', className)} {...props} />
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-md border border-gray-200">
      <Skeleton className="aspect-square rounded-none" />
      <div className="flex flex-col gap-2 p-3.5">
        <Skeleton className="h-3 w-2/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-3/5" />
        <Skeleton className="mt-1 h-6 w-1/3" />
        <Skeleton className="mt-1.5 h-11 w-full rounded-md" />
      </div>
    </div>
  )
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}
