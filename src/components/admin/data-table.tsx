import * as React from 'react'
import { Inbox } from 'lucide-react'
import { AdminEmptyState } from '@/components/admin/blocks'
import { cn } from '@/lib/utils'

/**
 * One table definition renders two layouts.
 *
 * Desktop gets a real <table> — staff scan columns, and column alignment is the
 * whole point. Below md the same columns render as stacked label/value cards,
 * because a 9-column table on a phone is either unreadable or a horizontal
 * scroll nobody discovers.
 *
 * `primary` marks the field that titles the mobile card; `hideOnMobile` drops
 * detail that only matters when scanning.
 */
export interface Column<T> {
  key: string
  header: string
  cell: (row: T) => React.ReactNode
  align?: 'left' | 'right'
  primary?: boolean
  hideOnMobile?: boolean
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  empty?: React.ReactNode
  caption?: string
}

export function DataTable<T>({ columns, rows, rowKey, empty, caption }: DataTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200/80 bg-white shadow-e1">
        {empty ?? (
          <AdminEmptyState
            icon={Inbox}
            title="Nothing here yet"
            description="Records will appear in this list as they are created. Try clearing any active filters."
          />
        )}
      </div>
    )
  }

  const primary = columns.find((c) => c.primary) ?? columns[0]
  const secondary = columns.filter((c) => c !== primary && !c.hideOnMobile)

  return (
    <>
      {/* Desktop */}
      <div className="hidden overflow-x-auto rounded-lg border border-gray-200/80 bg-white shadow-e1 md:block">
        <table className="w-full border-collapse text-left">
          {caption && <caption className="sr-only">{caption}</caption>}
          {/* Sticky within any vertically scrolling wrapper a page provides. */}
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-gray-200 bg-gray-50/90">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    'whitespace-nowrap px-4 py-3.5 text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500',
                    column.align === 'right' && 'text-right',
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                className="border-b border-gray-100 transition-colors duration-fast last:border-b-0 hover:bg-gray-50/80"
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-4 py-3.5 align-middle text-[13.5px] text-gray-700',
                      column.align === 'right' && 'text-right',
                      column.className,
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)} className="rounded-lg border border-gray-200/80 bg-white p-5 shadow-e1">
            <div className="mb-3 text-[15px] font-semibold text-gray-900">{primary.cell(row)}</div>
            <dl className="flex flex-col gap-2">
              {secondary.map((column) => (
                <div key={column.key} className="flex items-start justify-between gap-4">
                  <dt className="shrink-0 text-[12.5px] uppercase tracking-[0.04em] text-gray-500">
                    {column.header}
                  </dt>
                  <dd className="min-w-0 text-right text-[13.5px] text-gray-700">
                    {column.cell(row)}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  )
}
