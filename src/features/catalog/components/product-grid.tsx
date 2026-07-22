import Link from 'next/link'
import { PackageSearch } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/primitives'
import { DensityGrid } from './density-grid'
import { ProductCard } from './cards'
import { cn } from '@/lib/utils'
import type { Product } from '@/types'

export function ProductGrid({
  products,
  toolbar,
  controls,
}: {
  products: Product[]
  /** Results header row, left side (result count). */
  toolbar?: React.ReactNode
  /** Results header row, right side (sort control). */
  controls?: React.ReactNode
}) {
  if (products.length === 0) {
    return (
      <>
        {(toolbar || controls) && (
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="mr-auto">{toolbar}</div>
            {controls}
          </div>
        )}
        <EmptyState
          icon={<PackageSearch className="h-10 w-10" />}
          title="No products match these filters"
          description="Try removing a filter, or browse the full store catalogue."
          action={
            <Link href="/pharmacy" className={cn(buttonVariants({ variant: 'primary' }))}>
              Browse all medicines
            </Link>
          }
        />
      </>
    )
  }

  return (
    <DensityGrid toolbar={toolbar} controls={controls}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </DensityGrid>
  )
}
