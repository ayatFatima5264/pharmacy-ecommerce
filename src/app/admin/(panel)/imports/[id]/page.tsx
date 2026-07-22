import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { PageHeader, Panel, StatCard, StatusPill } from '@/components/admin/ui'
import { requirePermission } from '@/features/auth/staff/guards'
import { useDb } from '@/lib/data/source'
import { supabaseService } from '@/lib/supabase/server'
import { CommitImportForm } from '@/features/imports/components/import-forms'
import type { RowMessage } from '@/features/imports/engine'

export const metadata = { title: 'Import preview' }
export const dynamic = 'force-dynamic'

export default async function ImportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('products.manage')
  if (!useDb()) notFound()
  const { id } = await params

  const db = supabaseService()
  const { data: importRow } = await db
    .from('imports')
    .select('id, type, filename, status, totals, created_at')
    .eq('id', id)
    .maybeSingle()
  if (!importRow) notFound()
  const meta = importRow as {
    id: string
    type: string
    filename: string
    status: string
    totals: Record<string, number>
  }

  const { data: rowsData } = await db
    .from('import_rows')
    .select('row_number, raw, action, messages, status, result')
    .eq('import_id', id)
    .order('row_number')
  const rows = (rowsData ?? []) as {
    row_number: number
    raw: Record<string, unknown>
    action: 'create' | 'update' | 'error'
    messages: RowMessage[]
    status: string
    result: string | null
  }[]

  const keyColumn = meta.type === 'products' ? 'sku' : 'test_code'

  return (
    <>
      <Link
        href="/admin/imports"
        className="mb-4 inline-flex items-center gap-1 text-[13px] font-semibold text-gray-500 hover:text-blue-600"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Imports
      </Link>

      <PageHeader
        title={meta.filename}
        description={`${meta.type === 'products' ? 'Products' : 'Lab tests'} import`}
        action={
          <StatusPill tone={meta.status === 'completed' ? 'success' : 'warning'}>
            {meta.status}
          </StatusPill>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Rows" value={String(rows.length)} />
        <StatCard label="Creates" value={String(rows.filter((r) => r.action === 'create').length)} />
        <StatCard label="Updates" value={String(rows.filter((r) => r.action === 'update').length)} />
        <StatCard
          label="Errors"
          value={String(rows.filter((r) => r.action === 'error').length)}
          tone={rows.some((r) => r.action === 'error') ? 'danger' : undefined}
        />
      </div>

      {meta.status === 'ready' && (
        <Panel title="Commit" className="mb-4">
          <p className="mb-3 text-[12.5px] text-gray-500">
            Error rows are skipped. Every committed row succeeds or fails on its own — the result
            lands in the table below.
          </p>
          <CommitImportForm importId={meta.id} />
        </Panel>
      )}

      <Panel title="Rows">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-2 pr-3 font-semibold">#</th>
                <th className="py-2 pr-3 font-semibold">{keyColumn}</th>
                <th className="py-2 pr-3 font-semibold">Action</th>
                <th className="py-2 pr-3 font-semibold">Messages</th>
                <th className="py-2 font-semibold">Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.row_number} className="border-b border-gray-100 align-top">
                  <td className="tabular py-1.5 pr-3 text-gray-400">{row.row_number}</td>
                  <td className="tabular py-1.5 pr-3 font-semibold text-gray-900">
                    {String(row.raw[keyColumn] ?? '—')}
                  </td>
                  <td className="py-1.5 pr-3">
                    <StatusPill
                      tone={row.action === 'error' ? 'danger' : row.action === 'create' ? 'success' : 'neutral'}
                    >
                      {row.action}
                    </StatusPill>
                  </td>
                  <td className="py-1.5 pr-3">
                    {row.messages.length === 0 ? (
                      <span className="text-gray-300">—</span>
                    ) : (
                      <ul className="flex flex-col gap-0.5">
                        {row.messages.map((m, i) => (
                          <li key={i} className={m.level === 'error' ? 'text-red-700' : 'text-amber-700'}>
                            {m.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="py-1.5 text-gray-600">
                    {row.status === 'pending' ? (
                      <span className="text-gray-300">—</span>
                    ) : (
                      <span className={row.status === 'failed' ? 'text-red-700' : ''}>
                        {row.result ?? row.status}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
