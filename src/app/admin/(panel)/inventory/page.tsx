import Link from 'next/link'
import { AlertTriangle, Boxes, Clock, Layers, PackageSearch } from 'lucide-react'
import { PageHeader, Panel, SeverityStripe, StatCard, StatusPill } from '@/components/admin/ui'
import { AdminEmptyState, DistributionBar, SegmentedTabs } from '@/components/admin/blocks'
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

  const healthyCount = rows.filter((r) => r.state === 'healthy').length

  // Expiry-state tabs — the primary way staff slice this list.
  function tabHref(target?: string) {
    const qs = new URLSearchParams()
    if (query) qs.set('q', query)
    if (pharmacy) qs.set('pharmacy', pharmacy)
    if (target) qs.set('state', target)
    const s = qs.toString()
    return s ? `/admin/inventory?${s}` : '/admin/inventory'
  }
  const stateTabs = [
    { label: 'All batches', href: tabHref(), active: !state, count: rows.length },
    { label: 'Healthy', href: tabHref('healthy'), active: state === 'healthy', count: healthyCount },
    { label: 'Expiring soon', href: tabHref('expiring'), active: state === 'expiring', count: summary.expiring.length },
    { label: 'Expired', href: tabHref('expired'), active: state === 'expired', count: summary.expired.length },
  ]

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
    { key: 'pharmacy', header: 'Branch', cell: (r) => r.pharmacy, hideOnMobile: true },
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
        <StatCard label="Batches" icon={Layers} value={String(summary.batchCount)} />
        <StatCard
          label="Units on hand" icon={Boxes}
          value={summary.totalUnits.toLocaleString('en-PK')}
          hint={`${summary.reservedUnits.toLocaleString('en-PK')} reserved`}
        />
        <StatCard
          label={`Expiring < ${EXPIRY_WARNING_DAYS} days`} icon={Clock}
          value={String(summary.expiring.length)}
          tone={summary.expiring.length > 0 ? 'warning' : 'neutral'}
        />
        <StatCard
          label="Expired batches" icon={AlertTriangle}
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

      {/* Composition before detail: one bar answers "how healthy is the
          shelf?" before anyone reads a row. */}
      <Panel title="Stock health" className="mb-4">
        <DistributionBar
          segments={[
            { label: 'Healthy batches', value: healthyCount, colorClass: 'bg-green-600' },
            { label: 'Expiring soon', value: summary.expiring.length, colorClass: 'bg-amber-600' },
            { label: 'Expired', value: summary.expired.length, colorClass: 'bg-red-600' },
          ]}
        />
      </Panel>

      <ReceiveBatchForm options={options} pharmacies={PHARMACIES} />

      <SegmentedTabs tabs={stateTabs} label="Batch expiry state" />

      <FilterBar
        searchPlaceholder="Search batch, product, SKU…"
        selects={[
          {
            key: 'pharmacy',
            label: 'Branch',
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
          <AdminEmptyState
            icon={PackageSearch}
            title="No batches match these filters"
            description="Receive stock to create a batch, or switch to another expiry tab."
          />
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
