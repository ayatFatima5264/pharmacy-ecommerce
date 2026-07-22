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

export default async function MyOrdersPage() {
  await requireCustomer('/account/orders')
  const orders = isSupabaseConfigured() ? await getMyOrders() : []

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/account"
        className="mb-4 inline-flex items-center gap-1 text-body-sm font-semibold text-gray-500 hover:text-blue-600"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Account
      </Link>
      <h1 className="text-h1">My orders</h1>

      {orders.length === 0 ? (
        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-8 text-center">
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
                className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-blue-600"
              >
                <div>
                  <p className="text-body font-semibold text-gray-900">{order.orderNumber}</p>
                  <p className="mt-0.5 text-body-sm text-gray-500">
                    {formatDate(order.placedAt)} · {order.itemCount} item
                    {order.itemCount === 1 ? '' : 's'}
                  </p>
                  <p className="mt-0.5 text-body-sm text-gray-400">{order.itemsPreview}</p>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <p className="text-body font-semibold text-gray-900">
                      {formatPrice(order.totalPaisa)}
                    </p>
                    <p className="mt-0.5 text-body-sm text-gray-500">
                      {STATUS_LABELS[order.status] ?? order.status}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" aria-hidden="true" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
