import type { Metadata } from 'next'
import { getProducts } from '@/lib/data/queries'
import { WishlistGrid, type WishlistProduct } from '@/features/wishlist/wishlist-grid'

export const metadata: Metadata = { title: 'Wishlist' }
export const revalidate = 3600

/**
 * Wishlist lives in the browser (localStorage): the server sends the full
 * lightweight catalog summary, the client keeps only the saved items. No
 * account needed, nothing stored server-side.
 */
export default async function WishlistPage() {
  const products = await getProducts()
  const summaries: WishlistProduct[] = products.map((p) => {
    const variant = p.variants.find((v) => v.inStock) ?? p.variants[0]
    return {
      slug: p.slug,
      name: p.name,
      icon: p.icon,
      imageUrl: p.images?.[0]?.url,
      packSize: variant?.packSize ?? '',
      pricePaisa: variant?.pricePaisa ?? 0,
      compareAtPricePaisa: variant?.compareAtPricePaisa ?? null,
      inStock: p.variants.some((v) => v.inStock),
      variantId: variant?.id ?? '',
      requiresPrescription: p.requiresPrescription,
    }
  })

  return (
    <div className="container py-8">
      <h1 className="text-h1">Your wishlist</h1>
      <p className="mt-1 text-body text-gray-500">
        Saved on this device — no account needed.
      </p>
      <WishlistGrid products={summaries} />
    </div>
  )
}
