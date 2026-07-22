import 'server-only'
import type { PaymentMethodId } from '@/config/locations'

/**
 * Placed orders.
 *
 * Same seam and same limitation as the catalog store: process memory, not
 * persistence. It survives navigation and hot reload but not a restart or a
 * second instance. Every function maps onto an `orders` / `order_items` query.
 */

/** Mirrors features/orders/status-machine.ts — kept as a string union so the
 *  store has no dependency on the feature layer. */
export type PlacedOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'

export interface StatusHistoryEntry {
  from: string
  to: string
  at: string
  byUserId: string
  byUserName: string
  note: string | null
}

export interface PlacedOrderItem {
  kind: 'product' | 'test' | 'package'
  slug: string
  variantId?: string
  /** Snapshotted: an order is a financial record and must not change when a
   *  product is renamed or repriced. */
  name: string
  subtitle: string
  icon: string
  unitPricePaisa: number
  quantity: number
  lineTotalPaisa: number
  requiresPrescription: boolean
}

export interface PlacedOrder {
  id: string
  orderNumber: string
  placedAt: string
  status: PlacedOrderStatus

  firstName: string
  lastName: string
  phone: string
  email: string | null

  province: string
  city: string
  address: string
  postalCode: string | null
  notes: string | null

  paymentMethod: PaymentMethodId
  paymentStatus: 'pending' | 'awaiting_transfer' | 'paid'

  items: PlacedOrderItem[]
  couponCode: string | null

  subtotalPaisa: number
  discountPaisa: number
  taxPaisa: number
  shippingPaisa: number
  totalPaisa: number

  requiresPrescription: boolean
  hasLabItems: boolean
  estimatedDeliveryFrom: string
  estimatedDeliveryTo: string

  /** Dedupes retries of the same submission. */
  idempotencyKey: string
  emailStatus: 'sent' | 'skipped' | 'failed' | 'not_applicable'
  /** Append-only. A mutable status column cannot answer "who changed this". */
  statusHistory: StatusHistoryEntry[]
}

interface OrdersStore {
  orders: PlacedOrder[]
  sequence: number
}

const globalStore = globalThis as unknown as { __ordersStore?: OrdersStore }

function store(): OrdersStore {
  globalStore.__ordersStore ??= { orders: [], sequence: 100_000 }
  return globalStore.__ordersStore
}

/**
 * Order numbers come from a server-side counter, never from the client.
 *
 * A client-generated number can collide or be forged; the real implementation
 * uses a Postgres sequence, which is the same guarantee.
 */
export function nextOrderNumber(): string {
  const s = store()
  s.sequence += 1
  return `HC-${s.sequence}`
}

export function insertOrder(order: PlacedOrder): PlacedOrder {
  store().orders.unshift(order)
  return order
}

export function findOrderByNumber(orderNumber: string): PlacedOrder | undefined {
  return store().orders.find(
    (o) => o.orderNumber.toUpperCase() === orderNumber.trim().toUpperCase(),
  )
}

export function findOrderByIdempotencyKey(key: string): PlacedOrder | undefined {
  return store().orders.find((o) => o.idempotencyKey === key)
}

/**
 * Order lookup for the public tracking page.
 *
 * Requires the phone number as well as the order number. Without that second
 * factor, sequential order numbers make every customer's address and contents
 * enumerable by anyone who can count.
 */
export function findOrderForTracking(
  orderNumber: string,
  phone: string,
): PlacedOrder | undefined {
  const order = findOrderByNumber(orderNumber)
  if (!order) return undefined

  const normalize = (value: string) => value.replace(/[^0-9]/g, '').slice(-10)
  return normalize(order.phone) === normalize(phone) ? order : undefined
}

export function allOrders(): PlacedOrder[] {
  return store().orders
}

export function updateOrderEmailStatus(id: string, emailStatus: PlacedOrder['emailStatus']): void {
  const order = store().orders.find((o) => o.id === id)
  if (order) order.emailStatus = emailStatus
}

export function setOrderStatus(id: string, status: PlacedOrderStatus): void {
  const order = store().orders.find((o) => o.id === id)
  if (order) order.status = status
}

export function appendStatusHistory(id: string, entry: StatusHistoryEntry): void {
  const order = store().orders.find((o) => o.id === id)
  if (order) order.statusHistory.push(entry)
}
