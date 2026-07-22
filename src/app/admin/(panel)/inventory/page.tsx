import Link from 'next/link'
import { PageHeader, SeverityStripe, StatCard, StatusPill } from '@/components/admin/ui'
import { DataTable, type Column } from '@/components/admin/data-table'
import { FilterBar } from '@/components/admin/filter-bar'
import { Pagination } from '@/components/admin/pagination'
import {
  AdjustStockDialog,
  ReceiveBatchForm,
  WriteOffButton,
} from '@/features/catalog/components/inventory-forms'
import {
  EXPIRY_WARNING_DAYS,
  PHARMACIES,
  getBatchRows,
  getInventorySummary,
  getVariantOptions,
  type BatchRow,
} from '@/lib/data/admin-catalog'
import { matchesQuery, paginate, param, parsePage } from '@/lib/data/paginate'
import { formatDate } from '@/lib/utils'

export const metadata = { title: 'Inventory' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function AdminInventoryPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams

  const rows = await getBatchRows()
  const summary = await getInventorySummary()
  const options = await getVariantOptions()

  const query = param(params, 'q')
  const state = param(params, 'state')
  const pharmacy = param(params, 'pharmacy')

  const filtered = rows.filter((row) => {
    if (!matchesQuery(row, query, ['batchNumber', 'productName', 'sku'])) return false
    if (state && row.state !== state) return false
    if (pharmacy && row.pharmacy !== pharmacy) return false
    return true
  })

  const result = paginate(filtered, parsePage(params.page))

  const columns: Column<BatchRow>[] = [
    {
      key: 'batch',
      header: 'Batch',
      primary: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="tabular truncate font-semibold text-gray-900">{row.batchNumber}</p>
          <p className="truncate text-[12.5px] text-gray-500">
            {row.productName} · {row.sku}
          </p>
        </div>
      ),
    },
    { key: 'pharmacy', header: 'Pharmacy', cell: (r) => r.pharmacy, hideOnMobile: true },
    {
      key: 'expiry',
      header: 'Expiry',
      cell: (row) => {
        const tone = row.state === 'expired' ? 'danger' : row.state === 'expiring' ? 'warning' : 'success'
        return (
          <span className="whitespace-nowrap">
            <SeverityStripe tone={tone} />
            {formatDate(row.expiryDate)}
            <span className="ml-1.5 text-[12.5px] text-gray-500">
              {row.daysToExpiry <= 0
                ? `expired ${Math.abs(row.daysToExpiry)}d ago`
                : `in ${row.daysToExpiry}d`}
            </span>
          </span>
        )
      },
    },
    {
      key: 'onHand',
      header: 'On hand',
      align: 'right',
      cell: (r) => <span className="tabular font-semibold text-gray-900">{r.quantityOnHand.toLocaleString('en-PK')}</span>,
    },
    {
      key: 'reserved',
      header: 'Reserved',
      align: 'right',
      hideOnMobile: true,
      cell: (r) => (
        <span className="tabular text-gray-500">
          {r.quantityReserved > 0 ? r.quantityReserved.toLocaleString('en-PK') : '—'}
        </span>
      ),
    },
    {
      key: 'available',
      header: 'Sellable',
      align: 'right',
      cell: (row) => (
        <span className="tabular font-semibold">
          {/* Expired stock physically exists but is never sellable. */}
          {row.state === 'expired' ? (
            <StatusPill tone="danger">Not sellable</StatusPill>
          ) : (
            row.available.toLocaleString('en-PK')
          )}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          {row.state === 'expired' ? (
            <WriteOffButton batchId={row.id} units={row.quantityOnHand} />
          ) : (
            <AdjustStockDialog
              batchId={row.id}
              batchNumber={row.batchNumber}
              productName={row.productName}
              onHand={row.quantityOnHand}
              reserved={row.quantityReserved}
            />
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Stock is tracked per batch with an expiry date — the only way a recall is actionable."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Batches" value={String(summary.batchCount)} />
        <StatCard
          label="Units on hand"
          value={summary.totalUnits.toLocaleString('en-PK')}
          hint={`${summary.reservedUnits.toLocaleString('en-PK')} reserved`}
        />
        <StatCard
          label={`Expiring < ${EXPIRY_WARNING_DAYS} days`}
          value={String(summary.expiring.length)}
          tone={summary.expiring.length > 0 ? 'warning' : 'neutral'}
        />
        <StatCard
          label="Expired batches"
          value={String(summary.expired.length)}
          tone={summary.expired.length > 0 ? 'danger' : 'neutral'}
          hint={
            summary.unitsAtRisk > 0
              ? `${summary.unitsAtRisk.toLocaleString('en-PK')} units at risk`
              : undefined
          }
        />
      </div>

      {summary.expired.length > 0 && (
        <div className="mb-4 rounded-md border border-red-600/30 bg-red-50 p-4">
          <p className="text-[13.5px] font-semibold text-red-700">
            {summary.expired.length} batch{summary.expired.length === 1 ? '' : 'es'} past expiry
          </p>
          <p className="mt-0.5 text-[13px] text-red-700/90">
            Expired stock is excluded from sellable quantities automatically, but it should still be
            physically quarantined and written off.{' '}
            <Link href="/admin/inventory?state=expired" className="font-semibold underline">
              Review them
            </Link>
            .
          </p>
        </div>
      )}

      <ReceiveBatchForm options={options} pharmacies={PHARMACIES} />

      <FilterBar
        searchPlaceholder="Search batch, product, SKU…"
        selects={[
          {
            key: 'state',
            label: 'Expiry',
            options: [
              { value: 'expired', label: 'Expired' },
              { value: 'expiring', label: 'Expiring soon' },
              { value: 'healthy', label: 'Healthy' },
            ],
          },
          {
            key: 'pharmacy',
            label: 'Pharmacy',
            options: PHARMACIES.map((p) => ({ value: p, label: p })),
          },
        ]}
      />

      <DataTable
        columns={columns}
        rows={result.rows}
        rowKey={(r) => r.id}
        caption="Inventory batches"
        empty={
          <div>
            <p className="text-[14px] font-semibold text-gray-900">No batches match these filters</p>
            <p className="mt-1 text-[13px] text-gray-500">
              Receive stock to create a batch, or clear the filters.
            </p>
          </div>
        }
      />

      <Pagination result={result} searchParams={params} basePath="/admin/inventory" />

      <p className="mt-4 text-[12.5px] text-gray-500">
        Batches are picked first-expired-first-out, so the soonest expiry is always allocated first.
        Reserved units are committed to unshipped orders and cannot be adjusted away.
      </p>
    </>
  )
}
