import Link from 'next/link'
import { Boxes, FolderTree, FolderX, Package, Pencil } from 'lucide-react'
import { PageHeader, StatCard, StatusPill } from '@/components/admin/ui'
import { DataTable, type Column } from '@/components/admin/data-table'
import { FilterBar } from '@/components/admin/filter-bar'
import { Pagination } from '@/components/admin/pagination'
import { FlashBanner } from '@/components/admin/flash-banner'
import { CategoryPanel, TaxonomyDeleteButton } from '@/features/catalog/components/taxonomy-forms'
import { getAdminCategories } from '@/lib/data/admin-catalog'
import { allCategories } from '@/lib/data/store'
import { matchesQuery, paginate, param, parsePage } from '@/lib/data/paginate'

export const metadata = { title: 'Categories' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>
type Row = Awaited<ReturnType<typeof getAdminCategories>>[number]

export default async function AdminCategoriesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const rows = await getAdminCategories()

  const query = param(params, 'q')
  const level = param(params, 'level')
  const editId = param(params, 'edit')
  const editing = editId ? allCategories().find((c) => c.id === editId) : undefined

  const filtered = rows.filter((category) => {
    if (!matchesQuery(category, query, ['name', 'slug'])) return false
    if (level === 'top' && category.parentId) return false
    if (level === 'sub' && !category.parentId) return false
    if (level === 'empty' && category.productCount > 0) return false
    return true
  })

  const result = paginate(filtered, parsePage(params.page))

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: 'Category',
      primary: true,
      cell: (category) => (
        <div className="flex items-center gap-3">
          <span className="text-lg" aria-hidden="true">
            {category.icon}
          </span>
          <div className="min-w-0">
            <Link
              href={`/admin/categories?edit=${category.id}`}
              className="block truncate rounded-sm font-semibold text-gray-900 hover:text-blue-600 hover:underline"
            >
              {category.name}
            </Link>
            <p className="truncate text-[12.5px] text-gray-500">/{category.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      hideOnMobile: true,
      cell: (category) => (
        <span className="line-clamp-1 max-w-md text-gray-500">{category.description}</span>
      ),
    },
    {
      key: 'parent',
      header: 'Parent',
      cell: (category) =>
        category.parentName ?? <span className="text-gray-400">Top level</span>,
    },
    {
      key: 'products',
      header: 'Products',
      align: 'right',
      cell: (c) => <span className="tabular font-semibold text-gray-900">{c.productCount}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (category) =>
        category.isActive ? (
          <StatusPill tone="success">Active</StatusPill>
        ) : (
          <StatusPill tone="neutral">Hidden</StatusPill>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (category) => (
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/admin/categories?edit=${category.id}`}
            aria-label={`Edit ${category.name}`}
            className="flex h-8 w-8 items-center justify-center rounded-sm text-gray-500 hover:bg-gray-100 hover:text-blue-600"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Link>
          <TaxonomyDeleteButton
            kind="category"
            id={category.id}
            name={category.name}
            blocked={
              category.childCount > 0
                ? `${category.childCount} subcategories must be moved first`
                : category.productCount > 0
                  ? `${category.productCount} products still use this category`
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
        title="Categories"
        description="A self-referencing tree. Deleting is blocked while products or subcategories still reference a row."
      />

      <FlashBanner params={params} messages={{ created: 'Category created.' }} />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Categories" icon={Boxes} value={String(rows.length)} />
        <StatCard label="Top level" icon={FolderTree} value={String(rows.filter((c) => !c.parentId).length)} />
        <StatCard
          label="Products categorised" icon={Package}
          value={String(rows.reduce((sum, c) => sum + c.productCount, 0))}
        />
        <StatCard
          label="Empty categories" icon={FolderX}
          value={String(rows.filter((c) => c.productCount === 0).length)}
          tone={rows.some((c) => c.productCount === 0) ? 'warning' : 'neutral'}
        />
      </div>

      <CategoryPanel categories={allCategories()} editing={editing} />

      <FilterBar
        searchPlaceholder="Search categories…"
        selects={[
          {
            key: 'level',
            label: 'Level',
            options: [
              { value: 'top', label: 'Top level' },
              { value: 'sub', label: 'Subcategories' },
              { value: 'empty', label: 'No products' },
            ],
          },
        ]}
      />

      <DataTable columns={columns} rows={result.rows} rowKey={(c) => c.id} caption="Categories" />
      <Pagination result={result} searchParams={params} basePath="/admin/categories" />
    </>
  )
}
