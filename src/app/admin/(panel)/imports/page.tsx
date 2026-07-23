import Link from 'next/link'
import { CheckCircle2, Download, FileUp, ScanSearch } from 'lucide-react'
import { PageHeader, Panel, StatusPill } from '@/components/admin/ui'
import { requirePermission } from '@/features/auth/staff/guards'
import { useDb } from '@/lib/data/source'
import { supabaseService } from '@/lib/supabase/server'
import { UploadImportForm } from '@/features/imports/components/import-forms'
import { TEMPLATE_COLUMNS } from '@/features/imports/engine'
import { formatDateTime } from '@/lib/utils'

export const metadata = { title: 'Imports' }
export const dynamic = 'force-dynamic'

export default async function AdminImportsPage() {
  await requirePermission('products.manage')

  let history: {
    id: string
    type: string
    filename: string
    status: string
    totals: Record<string, number>
    created_at: string
  }[] = []
  if (useDb()) {
    const { data } = await supabaseService()
      .from('imports')
      .select('id, type, filename, status, totals, created_at')
      .order('created_at', { ascending: false })
      .limit(25)
    history = (data ?? []) as typeof history
  }

  return (
    <>
      <PageHeader
        title="Import Excel"
        description="Bulk create and update from Excel. Upload validates first — nothing changes until you commit."
        action={
          <div className="flex gap-2">
            <a
              href="/admin/imports/template?type=products"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-gray-200 bg-white px-3.5 text-[13px] font-semibold text-gray-700 shadow-e1 transition-colors duration-fast hover:border-blue-600/30 hover:text-blue-700"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Product sample
            </a>
            <a
              href="/admin/imports/template?type=lab_tests"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-gray-200 bg-white px-3.5 text-[13px] font-semibold text-gray-700 shadow-e1 transition-colors duration-fast hover:border-blue-600/30 hover:text-blue-700"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Lab test sample
            </a>
          </div>
        }
      />

      {/* The three-step contract, spelled out before the form. */}
      <ol className="mb-4 grid gap-3 sm:grid-cols-3">
        {(
          [
            [FileUp, '1 · Upload', 'Excel file (.xlsx / .xls) — up to 2,000 rows.'],
            [ScanSearch, '2 · Preview & validate', 'Every row is classified: create, update, or error.'],
            [CheckCircle2, '3 · Commit', 'Only valid rows apply. Errors never block the rest.'],
          ] as const
        ).map(([Icon, title, detail]) => (
          <li
            key={title}
            className="flex items-start gap-3 rounded-lg border border-gray-200/80 bg-white p-4 shadow-e1"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[13px] font-bold text-gray-900">{title}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-gray-500">{detail}</p>
            </div>
          </li>
        ))}
      </ol>

      <Panel title="New import" className="mb-4">
        <UploadImportForm />
        <div className="mt-4 grid gap-3 text-[12.5px] text-gray-500 sm:grid-cols-2">
          <div>
            <p className="font-semibold text-gray-700">Products columns</p>
            <p className="tabular mt-1">{TEMPLATE_COLUMNS.products.join(' · ')}</p>
            <p className="mt-1">
              Upsert key: <strong>sku</strong>. Updates touch only the columns present — a sheet
              with just sku + price is a bulk price update. <strong>stock</strong> is units
              received (intake), ledgered as a purchase.
            </p>
          </div>
          <div>
            <p className="font-semibold text-gray-700">Lab test columns</p>
            <p className="tabular mt-1">{TEMPLATE_COLUMNS.lab_tests.join(' · ')}</p>
            <p className="mt-1">
              Upsert key: <strong>test_code</strong>. Prices are in rupees; fasting_hours 0 means
              no fasting.
            </p>
          </div>
        </div>
      </Panel>

      <Panel title="History">
        {history.length === 0 ? (
          <p className="text-[13px] text-gray-500">No imports yet.</p>
        ) : (
          <ul className="flex flex-col">
            {history.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 border-b border-gray-100 py-2.5 last:border-0"
              >
                <div className="min-w-0">
                  <Link
                    href={`/admin/imports/${row.id}`}
                    className="truncate text-[13px] font-semibold text-blue-600 hover:underline"
                  >
                    {row.filename}
                  </Link>
                  <p className="text-[12.5px] text-gray-500">
                    {row.type === 'products' ? 'Products' : 'Lab tests'} ·{' '}
                    {formatDateTime(row.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[12.5px] text-gray-500">
                  <span className="tabular">
                    {row.status === 'ready'
                      ? `${row.totals.creates ?? 0} new · ${row.totals.updates ?? 0} updates · ${row.totals.errors ?? 0} errors`
                      : `${row.totals.committed ?? 0} committed · ${row.totals.failed ?? 0} failed`}
                  </span>
                  <StatusPill tone={row.status === 'completed' ? 'success' : row.status === 'ready' ? 'warning' : 'neutral'}>
                    {row.status}
                  </StatusPill>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  )
}
