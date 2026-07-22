import type { Metadata } from 'next'
import { BadgePercent } from 'lucide-react'
import { Breadcrumbs } from '@/components/shared/primitives'
import { ProductCard, PackageCard } from '@/features/catalog/components/cards'
import { getHealthPackages, getProducts } from '@/lib/data/queries'

export const metadata: Metadata = {
  title: "Today's Offers",
  description: 'Discounted medicines and health packages — genuine stock, real savings.',
}
export const revalidate = 3600

/** Everything currently discounted (compare-at price above the live price). */
export default async function OffersPage() {
  const [products, packages] = await Promise.all([getProducts(), getHealthPackages()])
  const onSale = products.filter((p) =>
    p.variants.some((v) => v.compareAtPricePaisa && v.compareAtPricePaisa > v.pricePaisa),
  )
  const packagesOnSale = packages.filter(
    (p) => p.compareAtPricePaisa && p.compareAtPricePaisa > p.pricePaisa,
  )

  return (
    <div className="container py-8">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Offers' }]} />

      <div className="mt-4 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-md bg-green-50 text-green-700">
          <BadgePercent className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-h1">Today&rsquo;s offers</h1>
          <p className="text-body text-gray-500">
            {onSale.length + packagesOnSale.length} items on discount right now
          </p>
        </div>
      </div>

      {onSale.length === 0 && packagesOnSale.length === 0 ? (
        <p className="mt-10 rounded-lg border border-gray-200 bg-white p-10 text-center text-body text-gray-500">
          No active offers at the moment — check back soon.
        </p>
      ) : (
        <>
          {onSale.length > 0 && (
            <section className="mt-8" aria-label="Discounted medicines">
              <h2 className="text-h2">Medicines &amp; essentials</h2>
              <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {onSale.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          )}
          {packagesOnSale.length > 0 && (
            <section className="mt-10" aria-label="Discounted health packages">
              <h2 className="text-h2">Health packages</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {packagesOnSale.map((pkg) => (
                  <PackageCard key={pkg.id} pkg={pkg} testCount={pkg.includedTestSlugs.length} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
