import 'server-only'
import { orderConfirmationEmail } from './templates'
import type { PlacedOrder } from '@/lib/data/orders-store'

/**
 * DEPRECATED shim.
 *
 * The confirmation email now lives in templates.ts alongside the other three,
 * sharing one branded shell. These wrappers keep older call sites compiling
 * and should be removed once nothing imports them.
 */

export function orderConfirmationSubject(order: PlacedOrder): string {
  return orderConfirmationEmail(order).subject
}

export function orderConfirmationText(order: PlacedOrder): string {
  return orderConfirmationEmail(order).text
}

export function orderConfirmationHtml(order: PlacedOrder): string {
  return orderConfirmationEmail(order).html
}
