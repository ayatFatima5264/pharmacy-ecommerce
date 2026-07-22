'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { checkRateLimit, clientIp, retryMessage } from '@/lib/security/rate-limit'
import { checkoutSchema } from '../schemas/checkout-schema'
import { fieldErrorsFrom } from '@/features/catalog/actions/action-result'
import { getCartCatalog } from '@/features/cart/catalog-snapshot'
import { computeTotals, resolveLines } from '@/features/cart/pricing'
import { validateCoupon } from '@/features/cart/actions/coupon-actions'
import {
  findOrderByIdempotencyKey,
  insertOrder,
  nextOrderNumber,
  updateOrderEmailStatus,
  type PlacedOrder,
  type PlacedOrderItem,
} from '@/lib/data/orders-store'
import { sendEmail } from '@/lib/email/resend'
import {
  orderConfirmationHtml,
  orderConfirmationSubject,
  orderConfirmationText,
} from '@/lib/email/order-confirmation'
import type { CartRef } from '@/features/cart/types'
import { entryKey } from '@/features/cart/pricing'
import { labBookingSchema } from '@/features/lab/schemas/booking-schema'
import {
  SLOT_TEMPLATES,
  insertBooking,
  nextBookingNumber,
  releaseSlot,
  reserveSlot,
  supportsHomeCollection,
  type LabBooking,
} from '@/lib/data/lab-store'
import { expandPackage, fastingHoursFor, getLabTestBySlug, getPackageBySlug } from '@/lib/data/lab-catalog'

import type { PlaceOrderState } from '@/features/orders/action-state'
import { useDb } from '@/lib/data/source'
import { placeOrderDb } from '@/lib/data/db/checkout-db'
import { getSetting } from '@/features/settings/queries'
import { getAuthUser } from '@/features/auth/shared/session'

function estimateDelivery(minDays: number, maxDays: number) {
  const format = (days: number) => {
    const date = new Date()
    let added = 0
    while (added < days) {
      date.setDate(date.getDate() + 1)
      if (date.getDay() !== 0) added++ // Skip Sundays.
    }
    return date.toLocaleDateString('en-PK', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'Asia/Karachi',
    })
  }
  return { from: format(Math.max(1, minDays)), to: format(Math.max(1, maxDays)) }
}

/**
 * Places an order.
 *
 * The client sends cart REFS and a coupon CODE — never prices, never totals.
 * Everything monetary is recomputed here from the live catalog, because a
 * total submitted by a browser is a total a browser can edit. This is the
 * single most important rule in the checkout.
 *
 * NOTE: unauthenticated, like the rest of this build. Guest checkout is
 * intentional, but the action still needs rate limiting and a bot check before
 * production, or it is an open order-creation endpoint.
 */
export async function placeOrder(
  _prev: PlaceOrderState,
  formData: FormData,
): Promise<PlaceOrderState> {
  // Guest checkout means this is deliberately unauthenticated, which makes rate
  // limiting the only thing standing between it and an order-flooding bot.
  const ip = clientIp(await headers())
  const limit = checkRateLimit('placeOrder', ip)
  if (!limit.allowed) {
    return {
      status: 'error',
      message: `Too many orders from this connection. ${retryMessage(limit.retryAfterSeconds)}`,
    }
  }

  let rawItems: unknown = []
  try {
    rawItems = JSON.parse(String(formData.get('items') ?? '[]'))
  } catch {
    return { status: 'error', message: 'Your cart could not be read. Please reload and try again.' }
  }

  const parsed = checkoutSchema.safeParse({
    firstName: String(formData.get('firstName') ?? ''),
    lastName: String(formData.get('lastName') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    email: String(formData.get('email') ?? ''),
    province: String(formData.get('province') ?? ''),
    city: String(formData.get('city') ?? ''),
    address: String(formData.get('address') ?? ''),
    postalCode: String(formData.get('postalCode') ?? ''),
    notes: String(formData.get('notes') ?? ''),
    paymentMethod: String(formData.get('paymentMethod') ?? ''),
    couponCode: String(formData.get('couponCode') ?? ''),
    idempotencyKey: String(formData.get('idempotencyKey') ?? ''),
    items: rawItems,
  })

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Please fix the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    }
  }

  const data = parsed.data

  // Idempotency: a double-click, a retry, or a flaky connection resubmitting
  // must not create two orders. Return the original instead. (In DB mode the
  // same guard lives inside place_order, keyed on orders.idempotency_key.)
  if (!useDb()) {
    const existing = findOrderByIdempotencyKey(data.idempotencyKey)
    if (existing) {
      return { status: 'success', orderNumber: existing.orderNumber }
    }
  }

  // --- Re-price everything server-side -------------------------------------
  const catalog = await getCartCatalog()
  const refs: CartRef[] = data.items.map((item) => ({
    key: entryKey(item.kind, item.slug, item.variantId),
    kind: item.kind,
    slug: item.slug,
    variantId: item.variantId,
    quantity: item.quantity,
  }))

  const lines = resolveLines(refs, catalog)

  const unavailable = lines.filter(
    (line) => line.issue?.type === 'unavailable' || line.issue?.type === 'out_of_stock',
  )
  if (unavailable.length > 0) {
    return {
      status: 'error',
      message: `${unavailable.length} item${unavailable.length === 1 ? '' : 's'} in your cart ${
        unavailable.length === 1 ? 'is' : 'are'
      } no longer available. Please review your cart.`,
    }
  }

  // Re-validate the coupon server-side. The client caches the rule for instant
  // recalculation, but it is never the authority on whether it still applies.
  let couponRule = null
  let couponCode: string | null = null
  if (data.couponCode) {
    const provisionalSubtotal = lines.reduce((sum, l) => sum + l.lineSubtotalPaisa, 0)
    const result = await validateCoupon(data.couponCode, provisionalSubtotal)
    if (result.ok) {
      couponRule = result.rule
      couponCode = result.rule.code
    }
    // A coupon that has since expired silently stops applying rather than
    // blocking the order — the confirmed total is simply the undiscounted one.
  }

  const totals = computeTotals({
    lines,
    coupon: couponRule,
    context: { city: data.city, paymentMethod: data.paymentMethod === 'cod' ? 'cod' : 'online' },
    catalog,
  })

  if (totals.itemCount === 0) {
    return { status: 'error', message: 'Your cart is empty.' }
  }

  // Store status: an admin can pause either vertical without a deploy.
  // Enforced HERE (the server action), not just hinted at in the UI.
  const storeStatus = await getSetting('store.status')
  if (totals.hasPhysicalItems && !storeStatus.pharmacyOpen) {
    return {
      status: 'error',
      message: storeStatus.message || 'Pharmacy ordering is temporarily paused. Please try again later.',
    }
  }
  if (totals.hasLabItems && !storeStatus.labOpen) {
    return {
      status: 'error',
      message: storeStatus.message || 'Lab bookings are temporarily paused. Please try again later.',
    }
  }

  // COD is not offered everywhere — some zones are prepaid only.
  if (data.paymentMethod === 'cod' && totals.shipping && !totals.shipping.supportsCod) {
    return {
      status: 'error',
      message: `Cash on delivery is not available for ${data.city}. Please choose an online payment method.`,
      fieldErrors: { paymentMethod: 'Not available in this delivery area' },
    }
  }

  // --- Lab appointment ------------------------------------------------------
  // Validated up front in both modes. The slot is CLAIMED before the order is
  // written — by reserveSlot here in scaffold mode, by place_order's guarded
  // UPDATE inside the same transaction in DB mode — so an order can never
  // exist pointing at a slot that filled up in the meantime.
  let booking: LabBooking | null = null
  let labForm: ReturnType<typeof labBookingSchema.parse> | null = null

  if (totals.hasLabItems) {
    const bookingParsed = labBookingSchema.safeParse({
      patientName: String(formData.get('patientName') ?? ''),
      patientAge: String(formData.get('patientAge') ?? ''),
      patientGender: String(formData.get('patientGender') ?? ''),
      patientPhone: String(formData.get('patientPhone') ?? ''),
      collectionMode: String(formData.get('collectionMode') ?? ''),
      slotDate: String(formData.get('slotDate') ?? ''),
      slotId: String(formData.get('slotId') ?? ''),
    })

    if (!bookingParsed.success) {
      return {
        status: 'error',
        message: 'Please complete the lab appointment details.',
        fieldErrors: fieldErrorsFrom(bookingParsed.error),
      }
    }

    const b = bookingParsed.data
    labForm = b

    if (b.collectionMode === 'home' && !supportsHomeCollection(data.city)) {
      return {
        status: 'error',
        message: `Home sample collection is not available in ${data.city} yet.`,
        fieldErrors: { collectionMode: 'Choose a lab visit instead' },
      }
    }
  }

  if (labForm && !useDb()) {
    const b = labForm
    const reservation = reserveSlot(data.city, b.slotDate, b.slotId)
    if (!reservation.ok) {
      return {
        status: 'error',
        message: reservation.reason,
        fieldErrors: { slotId: reservation.reason },
      }
    }

    // A package is sold as one item but the lab runs each member test, so it is
    // expanded here into the worklist the phlebotomist and lab actually need.
    const bookedTests: Awaited<ReturnType<typeof expandPackage>> = []
    for (const line of lines.filter((l) => l.kind === 'test' || l.kind === 'package')) {
      if (line.kind === 'test') {
        const test = await getLabTestBySlug(line.slug)
        if (test) bookedTests.push(test)
      } else {
        const pkg = await getPackageBySlug(line.slug)
        if (pkg) bookedTests.push(...(await expandPackage(pkg)))
      }
    }

    const labName = bookedTests[0]?.labName ?? 'Chughtai Lab'
    const slotLabel = SLOT_TEMPLATES.find((s) => s.id === b.slotId)?.label ?? b.slotId

    booking = {
      id: crypto.randomUUID(),
      bookingNumber: nextBookingNumber(),
      orderNumber: '', // Filled in below, once the order number exists.
      createdAt: new Date().toISOString(),
      patientName: b.patientName,
      patientAge: b.patientAge,
      patientGender: b.patientGender,
      patientPhone: b.patientPhone,
      collectionMode: b.collectionMode,
      city: data.city,
      address: b.collectionMode === 'home' ? data.address : null,
      slotDate: b.slotDate,
      slotId: b.slotId,
      slotLabel,
      labName,
      tests: bookedTests.map((test) => ({
        slug: test.slug,
        name: test.name,
        shortCode: test.shortCode,
        fastingRequired: test.fastingRequired,
      })),
      fastingHours: fastingHoursFor(bookedTests),
      status: 'scheduled',
      totalPaisa: lines
        .filter((line) => line.kind === 'test' || line.kind === 'package')
        .reduce((sum, line) => sum + line.lineSubtotalPaisa, 0),
    }
  }

  // --- Build the order ------------------------------------------------------
  const items: PlacedOrderItem[] = lines
    .filter((line) => line.entry)
    .map((line) => ({
      kind: line.kind,
      slug: line.slug,
      variantId: line.variantId,
      // Snapshotted deliberately: renaming or repricing a product must never
      // alter a historical invoice.
      name: line.entry!.name,
      subtitle: line.entry!.subtitle,
      icon: line.entry!.icon,
      unitPricePaisa: line.entry!.unitPricePaisa,
      quantity:
        line.issue?.type === 'quantity_capped' ? line.issue.maxQuantity : line.quantity,
      lineTotalPaisa: line.lineSubtotalPaisa,
      requiresPrescription: line.entry!.requiresPrescription,
    }))

  const delivery = estimateDelivery(
    totals.shipping?.minDays ?? 2,
    totals.shipping?.maxDays ?? 3,
  )

  const order: PlacedOrder = {
    id: crypto.randomUUID(),
    orderNumber: nextOrderNumber(),
    placedAt: new Date().toISOString(),
    // A prescription order is blocked on pharmacist review and a bank transfer
    // waits on funds - both sit in `pending` until a human clears them. Only a
    // straightforwardly payable order starts life confirmed.
    status:
      totals.hasPrescriptionItems || data.paymentMethod === 'bank_transfer'
        ? 'pending'
        : 'confirmed',

    firstName: data.firstName,
    lastName: data.lastName,
    phone: data.phone,
    email: data.email || null,

    province: data.province,
    city: data.city,
    address: data.address,
    postalCode: data.postalCode || null,
    notes: data.notes || null,

    paymentMethod: data.paymentMethod,
    paymentStatus: data.paymentMethod === 'bank_transfer' ? 'awaiting_transfer' : 'pending',

    items,
    couponCode,

    subtotalPaisa: totals.subtotalPaisa,
    discountPaisa: totals.discountPaisa,
    taxPaisa: totals.taxPaisa,
    shippingPaisa: totals.shippingPaisa,
    totalPaisa: totals.totalPaisa,

    requiresPrescription: totals.hasPrescriptionItems,
    hasLabItems: totals.hasLabItems,
    estimatedDeliveryFrom: delivery.from,
    estimatedDeliveryTo: delivery.to,

    idempotencyKey: data.idempotencyKey,
    emailStatus: data.email ? 'skipped' : 'not_applicable',
    statusHistory: [],
  }

  // --- Persist: database or scaffold ---------------------------------------
  if (useDb()) {
    // Signed-in customers get the order attached to their account (it shows
    // in /account/orders under RLS). Guests stay guests — checkout NEVER
    // requires an account.
    const authUser = await getAuthUser()

    // Prescription upload (optional): a failed upload never blocks the order —
    // the awaiting_rx gate holds it either way, and the customer can send the
    // file on WhatsApp. The id attaches to the order's Rx lines in place_order.
    let prescriptionId: string | null = null
    const rxFile = formData.get('prescriptionFile')
    if (totals.hasPrescriptionItems && rxFile instanceof File && rxFile.size > 0) {
      const { uploadPrescription } = await import('@/features/prescriptions/upload')
      const uploaded = await uploadPrescription({
        file: rxFile,
        userId: authUser?.id ?? null,
        patientName: `${data.firstName} ${data.lastName}`,
      })
      if ('id' in uploaded) prescriptionId = uploaded.id
      else console.warn('[checkout] prescription upload skipped:', uploaded.error)
    }

    // One RPC, one transaction: order, items, FEFO stock, slot claim, coupon
    // ledger, payment row, status history, and the confirmation email are all
    // written by place_order (0017) or not at all. The snapshot above becomes
    // the email's render payload; the SQL injects the real order number.
    const result = await placeOrderDb({
      userId: authUser?.id ?? null,
      prescriptionId,
      idempotencyKey: data.idempotencyKey,
      contact: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        email: data.email || null,
      },
      address: {
        line1: data.address,
        city: data.city,
        province: data.province,
        postalCode: data.postalCode || null,
      },
      notes: data.notes || null,
      paymentMethod: data.paymentMethod,
      lines,
      totals,
      couponCode,
      couponDiscountPaisa: totals.discountPaisa,
      booking: labForm
        ? {
            patientName: labForm.patientName,
            patientAge: labForm.patientAge,
            patientGender: labForm.patientGender,
            patientPhone: labForm.patientPhone,
            collectionMode: labForm.collectionMode,
            slotDate: labForm.slotDate,
            slotId: labForm.slotId,
          }
        : null,
      emailSnapshot: data.email ? order : null,
    })

    if (!result.ok) {
      return { status: 'error', message: result.message, fieldErrors: result.fieldErrors }
    }

    revalidatePath('/admin/orders')
    revalidatePath('/admin/lab-bookings')
    revalidatePath('/admin')
    return { status: 'success', orderNumber: result.orderNumber }
  }

  try {
    insertOrder(order)
  } catch (error) {
    // The slot was reserved before the order was written; if writing fails,
    // give the capacity back rather than leaking a phantom booking.
    if (booking) releaseSlot(booking.city, booking.slotDate, booking.slotId)
    console.error('[checkout] Failed to store order', error)
    return { status: 'error', message: 'We could not save your order. Please try again.' }
  }

  if (booking) {
    booking.orderNumber = order.orderNumber
    insertBooking(booking)
  }

  // --- Confirmation email ---------------------------------------------------
  // Best effort, and deliberately AFTER the order exists. A mail provider
  // outage must never lose an order that has already been placed.
  if (order.email) {
    const result = await sendEmail({
      to: order.email,
      subject: orderConfirmationSubject(order),
      html: orderConfirmationHtml(order),
      text: orderConfirmationText(order),
    })
    updateOrderEmailStatus(order.id, result.status === 'sent' ? 'sent' : result.status)
  }

  revalidatePath('/admin/orders')
  revalidatePath('/admin/lab-bookings')
  revalidatePath('/admin')

  return { status: 'success', orderNumber: order.orderNumber }
}
