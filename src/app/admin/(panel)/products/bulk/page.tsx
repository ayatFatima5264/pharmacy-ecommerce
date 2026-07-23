import { Info } from 'lucide-react'
import { PageHeader } from '@/components/admin/ui'
import { BulkEditGrid } from '@/features/catalog/components/bulk-edit-grid'
import { requirePermission, can } from '@/features/auth/staff/guards'
import { getAdminProducts } from '@/lib/data/admin-catalog'

export const metadata = { title: 'Bulk Edit Products' }
export const dynamic = 'force-dynamic'

/**
 * Excel-style daily updates: prices and stock across the whole catalog on one
 * screen. Staff can VIEW the grid; saving needs products.manage — the button
 * is disabled with a toast rather than hiding the page.
 */
export default async function BulkEditProductsPage() {
  await requirePermission('products.view')
  const canEdit = await can('products.manage')
  const products = await getAdminProducts()

  return (
    <>
      <PageHeader
        title="Bulk Edit"
        description="Edit prices and stock across the catalog like a spreadsheet. Only changed rows are saved, and every save lands in the Imports history as an audit record."
      />

      <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-gray-200/80 bg-white p-4 text-[12.5px] leading-relaxed text-gray-600 shadow-e1">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
        <p>
          <strong className="text-gray-900">Editable inline:</strong> price, sale price, and stock
          intake (added as a dated batch, first-expired-first-out).{' '}
          <strong className="text-gray-900">Not editable here:</strong> name, description, images,
          SEO, prescription flags — those changes carry clinical and content review, so they live in
          the full product editor.
        </p>
      </div>

      <BulkEditGrid rows={products} canEdit={canEdit} />
    </>
  )
}
