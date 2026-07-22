import Link from 'next/link'
import { ExternalLink, Pencil, Plus } from 'lucide-react'
import { PageHeader, SeverityStripe, StatCard, StatusPill } from '@/components/admin/ui'
import { DataTable, type Column } from '@/components/admin/data-table'
import { FilterBar } from '@/components/admin/filter-bar'
import { Pagination } from '@/components/admin/pagination'
import { FlashBanner } from '@/components/admin/flash-banner'
import {
  LOW_STOCK_THRESHOLD,
  getAdminBrands,
  getAdminCategories,
  getAdminProducts,
  type AdminProductRow,
} from '@/lib/data/admin-catalog'
import { matchesQuery, paginate, param, parsePage } from '@/lib/data/paginate'
import { discountPercent, formatPrice } from '@/lib/utils'

export const metadata = { title: 'Products' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function AdminProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams

  const products = await getAdminProducts()
  const categories = await getAdminCategories()
  const brands = await getAdminBrands()

  const query = param(params, 'q')
  const category = param(params, 'category')
  const brand = param(params, 'brand')
  const rx = param(params, 'rx')
  const stock = param(params, 'stock')

  const filtered = products.filter((product) => {
    if (!matchesQuery(product, query, ['name', 'sku', 'brandName'])) return false
    if (category && !product.categorySlugs.includes(category)) return false
    if (brand && product.brandId !== brand) return false
    if (rx === 'yes' && !product.requiresPrescription) return false
    if (rx === 'no' && product.requiresPrescription) return false
    if (stock === 'out' && product.stock > 0) return false
    if (stock === 'low' && (product.stock === 0 || product.stock >= LOW_STOCK_THRESHOLD)) return false
    if (stock === 'sale' && product.compareAtPricePaisa === null) return false
    return true
  })

  const result = paginate(filtered, parsePage(params.page))

  const outOfStock = products.filter((p) => p.stock === 0).length
  const lowStock = products.filter((p) => p.stock > 0 && p.stock < LOW_STOCK_THRESHOLD).length
  const onSale = products.filter((p) => p.compareAtPricePaisa !== null).length

  const columns: Column<AdminProductRow>[] = [
    {
      key: 'name',
      header: 'Product',
      primary: true,
      cell: (product) => (
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-gray-50 text-lg"
            aria-hidden="true"
          >
            {product.icon}
          </span>
          <div className="min-w-0">
            <Link
              href={`/admin/products/${product.id}/edit`}
              className="block truncate rounded-sm font-semibold text-gray-900 hover:text-blue-600 hover:underline"
            >
              {product.name}
            </Link>
            <p className="tabular truncate text-[12.5px] text-gray-500">
              {product.sku}
              {product.variantCount > 1 && ` · ${product.variantCount} pack sizes`}
              {product.imageCount > 0 && ` · ${product.imageCount} images`}
            </p>
          </div>
        </div>
      ),
    },
    { key: 'brand', header: 'Brand', cell: (p) => p.brandName, hideOnMobile: true },
    { key: 'category', header: 'Category', cell: (p) => p.categoryName },
    {
      key: 'rx',
      header: 'Type',
      cell: (product) =>
        product.requiresPrescription ? (
          <StatusPill tone="warning">Rx only</StatusPill>
        ) : (
          <StatusPill tone="neutral">OTC</StatusPill>
        ),
    },
    {
      key: 'price',
      header: 'Price',
      align: 'right',
      cell: (product) => {
        const percent = discountPercent(product.pricePaisa, product.compareAtPricePaisa)
        return (
          <div className="tabular flex flex-col items-end">
            <span className="font-semibold text-gray-900">{formatPrice(product.pricePaisa)}</span>
            {percent !== null && (
              <span className="text-[12px] text-red-600">
                −{percent}% from {formatPrice(product.compareAtPricePaisa!)}
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: 'stock',
      header: 'Stock',
      align: 'right',
      cell: (product) => {
        const tone =
          product.stock === 0 ? 'danger' : product.stock < LOW_STOCK_THRESHOLD ? 'warning' : 'success'
        return (
          <span className="tabular whitespace-nowrap">
            <SeverityStripe tone={tone} />
            {product.stock === 0 ? 'None sellable' : product.stock.toLocaleString('en-PK')}
          </span>
        )
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (product) => (
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/admin/products/${product.id}/edit`}
            aria-label={`Edit ${product.name}`}
            className="flex h-8 w-8 items-center justify-center rounded-sm text-gray-500 hover:bg-gray-100 hover:text-blue-600"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href={`/products/${product.slug}`}
            aria-label={`View ${product.name} on the storefront`}
            className="flex h-8 w-8 items-center justify-center rounded-sm text-gray-500 hover:bg-gray-100 hover:text-blue-600"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Products"
        description="Stock counts sellable units from unexpired batches only."
        action={
          <Link
            href="/admin/products/new"
            className="inline-flex h-9 items-center gap-2 rounded-sm bg-blue-600 px-4 text-[13.5px] font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add product
          </Link>
        }
      />

      <FlashBanner
        params={params}
        messages={{ deleted: 'Product deleted.', created: 'Product created.' }}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Products" value={String(products.length)} />
        <StatCard label="On sale" value={String(onSale)} hint="Have a compare-at price" />
        <StatCard label="Low stock" value={String(lowStock)} tone={lowStock > 0 ? 'warning' : 'neutral'} />
        <StatCard
          label="Nothing sellable"
          value={String(outOfStock)}
          tone={outOfStock > 0 ? 'danger' : 'neutral'}
        />
      </div>

      <FilterBar
        searchPlaceholder="Search name, SKU, brand…"
        selects={[
          {
            key: 'category',
            label: 'Category',
            options: categories.map((c) => ({ value: c.slug, label: c.name })),
          },
          { key: 'brand', label: 'Brand', options: brands.map((b) => ({ value: b.id, label: b.name })) },
          {
            key: 'rx',
            label: 'Type',
            options: [
              { value: 'yes', label: 'Prescription only' },
              { value: 'no', label: 'Over the counter' },
            ],
          },
          {
            key: 'stock',
            label: 'Stock',
            options: [
              { value: 'low', label: 'Low stock' },
              { value: 'out', label: 'Nothing sellable' },
              { value: 'sale', label: 'On sale' },
            ],
          },
        ]}
      />

      <DataTable
        columns={columns}
        rows={result.rows}
        rowKey={(p) => p.id}
        caption="Products"
        empty={
          <div>
            <p className="text-[14px] font-semibold text-gray-900">No products match these filters</p>
            <p className="mt-1 text-[13px] text-gray-500">Try a different search or clear the filters.</p>
          </div>
        }
      />

      <Pagination result={result} searchParams={params} basePath="/admin/products" />
    </>
  )
}
