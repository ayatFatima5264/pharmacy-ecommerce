'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { authorizeAction } from '@/features/auth/staff/guards'
import { checkRateLimit, clientIp, retryMessage } from '@/lib/security/rate-limit'
import {
  ORDER_STATUSES,
  STATUS_EMAIL,
  STATUS_LABELS,
  transitionError,
  type OrderStatus,
} from '../status-machine'
import {
  appendStatusHistory,
  findOrderByNumber,
  setOrderStatus,
  updateOrderEmailStatus,
} from '@/lib/data/orders-store'
import { sendEmail } from '@/lib/email/resend'
import {
  orderConfirmationEmail,
  orderDeliveredEmail,
  orderShippedEmail,
} from '@/lib/email/templates'
import { useDb } from '@/lib/data/source'
import {
  applyOrderStatusDb,
  enqueueOrderEmailDb,
  findAdminOrderDb,
} from '@/lib/data/db/admin-db'
import { drainEmailOutbox } from '@/lib/email/outbox'

import type { StatusUpdateState } from '../action-state'

const TEMPLATE_KEYS = {
  confirmation: 'order_confirmation',
  shipped: 'order_shipped',
  delivered: 'order_delivered',
} as const

const updateSchema = z.object({
  orderNumber: z.string().trim().min(1),
  nextStatus: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(300).optional().default(''),
})

/**
 * Moves an order to a new status and notifies the customer.
 *
 * Layered checks, each doing a different job:
 *   1. authorize  â€” is this person allowed to change order status at all?
 *   2. rate limit â€” a compromised staff session cannot mass-mutate orders.
 *   3. validate   â€” is the submitted status even a real one?
 *   4. transition â€” is this move legal from where the order currently is?
 *
 * Skipping any one of them leaves a hole the others do not cover.
 */
export async function updateOrderStatus(
  _prev: StatusUpdateState,
  formData: FormData,
): Promise<StatusUpdateState> {
  const auth = await authorizeAction('orders.update_status')
  if (!auth.ok) return { status: 'error', message: auth.message }

  const ip = clientIp(await headers())
  const limit = checkRateLimit('adminWrite', `${auth.user.id}:${ip}`)
  if (!limit.allowed) {
    return { status: 'error', message: `Too many updates. ${retryMessage(limit.retryAfterSeconds)}` }
  }

  const parsed = updateSchema.safeParse({
    orderNumber: String(formData.get('orderNumber') ?? ''),
    nextStatus: String(formData.get('nextStatus') ?? ''),
    note: String(formData.get('note') ?? ''),
  })
  if (!parsed.success) {
    return { status: 'error', message: 'That status is not recognised.' }
  }

  const { orderNumber, nextStatus, note } = parsed.data

  // --- Database path ---------------------------------------------------------
  if (useDb()) {
    const detail = await findAdminOrderDb(orderNumber)
    if (!detail) return { status: 'error', message: 'That order no longer exists.' }

    const machineError = transitionError(detail.order.status as OrderStatus, nextStatus)
    if (machineError) return { status: 'error', message: machineError }

    const applied = await applyOrderStatusDb({
      dbId: detail.dbId,
      orderNumber: detail.order.orderNumber,
      fromDbStatus: detail.dbStatus,
      to: nextStatus,
      actorId: auth.user.id,
      note: note || null,
    })
    if (applied.error) return { status: 'error', message: applied.error }

    // Customer notification rides the OUTBOX (durable), then a drain runs
    // inline so the admin sees the outcome immediately.
    let emailNote = ''
    const template = STATUS_EMAIL[nextStatus]
    if (template && detail.order.email) {
      const enqueued = await enqueueOrderEmailDb(TEMPLATE_KEYS[template], {
        ...detail.order,
        status: nextStatus,
      })
      if (enqueued.error) {
        emailNote = ' The notification email could not be queued.'
      } else {
        const drained = await drainEmailOutbox()
        emailNote =
          drained.sent > 0
            ? ` Customer notified at ${detail.order.email}.`
            : drained.skipped > 0
              ? ' Email is not configured — the notification is queued and sends once it is.'
              : ' The notification is queued and will send shortly.'
      }
    } else if (template && !detail.order.email) {
      emailNote = ' No email address on this order, so no notification was sent.'
    }

    revalidatePath('/admin/orders')
    revalidatePath(`/admin/orders/${detail.order.orderNumber}`)
    revalidatePath('/admin')
    return { status: 'success', message: `Order moved to ${STATUS_LABELS[nextStatus]}.${emailNote}` }
  }

  // --- Scaffold path ---------------------------------------------------------
  const order = findOrderByNumber(orderNumber)
  if (!order) return { status: 'error', message: 'That order no longer exists.' }

  const current = order.status as OrderStatus
  const error = transitionError(current, nextStatus)
  if (error) return { status: 'error', message: error }

  setOrderStatus(order.id, nextStatus)
  // Append-only history: "who moved this and when" must survive later changes,
  // which a single mutable status column cannot answer.
  appendStatusHistory(order.id, {
    from: current,
    to: nextStatus,
    at: new Date().toISOString(),
    byUserId: auth.user.id,
    byUserName: auth.user.name,
    note: note || null,
  })

  // Notification is best effort and deliberately last. A mail outage must never
  // roll back a status change that already happened operationally.
  let emailNote = ''
  const template = STATUS_EMAIL[nextStatus]

  if (template && order.email) {
    const rendered =
      template === 'shipped'
        ? orderShippedEmail(order)
        : template === 'delivered'
          ? orderDeliveredEmail(order)
          : orderConfirmationEmail(order)

    const result = await sendEmail({
      to: order.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    })

    updateOrderEmailStatus(order.id, result.status === 'sent' ? 'sent' : result.status)
    if (result.status === 'sent') emailNote = ` Customer notified at ${order.email}.`
    else if (result.status === 'skipped') emailNote = ' Email is not configured, so no notification was sent.'
    else emailNote = ' The notification email failed to send.'
  } else if (template && !order.email) {
    emailNote = ' No email address on this order, so no notification was sent.'
  }

  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${order.orderNumber}`)
  revalidatePath('/admin')

  return {
    status: 'success',
    message: `Order moved to ${STATUS_LABELS[nextStatus]}.${emailNote}`,
  }
}

/** Resends the current status notification â€” for "I never got the email". */
export async function resendOrderEmail(
  _prev: StatusUpdateState,
  formData: FormData,
): Promise<StatusUpdateState> {
  const auth = await authorizeAction('orders.update_status')
  if (!auth.ok) return { status: 'error', message: auth.message }

  // --- Database path ---------------------------------------------------------
  if (useDb()) {
    const detail = await findAdminOrderDb(String(formData.get('orderNumber') ?? ''))
    if (!detail) return { status: 'error', message: 'That order no longer exists.' }
    if (!detail.order.email)
      return { status: 'error', message: 'This order has no email address on file.' }

    const template = STATUS_EMAIL[detail.order.status as OrderStatus] ?? 'confirmation'
    // resend: true gives a fresh dedupe key, or the original send would block it.
    const enqueued = await enqueueOrderEmailDb(TEMPLATE_KEYS[template], detail.order, {
      resend: true,
    })
    if (enqueued.error) return { status: 'error', message: 'Could not queue the email.' }

    const drained = await drainEmailOutbox()
    if (drained.sent > 0) return { status: 'success', message: `Resent to ${detail.order.email}.` }
    return {
      status: drained.skipped > 0 ? 'error' : 'success',
      message:
        drained.skipped > 0
          ? 'Email is not configured on this environment.'
          : 'Queued — it will send shortly.',
    }
  }

  // --- Scaffold path ---------------------------------------------------------
  const order = findOrderByNumber(String(formData.get('orderNumber') ?? ''))
  if (!order) return { status: 'error', message: 'That order no longer exists.' }
  if (!order.email) return { status: 'error', message: 'This order has no email address on file.' }

  const template = STATUS_EMAIL[order.status as OrderStatus] ?? 'confirmation'
  const rendered =
    template === 'shipped'
      ? orderShippedEmail(order)
      : template === 'delivered'
        ? orderDeliveredEmail(order)
        : orderConfirmationEmail(order)

  const result = await sendEmail({
    to: order.email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  })

  updateOrderEmailStatus(order.id, result.status === 'sent' ? 'sent' : result.status)

  if (result.status === 'sent') {
    return { status: 'success', message: `Resent to ${order.email}.` }
  }
  return {
    status: 'error',
    message:
      result.status === 'skipped'
        ? 'Email is not configured on this environment.'
        : 'Could not send the email. Please try again.',
  }
}
