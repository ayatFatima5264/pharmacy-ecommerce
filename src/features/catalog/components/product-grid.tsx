import Link from 'next/link'
import { PackageSearch } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/primitives'
import { ProductCard } from './cards'
import { cn } from '@/lib/utils'
import type { Product } from '@/types'

export function ProductGrid({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return (
      <EmptyState
        icon={<PackageSearch className="h-10 w-10" />}
        title="No products match these filters"
        description="Try removing a filter, or browse the full pharmacy catalogue."
        action={
          <Link href="/pharmacy" className={cn(buttonVariants({ variant: 'primary' }))}>
            Browse all medicines
          </Link>
        }
      />
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
