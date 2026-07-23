import Link from 'next/link'
import { Banknote, ClipboardCheck, Lock, Microscope, Receipt, ShoppingBag } from 'lucide-react'
import { PageHeader, StatCard } from '@/components/admin/ui'
import { Avatar, SegmentedTabs } from '@/components/admin/blocks'
import { DataTable, type Column } from '@/components/admin/data-table'
import { FilterBar } from '@/components/admin/filter-bar'
import { Pagination } from '@/components/admin/pagination'
import {
  OrderStatusPill,
  PaymentStatusPill,
  orderStatusOptions,
  paymentMethodLabels,
} from '@/components/admin/status'
import { adminOrders as seedOrders, getDashboardMetrics, type AdminOrder } from '@/lib/data/admin'
import { allOrders } from '@/lib/data/orders-store'
import { useDb } from '@/lib/data/source'
import { getAdminOrdersDb } from '@/lib/data/db/admin-db'
import { requirePermission } from '@/features/auth/staff/guards'
import { matchesQuery, paginate, param, parsePage } from '@/lib/data/paginate'
import { formatDate, formatPrice } from '@/lib/utils'
import { cities } from '@/config/site'

export const metadata = { title: 'Orders' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function AdminOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission('orders.view')

  const params = await searchParams
  const metrics = await getDashboardMetrics()

  // DB mode: the database IS the order book — no demo rows mixed in.
  // Scaffold mode: checkout-placed orders lead, then the seeded demo rows.
  const liveOrders: AdminOrder[] = useDb()
    ? await getAdminOrdersDb()
    : allOrders().map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerId: o.phone,
        customerName: `${o.firstName} ${o.lastName}`,
        city: o.city,
        placedAt: o.placedAt,
        status: o.status === 'pending' ? 'awaiting_rx' : (o.status as AdminOrder['status']),
        paymentMethod: o.paymentMethod === 'bank_transfer' ? 'cod' : o.paymentMethod,
        paymentStatus: o.paymentStatus === 'paid' ? 'paid' : 'pending',
        itemCount: o.items.length,
        requiresPrescription: o.requiresPrescription,
        hasLabItems: o.hasLabItems,
        totalPaisa: o.totalPaisa,
      }))

  const adminOrders = useDb() ? liveOrders : [...liveOrders, ...seedOrders]

  const query = param(params, 'q')
  const status = param(params, 'status')
  const payment = param(params, 'payment')
  const city = param(params, 'city')

  const filtered = adminOrders.filter(
    (order) =>
      matchesQuery(order, query, ['orderNumber', 'customerName', 'city']) &&
      (!status || order.status === status) &&
      (!payment || order.paymentMethod === payment) &&
      (!city || order.city === city),
  )

  const result = paginate(filtered, parsePage(params.page))

  // Shopify-style status tabs. Hrefs keep the other live filters (q, payment,
  // city) so switching status never silently discards a search.
  function tabHref(target?: string) {
    const qs = new URLSearchParams()
    if (query) qs.set('q', query)
    if (payment) qs.set('payment', payment)
    if (city) qs.set('city', city)
    if (target) qs.set('status', target)
    const s = qs.toString()
    return s ? `/admin/orders?${s}` : '/admin/orders'
  }
  const statusTabs = [
    { label: 'All', href: tabHref(), active: !status, count: adminOrders.length },
    ...orderStatusOptions.map((option) => ({
      label: option.label,
      href: tabHref(option.value),
      active: status === option.value,
      count: adminOrders.filter((o) => o.status === option.value).length,
    })),
  ]

  const columns: Column<AdminOrder>[] = [
    {
      key: 'orderNumber',
      header: 'Order',
      primary: true,
      cell: (order) => (
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/orders/${encodeURIComponent(order.orderNumber)}`}
            className="tabular rounded-sm font-semibold text-blue-600 hover:underline"
          >
            {order.orderNumber}
          </Link>
          {/* Rx and lab flags ride on the order row so the fulfilment team sees
              what a row needs without opening it. */}
          {order.requiresPrescription && (
            <Lock className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-label="Prescription required" />
          )}
          {order.hasLabItems && (
            <Microscope className="h-3.5 w-3.5 shrink-0 text-blue-600" aria-label="Includes lab tests" />
          )}
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      cell: (order) => (
        <Link
          href={`/admin/customers?q=${encodeURIComponent(order.customerName)}`}
          className="flex items-center gap-2.5 rounded-sm hover:text-blue-600"
        >
          <Avatar name={order.customerName} />
          <span className="min-w-0">
            <span className="block truncate font-medium">{order.customerName}</span>
            <span className="block truncate text-[12px] text-gray-500">{order.city}</span>
          </span>
        </Link>
      ),
    },
    {
      key: 'placedAt',
      header: 'Placed',
      cell: (o) => <span className="whitespace-nowrap">{formatDate(o.placedAt)}</span>,
    },
    { key: 'status', header: 'Status', cell: (o) => <OrderStatusPill status={o.status} /> },
    {
      key: 'payment',
      header: 'Payment',
      cell: (order) => (
        <div className="flex flex-col items-end gap-1 md:items-start">
          <PaymentStatusPill status={order.paymentStatus} />
          <span className="text-[12.5px] text-gray-500">
            {paymentMethodLabels[order.paymentMethod]}
          </span>
        </div>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      align: 'right',
      hideOnMobile: true,
      cell: (o) => <span className="tabular">{o.itemCount}</span>,
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      cell: (o) => <span className="tabular font-semibold text-gray-900">{formatPrice(o.totalPaisa)}</span>,
    },
  ]

  return (
    <>
      <PageHeader title="Orders" description="Every order across medicines and diagnostics." />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total orders" icon={ShoppingBag} value={String(adminOrders.length)} />
        <StatCard
          label="Awaiting Rx" icon={ClipboardCheck}
          value={String(metrics.awaitingRx)}
          tone={metrics.awaitingRx > 0 ? 'warning' : 'neutral'}
        />
        <StatCard label="COD uncollected" icon={Banknote} value={formatPrice(metrics.codPendingPaisa)} tone="warning" />
        <StatCard label="Average order" icon={Receipt} value={formatPrice(metrics.averageOrderPaisa)} />
      </div>

      <SegmentedTabs tabs={statusTabs} label="Order status" />

      <FilterBar
        searchPlaceholder="Search order number, customer, city…"
        selects={[
          {
            key: 'payment',
            label: 'Payment',
            options: Object.entries(paymentMethodLabels).map(([value, label]) => ({ value, label })),
          },
          { key: 'city', label: 'City', options: cities.map((c) => ({ value: c, label: c })) },
        ]}
      />

      <DataTable
        columns={columns}
        rows={result.rows}
        rowKey={(o) => o.id}
        caption="Orders"
        empty={
          <div>
            <p className="text-[14px] font-semibold text-gray-900">No orders match these filters</p>
            <p className="mt-1 text-[13px] text-gray-500">Try clearing the filters or search term.</p>
          </div>
        }
      />

      <Pagination result={result} searchParams={params} basePath="/admin/orders" />
    </>
  )
}
