import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { PageHeader } from '@/components/admin/ui'
import { ProductForm } from '@/features/catalog/components/product-form'
import { createProduct } from '@/features/catalog/actions/product-actions'
import { getAdminBrands, getAdminCategories } from '@/lib/data/admin-catalog'

export const metadata = { title: 'Add product' }

export default async function NewProductPage() {
  const brands = await getAdminBrands()
  const categories = await getAdminCategories()

  return (
    <>
      <Link
        href="/admin/products"
        className="mb-4 inline-flex items-center gap-1 rounded-sm text-[13px] font-semibold text-gray-500 hover:text-blue-600"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back to products
      </Link>

      <PageHeader
        title="Add product"
        description="Pack sizes carry their own price and SKU. At least one is required."
      />

      {brands.length === 0 || categories.length === 0 ? (
        <div className="rounded-md border border-gray-200 bg-white p-8 text-center">
          <p className="text-[14px] font-semibold text-gray-900">
            Add a brand and a category first
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] text-gray-500">
            Every product must belong to a brand and at least one category, so those need to exist
            before a product can be created.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Link
              href="/admin/brands"
              className="inline-flex h-9 items-center rounded-sm bg-blue-600 px-4 text-[13.5px] font-semibold text-white hover:bg-blue-700"
            >
              Manage brands
            </Link>
            <Link
              href="/admin/categories"
              className="inline-flex h-9 items-center rounded-sm border border-gray-200 bg-white px-4 text-[13.5px] font-semibold text-gray-700 hover:bg-gray-50"
            >
              Manage categories
            </Link>
          </div>
        </div>
      ) : (
        <ProductForm
          action={createProduct}
          brands={brands}
          categories={categories}
          submitLabel="Create product"
        />
      )}
    </>
  )
}
