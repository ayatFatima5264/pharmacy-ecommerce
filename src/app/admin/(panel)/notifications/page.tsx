import Link from 'next/link'
import { Bell, CheckCheck } from 'lucide-react'
import { PageHeader, Panel } from '@/components/admin/ui'
import { requirePermission } from '@/features/auth/staff/guards'
import { getNotifications } from '@/features/notifications/queries'
import { markAllNotificationsRead } from '@/features/notifications/actions'
import { formatDateTime } from '@/lib/utils'

export const metadata = { title: 'Notifications' }
export const dynamic = 'force-dynamic'

const TYPE_LABELS: Record<string, string> = {
  'order.placed': 'Order',
  'booking.placed': 'Lab booking',
  'rx.review': 'Prescription',
  'rx.approved': 'Prescription',
  'rx.rejected': 'Prescription',
}

export default async function AdminNotificationsPage() {
  await requirePermission('orders.view')
  const notifications = await getNotifications()
  const hasUnread = notifications.some((n) => !n.readAt)

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Orders, bookings, and prescription events as they happen."
        action={
          hasUnread ? (
            <form action={markAllNotificationsRead}>
              <button
                type="submit"
                className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-200 bg-white px-4 text-[13px] font-semibold text-gray-700 hover:bg-gray-50"
              >
                <CheckCheck className="h-4 w-4" aria-hidden="true" />
                Mark all read
              </button>
            </form>
          ) : undefined
        }
      />

      <Panel title="Latest">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Bell className="h-6 w-6 text-gray-300" aria-hidden="true" />
            <p className="text-[13px] text-gray-500">Nothing yet — new orders will ring here.</p>
          </div>
        ) : (
          <ul className="flex flex-col">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={`flex items-start justify-between gap-3 border-b border-gray-100 py-2.5 last:border-0 ${
                  n.readAt ? 'opacity-60' : ''
                }`}
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-gray-900">
                    {!n.readAt && (
                      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-blue-600 align-middle" />
                    )}
                    {n.linkUrl ? (
                      <Link href={n.linkUrl} className="hover:text-blue-600 hover:underline">
                        {n.title}
                      </Link>
                    ) : (
                      n.title
                    )}
                  </p>
                  {n.body && <p className="mt-0.5 truncate text-[12.5px] text-gray-500">{n.body}</p>}
                </div>
                <div className="shrink-0 text-right text-[12px] text-gray-400">
                  <p>{TYPE_LABELS[n.type] ?? n.type}</p>
                  <p>{formatDateTime(n.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  )
}
