import { Banknote, Download, Microscope, Receipt, Wallet } from 'lucide-react'
import { BarChart, PageHeader, Panel, StatCard } from '@/components/admin/ui'
import { DataTable, type Column } from '@/components/admin/data-table'
import { Button } from '@/components/ui/button'
import {
  getAdminBookings,
  getAdminCustomers,
  getAdminOrders,
  getDashboardMetrics,
  getRevenueSeries,
} from '@/lib/data/admin'
import { getTopProducts } from '@/lib/data/admin-catalog'
import { formatPrice } from '@/lib/utils'
import { cities } from '@/config/site'

export const metadata = { title: 'Reports' }

export default async function AdminReportsPage() {
  const metrics = await getDashboardMetrics()
  const series = await getRevenueSeries()
  const topProducts = await getTopProducts(8)
  const adminOrders = await getAdminOrders()
  const adminCustomers = await getAdminCustomers()
  const adminBookings = await getAdminBookings()

  // Revenue by city, so operations can see where fulfilment pressure sits.
  const byCity = cities
    .map((city) => {
      const cityOrders = adminOrders.filter((o) => o.city === city)
      return {
        city,
        orders: cityOrders.length,
        revenuePaisa: cityOrders.reduce((sum, o) => sum + o.totalPaisa, 0),
        customers: adminCustomers.filter((c) => c.city === city).length,
      }
    })
    .filter((row) => row.orders > 0)
    .sort((a, b) => b.revenuePaisa - a.revenuePaisa)

  const byPayment = (['cod', 'jazzcash', 'easypaisa'] as const).map((method) => {
    const rows = adminOrders.filter((o) => o.paymentMethod === method)
    return {
      method,
      label: { cod: 'Cash on delivery', jazzcash: 'JazzCash', easypaisa: 'Easypaisa' }[method],
      orders: rows.length,
      revenuePaisa: rows.reduce((sum, o) => sum + o.totalPaisa, 0),
      share: Math.round((rows.length / adminOrders.length) * 100),
    }
  })

  const cityColumns: Column<(typeof byCity)[number]>[] = [
    { key: 'city', header: 'City', primary: true, cell: (r) => <span className="font-semibold text-gray-900">{r.city}</span> },
    { key: 'customers', header: 'Customers', align: 'right', cell: (r) => <span className="tabular">{r.customers}</span> },
    { key: 'orders', header: 'Orders', align: 'right', cell: (r) => <span className="tabular">{r.orders}</span> },
    {
      key: 'revenue',
      header: 'Revenue',
      align: 'right',
      cell: (r) => <span className="tabular font-semibold text-gray-900">{formatPrice(r.revenuePaisa)}</span>,
    },
  ]

  return (
    <>
      <PageHeader
        title="Reports"
        description="Sales, fulfilment, and payment mix. Figures come from the dummy dataset."
        action={
          <Button size="sm" variant="outline">
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Revenue (delivered)" icon={Banknote} value={formatPrice(metrics.revenuePaisa)} delta="↑ 12% vs last month" />
        <StatCard label="Average order" icon={Receipt} value={formatPrice(metrics.averageOrderPaisa)} />
        <StatCard label="Lab bookings" icon={Microscope} value={String(adminBookings.length)} />
        <StatCard label="COD uncollected" icon={Wallet} value={formatPrice(metrics.codPendingPaisa)} tone="warning" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Revenue, last 14 days">
          <BarChart
            data={series.map((point) => ({ label: point.label, value: point.revenuePaisa }))}
            format={formatPrice}
          />
        </Panel>
        <Panel title="Orders, last 14 days">
          <BarChart
            data={series.map((point) => ({ label: point.label, value: point.orderCount }))}
            format={(value) => `${value} order${value === 1 ? '' : 's'}`}
          />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Payment mix">
          <ul className="flex flex-col gap-4">
            {byPayment.map((row) => (
              <li key={row.method}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="text-[13.5px] font-semibold text-gray-900">{row.label}</span>
                  <span className="tabular text-[13px] text-gray-500">
                    {row.orders} orders · {formatPrice(row.revenuePaisa)}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <span className="block h-full bg-blue-600" style={{ width: `${row.share}%` }} />
                  </span>
                  <span className="tabular w-9 shrink-0 text-right text-[12.5px] font-semibold text-gray-700">
                    {row.share}%
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-5 border-t border-gray-200 pt-4 text-[12.5px] text-gray-500">
            Cash counts as revenue only once the courier remits it — reconcile COD weekly against
            the amount actually collected.
          </p>
        </Panel>

        <Panel title="Fulfilment status">
          <ul className="flex flex-col gap-2.5">
            {(
              [
                ['Delivered', 'delivered', 'bg-green-600'],
                ['Shipped', 'shipped', 'bg-blue-600'],
                ['Processing', 'processing', 'bg-blue-500'],
                ['Awaiting Rx', 'awaiting_rx', 'bg-amber-600'],
                ['Delivery failed', 'delivery_failed', 'bg-red-600'],
                ['Cancelled', 'cancelled', 'bg-gray-400'],
              ] as const
            ).map(([label, status, color]) => {
              const count = adminOrders.filter((o) => o.status === status).length
              const percent = Math.round((count / adminOrders.length) * 100)
              return (
                <li key={status} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-[13px] text-gray-700">{label}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <span className={`block h-full ${color}`} style={{ width: `${percent}%` }} />
                  </span>
                  <span className="tabular w-14 shrink-0 text-right text-[12.5px] text-gray-500">
                    {count} · {percent}%
                  </span>
                </li>
              )
            })}
          </ul>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Ranked bars, not a table: comparison is the question here, and
            length answers it faster than digits. */}
        <Panel title="Top products by revenue">
          {(() => {
            const maxRevenue = Math.max(...topProducts.map((p) => p.revenuePaisa), 1)
            return (
              <ol className="flex flex-col gap-4">
                {topProducts.map((product, i) => (
                  <li key={product.id}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gray-100 text-[11px] font-bold text-gray-500">
                          {i + 1}
                        </span>
                        <span className="text-base" aria-hidden="true">{product.icon}</span>
                        <span className="truncate text-[13px] font-semibold text-gray-900">
                          {product.name}
                        </span>
                      </span>
                      <span className="tabular shrink-0 text-[12.5px] text-gray-500">
                        {product.unitsSold} units · <span className="font-semibold text-gray-900">{formatPrice(product.revenuePaisa)}</span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <span
                        className="block h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-500"
                        style={{ width: `${Math.max(2, (product.revenuePaisa / maxRevenue) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ol>
            )
          })()}
        </Panel>

        <section>
          <h2 className="mb-3 text-[14px] font-bold text-gray-900">Revenue by city</h2>
          <DataTable columns={cityColumns} rows={byCity} rowKey={(r) => r.city} caption="Revenue by city" />
        </section>
      </div>
    </>
  )
}
