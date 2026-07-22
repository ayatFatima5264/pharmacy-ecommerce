import 'server-only'
import { supabaseService } from '@/lib/supabase/server'
import { chargeableQuantity } from '@/features/cart/pricing'
import { SLOT_TEMPLATES } from '@/lib/data/lab-store'
import { PAYMENT_METHODS } from '@/config/locations'
import { DEFAULT_ICONS } from '@/config/icons'
import { mainPharmacyId } from './catalog-db'
import { resolveSlotDb } from './lab-slots-db'
import { getCartCatalogDb } from './cart-db'
import type { CartLine, CartTotals } from '@/features/cart/types'
import type { PlacedOrder } from '@/lib/data/orders-store'
import type { TrackedOrderView } from '@/features/checkout/actions/track-order'

/**
 * Checkout writes and order tracking, database-backed.
 *
 * The pricing engine already re-priced every line from the DB snapshot; this
 * module's job is RESOLUTION (slugs/template-ids -> row uuids) and one RPC:
 * place_order (0017) does everything else atomically, including stock, slot
 * capacity, coupon budget, and the outbox email.
 */

export interface BookingInput {
  patientName: string
  patientAge: number
  patientGender: string
  patientPhone: string
  collectionMode: 'home' | 'lab_visit'
  slotDate: string
  slotId: string // UI template id ('morning'), resolved to a slot row here.
}

export interface PlaceOrderDbInput {
  /** Authenticated customer, or null for guests. */
  userId: string | null
  /** Uploaded prescription to attach to the order's Rx lines, if any. */
  prescriptionId?: string | null
  idempotencyKey: string
  contact: { firstName: string; lastName: string; phone: string; email: string | null }
  address: { line1: string; city: string; province: string; postalCode: string | null }
  notes: string | null
  paymentMethod: string
  lines: CartLine[]
  totals: CartTotals
  couponCode: string | null
  couponDiscountPaisa: number
  booking: BookingInput | null
  /** PlacedOrder-shaped snapshot used to render the confirmation email.
   *  place_order injects the real order number into it at enqueue time. */
  emailSnapshot: PlacedOrder | null
}

export type PlaceOrderDbResult =
  | { ok: true; orderNumber: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

export async function placeOrderDb(input: PlaceOrderDbInput): Promise<PlaceOrderDbResult> {
  const db = supabaseService()
  const lines = input.lines.filter((line) => line.entry)

  // --- Resolve slugs to row ids, one query per kind ------------------------
  const testSlugs = lines.filter((l) => l.kind === 'test').map((l) => l.slug)
  const packageSlugs = lines.filter((l) => l.kind === 'package').map((l) => l.slug)
  const variantIds = lines
    .filter((l) => l.kind === 'product')
    .map((l) => l.variantId)
    .filter((id): id is string => Boolean(id))

  const [variantsResult, testsResult, packagesResult] = await Promise.all([
    variantIds.length
      ? db.from('product_variants').select('id, sku').in('id', variantIds)
      : Promise.resolve({ data: [], error: null }),
    testSlugs.length
      ? db
          .from('lab_tests')
          .select('id, slug, name, lab_test_pricing ( lab_id, is_available )')
          .in('slug', testSlugs)
      : Promise.resolve({ data: [], error: null }),
    packageSlugs.length
      ? db
          .from('health_packages')
          .select('id, slug, lab_id, health_package_tests ( lab_tests ( id, name ) )')
          .in('slug', packageSlugs)
      : Promise.resolve({ data: [], error: null }),
  ])
  const resolveError = variantsResult.error ?? testsResult.error ?? packagesResult.error
  if (resolveError) {
    console.error('[checkout] id resolution failed', resolveError)
    return { ok: false, message: 'We could not verify your items. Please try again.' }
  }

  const skuByVariant = new Map(
    (variantsResult.data as { id: string; sku: string }[]).map((v) => [v.id, v.sku]),
  )
  const testBySlug = new Map(
    (
      testsResult.data as {
        id: string
        slug: string
        name: string
        lab_test_pricing: { lab_id: string; is_available: boolean }[]
      }[]
    ).map((t) => [t.slug, t]),
  )
  const packageBySlug = new Map(
    (
      packagesResult.data as {
        id: string
        slug: string
        lab_id: string | null
        health_package_tests: { lab_tests: { id: string; name: string } | null }[]
      }[]
    ).map((p) => [p.slug, p]),
  )

  // --- Build payload items (same order as `lines`, for booking item_index) --
  const items: Record<string, unknown>[] = []
  const bookingTests: { test_id: string; test_name: string; item_index: number }[] = []
  let bookingLabId: string | null = null

  for (const line of lines) {
    const entry = line.entry!
    const index = items.length

    if (line.kind === 'product') {
      items.push({
        kind: 'product',
        variant_id: line.variantId,
        name: entry.name,
        sku: line.variantId ? (skuByVariant.get(line.variantId) ?? null) : null,
        pack_size: entry.subtitle,
        unit_price_paisa: entry.unitPricePaisa,
        quantity: chargeableQuantity(line),
        requires_prescription: entry.requiresPrescription,
      })
      continue
    }

    if (line.kind === 'test') {
      const test = testBySlug.get(line.slug)
      const labId = test?.lab_test_pricing.find((p) => p.is_available)?.lab_id ?? null
      if (!test || !labId) {
        return { ok: false, message: `"${entry.name}" is no longer available. Please review your cart.` }
      }
      bookingLabId ??= labId
      items.push({
        kind: 'test',
        test_id: test.id,
        lab_id: labId,
        name: entry.name,
        unit_price_paisa: entry.unitPricePaisa,
        quantity: chargeableQuantity(line),
        requires_prescription: false,
      })
      bookingTests.push({ test_id: test.id, test_name: test.name, item_index: index })
      continue
    }

    const pkg = packageBySlug.get(line.slug)
    if (!pkg) {
      return { ok: false, message: `"${entry.name}" is no longer available. Please review your cart.` }
    }
    bookingLabId ??= pkg.lab_id
    items.push({
      kind: 'package',
      package_id: pkg.id,
      lab_id: pkg.lab_id,
      name: entry.name,
      unit_price_paisa: entry.unitPricePaisa,
      quantity: chargeableQuantity(line),
      requires_prescription: false,
    })
    // The phlebotomist's worklist needs the member tests, not the bundle.
    for (const member of pkg.health_package_tests) {
      if (member.lab_tests) {
        bookingTests.push({
          test_id: member.lab_tests.id,
          test_name: member.lab_tests.name,
          item_index: index,
        })
      }
    }
  }

  // --- Booking: resolve the UI slot template to a slot row ------------------
  let booking: Record<string, unknown> | null = null
  if (input.booking) {
    const slot = await resolveSlotDb(
      input.address.city,
      input.booking.slotDate,
      input.booking.slotId,
    )
    if (!slot) {
      return {
        ok: false,
        message: 'That time slot is no longer offered. Please pick another.',
        fieldErrors: { slotId: 'Choose a different slot' },
      }
    }
    const template = SLOT_TEMPLATES.find((t) => t.id === input.booking!.slotId)
    booking = {
      lab_id: slot.lab_id ?? bookingLabId,
      slot_id: slot.id,
      // Pakistan is UTC+5 year-round (no DST); slot times are local wall-clock.
      scheduled_at: `${input.booking.slotDate}T${String(template?.startHour ?? 9).padStart(2, '0')}:00:00+05:00`,
      patient_name: input.booking.patientName,
      patient_age: input.booking.patientAge,
      patient_gender: input.booking.patientGender,
      patient_phone: input.booking.patientPhone,
      collection_mode: input.booking.collectionMode,
      collection_address:
        input.booking.collectionMode === 'home'
          ? { line1: input.address.line1, city: input.address.city }
          : null,
      tests: bookingTests,
    }
  }

  // --- Coupon: attach the DB row when one exists ----------------------------
  let couponId: string | null = null
  if (input.couponCode) {
    const { data: couponRow } = await db
      .from('coupons')
      .select('id')
      .eq('code', input.couponCode)
      .eq('is_active', true)
      .maybeSingle()
    couponId = (couponRow as { id: string } | null)?.id ?? null
  }

  const payload = {
    idempotency_key: input.idempotencyKey,
    user_id: input.userId,
    prescription_id: input.prescriptionId ?? null,
    pharmacy_id: items.some((i) => i.kind === 'product') ? mainPharmacyId() : null,
    contact: { email: input.contact.email, phone: input.contact.phone },
    address: {
      first_name: input.contact.firstName,
      last_name: input.contact.lastName,
      phone: input.contact.phone,
      line1: input.address.line1,
      city: input.address.city,
      province: input.address.province,
      postal_code: input.address.postalCode,
    },
    city: input.address.city,
    payment_method: input.paymentMethod,
    notes: input.notes,
    totals: {
      subtotal: input.totals.subtotalPaisa,
      discount: input.totals.discountPaisa,
      shipping: input.totals.shippingPaisa,
      tax: input.totals.taxPaisa,
      total: input.totals.totalPaisa,
    },
    coupon: input.couponCode
      ? { id: couponId, code: input.couponCode, discount_paisa: input.couponDiscountPaisa }
      : null,
    items,
    booking,
    email:
      input.emailSnapshot && input.contact.email
        ? {
            template_key: 'order_confirmation',
            recipient: input.contact.email,
            payload: input.emailSnapshot,
          }
        : null,
  }

  const { data, error } = await db.rpc('place_order', { p: payload })
  if (error) {
    if (error.message.includes('insufficient_stock')) {
      return {
        ok: false,
        message: 'An item in your cart just sold out. Please review your cart and try again.',
      }
    }
    if (error.message.includes('slot_unavailable')) {
      return {
        ok: false,
        message: 'That time slot just filled up. Please pick another.',
        fieldErrors: { slotId: 'This slot is full — choose another' },
      }
    }
    if (error.message.includes('coupon_exhausted')) {
      return {
        ok: false,
        message: 'That coupon has just reached its usage limit. Remove it and try again.',
        fieldErrors: { couponCode: 'No longer available' },
      }
    }
    console.error('[checkout] place_order failed', error)
    return { ok: false, message: 'We could not save your order. Please try again.' }
  }

  const result = data as { order_number: string }
  return { ok: true, orderNumber: result.order_number }
}

// ---------------------------------------------------------------------------
// Order tracking
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Awaiting payment',
  awaiting_rx: 'Awaiting prescription review',
  confirmed: 'Confirmed',
  processing: 'Being prepared',
  partially_shipped: 'Partially shipped',
  shipped: 'On the way',
  delivery_failed: 'Delivery attempted',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}

/** How far along the confirmed→processing→shipped→delivered rail a status is. */
const STATUS_RANK: Record<string, number> = {
  pending_payment: 0,
  awaiting_rx: 0,
  confirmed: 0,
  processing: 1,
  partially_shipped: 2,
  shipped: 2,
  delivery_failed: 2,
  delivered: 3,
}

interface TrackRow {
  order_number: string
  placed_at: string
  status: string
  guest_phone: string | null
  shipping_address: {
    first_name?: string
    last_name?: string
    line1?: string
    city?: string
    province?: string
  } | null
  shipping_city: string | null
  requires_prescription: boolean
  total_paisa: number
  order_items: {
    item_name: string
    pack_size: string | null
    quantity: number
    variant_id: string | null
    test_id: string | null
  }[]
  payments: { method: string }[]
}

function lastTenDigits(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10)
}

export async function trackOrderDb(
  orderNumber: string,
  phone: string,
): Promise<TrackedOrderView | null> {
  const { data, error } = await supabaseService()
    .from('orders')
    .select(
      `order_number, placed_at, status, guest_phone, shipping_address, shipping_city,
       requires_prescription, total_paisa,
       order_items ( item_name, pack_size, quantity, variant_id, test_id ),
       payments ( method )`,
    )
    .ilike('order_number', orderNumber.trim())
    .maybeSingle()
  if (error) {
    console.error('[track-order] query failed', error)
    return null
  }
  const order = data as unknown as TrackRow | null

  // One combined failure path for "no such order" and "wrong phone" — the
  // caller shows a single message either way (no enumeration oracle).
  if (!order || !order.guest_phone) return null
  if (lastTenDigits(order.guest_phone) !== lastTenDigits(phone)) return null

  const rank = STATUS_RANK[order.status] ?? 0
  const address = order.shipping_address ?? {}
  const hasPhysical = order.order_items.some((i) => i.variant_id)

  // Delivery window from the zone serving this city (same data the cart
  // quotes from), measured from the order date.
  let estimatedDelivery = '—'
  if (hasPhysical && order.shipping_city) {
    const { zones } = await getCartCatalogDb()
    const zone = zones.find((z) => z.cities.includes(order.shipping_city!))
    if (zone) {
      const fmt = (days: number) => {
        const d = new Date(order.placed_at)
        d.setDate(d.getDate() + Math.max(1, days))
        return d.toLocaleDateString('en-PK', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          timeZone: 'Asia/Karachi',
        })
      }
      estimatedDelivery = `${fmt(zone.minDays)} – ${fmt(zone.maxDays)}`
    }
  }

  return {
    orderNumber: order.order_number,
    placedAt: order.placed_at,
    status: order.status,
    statusLabel: STATUS_LABELS[order.status] ?? order.status,
    estimatedDelivery,
    address: [address.line1, address.city, address.province].filter(Boolean).join(', '),
    customerName: [address.first_name, address.last_name].filter(Boolean).join(' '),
    paymentLabel:
      PAYMENT_METHODS.find((m) => m.id === order.payments[0]?.method)?.label ??
      order.payments[0]?.method ??
      'Cash on delivery',
    requiresPrescription: order.requires_prescription,
    items: order.order_items.map((item) => ({
      name: item.item_name,
      subtitle: item.pack_size ?? '',
      quantity: item.quantity,
      icon: item.variant_id ? DEFAULT_ICONS.product : DEFAULT_ICONS.test,
    })),
    totalPaisa: order.total_paisa,
    timeline: [
      {
        key: 'confirmed',
        label: order.requires_prescription
          ? 'Order placed — prescription under review'
          : 'Order confirmed',
        at: order.placed_at,
        done: true,
      },
      { key: 'processing', label: 'Being prepared at our store', at: null, done: rank >= 1 },
      { key: 'shipped', label: 'On the way', at: null, done: rank >= 2 },
      { key: 'delivered', label: 'Delivered', at: null, done: rank >= 3 },
    ],
  }
}
