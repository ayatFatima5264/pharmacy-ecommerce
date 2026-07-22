import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { PageHeader, StatCard, StatusPill } from '@/components/admin/ui'
import { DataTable, type Column } from '@/components/admin/data-table'
import { FilterBar } from '@/components/admin/filter-bar'
import { Pagination } from '@/components/admin/pagination'
import { FlashBanner } from '@/components/admin/flash-banner'
import { BrandPanel, TaxonomyDeleteButton } from '@/features/catalog/components/taxonomy-forms'
import { getAdminBrands } from '@/lib/data/admin-catalog'
import { findBrand } from '@/lib/data/store'
import { matchesQuery, paginate, param, parsePage } from '@/lib/data/paginate'

export const metadata = { title: 'Brands' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>
type Row = Awaited<ReturnType<typeof getAdminBrands>>[number]

export default async function AdminBrandsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const rows = await getAdminBrands()

  const query = param(params, 'q')
  const usage = param(params, 'usage')
  const editId = param(params, 'edit')
  const editing = editId ? findBrand(editId) : undefined

  const filtered = rows.filter((brand) => {
    if (!matchesQuery(brand, query, ['name', 'slug'])) return false
    if (usage === 'used' && brand.productCount === 0) return false
    if (usage === 'unused' && brand.productCount > 0) return false
    return true
  })

  const result = paginate(filtered, parsePage(params.page))

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: 'Brand',
      primary: true,
      cell: (brand) => (
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-gray-50 text-[12.5px] font-bold text-gray-500">
            {brand.name.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <Link
              href={`/admin/brands?edit=${brand.id}`}
              className="block truncate rounded-sm font-semibold text-gray-900 hover:text-blue-600 hover:underline"
            >
              {brand.name}
            </Link>
            <p className="truncate text-[12.5px] text-gray-500">/{brand.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'products',
      header: 'Products',
      align: 'right',
      cell: (b) => <span className="tabular font-semibold text-gray-900">{b.productCount}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (brand) =>
        brand.isActive ? (
          <StatusPill tone="success">Active</StatusPill>
        ) : (
          <StatusPill tone="neutral">Inactive</StatusPill>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (brand) => (
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/admin/brands?edit=${brand.id}`}
            aria-label={`Edit ${brand.name}`}
            className="flex h-8 w-8 items-center justify-center rounded-sm text-gray-500 hover:bg-gray-100 hover:text-blue-600"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Link>
          <TaxonomyDeleteButton
            kind="brand"
            id={brand.id}
            name={brand.name}
            blocked={
              brand.productCount > 0
                ? `${brand.productCount} products still reference this brand`
                : undefined
            }
          />
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Brands"
        description="Manufacturers and distributors. A brand cannot be deleted while products reference it."
      />

      <FlashBanner params={params} messages={{ created: 'Brand created.' }} />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Brands" value={String(rows.length)} />
        <StatCard label="Products linked" value={String(rows.reduce((sum, b) => sum + b.productCount, 0))} />
        <StatCard
          label="Without products"
          value={String(rows.filter((b) => b.productCount === 0).length)}
          tone={rows.some((b) => b.productCount === 0) ? 'warning' : 'neutral'}
        />
      </div>

      <BrandPanel editing={editing} />

      <FilterBar
        searchPlaceholder="Search brands…"
        selects={[
          {
            key: 'usage',
            label: 'Usage',
            options: [
              { value: 'used', label: 'Has products' },
              { value: 'unused', label: 'No products' },
            ],
          },
        ]}
      />

      <DataTable columns={columns} rows={result.rows} rowKey={(b) => b.id} caption="Brands" />
      <Pagination result={result} searchParams={params} basePath="/admin/brands" />
    </>
  )
}
