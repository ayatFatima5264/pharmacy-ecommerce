import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CheckCircle2, ChevronLeft } from 'lucide-react'
import { requireCustomer } from '@/features/auth/customer/guards'
import { getMyOrder } from '@/features/account/queries'
import { isSupabaseConfigured } from '@/config/env'
import { PAYMENT_METHODS } from '@/config/locations'
import { formatDate, formatDateTime, formatPrice } from '@/lib/utils'

export const metadata: Metadata = { title: 'Order details', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Awaiting payment',
  awaiting_rx: 'Prescription under review',
  confirmed: 'Order confirmed',
  processing: 'Being prepared',
  partially_shipped: 'Partially shipped',
  shipped: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export default async function MyOrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>
}) {
  await requireCustomer('/account/orders')
  const { orderNumber } = await params
  if (!isSupabaseConfigured()) notFound()

  const order = await getMyOrder(decodeURIComponent(orderNumber))
  if (!order) notFound()

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/account/orders"
        className="mb-4 inline-flex items-center gap-1 text-body-sm font-semibold text-gray-500 hover:text-blue-600"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        My orders
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-h1">{order.orderNumber}</h1>
          <p className="mt-1 text-body-sm text-gray-500">Placed {formatDate(order.placedAt)}</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-body-sm font-semibold text-blue-700">
          {STATUS_LABELS[order.status] ?? order.status}
        </span>
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-body font-semibold text-gray-900">Items</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {order.items.map((item, i) => (
            <li key={i} className="flex items-center justify-between gap-3 text-body-sm">
              <span className="text-gray-700">
                {item.name}
                {item.packSize ? ` · ${item.packSize}` : ''} × {item.quantity}
              </span>
              <span className="font-semibold text-gray-900">{formatPrice(item.lineTotalPaisa)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 flex flex-col gap-1 border-t border-gray-100 pt-3 text-body-sm">
          <div className="flex justify-between text-gray-500">
            <dt>Subtotal</dt>
            <dd>{formatPrice(order.subtotalPaisa)}</dd>
          </div>
          {order.discountPaisa > 0 && (
            <div className="flex justify-between text-green-700">
              <dt>Discount</dt>
              <dd>−{formatPrice(order.discountPaisa)}</dd>
            </div>
          )}
          <div className="flex justify-between text-gray-500">
            <dt>Delivery</dt>
            <dd>{order.shippingPaisa === 0 ? 'Free' : formatPrice(order.shippingPaisa)}</dd>
          </div>
          <div className="mt-1 flex justify-between text-body font-semibold text-gray-900">
            <dt>Total</dt>
            <dd>{formatPrice(order.totalPaisa)}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-body font-semibold text-gray-900">Delivery</h2>
          <p className="mt-2 text-body-sm text-gray-600">
            {order.address}
            {order.address && order.city ? ', ' : ''}
            {order.city}
          </p>
          <p className="mt-1 text-body-sm text-gray-500">
            {PAYMENT_METHODS.find((m) => m.id === order.paymentMethod)?.label ?? order.paymentMethod}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-body font-semibold text-gray-900">Progress</h2>
          <ul className="mt-2 flex flex-col gap-1.5">
            {order.history.map((entry, i) => (
              <li key={i} className="flex items-center gap-2 text-body-sm text-gray-600">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" aria-hidden="true" />
                {STATUS_LABELS[entry.toStatus] ?? entry.toStatus}
                <span className="text-gray-400">· {formatDateTime(entry.at)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
