import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, ExternalLink } from 'lucide-react'
import { PageHeader, StatCard } from '@/components/admin/ui'
import { FlashBanner } from '@/components/admin/flash-banner'
import { ProductForm } from '@/features/catalog/components/product-form'
import { DeleteProduct } from '@/features/catalog/components/delete-product'
import { updateProduct } from '@/features/catalog/actions/product-actions'
import { getAdminBrands, getAdminCategories, getBatchRows } from '@/lib/data/admin-catalog'
import { findProduct } from '@/lib/data/store'
import { useDb } from '@/lib/data/source'
import { findProductDb } from '@/lib/data/db/admin-catalog-db'
import { formatPrice } from '@/lib/utils'

type Params = Promise<{ id: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params
  const product = useDb() ? await findProductDb(id) : findProduct(id)
  return { title: product ? `Edit ${product.name}` : 'Product not found' }
}

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { id } = await params
  const query = await searchParams

  const product = useDb() ? await findProductDb(id) : findProduct(id)
  if (!product) notFound()

  const brands = await getAdminBrands()
  const categories = await getAdminCategories()

  const batches = (await getBatchRows()).filter((b) => b.productId === product.id)
  const onHand = batches.reduce((sum, b) => sum + b.quantityOnHand, 0)
  const sellable = batches
    .filter((b) => b.state !== 'expired')
    .reduce((sum, b) => sum + b.available, 0)

  // Bind the product id so the action signature matches useActionState.
  const action = updateProduct.bind(null, product.id)

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/products"
          className="inline-flex items-center gap-1 rounded-sm text-[13px] font-semibold text-gray-500 hover:text-blue-600"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Back to products
        </Link>
        <Link
          href={`/products/${product.slug}`}
          className="inline-flex items-center gap-1.5 rounded-sm text-[13px] font-semibold text-blue-600 hover:underline"
        >
          View on storefront
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      <PageHeader title={product.name} description={`/products/${product.slug}`} />

      <FlashBanner params={query} messages={{ created: 'Product created. Add inventory next.' }} />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Pack sizes" value={String(product.variants.length)} />
        <StatCard label="Batches" value={String(batches.length)} />
        <StatCard
          label="Sellable units"
          value={sellable.toLocaleString('en-PK')}
          tone={sellable === 0 ? 'danger' : 'neutral'}
          hint={onHand !== sellable ? `${onHand.toLocaleString('en-PK')} on hand incl. expired` : undefined}
        />
        <StatCard label="Lowest price" value={formatPrice(Math.min(...product.variants.map((v) => v.pricePaisa)))} />
      </div>

      <ProductForm
        action={action}
        product={product}
        brands={brands}
        categories={categories}
        submitLabel="Save changes"
      />

      <section className="mt-8 border-t border-gray-200 pt-6">
        <h2 className="mb-1 text-[14px] font-bold text-gray-900">Danger zone</h2>
        <p className="mb-4 text-[13px] text-gray-500">
          Deleting removes the product and its {batches.length} inventory batch
          {batches.length === 1 ? '' : 'es'}.
        </p>
        <DeleteProduct productId={product.id} productName={product.name} stockOnHand={onHand} />
      </section>
    </>
  )
}
