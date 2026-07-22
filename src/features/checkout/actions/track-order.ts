'use server'

import { findOrderForTracking } from '@/lib/data/orders-store'
import { PAYMENT_METHODS } from '@/config/locations'
import { useDb } from '@/lib/data/source'
import { trackOrderDb } from '@/lib/data/db/checkout-db'

/**
 * Public order lookup.
 *
 * Requires the order number AND the phone number used at checkout. Order
 * numbers are sequential, so without a second factor anyone could enumerate
 * every customer's address and order contents by counting upwards.
 */

export interface TrackedOrderView {
  orderNumber: string
  placedAt: string
  status: string
  statusLabel: string
  estimatedDelivery: string
  address: string
  customerName: string
  paymentLabel: string
  requiresPrescription: boolean
  items: { name: string; subtitle: string; quantity: number; icon: string }[]
  totalPaisa: number
  timeline: { key: string; label: string; at: string | null; done: boolean }[]
}

export type TrackResult =
  | { ok: true; order: TrackedOrderView }
  | { ok: false; message: string }

const STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Awaiting payment',
  awaiting_rx: 'Awaiting prescription review',
  confirmed: 'Confirmed',
  processing: 'Being prepared',
  shipped: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export async function trackOrder(orderNumber: string, phone: string): Promise<TrackResult> {
  if (!orderNumber.trim()) {
    return { ok: false, message: 'Enter your order number.' }
  }
  if (!phone.trim()) {
    return { ok: false, message: 'Enter the mobile number you ordered with.' }
  }

  if (useDb()) {
    const view = await trackOrderDb(orderNumber, phone)
    if (!view) {
      return {
        ok: false,
        message:
          'We could not find an order matching that number and mobile number. Check both and try again.',
      }
    }
    return { ok: true, order: view }
  }

  const order = findOrderForTracking(orderNumber, phone)

  // Deliberately one message for "no such order" and "wrong phone" — telling
  // them apart would confirm which order numbers exist.
  if (!order) {
    return {
      ok: false,
      message:
        'We could not find an order matching that number and mobile number. Check both and try again.',
    }
  }

  const reached = (key: string) => {
    const sequence = ['confirmed', 'processing', 'shipped', 'delivered']
    const current = sequence.indexOf(order.status)
    const target = sequence.indexOf(key)
    return current >= 0 && target >= 0 && target <= current
  }

  return {
    ok: true,
    order: {
      orderNumber: order.orderNumber,
      placedAt: order.placedAt,
      status: order.status,
      statusLabel: STATUS_LABELS[order.status] ?? order.status,
      estimatedDelivery: `${order.estimatedDeliveryFrom} – ${order.estimatedDeliveryTo}`,
      address: `${order.address}, ${order.city}, ${order.province}`,
      customerName: `${order.firstName} ${order.lastName}`,
      paymentLabel:
        PAYMENT_METHODS.find((m) => m.id === order.paymentMethod)?.label ?? order.paymentMethod,
      requiresPrescription: order.requiresPrescription,
      items: order.items.map((item) => ({
        name: item.name,
        subtitle: item.subtitle,
        quantity: item.quantity,
        icon: item.icon,
      })),
      totalPaisa: order.totalPaisa,
      timeline: [
        {
          key: 'confirmed',
          label: order.requiresPrescription ? 'Order placed — prescription under review' : 'Order confirmed',
          at: order.placedAt,
          done: true,
        },
        { key: 'processing', label: 'Being prepared at our store', at: null, done: reached('processing') },
        { key: 'shipped', label: 'On the way', at: null, done: reached('shipped') },
        { key: 'delivered', label: 'Delivered', at: null, done: reached('delivered') },
      ],
    },
  }
}
