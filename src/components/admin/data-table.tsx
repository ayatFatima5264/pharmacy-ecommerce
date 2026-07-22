import * as React from 'react'
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
      <div className="rounded-md border border-gray-200 bg-white px-6 py-16 text-center">
        {empty ?? <p className="text-body-sm text-gray-500">No records found.</p>}
      </div>
    )
  }

  const primary = columns.find((c) => c.primary) ?? columns[0]
  const secondary = columns.filter((c) => c !== primary && !c.hideOnMobile)

  return (
    <>
      {/* Desktop */}
      <div className="hidden overflow-x-auto rounded-md border border-gray-200 bg-white md:block">
        <table className="w-full border-collapse text-left">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    'whitespace-nowrap px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.06em] text-gray-500',
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
                className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-4 py-3 align-middle text-[13.5px] text-gray-700',
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
          <li key={rowKey(row)} className="rounded-md border border-gray-200 bg-white p-4">
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
