import 'server-only'
import { cache } from 'react'
import { supabaseService } from '@/lib/supabase/server'
import { labTests as scaffoldLabTests } from '@/lib/data/catalog'
import type { AdminBooking, AdminCoupon, AdminCustomer, AdminShippingZone } from '@/lib/data/admin'
import type { CouponRule } from '@/features/cart/types'

/**
 * Database projections for the remaining admin surfaces: lab tests, lab
 * bookings, customers, coupons, shipping zones — mapped to the exact row
 * shapes the existing pages render. Read-only, matching the pages (their
 * CRUD affordances arrive with their own phases).
 */

// --- Lab tests --------------------------------------------------------------

const scaffoldTestBySlug = new Map(scaffoldLabTests.map((t) => [t.slug, t]))

export const getAdminLabTestsDb = cache(async () => {
  const db = supabaseService()
  const [testsResult, bookingCounts] = await Promise.all([
    db
      .from('lab_tests')
      .select(
        `id, slug, name, short_code, sample_type, fasting_required, fasting_hours,
         turnaround_hours, is_active,
         lab_test_pricing ( price_paisa, is_available, labs ( name ) )`,
      )
      .order('name'),
    db.from('lab_booking_items').select('test_id'),
  ])
  if (testsResult.error) throw new Error(`lab_tests query failed: ${testsResult.error.message}`)

  const countByTest = new Map<string, number>()
  for (const row of (bookingCounts.data ?? []) as { test_id: string }[]) {
    countByTest.set(row.test_id, (countByTest.get(row.test_id) ?? 0) + 1)
  }

  return (
    (testsResult.data ?? []) as unknown as {
      id: string
      slug: string
      name: string
      short_code: string | null
      sample_type: string
      fasting_required: boolean
      fasting_hours: number | null
      turnaround_hours: number
      is_active: boolean
      lab_test_pricing: { price_paisa: number; is_available: boolean; labs: { name: string } | null }[]
    }[]
  ).map((t) => {
    const pricing = t.lab_test_pricing.find((p) => p.is_available)
    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      shortCode: t.short_code ?? '',
      // Clinical display content stays code-side until the lab import phase.
      parameters: scaffoldTestBySlug.get(t.slug)?.parameters ?? [],
      labName: pricing?.labs?.name ?? '—',
      sampleType: t.sample_type,
      fastingRequired: t.fasting_required,
      fastingHours: t.fasting_hours,
      turnaroundHours: t.turnaround_hours,
      bookingCount: countByTest.get(t.id) ?? 0,
      pricePaisa: pricing?.price_paisa ?? 0,
      isActive: t.is_active,
    }
  })
})

// --- Lab bookings -----------------------------------------------------------

export async function getAdminBookingsDb(): Promise<AdminBooking[]> {
  const { data, error } = await supabaseService()
    .from('lab_bookings')
    .select(
      `id, booking_number, patient_name, collection_mode, scheduled_at, status,
       collection_slots ( city, slot_date, starts_at, ends_at ),
       lab_booking_items ( test_name, order_item_id ),
       orders ( shipping_city ),
       labs ( name )`,
    )
    .order('scheduled_at', { ascending: false })
    .limit(500)
  if (error) throw new Error(`lab_bookings query failed: ${error.message}`)

  const rows = (data ?? []) as unknown as {
    id: string
    booking_number: string
    patient_name: string
    collection_mode: 'home' | 'lab_visit'
    scheduled_at: string
    status: string
    collection_slots: { city: string; slot_date: string; starts_at: string; ends_at: string } | null
    lab_booking_items: { test_name: string; order_item_id: string }[]
    orders: { shipping_city: string | null } | null
    labs: { name: string } | null
  }[]

  // Booking value = its distinct order lines. One query for all bookings.
  const itemIds = [...new Set(rows.flatMap((b) => b.lab_booking_items.map((i) => i.order_item_id)))]
  const priceByItem = new Map<string, number>()
  if (itemIds.length) {
    const { data: items } = await supabaseService()
      .from('order_items')
      .select('id, line_total_paisa')
      .in('id', itemIds)
    for (const item of (items ?? []) as { id: string; line_total_paisa: number }[]) {
      priceByItem.set(item.id, item.line_total_paisa)
    }
  }

  const time = (t: string) => t.slice(0, 5)
  return rows.map((b) => ({
    id: b.id,
    bookingNumber: b.booking_number,
    patientName: b.patient_name,
    testName:
      b.lab_booking_items[0]?.test_name
        ? b.lab_booking_items.length > 1
          ? `${b.lab_booking_items[0].test_name} +${b.lab_booking_items.length - 1}`
          : b.lab_booking_items[0].test_name
        : '—',
    labName: b.labs?.name ?? '—',
    city: b.collection_slots?.city ?? b.orders?.shipping_city ?? '—',
    scheduledAt: b.scheduled_at,
    slot: b.collection_slots
      ? `${time(b.collection_slots.starts_at)} – ${time(b.collection_slots.ends_at)}`
      : '—',
    collectionMode: b.collection_mode,
    // DB enum ⊃ page enum: sample_pending displays as scheduled.
    status: (b.status === 'sample_pending' ? 'scheduled' : b.status) as AdminBooking['status'],
    pricePaisa: [...new Set(b.lab_booking_items.map((i) => i.order_item_id))].reduce(
      (sum, id) => sum + (priceByItem.get(id) ?? 0),
      0,
    ),
  }))
}

// --- Customers ---------------------------------------------------------------

export async function getAdminCustomersDb(): Promise<AdminCustomer[]> {
  const db = supabaseService()
  const [profilesResult, ordersResult] = await Promise.all([
    db
      .from('profiles')
      .select('id, full_name, email, phone, is_active, created_at')
      .order('created_at', { ascending: false })
      .limit(500),
    db
      .from('orders')
      .select('user_id, total_paisa, placed_at, shipping_city, status')
      .not('user_id', 'is', null),
  ])
  if (profilesResult.error) throw new Error(`profiles query failed: ${profilesResult.error.message}`)

  const orders = (ordersResult.data ?? []) as {
    user_id: string
    total_paisa: number
    placed_at: string
    shipping_city: string | null
    status: string
  }[]
  const byUser = new Map<string, typeof orders>()
  for (const o of orders) {
    const list = byUser.get(o.user_id) ?? []
    list.push(o)
    byUser.set(o.user_id, list)
  }

  return (
    (profilesResult.data ?? []) as {
      id: string
      full_name: string | null
      email: string
      phone: string | null
      is_active: boolean
      created_at: string
    }[]
  ).map((p) => {
    const mine = (byUser.get(p.id) ?? []).filter((o) => o.status !== 'cancelled')
    const latest = mine[0]?.placed_at
      ? mine.reduce((max, o) => (o.placed_at > max ? o.placed_at : max), mine[0].placed_at)
      : ''
    return {
      id: p.id,
      name: p.full_name ?? 'Customer',
      phone: p.phone ?? '—',
      email: p.email,
      city: mine[0]?.shipping_city ?? '—',
      orderCount: mine.length,
      lifetimeValuePaisa: mine.reduce((sum, o) => sum + o.total_paisa, 0),
      joinedAt: p.created_at,
      lastOrderAt: latest,
      status: p.is_active ? 'active' : 'inactive',
    }
  })
}

// --- Coupons -----------------------------------------------------------------

interface CouponDbRow {
  id: string
  code: string
  discount_type: 'percentage' | 'fixed_amount' | 'free_shipping'
  discount_percent: number | null
  discount_amount_paisa: number | null
  min_order_paisa: number
  max_discount_paisa: number | null
  usage_limit: number | null
  usage_count: number
  starts_at: string
  expires_at: string | null
  is_active: boolean
}

const fetchCoupons = cache(async (): Promise<CouponDbRow[]> => {
  const { data, error } = await supabaseService()
    .from('coupons')
    .select(
      'id, code, discount_type, discount_percent, discount_amount_paisa, min_order_paisa, max_discount_paisa, usage_limit, usage_count, starts_at, expires_at, is_active',
    )
    .order('created_at', { ascending: false })
  if (error) throw new Error(`coupons query failed: ${error.message}`)
  return (data ?? []) as unknown as CouponDbRow[]
})

/** AdminCoupon.discountValue units: percent for percentage, RUPEES for fixed. */
export async function getAdminCouponsDb(): Promise<AdminCoupon[]> {
  return (await fetchCoupons()).map((c) => ({
    id: c.id,
    code: String(c.code),
    discountType: c.discount_type,
    discountValue:
      c.discount_type === 'percentage'
        ? Number(c.discount_percent ?? 0)
        : c.discount_type === 'fixed_amount'
          ? Math.round((c.discount_amount_paisa ?? 0) / 100)
          : 100,
    minOrderPaisa: c.min_order_paisa,
    maxDiscountPaisa: c.max_discount_paisa,
    usageLimit: c.usage_limit,
    usageCount: c.usage_count,
    startsAt: c.starts_at,
    expiresAt: c.expires_at,
    isActive: c.is_active,
  }))
}

export type CouponLookup =
  | { ok: true; rule: CouponRule }
  | { ok: false; reason: 'unknown' | 'not_started' | 'expired' | 'exhausted' | 'min_order'; minOrderPaisa?: number }

/** Coupon validation against the live table (same messages decided by caller). */
export async function lookupCouponDb(code: string, subtotalPaisa: number): Promise<CouponLookup> {
  const { data, error } = await supabaseService()
    .from('coupons')
    .select(
      'id, code, discount_type, discount_percent, discount_amount_paisa, min_order_paisa, max_discount_paisa, usage_limit, usage_count, starts_at, expires_at, is_active',
    )
    .eq('code', code)
    .maybeSingle()
  if (error || !data) return { ok: false, reason: 'unknown' }
  const c = data as unknown as CouponDbRow
  if (!c.is_active) return { ok: false, reason: 'unknown' } // same message as unknown — no oracle
  const now = Date.now()
  if (new Date(c.starts_at).getTime() > now) return { ok: false, reason: 'not_started' }
  if (c.expires_at && new Date(c.expires_at).getTime() < now) return { ok: false, reason: 'expired' }
  if (c.usage_limit !== null && c.usage_count >= c.usage_limit)
    return { ok: false, reason: 'exhausted' }
  if (subtotalPaisa < c.min_order_paisa)
    return { ok: false, reason: 'min_order', minOrderPaisa: c.min_order_paisa }

  return {
    ok: true,
    rule: {
      code: String(c.code).toUpperCase(),
      discountType: c.discount_type,
      // CouponRule units match the scaffold: percent, or RUPEES for fixed.
      discountValue:
        c.discount_type === 'percentage'
          ? Number(c.discount_percent ?? 0)
          : Math.round((c.discount_amount_paisa ?? 0) / 100),
      minOrderPaisa: c.min_order_paisa,
      maxDiscountPaisa: c.max_discount_paisa,
    },
  }
}

// --- Shipping zones ----------------------------------------------------------

export async function getAdminShippingZonesDb(): Promise<AdminShippingZone[]> {
  const { data, error } = await supabaseService()
    .from('shipping_rates')
    .select(
      `zone_id, min_weight_grams, rate_paisa, free_above_paisa,
       shipping_zones ( id, name, is_active, shipping_zone_areas ( city ) ),
       shipping_methods ( carrier, min_days, max_days, supports_cod )`,
    )
    .eq('min_weight_grams', 0) // base band carries the zone's headline rate
  if (error) throw new Error(`shipping query failed: ${error.message}`)

  return (
    (data ?? []) as unknown as {
      zone_id: string
      rate_paisa: number
      free_above_paisa: number | null
      shipping_zones: {
        id: string
        name: string
        is_active: boolean
        shipping_zone_areas: { city: string }[]
      } | null
      shipping_methods: {
        carrier: string
        min_days: number
        max_days: number
        supports_cod: boolean
      } | null
    }[]
  )
    .filter((r) => r.shipping_zones && r.shipping_methods)
    .map((r) => ({
      id: r.shipping_zones!.id,
      name: r.shipping_zones!.name,
      cities: r.shipping_zones!.shipping_zone_areas.map((a) => a.city),
      carrier: r.shipping_methods!.carrier,
      ratePaisa: r.rate_paisa,
      freeAbovePaisa: r.free_above_paisa,
      minDays: r.shipping_methods!.min_days,
      maxDays: r.shipping_methods!.max_days,
      supportsCod: r.shipping_methods!.supports_cod,
      isActive: r.shipping_zones!.is_active,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
