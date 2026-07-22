import Link from 'next/link'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { BarChart, PageHeader, Panel, SeverityStripe, StatCard } from '@/components/admin/ui'
import { DataTable, type Column } from '@/components/admin/data-table'
import { OrderStatusPill } from '@/components/admin/status'
import {
  ADMIN_NOW,
  adminOrders,
  getDashboardMetrics,
  getRevenueSeries,
  type AdminOrder,
} from '@/lib/data/admin'
import {
  getInventorySummary,
  getTopProducts,
  type BatchRow,
} from '@/lib/data/admin-catalog'
import { useDb } from '@/lib/data/source'
import { getAdminOrdersDb } from '@/lib/data/db/admin-db'
import { formatDate, formatPrice } from '@/lib/utils'

export const metadata = { title: 'Dashboard' }

export default async function AdminDashboardPage() {
  const metrics = await getDashboardMetrics()
  const inventory = await getInventorySummary()
  const series = await getRevenueSeries()
  const topProducts = await getTopProducts()
  const recentOrders = useDb()
    ? (await getAdminOrdersDb()).slice(0, 6)
    : adminOrders.slice(0, 6)

  // Expired first, then soonest to expire — the order staff act on.
  const attentionBatches = [...inventory.expired, ...inventory.expiring]

  const orderColumns: Column<AdminOrder>[] = [
    {
      key: 'order',
      header: 'Order',
      primary: true,
      cell: (order) => (
        <Link
          href={`/admin/orders?q=${order.orderNumber}`}
          className="tabular rounded-sm font-semibold text-blue-600 hover:underline"
        >
          {order.orderNumber}
        </Link>
      ),
    },
    { key: 'customer', header: 'Customer', cell: (o) => o.customerName },
    { key: 'status', header: 'Status', cell: (o) => <OrderStatusPill status={o.status} /> },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      cell: (o) => <span className="tabular font-semibold text-gray-900">{formatPrice(o.totalPaisa)}</span>,
    },
  ]

  const batchColumns: Column<BatchRow>[] = [
    {
      key: 'batch',
      header: 'Batch',
      primary: true,
      cell: (batch) => <span className="tabular font-semibold text-gray-900">{batch.batchNumber}</span>,
    },
    { key: 'product', header: 'Product', cell: (b) => b.productName },
    {
      key: 'expiry',
      header: 'Expiry',
      cell: (batch) => (
        <span className="whitespace-nowrap">
          <SeverityStripe tone={batch.state === 'expired' ? 'danger' : 'warning'} />
          {formatDate(batch.expiryDate)}
          <span className="ml-1.5 text-gray-500">
            {batch.daysToExpiry <= 0
              ? `expired ${Math.abs(batch.daysToExpiry)}d ago`
              : `in ${batch.daysToExpiry}d`}
          </span>
        </span>
      ),
    },
    {
      key: 'qty',
      header: 'Qty',
      align: 'right',
      cell: (b) => <span className="tabular">{b.quantityOnHand.toLocaleString('en-PK')}</span>,
    },
  ]

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Overview for ${formatDate(new Date(ADMIN_NOW))}. All figures are from the dummy dataset.`}
      />

      {/* Summary before detail: what needs attention reads at a glance. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Revenue (delivered)"
          value={formatPrice(metrics.revenuePaisa)}
          delta="↑ 12% vs last month"
        />
        <StatCard label="Orders" value={String(metrics.orderCount)} hint={`${metrics.customerCount} customers`} />
        <StatCard
          label="Awaiting Rx"
          value={String(metrics.awaitingRx)}
          tone={metrics.awaitingRx > 0 ? 'warning' : 'neutral'}
          hint="Blocked until verified"
        />
        <StatCard
          label="Batches at risk"
          value={String(inventory.expiring.length + inventory.expired.length)}
          tone={inventory.expired.length > 0 ? 'danger' : 'warning'}
          hint={`${inventory.expired.length} already expired`}
        />
      </div>

      {/* COD remittance is a real and material source of loss here, so it gets
          dashboard space rather than being buried in a report. */}
      {metrics.codPendingPaisa > 0 && (
        <div className="mt-3 flex items-start gap-3 rounded-md border border-gray-200 bg-white p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-[13.5px] font-semibold text-gray-900">
              {formatPrice(metrics.codPendingPaisa)} in cash on delivery not yet collected
            </p>
            <p className="mt-0.5 text-[13px] text-gray-500">
              Cash counts as revenue only once the courier remits it. Reconcile weekly.
            </p>
          </div>
          <Link
            href="/admin/reports"
            className="shrink-0 rounded-sm text-[13px] font-semibold text-blue-600 hover:underline"
          >
            View report
          </Link>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Revenue, last 14 days" className="lg:col-span-2">
          <BarChart
            data={series.map((point) => ({ label: point.label, value: point.revenuePaisa }))}
            format={formatPrice}
          />
        </Panel>

        <Panel title="Top products by revenue">
          <ol className="flex flex-col gap-3">
            {topProducts.map((product, i) => (
              <li key={product.id} className="flex items-center gap-3">
                <span className="tabular w-4 shrink-0 text-[12.5px] font-bold text-gray-400">
                  {i + 1}
                </span>
                <span className="text-lg" aria-hidden="true">
                  {product.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-gray-900">{product.name}</p>
                  <p className="tabular text-[12.5px] text-gray-500">{product.unitsSold} units</p>
                </div>
                <span className="tabular shrink-0 text-[13px] font-semibold text-gray-900">
                  {formatPrice(product.revenuePaisa)}
                </span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[14px] font-bold text-gray-900">Recent orders</h2>
            <Link
              href="/admin/orders"
              className="flex items-center gap-1 rounded-sm text-[13px] font-semibold text-blue-600 hover:underline"
            >
              All orders
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
          <DataTable
            columns={orderColumns}
            rows={recentOrders}
            rowKey={(o) => o.id}
            caption="Six most recent orders"
          />
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[14px] font-bold text-gray-900">Batches needing attention</h2>
            <Link
              href="/admin/inventory"
              className="flex items-center gap-1 rounded-sm text-[13px] font-semibold text-blue-600 hover:underline"
            >
              All inventory
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
          <DataTable
            columns={batchColumns}
            rows={attentionBatches.slice(0, 6)}
            rowKey={(b) => b.id}
            caption="Batches expired or expiring within 90 days"
            empty={<p className="text-[13.5px] text-green-700">No batches expiring soon.</p>}
          />
        </section>
      </div>
    </>
  )
}
