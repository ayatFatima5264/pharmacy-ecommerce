/**
 * Order status transitions.
 *
 * Modelled as an explicit graph rather than a free-form string column, because
 * "Delivered → Pending" is not a workflow, it is a bug. Every transition the
 * business allows is listed; everything else is refused with a reason.
 *
 * Pure module (no server imports) so the rules can be tested directly.
 */

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export const STATUS_DESCRIPTIONS: Record<OrderStatus, string> = {
  pending: 'Awaiting payment or prescription verification',
  confirmed: 'Accepted and queued for picking',
  processing: 'Being picked and packed at the store',
  shipped: 'Handed to the courier',
  delivered: 'Received by the customer',
  cancelled: 'Cancelled — no further action',
}

export const STATUS_TONES: Record<OrderStatus, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  confirmed: 'info',
  processing: 'info',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'neutral',
}

/**
 * Legal transitions.
 *
 * Notes on the shape:
 *  - Cancellation is possible up to (but not after) dispatch. Once a parcel is
 *    with the courier the correct path is a return, not a cancellation, because
 *    stock and cash are already in motion.
 *  - `delivered` and `cancelled` are terminal. Reopening a completed order
 *    would silently rewrite a financial record.
 *  - Backward steps are allowed only where they reflect real operations:
 *    processing → confirmed happens when picking is paused.
 */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'confirmed', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
}

export function allowedTransitions(from: OrderStatus): OrderStatus[] {
  return TRANSITIONS[from] ?? []
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return allowedTransitions(from).includes(to)
}

export function transitionError(from: OrderStatus, to: OrderStatus): string | null {
  if (from === to) return `This order is already ${STATUS_LABELS[to].toLowerCase()}.`
  if (canTransition(from, to)) return null

  if (from === 'delivered') {
    return 'Delivered orders cannot change status. Raise a return instead.'
  }
  if (from === 'cancelled') {
    return 'Cancelled orders cannot be reopened. Create a new order instead.'
  }
  if (to === 'cancelled' && from === 'shipped') {
    return 'This order is already with the courier. Raise a return rather than cancelling.'
  }
  return `An order cannot move from ${STATUS_LABELS[from].toLowerCase()} to ${STATUS_LABELS[to].toLowerCase()}.`
}

/** Statuses that notify the customer, and which template each one uses. */
export const STATUS_EMAIL: Partial<Record<OrderStatus, 'confirmation' | 'shipped' | 'delivered'>> = {
  confirmed: 'confirmation',
  shipped: 'shipped',
  delivered: 'delivered',
}

export function isTerminal(status: OrderStatus): boolean {
  return allowedTransitions(status).length === 0
}
