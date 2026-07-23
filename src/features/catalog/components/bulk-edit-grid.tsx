'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Download, FileUp, Loader2, Pencil, RotateCcw, Save, Search } from 'lucide-react'
import { StatusPill } from '@/components/admin/ui'
import { NO_PERMISSION_MESSAGE, useAdminToast } from '@/components/admin/toast'
import { bulkEditProducts } from '@/features/catalog/actions/bulk-edit-actions'
import { idleState, type ActionState } from '@/features/catalog/actions/action-result'
import { cn } from '@/lib/utils'
import type { AdminProductRow } from '@/lib/data/admin-catalog'

/**
 * Excel-style inline editing over the products list.
 *
 * Editable: price, sale price, stock intake — exactly the columns the import
 * engine's update path supports, because "Save all changes" IS an import
 * commit (one synthetic sheet of changed rows). Name, description, images,
 * brand, category and Rx flags stay read-only here by design: those edits
 * carry validation and clinical consequences that belong to the full editor.
 *
 * Only changed cells travel; unchanged rows never touch the server.
 */

interface RowEdit {
  price?: string
  salePrice?: string
  stock?: string
}

const MONEY = /^\d+(\.\d{1,2})?$/

function paisaToRupees(paisa: number): string {
  return (paisa / 100).toFixed(paisa % 100 === 0 ? 0 : 2)
}

export function BulkEditGrid({ rows, canEdit }: { rows: AdminProductRow[]; canEdit: boolean }) {
  const router = useRouter()
  const { toast, showToast } = useAdminToast()
  const [state, formAction] = useActionState(bulkEditProducts, idleState)
  const [edits, setEdits] = React.useState<Record<string, RowEdit>>({})
  const [query, setQuery] = React.useState('')
  const [category, setCategory] = React.useState('')

  const categories = React.useMemo(
    () => [...new Set(rows.map((r) => r.categoryName))].sort(),
    [rows],
  )

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (category && row.categoryName !== category) return false
      if (!q) return true
      return [row.name, row.sku, row.brandName].join(' ').toLowerCase().includes(q)
    })
  }, [rows, query, category])

  /** A cell is dirty when it differs from the row's original value. */
  function setCell(row: AdminProductRow, field: keyof RowEdit, value: string) {
    setEdits((current) => {
      // Engine semantics: "price" is the list price (compare-at when on sale),
      // "sale_price" is the discounted selling price — mirror the display.
      const original =
        field === 'price'
          ? paisaToRupees(row.compareAtPricePaisa ?? row.pricePaisa)
          : field === 'salePrice'
            ? row.compareAtPricePaisa !== null
              ? paisaToRupees(row.pricePaisa)
              : ''
            : ''
      const next = { ...current }
      const entry = { ...(next[row.sku] ?? {}) }
      if (value === original || value === '') delete entry[field]
      else entry[field] = value
      if (Object.keys(entry).length === 0) delete next[row.sku]
      else next[row.sku] = entry
      return next
    })
  }

  const changes = React.useMemo(
    () =>
      Object.entries(edits).map(([sku, edit]) => ({
        sku,
        ...(edit.price !== undefined ? { price: edit.price } : {}),
        ...(edit.salePrice !== undefined ? { salePrice: edit.salePrice } : {}),
        ...(edit.stock !== undefined ? { stock: edit.stock } : {}),
      })),
    [edits],
  )

  const invalidCount = React.useMemo(
    () =>
      changes.filter(
        (c) =>
          (c.price !== undefined && !MONEY.test(c.price)) ||
          (c.salePrice !== undefined && !MONEY.test(c.salePrice)) ||
          (c.stock !== undefined && !/^\d+$/.test(c.stock)),
      ).length,
    [changes],
  )

  const dirty = changes.length > 0

  // Unsaved changes guard — the browser prompt, exactly like a document.
  React.useEffect(() => {
    if (!dirty) return
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // After a successful save the server rows are fresh — drop local edits.
  const lastStatus = React.useRef<ActionState['status']>('idle')
  React.useEffect(() => {
    if (state.status === 'success' && lastStatus.current !== 'success') {
      setEdits({})
      showToast(state.message, 'success')
      router.refresh()
    }
    if (state.status === 'error' && lastStatus.current !== 'error') {
      showToast(state.message, 'error')
      router.refresh()
    }
    lastStatus.current = state.status
  }, [state, router, showToast])

  function exportCsv() {
    const header = ['sku', 'name', 'brand', 'category', 'price', 'sale_price', 'stock']
    const lines = visible.map((row) =>
      [
        row.sku,
        `"${row.name.replace(/"/g, '""')}"`,
        `"${row.brandName.replace(/"/g, '""')}"`,
        `"${row.categoryName.replace(/"/g, '""')}"`,
        paisaToRupees(row.compareAtPricePaisa ?? row.pricePaisa),
        row.compareAtPricePaisa !== null ? paisaToRupees(row.pricePaisa) : '',
        String(row.stock),
      ].join(','),
    )
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'products.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <form action={formAction}>
      {toast}
      <input type="hidden" name="changes" value={JSON.stringify(changes)} />

      {/* ---------- Toolbar ---------- */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, SKU, brand…"
            className="h-10 w-full rounded-md border border-gray-200 bg-white pl-9 pr-3 text-[13.5px] shadow-e1 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none focus:ring-[3px] focus:ring-blue-100"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filter by category"
          className="h-10 cursor-pointer rounded-md border border-gray-200 bg-white px-3 pr-8 text-[13.5px] text-gray-700 shadow-e1 focus:border-blue-600 focus:outline-none focus:ring-[3px] focus:ring-blue-100"
        >
          <option value="">Category: All</option>
          {categories.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/admin/imports"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-gray-200 bg-white px-3.5 text-[13px] font-semibold text-gray-700 shadow-e1 transition-colors duration-fast hover:border-blue-600/30 hover:text-blue-700"
          >
            <FileUp className="h-4 w-4" aria-hidden="true" />
            Import Excel
          </Link>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-gray-200 bg-white px-3.5 text-[13px] font-semibold text-gray-700 shadow-e1 transition-colors duration-fast hover:border-blue-600/30 hover:text-blue-700"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </button>
        </div>
      </div>

      {/* ---------- Grid ---------- */}
      <div className="max-h-[62vh] overflow-auto rounded-lg border border-gray-200/80 bg-white shadow-e1">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Bulk edit products</caption>
          <thead className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur">
            <tr className="border-b border-gray-200">
              {['Product', 'SKU', 'Category', 'Price (Rs)', 'Sale price (Rs)', 'Current stock', 'Add stock', 'Status', ''].map(
                (header, i) => (
                  <th
                    key={header + i}
                    scope="col"
                    className={cn(
                      'whitespace-nowrap px-4 py-3.5 text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500',
                      i >= 3 && i <= 6 && 'text-right',
                    )}
                  >
                    {header}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const edit = edits[row.sku] ?? {}
              const rowDirty = Object.keys(edit).length > 0
              return (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b border-gray-100 transition-colors duration-fast last:border-b-0',
                    rowDirty ? 'bg-amber-50/50' : 'hover:bg-gray-50/80',
                  )}
                >
                  <td className="max-w-[260px] px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-50 text-base"
                        aria-hidden="true"
                      >
                        {row.icon}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-gray-900">{row.name}</p>
                        <p className="truncate text-[11.5px] text-gray-500">{row.brandName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="tabular whitespace-nowrap px-4 py-2.5 text-[12.5px] text-gray-500">
                    {row.sku}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-[12.5px] text-gray-500">
                    {row.categoryName}
                  </td>
                  <GridCell
                    value={edit.price ?? paisaToRupees(row.compareAtPricePaisa ?? row.pricePaisa)}
                    dirty={edit.price !== undefined}
                    invalid={edit.price !== undefined && !MONEY.test(edit.price)}
                    disabled={!canEdit}
                    label={`Price for ${row.name}`}
                    onChange={(value) => setCell(row, 'price', value)}
                  />
                  <GridCell
                    value={
                      edit.salePrice ??
                      (row.compareAtPricePaisa !== null ? paisaToRupees(row.pricePaisa) : '')
                    }
                    dirty={edit.salePrice !== undefined}
                    invalid={edit.salePrice !== undefined && !MONEY.test(edit.salePrice)}
                    disabled={!canEdit}
                    label={`Sale price for ${row.name}`}
                    placeholder="—"
                    onChange={(value) => setCell(row, 'salePrice', value)}
                  />
                  <td className="tabular whitespace-nowrap px-4 py-2.5 text-right text-[13px] text-gray-700">
                    {row.stock.toLocaleString('en-PK')}
                  </td>
                  <GridCell
                    value={edit.stock ?? ''}
                    dirty={edit.stock !== undefined}
                    invalid={edit.stock !== undefined && !/^\d+$/.test(edit.stock)}
                    disabled={!canEdit}
                    label={`Stock intake for ${row.name}`}
                    placeholder="+0"
                    onChange={(value) => setCell(row, 'stock', value)}
                  />
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <StatusPill tone={row.inStock ? 'success' : 'danger'}>
                      {row.inStock ? 'Active' : 'Out of stock'}
                    </StatusPill>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">
                    <Link
                      href={`/admin/products/${row.id}/edit`}
                      aria-label={`Open full editor for ${row.name}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors duration-fast hover:bg-blue-50 hover:text-blue-600"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p className="px-6 py-12 text-center text-[13px] text-gray-500">
            No products match this search.
          </p>
        )}
      </div>

      {/* ---------- Sticky save bar ---------- */}
      <div className="sticky bottom-4 z-20 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200/80 bg-white/95 p-3.5 shadow-e2 backdrop-blur">
        <p className="text-[13px] text-gray-600">
          {dirty ? (
            <>
              <span className="font-bold text-amber-700">{changes.length}</span> row
              {changes.length === 1 ? '' : 's'} with unsaved changes
              {invalidCount > 0 && (
                <span className="ml-2 font-semibold text-red-600">
                  · {invalidCount} invalid value{invalidCount === 1 ? '' : 's'}
                </span>
              )}
            </>
          ) : (
            'Edit price, sale price, or add stock intake — only changed rows are saved.'
          )}
        </p>
        <div className="flex items-center gap-2">
          {dirty && (
            <button
              type="button"
              onClick={() => setEdits({})}
              className="inline-flex h-10 items-center gap-2 rounded-md px-3.5 text-[13px] font-semibold text-gray-500 transition-colors duration-fast hover:bg-red-50 hover:text-red-600"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Discard
            </button>
          )}
          <SaveAllButton
            disabled={!dirty || invalidCount > 0}
            blocked={!canEdit}
            onBlocked={() => showToast(NO_PERMISSION_MESSAGE)}
            count={changes.length}
          />
        </div>
      </div>
    </form>
  )
}

function GridCell({
  value,
  dirty,
  invalid,
  disabled,
  label,
  placeholder,
  onChange,
}: {
  value: string
  dirty: boolean
  invalid: boolean
  disabled: boolean
  label: string
  placeholder?: string
  onChange: (value: string) => void
}) {
  return (
    <td className="whitespace-nowrap px-2.5 py-2">
      <input
        type="text"
        inputMode="decimal"
        value={value}
        disabled={disabled}
        aria-label={label}
        aria-invalid={invalid || undefined}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'tabular h-9 w-24 rounded-md border px-2.5 text-right text-[13px] transition-all duration-fast focus:outline-none focus:ring-[3px]',
          invalid
            ? 'border-red-600 bg-red-50 text-red-700 focus:ring-red-50'
            : dirty
              ? 'border-amber-600/50 bg-amber-50 font-semibold text-amber-900 focus:ring-amber-600/10'
              : 'border-gray-200 bg-white text-gray-900 focus:border-blue-600 focus:ring-blue-100',
          disabled && 'cursor-not-allowed bg-gray-50 text-gray-400',
        )}
      />
    </td>
  )
}

function SaveAllButton({
  disabled,
  blocked,
  onBlocked,
  count,
}: {
  disabled: boolean
  blocked: boolean
  onBlocked: () => void
  count: number
}) {
  const { pending } = useFormStatus()

  if (blocked) {
    return (
      <button
        type="button"
        onClick={onBlocked}
        aria-disabled="true"
        className="inline-flex h-10 cursor-not-allowed items-center gap-2 rounded-md bg-gray-100 px-5 text-[13.5px] font-semibold text-gray-400"
      >
        <Save className="h-4 w-4" aria-hidden="true" />
        Save all changes
      </button>
    )
  }

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-5 text-[13.5px] font-semibold text-white shadow-e1 transition-all duration-medium hover:bg-blue-700 hover:shadow-e2 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <Save className="h-4 w-4" aria-hidden="true" />
      )}
      {pending ? 'Saving…' : `Save all changes${count > 0 ? ` (${count})` : ''}`}
    </button>
  )
}
