import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  BarChart3,
  Bell,
  ClipboardCheck,
  Layers,
  Microscope,
  Plus,
  ShoppingBag,
  Star,
  Tag,
  Users,
} from 'lucide-react'
import { BarChart, PageHeader, Panel, SeverityStripe, StatCard, StatusPill } from '@/components/admin/ui'
import { DataTable, type Column } from '@/components/admin/data-table'
import { OrderStatusPill } from '@/components/admin/status'
import { RatingStars } from '@/components/shared/rating-stars'
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
import { getAdminReviews, type AdminReview } from '@/features/reviews/queries'
import { getNotifications } from '@/features/notifications/queries'
import { requireUser } from '@/features/auth/staff/guards'
import { useDb } from '@/lib/data/source'
import { getAdminOrdersDb } from '@/lib/data/db/admin-db'
import { formatDate, formatPrice } from '@/lib/utils'

export const metadata = { title: 'Dashboard' }

/** "↑ 12.5% vs last week" from a 14-day series — a real trend, not a stub. */
function weekTrend(values: number[]): string | undefined {
  if (values.length < 14) return undefined
  const prev = values.slice(0, 7).reduce((a, b) => a + b, 0)
  const last = values.slice(7).reduce((a, b) => a + b, 0)
  if (prev === 0) return undefined
  const percent = ((last - prev) / prev) * 100
  const arrow = percent >= 0 ? '↑' : '↓'
  return `${arrow} ${Math.abs(percent).toFixed(1)}% vs last week`
}

const QUICK_ACTIONS = [
  { label: 'Add product', href: '/admin/products/new', icon: Plus },
  { label: 'Verify prescriptions', href: '/admin/prescriptions', icon: ClipboardCheck },
  { label: 'Moderate reviews', href: '/admin/reviews', icon: Star },
  { label: 'Add stock', href: '/admin/inventory', icon: Layers },
  { label: 'Coupons', href: '/admin/coupons', icon: Tag },
  { label: 'Reports', href: '/admin/reports', icon: BarChart3 },
] as const

const REVIEW_TONES = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  hidden: 'neutral',
} as const

export default async function AdminDashboardPage() {
  // Session is React-cached by the layout's guard — no extra lookup.
  const user = await requireUser('/admin')
  const db = useDb()
  const [metrics, inventory, series, topProducts, recentOrders, reviews, notifications] =
    await Promise.all([
      getDashboardMetrics(),
      getInventorySummary(),
      getRevenueSeries(),
      getTopProducts(),
      db ? getAdminOrdersDb().then((o) => o.slice(0, 6)) : Promise.resolve(adminOrders.slice(0, 6)),
      db ? getAdminReviews().catch(() => [] as AdminReview[]) : Promise.resolve([] as AdminReview[]),
      getNotifications(5).catch(() => []),
    ])

  // Expired first, then soonest to expire — the order staff act on.
  const attentionBatches = [...inventory.expired, ...inventory.expiring]
  const recentReviews = reviews.slice(0, 4)

  const revenueTrend = weekTrend(series.map((p) => p.revenuePaisa))
  const ordersTrend = weekTrend(series.map((p) => p.orderCount))

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
        title={`Welcome back, ${user.name.split(' ')[0]}`}
        description={`Store performance at a glance — ${formatDate(db ? new Date() : new Date(ADMIN_NOW))}.`}
        action={
          <Link
            href="/admin/products/new"
            className="flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-[13.5px] font-semibold text-white shadow-e1 transition-all duration-medium hover:bg-blue-700 hover:shadow-e2"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add product
          </Link>
        }
      />

      {/* Summary before detail: what needs attention reads at a glance. */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Revenue (delivered)"
          value={formatPrice(metrics.revenuePaisa)}
          delta={revenueTrend}
          icon={Banknote}
        />
        <StatCard
          label="Orders"
          value={String(metrics.orderCount)}
          delta={ordersTrend}
          hint={`Avg ${formatPrice(metrics.averageOrderPaisa)}`}
          icon={ShoppingBag}
        />
        <StatCard
          label="Customers"
          value={String(metrics.customerCount)}
          hint="Registered accounts"
          icon={Users}
        />
        <StatCard
          label="Awaiting Rx"
          value={String(metrics.awaitingRx)}
          tone={metrics.awaitingRx > 0 ? 'warning' : 'neutral'}
          hint="Blocked until verified"
          icon={ClipboardCheck}
        />
        <StatCard
          label="Lab bookings"
          value={String(metrics.pendingBookings)}
          hint="Awaiting collection"
          icon={Microscope}
        />
      </div>

      {/* COD remittance is a real and material source of loss here, so it gets
          dashboard space rather than being buried in a report. */}
      {metrics.codPendingPaisa > 0 && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-600/25 bg-amber-50 p-4 shadow-e1">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-[13.5px] font-semibold text-gray-900">
              {formatPrice(metrics.codPendingPaisa)} in cash on delivery not yet collected
            </p>
            <p className="mt-0.5 text-[13px] text-gray-600">
              Cash counts as revenue only once the courier remits it. Reconcile weekly.
            </p>
          </div>
          <Link
            href="/admin/reports"
            className="shrink-0 rounded-sm text-[13px] font-semibold text-amber-700 hover:underline"
          >
            View report
          </Link>
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel title="Revenue, last 14 days" className="lg:col-span-2">
          <BarChart
            data={series.map((point) => ({ label: point.label, value: point.revenuePaisa }))}
            format={formatPrice}
          />
        </Panel>

        <Panel
          title="Top selling products"
          action={
            <Link
              href="/admin/products"
              className="rounded-sm text-[12.5px] font-semibold text-blue-600 hover:underline"
            >
              View all
            </Link>
          }
        >
          <ol className="flex flex-col gap-3.5">
            {topProducts.map((product, i) => (
              <li key={product.id} className="flex items-center gap-3">
                <span className="tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-100 text-[12px] font-bold text-gray-500">
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

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Orders, last 7 days">
          <BarChart
            data={series.slice(-7).map((point) => ({ label: point.label, value: point.orderCount }))}
            format={(value) => `${value} order${value === 1 ? '' : 's'}`}
          />
        </Panel>

        <Panel
          title="Recent reviews"
          action={
            <Link
              href="/admin/reviews"
              className="rounded-sm text-[12.5px] font-semibold text-blue-600 hover:underline"
            >
              Moderate
            </Link>
          }
        >
          {recentReviews.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-gray-500">
              No reviews yet — they appear as customers rate delivered orders.
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {recentReviews.map((review) => (
                <li key={review.id} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-[13px] font-semibold text-gray-900">
                      {review.productName}
                    </span>
                    <StatusPill tone={REVIEW_TONES[review.status]}>
                      {review.status.charAt(0).toUpperCase() + review.status.slice(1)}
                    </StatusPill>
                  </div>
                  <div className="flex items-center gap-2">
                    <RatingStars rating={review.rating} />
                    <span className="truncate text-[12.5px] text-gray-500">
                      {review.reviewerName}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title="Quick actions">
            <div className="grid grid-cols-2 gap-2">
              {QUICK_ACTIONS.map((action) => (
                <Link
                  key={action.href + action.label}
                  href={action.href}
                  className="group flex items-center gap-2.5 rounded-md border border-gray-200/80 px-3 py-2.5 text-[12.5px] font-semibold text-gray-700 transition-all duration-medium hover:-translate-y-0.5 hover:border-blue-600/30 hover:bg-blue-50/50 hover:text-blue-700 hover:shadow-e1"
                >
                  <action.icon
                    className="h-4 w-4 shrink-0 text-gray-400 transition-colors duration-medium group-hover:text-blue-600"
                    aria-hidden="true"
                  />
                  <span className="truncate">{action.label}</span>
                </Link>
              ))}
            </div>
          </Panel>

          <Panel
            title="Latest notifications"
            action={
              <Link
                href="/admin/notifications"
                className="rounded-sm text-[12.5px] font-semibold text-blue-600 hover:underline"
              >
                All
              </Link>
            }
          >
            {notifications.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-gray-500">All caught up.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {notifications.map((n) => (
                  <li key={n.id} className="flex items-start gap-2.5">
                    <span
                      className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                        n.readAt ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 text-blue-600'
                      }`}
                    >
                      <Bell className="h-3 w-3" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      {n.linkUrl ? (
                        <Link
                          href={n.linkUrl}
                          className="block truncate rounded-sm text-[13px] font-semibold text-gray-900 hover:text-blue-600"
                        >
                          {n.title}
                        </Link>
                      ) : (
                        <p className="truncate text-[13px] font-semibold text-gray-900">{n.title}</p>
                      )}
                      <p className="text-[11.5px] text-gray-500">{formatDate(n.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
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
            <h2 className="text-[14px] font-bold text-gray-900">Stock needing attention</h2>
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
