import Link from 'next/link'
import { ExternalLink, FileWarning, Phone } from 'lucide-react'
import { PageHeader, Panel, StatCard, StatusPill } from '@/components/admin/ui'
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
        <StatCard label="Awaiting review" value={String(pending.length)} tone={pending.length ? 'warning' : undefined} />
        <StatCard label="Reviewed" value={String(decided.length)} />
        <StatCard label="Orders without a file" value={String(unattached.length)} tone={unattached.length ? 'danger' : undefined} />
        <StatCard label="Queue total" value={String(queue.length)} />
      </div>

      {unattached.length > 0 && (
        <Panel title="Rx orders with no prescription on file" className="mb-4">
          <p className="mb-3 text-[12.5px] text-gray-500">
            These orders are blocked on a prescription nobody has uploaded. Call the customer, or
            cancel from the order page if unreachable.
          </p>
          <ul className="flex flex-col gap-2">
            {unattached.map((order) => (
              <li key={order.orderNumber} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="flex items-center gap-2">
                  <FileWarning className="h-4 w-4 text-amber-600" aria-hidden="true" />
                  <Link
                    href={`/admin/orders/${order.orderNumber}`}
                    className="tabular font-semibold text-blue-600 hover:underline"
                  >
                    {order.orderNumber}
                  </Link>
                  <span className="text-gray-400">{formatDateTime(order.placedAt)}</span>
                </span>
                {order.phone && (
                  <a href={`tel:${order.phone}`} className="flex items-center gap-1.5 text-gray-600 hover:text-blue-600">
                    <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                    {order.phone}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {pending.length === 0 && unattached.length === 0 && (
        <Panel title="All clear">
          <p className="text-[13px] text-gray-500">No prescriptions are waiting for review.</p>
        </Panel>
      )}

      <div className="flex flex-col gap-4">
        {pending.map((rx) => (
          <Panel
            key={rx.id}
            title={`${rx.patientName} — ${rx.orderNumbers.join(', ')}`}
            action={
              rx.fileUrl ? (
                <a
                  href={rx.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[13px] font-semibold text-blue-600 hover:underline"
                >
                  View prescription
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              ) : (
                <StatusPill tone="danger">File unavailable</StatusPill>
              )
            }
          >
            <p className="mb-1 text-[12.5px] text-gray-500">
              Submitted {formatDateTime(rx.submittedAt)} · {rx.fileMime}
            </p>
            <ul className="mb-3 flex flex-col gap-0.5 text-[13px] text-gray-700">
              {rx.rxItems.map((item, i) => (
                <li key={i}>
                  {item.name} × {item.quantity}{' '}
                  <span className="text-gray-400">({item.orderNumber})</span>
                </li>
              ))}
            </ul>
            <ReviewControls prescriptionId={rx.id} />
          </Panel>
        ))}
      </div>

      {decided.length > 0 && (
        <Panel title="Recently reviewed" className="mt-4">
          <ul className="flex flex-col gap-1.5">
            {decided.slice(0, 10).map((rx) => (
              <li key={rx.id} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="text-gray-700">
                  {rx.patientName} · {rx.orderNumbers.join(', ')}
                </span>
                <StatusPill tone={rx.status === 'approved' ? 'success' : 'danger'}>
                  {rx.status}
                </StatusPill>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  )
}
