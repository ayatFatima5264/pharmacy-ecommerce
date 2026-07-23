import Link from 'next/link'
import {
  CalendarClock,
  ClipboardCheck,
  Clock,
  ExternalLink,
  FileText,
  FileWarning,
  Files,
  Phone,
} from 'lucide-react'
import { PageHeader, Panel, StatCard, StatusPill } from '@/components/admin/ui'
import { AdminEmptyState, Avatar } from '@/components/admin/blocks'
import { requirePermission } from '@/features/auth/staff/guards'
import { useDb } from '@/lib/data/source'
import { getReviewQueue, getUnattachedRxOrders } from '@/features/prescriptions/queries'
import { ReviewControls } from '@/features/prescriptions/components/review-controls'
import { formatDateTime } from '@/lib/utils'

export const metadata = { title: 'Prescriptions' }
export const dynamic = 'force-dynamic'

/**
 * The pharmacist review queue (blueprint W14): every prescription decision is
 * a licensed professional act — the review action refuses accounts without a
 * pharmacists licence record, whatever their role.
 */
export default async function AdminPrescriptionsPage() {
  await requirePermission('rx.verify')

  const [queue, unattached] = useDb()
    ? await Promise.all([getReviewQueue(), getUnattachedRxOrders()])
    : [[], []]
  const pending = queue.filter((rx) => rx.status === 'pending_review')
  const decided = queue.filter((rx) => rx.status !== 'pending_review')

  return (
    <>
      <PageHeader
        title="Prescriptions"
        description="Review queue. Approving releases the order for fulfilment; rejecting emails the customer the reason."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Awaiting review" icon={Clock} value={String(pending.length)} tone={pending.length ? 'warning' : undefined} />
        <StatCard label="Reviewed" icon={ClipboardCheck} value={String(decided.length)} />
        <StatCard label="Orders without a file" icon={FileWarning} value={String(unattached.length)} tone={unattached.length ? 'danger' : undefined} />
        <StatCard label="Queue total" icon={Files} value={String(queue.length)} />
      </div>

      {/* Review workspace: the queue is the work, so it owns the wide column;
          exceptions and history sit in the rail. */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="flex flex-col gap-4">
          {pending.length === 0 ? (
            <div className="rounded-lg border border-gray-200/80 bg-white shadow-e1">
              <AdminEmptyState
                icon={ClipboardCheck}
                title="Queue is clear"
                description="No prescriptions are waiting for review. New uploads appear here the moment a customer attaches one."
              />
            </div>
          ) : (
            pending.map((rx) => (
              <article
                key={rx.id}
                className="rounded-lg border border-gray-200/80 bg-white shadow-e1 transition-shadow duration-medium hover:shadow-e2"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={rx.patientName} />
                    <div className="min-w-0">
                      <h2 className="truncate text-[14px] font-bold text-gray-900">
                        {rx.patientName}
                      </h2>
                      <p className="flex items-center gap-1.5 text-[12px] text-gray-500">
                        <CalendarClock className="h-3 w-3 shrink-0" aria-hidden="true" />
                        Submitted {formatDateTime(rx.submittedAt)} · {rx.fileMime}
                      </p>
                    </div>
                  </div>
                  {rx.fileUrl ? (
                    <a
                      href={rx.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-4 text-[13px] font-semibold text-white shadow-e1 transition-colors duration-fast hover:bg-blue-700"
                    >
                      <FileText className="h-4 w-4" aria-hidden="true" />
                      View prescription
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  ) : (
                    <StatusPill tone="danger">File unavailable</StatusPill>
                  )}
                </div>

                <div className="px-5 py-4">
                  <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-gray-400">
                    Prescription items
                  </p>
                  <ul className="mb-4 flex flex-wrap gap-2">
                    {rx.rxItems.map((item, i) => (
                      <li
                        key={i}
                        className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[12.5px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20"
                      >
                        {item.name} × {item.quantity}
                        <Link
                          href={`/admin/orders/${item.orderNumber}`}
                          className="tabular font-medium text-amber-700/70 hover:underline"
                        >
                          {item.orderNumber}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <ReviewControls prescriptionId={rx.id} />
                </div>
              </article>
            ))
          )}
        </div>

        <div className="flex flex-col gap-4">
          {unattached.length > 0 && (
            <Panel title="No file on order">
              <p className="mb-3 text-[12.5px] text-gray-500">
                Blocked on a prescription nobody has uploaded. Call the customer, or cancel from
                the order page if unreachable.
              </p>
              <ul className="flex flex-col gap-2.5">
                {unattached.map((order) => (
                  <li key={order.orderNumber} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="flex min-w-0 items-center gap-2">
                      <FileWarning className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                      <span className="min-w-0">
                        <Link
                          href={`/admin/orders/${order.orderNumber}`}
                          className="tabular block truncate font-semibold text-blue-600 hover:underline"
                        >
                          {order.orderNumber}
                        </Link>
                        <span className="block truncate text-[11.5px] text-gray-400">
                          {formatDateTime(order.placedAt)}
                        </span>
                      </span>
                    </span>
                    {order.phone && (
                      <a
                        href={`tel:${order.phone}`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-50 text-gray-500 transition-colors duration-fast hover:bg-blue-50 hover:text-blue-600"
                        aria-label={`Call ${order.phone}`}
                      >
                        <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {decided.length > 0 && (
            <Panel title="Recently reviewed">
              <ul className="flex flex-col gap-3">
                {decided.slice(0, 10).map((rx) => (
                  <li key={rx.id} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={rx.patientName} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-gray-900">
                          {rx.patientName}
                        </span>
                        <span className="tabular block truncate text-[11.5px] text-gray-400">
                          {rx.orderNumbers.join(', ')}
                        </span>
                      </span>
                    </span>
                    <StatusPill tone={rx.status === 'approved' ? 'success' : 'danger'}>
                      {rx.status}
                    </StatusPill>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </>
  )
}
