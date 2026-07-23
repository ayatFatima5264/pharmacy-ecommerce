import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  Banknote,
  CalendarClock,
  ChevronLeft,
  Clock,
  Lock,
  Mail,
  MapPin,
  Microscope,
  Phone,
  ShoppingBag,
  StickyNote,
} from 'lucide-react'
import { Panel, StatusPill } from '@/components/admin/ui'
import { Avatar, MetaItem } from '@/components/admin/blocks'
import { StatusControl, ResendEmailButton } from '@/features/orders/components/status-control'
import { can, requirePermission } from '@/features/auth/staff/guards'
import { findOrderByNumber } from '@/lib/data/orders-store'
import { findBookingsByOrder } from '@/lib/data/lab-store'
import { useDb } from '@/lib/data/source'
import { findAdminOrderDb, getOrderBookingsDb } from '@/lib/data/db/admin-db'
import { STATUS_LABELS, STATUS_TONES, type OrderStatus } from '@/features/orders/status-machine'
import { PAYMENT_METHODS } from '@/config/locations'
import { formatDateTime, formatPrice } from '@/lib/utils'

type Params = Promise<{ orderNumber: string }>

export async function generateMetadata({ params }: { params: Params }) {
  const { orderNumber } = await params
  return { title: `Order ${decodeURIComponent(orderNumber)}` }
}

export default async function AdminOrderDetailPage({ params }: { params: Params }) {
  // Page-level guard. The status action re-checks independently, because a
  // Server Action can be invoked without this page ever rendering.
  await requirePermission('orders.view')
  const canUpdateStatus = await can('orders.update_status')

  const { orderNumber } = await params
  const decoded = decodeURIComponent(orderNumber)

  let order
  let bookings
  if (useDb()) {
    const detail = await findAdminOrderDb(decoded)
    if (!detail) notFound()
    order = detail.order
    bookings = await getOrderBookingsDb(detail.dbId)
  } else {
    const found = findOrderByNumber(decoded)
    if (!found) notFound()
    order = found
    bookings = findBookingsByOrder(order.orderNumber)
  }
  const method = PAYMENT_METHODS.find((m) => m.id === order.paymentMethod)
  const status = order.status as OrderStatus

  return (
    <>
      <Link
        href="/admin/orders"
        className="mb-4 inline-flex items-center gap-1 rounded-sm text-[13px] font-semibold text-gray-500 hover:text-blue-600"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back to orders
      </Link>

      {/* ERP-style header band: identity on the left, the three numbers every
          question about this order starts from on the right. */}
      <header className="mb-6 rounded-lg border border-gray-200/80 bg-white p-6 shadow-e1">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="tabular text-[26px] font-bold leading-tight tracking-[-0.02em] text-gray-900">
                {order.orderNumber}
              </h1>
              <StatusPill tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</StatusPill>
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-gray-500">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              Placed {formatDateTime(order.placedAt)}
            </p>
          </div>

          <dl className="flex flex-wrap gap-x-10 gap-y-3">
            <div>
              <dt className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-gray-400">
                <Banknote className="h-3.5 w-3.5" aria-hidden="true" />
                Total
              </dt>
              <dd className="tabular mt-1 text-[20px] font-bold leading-none text-gray-900">
                {formatPrice(order.totalPaisa)}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-gray-400">
                <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />
                Items
              </dt>
              <dd className="tabular mt-1 text-[20px] font-bold leading-none text-gray-900">
                {order.items.length}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-gray-400">
                <Banknote className="h-3.5 w-3.5" aria-hidden="true" />
                Payment
              </dt>
              <dd className="mt-1 text-[20px] font-bold leading-none text-gray-900">
                {method?.label ?? order.paymentMethod}
              </dd>
            </div>
          </dl>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="flex flex-col gap-4">
          <Panel title="Items">
            <ul className="flex flex-col gap-3">
              {order.items.map((item, i) => (
                <li key={`${item.slug}-${i}`} className="flex items-center gap-3">
                  <span className="text-lg" aria-hidden="true">
                    {item.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-gray-900">
                      {item.name}
                      {item.requiresPrescription && (
                        <Lock
                          className="ml-1.5 inline h-3 w-3 align-[-1px] text-amber-600"
                          aria-label="Prescription required"
                        />
                      )}
                    </p>
                    <p className="truncate text-[12.5px] text-gray-500">
                      {item.subtitle}
                      {item.kind === 'product' && ` x ${item.quantity}`}
                    </p>
                  </div>
                  <span className="tabular shrink-0 text-[13.5px] font-semibold text-gray-900">
                    {formatPrice(item.lineTotalPaisa)}
                  </span>
                </li>
              ))}
            </ul>

            <dl className="tabular mt-4 flex flex-col gap-1.5 border-t border-gray-200 pt-4 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-gray-500">Subtotal</dt>
                <dd>{formatPrice(order.subtotalPaisa)}</dd>
              </div>
              {order.discountPaisa > 0 && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Discount ({order.couponCode})</dt>
                  <dd className="text-green-700">- {formatPrice(order.discountPaisa)}</dd>
                </div>
              )}
              {order.taxPaisa > 0 && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Tax</dt>
                  <dd>{formatPrice(order.taxPaisa)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500">Delivery</dt>
                <dd>{order.shippingPaisa === 0 ? 'Free' : formatPrice(order.shippingPaisa)}</dd>
              </div>
              <div className="mt-1.5 flex justify-between border-t border-gray-200 pt-2 text-[15px] font-bold">
                <dt>Total</dt>
                <dd>{formatPrice(order.totalPaisa)}</dd>
              </div>
            </dl>
          </Panel>

          {bookings.map((booking) => (
            <Panel key={booking.id} title={`Lab appointment ${booking.bookingNumber}`}>
              <div className="flex items-start gap-3">
                <Microscope className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
                <div className="text-[13px]">
                  <p className="font-semibold text-gray-900">
                    {booking.slotDate} · {booking.slotLabel}
                  </p>
                  <p className="mt-0.5 text-gray-500">
                    {booking.patientName}, age {booking.patientAge}, {booking.patientGender} ·{' '}
                    {booking.patientPhone}
                  </p>
                  <p className="mt-0.5 text-gray-500">
                    {booking.collectionMode === 'home' ? 'Home collection' : 'Lab visit'} ·{' '}
                    {booking.tests.map((t) => t.shortCode).join(', ')}
                  </p>
                  {booking.fastingHours !== null && (
                    <p className="mt-1 text-amber-700">Fasting {booking.fastingHours}h required</p>
                  )}
                </div>
              </div>
            </Panel>
          ))}

          {/* Append-only history: who moved this order, when, and why. */}
          <Panel title="History">
            {order.statusHistory.length === 0 ? (
              <p className="text-[13px] text-gray-500">
                No status changes yet. The order was created as{' '}
                {STATUS_LABELS[status].toLowerCase()}.
              </p>
            ) : (
              // Timeline: newest first, a connected rail so the order's journey
              // reads as one line rather than a list of isolated events.
              <ol className="relative flex flex-col gap-5 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-gray-200">
                {[...order.statusHistory].reverse().map((entry, i) => (
                  <li key={i} className="relative flex gap-4 text-[13px]">
                    <span
                      className={`relative z-10 mt-0.5 flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full ring-4 ring-white ${
                        i === 0 ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                      aria-hidden="true"
                    >
                      {i === 0 && <Clock className="h-2.5 w-2.5 text-white" />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-gray-900">
                        <span className="text-gray-500">{STATUS_LABELS[entry.from as OrderStatus]}</span>
                        {' → '}
                        <strong className="font-semibold">
                          {STATUS_LABELS[entry.to as OrderStatus]}
                        </strong>
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-gray-500">
                        {formatDateTime(entry.at)} by {entry.byUserName}
                      </p>
                      {entry.note && (
                        <p className="mt-1.5 rounded-md bg-gray-50 px-2.5 py-1.5 text-gray-700">
                          {entry.note}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel title="Update status">
            {canUpdateStatus ? (
              <StatusControl
                orderNumber={order.orderNumber}
                current={status}
                hasEmail={Boolean(order.email)}
              />
            ) : (
              <div className="flex items-start gap-2.5 rounded-md bg-gray-50 p-3.5 text-[12.5px] leading-relaxed text-gray-500">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                <p>
                  Your role can monitor orders but not change their status. Please contact your
                  Administrator if this order needs an update.
                </p>
              </div>
            )}
          </Panel>

          <Panel title="Customer">
            <div className="mb-4 flex items-center gap-3 border-b border-gray-100 pb-4">
              <Avatar name={`${order.firstName} ${order.lastName}`} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-[14px] font-bold text-gray-900">
                  {order.firstName} {order.lastName}
                </p>
                <Link
                  href={`/admin/customers?q=${encodeURIComponent(`${order.firstName} ${order.lastName}`)}`}
                  className="text-[12.5px] font-semibold text-blue-600 hover:underline"
                >
                  View customer
                </Link>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <MetaItem icon={Phone} label="Phone">
                <span className="tabular">{order.phone}</span>
              </MetaItem>
              <MetaItem icon={Mail} label="Email">
                <span className="break-all">{order.email ?? 'Not provided'}</span>
              </MetaItem>
              <MetaItem icon={MapPin} label="Delivering to">
                {order.address}, {order.city}, {order.province}
                {order.postalCode ? ` ${order.postalCode}` : ''}
              </MetaItem>
              {order.notes && (
                <MetaItem icon={StickyNote} label="Customer note">
                  {order.notes}
                </MetaItem>
              )}
            </div>
          </Panel>

          <Panel title="Payment & notifications">
            <dl className="flex flex-col gap-2.5 text-[13px]">
              <div>
                <dt className="text-gray-500">Method</dt>
                <dd className="font-semibold text-gray-900">{method?.label}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Last email</dt>
                <dd className="text-gray-900">
                  {order.emailStatus === 'sent' && 'Delivered to the customer'}
                  {order.emailStatus === 'skipped' && 'Not sent — email is not configured'}
                  {order.emailStatus === 'failed' && 'Failed to send'}
                  {order.emailStatus === 'not_applicable' && 'No email address on file'}
                </dd>
              </div>
            </dl>
            {order.email && (
              <div className="mt-3 border-t border-gray-200 pt-3">
                <ResendEmailButton orderNumber={order.orderNumber} />
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  )
}
