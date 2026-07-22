import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Package } from 'lucide-react'
import { requireCustomer } from '@/features/auth/customer/guards'
import { getMyOrders } from '@/features/account/queries'
import { isSupabaseConfigured } from '@/config/env'
import { formatDate, formatPrice } from '@/lib/utils'

export const metadata: Metadata = { title: 'My orders', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Awaiting payment',
  awaiting_rx: 'Prescription review',
  confirmed: 'Confirmed',
  processing: 'Being prepared',
  partially_shipped: 'Partially shipped',
  shipped: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

/** Visual tint per status — presentation only, keyed on the same map above. */
const STATUS_TONES: Record<string, string> = {
  pending_payment: 'bg-amber-50 text-amber-700',
  awaiting_rx: 'bg-amber-50 text-amber-700',
  confirmed: 'bg-blue-50 text-blue-700',
  processing: 'bg-blue-50 text-blue-700',
  partially_shipped: 'bg-blue-50 text-blue-700',
  shipped: 'bg-blue-50 text-blue-700',
  delivered: 'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-600',
}

export default async function MyOrdersPage() {
  await requireCustomer('/account/orders')
  const orders = isSupabaseConfigured() ? await getMyOrders() : []

  return (
    <div className="bg-gray-50">
    <div className="container max-w-4xl py-10 md:py-12">
      <Link
        href="/account"
        className="mb-4 inline-flex items-center gap-1 text-body-sm font-semibold text-gray-500 hover:text-blue-600"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Account
      </Link>
      <h1 className="text-h1">My orders</h1>

      {orders.length === 0 ? (
        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-10 text-center shadow-e1">
          <Package className="mx-auto h-8 w-8 text-gray-300" aria-hidden="true" />
          <p className="mt-3 text-body text-gray-600">No orders on this account yet.</p>
          <p className="mt-1 text-body-sm text-gray-500">
            Orders placed while signed in appear here. Placed one as a guest?{' '}
            <Link href="/track-order" className="font-semibold text-blue-600 hover:underline">
              Track it here
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {orders.map((order) => (
            <li key={order.orderNumber}>
              <Link
                href={`/account/orders/${encodeURIComponent(order.orderNumber)}`}
                className="group flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-e1 transition-all duration-medium hover:-translate-y-0.5 hover:border-blue-600/30 hover:shadow-e2"
              >
                <div>
                  <p className="tabular text-body font-semibold text-gray-900 group-hover:text-blue-600">
                    {order.orderNumber}
                  </p>
                  <p className="mt-0.5 text-body-sm text-gray-500">
                    {formatDate(order.placedAt)} · {order.itemCount} item
                    {order.itemCount === 1 ? '' : 's'}
                  </p>
                  <p className="mt-0.5 text-body-sm text-gray-400">{order.itemsPreview}</p>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <p className="tabular text-body font-semibold text-gray-900">
                      {formatPrice(order.totalPaisa)}
                    </p>
                    <span
                      className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-caption font-semibold ${
                        STATUS_TONES[order.status] ?? 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </div>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-gray-300 transition-colors duration-fast group-hover:text-blue-600"
                    aria-hidden="true"
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
    </div>
  )
}
