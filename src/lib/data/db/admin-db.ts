import 'server-only'
import { cache } from 'react'
import { supabaseService } from '@/lib/supabase/server'
import { DEFAULT_ICONS } from '@/config/icons'
import type { PlacedOrder, PlacedOrderItem, PlacedOrderStatus } from '@/lib/data/orders-store'
// (DEFAULT_ICONS is used by the order-detail item mapping below.)
import type { AdminOrder } from '@/lib/data/admin'
import type { OrderStatus } from '@/features/orders/status-machine'

/**
 * Admin console reads and order mutations, database-backed.
 *
 * STATUS MAPPING: the admin UI runs on the 6-state machine
 * (pending→confirmed→processing→shipped→delivered / cancelled); the database
 * enum is richer (awaiting_rx, pending_payment, partially_shipped, ...).
 * DB→machine collapses the extra states onto the rail; machine→DB is the
 * identity, because every machine TARGET is a valid enum value. The richer
 * states re-emerge as their own UI affordances in later phases (Rx review
 * queue, payment gating) — the machine is deliberately the simple core.
 */

export const DB_TO_MACHINE: Record<string, PlacedOrderStatus> = {
  pending_payment: 'pending',
  awaiting_rx: 'pending',
  confirmed: 'confirmed',
  processing: 'processing',
  partially_shipped: 'shipped',
  shipped: 'shipped',
  delivery_failed: 'shipped',
  delivered: 'delivered',
  cancelled: 'cancelled',
  refunded: 'cancelled',
}

/** AdminOrder-list status: keep awaiting_rx distinct (it drives the Rx queue). */
const DB_TO_LIST_STATUS: Record<string, AdminOrder['status']> = {
  pending_payment: 'confirmed',
  awaiting_rx: 'awaiting_rx',
  confirmed: 'confirmed',
  processing: 'processing',
  partially_shipped: 'shipped',
  shipped: 'shipped',
  delivery_failed: 'delivery_failed',
  delivered: 'delivered',
  cancelled: 'cancelled',
  refunded: 'cancelled',
}

interface DbOrderRow {
  id: string
  order_number: string
  status: string
  placed_at: string
  guest_email: string | null
  guest_phone: string | null
  shipping_address: Record<string, string | null> | null
  shipping_city: string | null
  requires_prescription: boolean
  customer_notes: string | null
  subtotal_paisa: number
  discount_paisa: number
  shipping_paisa: number
  tax_paisa: number
  total_paisa: number
  idempotency_key: string | null
  coupons: { code: string } | null
  payments: { method: string; status: string }[]
  order_items: {
    id: string
    item_name: string
    item_sku: string | null
    pack_size: string | null
    unit_price_paisa: number
    quantity: number
    line_total_paisa: number
    requires_prescription: boolean
    variant_id: string | null
    test_id: string | null
    package_id: string | null
  }[]
  lab_bookings: { id: string }[]
}

const ORDER_SELECT = `
  id, order_number, status, placed_at, guest_email, guest_phone,
  shipping_address, shipping_city, requires_prescription, customer_notes,
  subtotal_paisa, discount_paisa, shipping_paisa, tax_paisa, total_paisa,
  idempotency_key,
  coupons ( code ),
  payments ( method, status ),
  order_items ( id, item_name, item_sku, pack_size, unit_price_paisa, quantity,
                line_total_paisa, requires_prescription, variant_id, test_id, package_id ),
  lab_bookings ( id )
`

function itemKind(item: DbOrderRow['order_items'][number]): PlacedOrderItem['kind'] {
  return item.variant_id ? 'product' : item.test_id ? 'test' : 'package'
}

function customerName(address: DbOrderRow['shipping_address']): string {
  return [address?.first_name, address?.last_name].filter(Boolean).join(' ') || 'Guest customer'
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

/** Recent-window order rows, shared by metrics/series/recents (one query). */
const fetchOrderRows = cache(async (): Promise<DbOrderRow[]> => {
  const { data, error } = await supabaseService()
    .from('orders')
    .select(ORDER_SELECT)
    .order('placed_at', { ascending: false })
    .limit(500)
  if (error) throw new Error(`orders query failed: ${error.message}`)
  return (data ?? []) as unknown as DbOrderRow[]
})

export const getDashboardMetricsDb = cache(async () => {
  const db = supabaseService()
  const [orders, bookings, customers] = await Promise.all([
    fetchOrderRows(),
    db.from('lab_bookings').select('id', { count: 'exact', head: true }).eq('status', 'scheduled'),
    db.from('profiles').select('id', { count: 'exact', head: true }),
  ])

  const delivered = orders.filter((o) => o.status === 'delivered')
  const revenuePaisa = delivered.reduce((sum, o) => sum + o.total_paisa, 0)

  return {
    revenuePaisa,
    orderCount: orders.filter((o) => o.status !== 'cancelled').length,
    awaitingRx: orders.filter((o) => o.status === 'awaiting_rx').length,
    pendingBookings: bookings.count ?? 0,
    customerCount: customers.count ?? 0,
    averageOrderPaisa: delivered.length ? Math.round(revenuePaisa / delivered.length) : 0,
    codPendingPaisa: orders
      .filter(
        (o) =>
          o.status !== 'cancelled' &&
          o.payments.some((p) => p.method === 'cod' && p.status === 'pending'),
      )
      .reduce((sum, o) => sum + o.total_paisa, 0),
  }
})

/**
 * Ensures the rollups are usable: recompute when today's row is missing or
 * more than ten minutes old. At most one cheap recompute per ten minutes of
 * dashboard traffic; the nightly cron rebuilds a 35-day window regardless.
 */
const ensureRollupsFresh = cache(async (): Promise<void> => {
  const db = supabaseService()
  const { data } = await db
    .from('analytics_daily')
    .select('day, updated_at')
    .order('day', { ascending: false })
    .limit(1)
    .maybeSingle()
  const latest = data as { day: string; updated_at: string } | null
  const today = new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10) // Asia/Karachi
  const stale =
    !latest ||
    latest.day < today ||
    Date.now() - new Date(latest.updated_at).getTime() > 10 * 60_000
  if (stale) {
    const { error } = await db.rpc('rollup_analytics', { p_days: 14 })
    if (error) console.error('[analytics] rollup failed', error)
  }
})

/** 14-day series from the analytics_daily rollups (W9: no OLTP scans). */
export async function getRevenueSeriesDb() {
  await ensureRollupsFresh()
  const { data } = await supabaseService()
    .from('analytics_daily')
    .select('day, booked_value_paisa, orders_count')
    .order('day', { ascending: false })
    .limit(14)
  const rows = ((data ?? []) as { day: string; booked_value_paisa: number; orders_count: number }[])
    .slice()
    .reverse()
  return rows.map((row) => {
    const date = new Date(`${row.day}T00:00:00`)
    return {
      date: date.toISOString(),
      label: date.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' }),
      revenuePaisa: row.booked_value_paisa,
      orderCount: row.orders_count,
    }
  })
}

export async function getTopProductsDb(limit = 5) {
  // AdminProductRow rows enriched with sales from the product rollups
  // (item_name is the sale-time snapshot key — it matches the product name).
  const { getAdminProductsDb } = await import('./admin-catalog-db')
  await ensureRollupsFresh()
  const [{ data: rollups }, products] = await Promise.all([
    supabaseService()
      .from('analytics_product_daily')
      .select('item_name, units, revenue_paisa'),
    getAdminProductsDb(),
  ])

  const byName = new Map<string, { unitsSold: number; revenuePaisa: number }>()
  for (const row of (rollups ?? []) as { item_name: string; units: number; revenue_paisa: number }[]) {
    const entry = byName.get(row.item_name) ?? { unitsSold: 0, revenuePaisa: 0 }
    entry.unitsSold += row.units
    entry.revenuePaisa += row.revenue_paisa
    byName.set(row.item_name, entry)
  }
  return products
    .map((product) => ({
      ...product,
      unitsSold: byName.get(product.name)?.unitsSold ?? 0,
      revenuePaisa: byName.get(product.name)?.revenuePaisa ?? 0,
    }))
    .sort((a, b) => b.revenuePaisa - a.revenuePaisa)
    .slice(0, limit)
}

// ---------------------------------------------------------------------------
// Orders list + detail
// ---------------------------------------------------------------------------

export async function getAdminOrdersDb(): Promise<AdminOrder[]> {
  const orders = await fetchOrderRows()
  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.order_number,
    customerId: o.guest_phone ?? o.guest_email ?? 'guest',
    customerName: customerName(o.shipping_address),
    city: o.shipping_city ?? o.shipping_address?.city ?? '—',
    placedAt: o.placed_at,
    status: DB_TO_LIST_STATUS[o.status] ?? 'confirmed',
    paymentMethod: (o.payments[0]?.method ?? 'cod') as AdminOrder['paymentMethod'],
    paymentStatus: (o.payments[0]?.status === 'paid'
      ? 'paid'
      : o.payments[0]?.status === 'failed'
        ? 'failed'
        : 'pending') as AdminOrder['paymentStatus'],
    itemCount: o.order_items.reduce((sum, i) => sum + i.quantity, 0),
    requiresPrescription: o.requires_prescription,
    hasLabItems: o.lab_bookings.length > 0 || o.order_items.some((i) => !i.variant_id),
    totalPaisa: o.total_paisa,
  }))
}

export interface AdminOrderDetail {
  /** PlacedOrder-shaped view for the detail page, status control, and emails. */
  order: PlacedOrder
  dbId: string
  /** Raw DB status — the machine status above collapses awaiting_rx etc. */
  dbStatus: string
}

export async function findAdminOrderDb(orderNumber: string): Promise<AdminOrderDetail | null> {
  const db = supabaseService()
  const { data, error } = await db
    .from('orders')
    .select(ORDER_SELECT)
    .ilike('order_number', orderNumber.trim())
    .maybeSingle()
  if (error) throw new Error(`order lookup failed: ${error.message}`)
  if (!data) return null
  const row = data as unknown as DbOrderRow

  const [{ data: historyRows }, { data: sentEmail }] = await Promise.all([
    db
      .from('order_status_history')
      .select('from_status, to_status, reason, created_at, profiles ( full_name )')
      .eq('order_id', row.id)
      .order('created_at', { ascending: true }),
    db
      .from('email_outbox')
      .select('id')
      .like('dedupe_key', `%:${row.order_number}`)
      .eq('status', 'sent')
      .limit(1),
  ])

  const address = row.shipping_address ?? {}
  const order: PlacedOrder = {
    id: row.id,
    orderNumber: row.order_number,
    placedAt: row.placed_at,
    status: DB_TO_MACHINE[row.status] ?? 'confirmed',
    firstName: address.first_name ?? 'Guest',
    lastName: address.last_name ?? '',
    phone: row.guest_phone ?? address.phone ?? '',
    email: row.guest_email,
    province: address.province ?? '',
    city: row.shipping_city ?? address.city ?? '',
    address: address.line1 ?? '',
    postalCode: address.postal_code ?? null,
    notes: row.customer_notes,
    paymentMethod: (row.payments[0]?.method ?? 'cod') as PlacedOrder['paymentMethod'],
    paymentStatus: row.payments[0]?.status === 'paid' ? 'paid' : 'pending',
    items: row.order_items.map((item) => ({
      kind: itemKind(item),
      slug: item.item_sku ?? item.item_name,
      variantId: item.variant_id ?? undefined,
      name: item.item_name,
      subtitle: item.pack_size ?? '',
      icon: item.variant_id ? DEFAULT_ICONS.product : DEFAULT_ICONS.test,
      unitPricePaisa: item.unit_price_paisa,
      quantity: item.quantity,
      lineTotalPaisa: item.line_total_paisa,
      requiresPrescription: item.requires_prescription,
    })),
    couponCode: row.coupons?.code ?? null,
    subtotalPaisa: row.subtotal_paisa,
    discountPaisa: row.discount_paisa,
    taxPaisa: row.tax_paisa,
    shippingPaisa: row.shipping_paisa,
    totalPaisa: row.total_paisa,
    requiresPrescription: row.requires_prescription,
    hasLabItems: row.lab_bookings.length > 0,
    estimatedDeliveryFrom: '—',
    estimatedDeliveryTo: '—',
    idempotencyKey: row.idempotency_key ?? '',
    emailStatus: row.guest_email
      ? (sentEmail?.length ?? 0) > 0
        ? 'sent'
        : 'skipped'
      : 'not_applicable',
    statusHistory: (
      (historyRows ?? []) as unknown as {
        from_status: string | null
        to_status: string
        reason: string | null
        created_at: string
        profiles: { full_name: string | null } | null
      }[]
    ).map((h) => ({
      from: h.from_status ?? '—',
      to: h.to_status,
      at: h.created_at,
      byUserId: '',
      byUserName: h.profiles?.full_name ?? 'System',
      note: h.reason,
    })),
  }

  return { order, dbId: row.id, dbStatus: row.status }
}

/** Lab bookings of an order, shaped for the admin detail page. */
export async function getOrderBookingsDb(orderId: string) {
  const { data, error } = await supabaseService()
    .from('lab_bookings')
    .select(
      `id, booking_number, patient_name, patient_age, patient_gender, patient_phone,
       collection_mode, scheduled_at, status,
       collection_slots ( slot_date, starts_at, ends_at ),
       lab_booking_items ( test_name, lab_tests ( short_code, fasting_required, fasting_hours ) )`,
    )
    .eq('order_id', orderId)
  if (error) throw new Error(`bookings lookup failed: ${error.message}`)

  return ((data ?? []) as unknown as {
    id: string
    booking_number: string
    patient_name: string
    patient_age: number | null
    patient_gender: string | null
    patient_phone: string
    collection_mode: 'home' | 'lab_visit'
    scheduled_at: string
    status: string
    collection_slots: { slot_date: string; starts_at: string; ends_at: string } | null
    lab_booking_items: {
      test_name: string
      lab_tests: { short_code: string | null; fasting_required: boolean; fasting_hours: number | null } | null
    }[]
  }[]).map((b) => {
    const fastingHours = Math.max(
      0,
      ...b.lab_booking_items
        .filter((i) => i.lab_tests?.fasting_required)
        .map((i) => i.lab_tests?.fasting_hours ?? 8),
    )
    const slotTime = (t: string) => t.slice(0, 5)
    return {
      id: b.id,
      bookingNumber: b.booking_number,
      slotDate: b.collection_slots?.slot_date ?? b.scheduled_at.slice(0, 10),
      slotLabel: b.collection_slots
        ? `${slotTime(b.collection_slots.starts_at)} – ${slotTime(b.collection_slots.ends_at)}`
        : new Date(b.scheduled_at).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' }),
      patientName: b.patient_name,
      patientAge: b.patient_age ?? 0,
      patientGender: (b.patient_gender ?? 'other') as 'male' | 'female' | 'other',
      patientPhone: b.patient_phone,
      collectionMode: b.collection_mode,
      tests: b.lab_booking_items.map((i) => ({
        slug: i.test_name,
        name: i.test_name,
        shortCode: i.lab_tests?.short_code ?? i.test_name.slice(0, 6).toUpperCase(),
        fastingRequired: i.lab_tests?.fasting_required ?? false,
      })),
      fastingHours: fastingHours > 0 ? fastingHours : null,
      status: b.status,
    }
  })
}

// ---------------------------------------------------------------------------
// Status transition (the admin write path)
// ---------------------------------------------------------------------------

export interface ApplyStatusInput {
  dbId: string
  orderNumber: string
  fromDbStatus: string
  to: OrderStatus
  actorId: string
  note: string | null
}

/**
 * Applies a status transition with its operational side effects:
 * cancellation releases stock (idempotent SQL function), cancels the order's
 * lab bookings, and frees their slots. Legality of the transition was already
 * checked by the caller against the status machine.
 */
export async function applyOrderStatusDb(input: ApplyStatusInput): Promise<{ error?: string }> {
  const db = supabaseService()

  const patch: Record<string, unknown> = { status: input.to }
  if (input.to === 'delivered') patch.delivered_at = new Date().toISOString()
  if (input.to === 'cancelled') patch.cancelled_at = new Date().toISOString()

  const { error: updateError } = await db.from('orders').update(patch).eq('id', input.dbId)
  if (updateError) return { error: `Could not update the order: ${updateError.message}` }

  const { error: historyError } = await db.from('order_status_history').insert({
    order_id: input.dbId,
    from_status: input.fromDbStatus,
    to_status: input.to,
    reason: input.note,
    changed_by: input.actorId,
  })
  if (historyError) console.error('[orders] history insert failed', historyError)

  if (input.to === 'cancelled') {
    const { error: releaseError } = await db.rpc('release_order_stock', {
      p_order_id: input.dbId,
    })
    if (releaseError) {
      // The status already changed; surface the stock problem loudly instead
      // of pretending the cancellation fully completed.
      return { error: `Order cancelled, but stock release failed: ${releaseError.message}` }
    }
    const { data: bookings } = await db
      .from('lab_bookings')
      .select('id, slot_id, status')
      .eq('order_id', input.dbId)
    for (const booking of (bookings ?? []) as { id: string; slot_id: string | null; status: string }[]) {
      if (booking.status === 'cancelled') continue
      await db.from('lab_bookings').update({ status: 'cancelled' }).eq('id', booking.id)
      if (booking.slot_id) {
        // Guarded SQL decrement (0018) — can never go negative under races.
        const { error: slotError } = await db.rpc('release_slot', { p_slot_id: booking.slot_id })
        if (slotError) console.error('[orders] slot release failed', slotError)
      }
    }
  }

  return {}
}

/** Queues a status email through the outbox and returns the dedupe key used. */
export async function enqueueOrderEmailDb(
  templateKey: 'order_confirmation' | 'order_shipped' | 'order_delivered',
  order: PlacedOrder,
  options: { resend?: boolean } = {},
): Promise<{ error?: string }> {
  const dedupe = options.resend
    ? `${templateKey}:${order.orderNumber}:r${Date.now()}`
    : `${templateKey}:${order.orderNumber}`
  const { error } = await supabaseService().from('email_outbox').insert({
    template_key: templateKey,
    recipient: order.email,
    payload: order,
    dedupe_key: dedupe,
  })
  // Unique violation = already queued once — that is the dedupe working.
  if (error && !error.message.includes('duplicate')) return { error: error.message }
  return {}
}
