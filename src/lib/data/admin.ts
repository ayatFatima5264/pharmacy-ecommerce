import { brands, categories, healthPackages, labTests, products } from './catalog'
import { useDb } from './source'

/**
 * Dummy admin data.
 *
 * Generated deterministically from an index — no Math.random and no Date.now —
 * so a given row has the same values on every render. Random data would make
 * pagination appear to reshuffle between server renders and is impossible to
 * test against.
 */

const BASE = new Date('2026-07-21T10:00:00+05:00').getTime()
const DAY = 86_400_000

/** Small deterministic hash so values look varied but never change. */
function seeded(n: number, mod: number): number {
  return Math.abs(Math.sin(n * 12.9898) * 43758.5453) % mod | 0
}

function daysAgo(n: number): string {
  return new Date(BASE - n * DAY).toISOString()
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

const FIRST = ['Ahmed', 'Fatima', 'Bilal', 'Ayesha', 'Usman', 'Zainab', 'Hassan', 'Maryam', 'Omar', 'Sana', 'Imran', 'Hira', 'Kamran', 'Nida', 'Faisal', 'Rabia']
const LAST = ['Khan', 'Ali', 'Malik', 'Siddiqui', 'Sheikh', 'Qureshi', 'Butt', 'Raza', 'Ahmed', 'Hussain', 'Iqbal', 'Chaudhry']
const CITIES = ['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Quetta']

export interface AdminCustomer {
  id: string
  name: string
  phone: string
  email: string
  city: string
  orderCount: number
  lifetimeValuePaisa: number
  joinedAt: string
  lastOrderAt: string
  status: 'active' | 'inactive'
}

export const adminCustomers: AdminCustomer[] = Array.from({ length: 64 }, (_, i) => {
  const first = FIRST[seeded(i + 1, FIRST.length)]
  const last = LAST[seeded(i + 7, LAST.length)]
  const orderCount = 1 + seeded(i + 3, 24)
  return {
    id: `CUS-${2000 + i}`,
    name: `${first} ${last}`,
    phone: `+92 3${seeded(i + 11, 9)}${String(10_000_000 + seeded(i + 13, 89_999_999)).slice(0, 8)}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.pk`,
    city: CITIES[seeded(i + 5, CITIES.length)],
    orderCount,
    lifetimeValuePaisa: orderCount * (45_000 + seeded(i + 17, 320_000)),
    joinedAt: daysAgo(30 + seeded(i + 19, 500)),
    lastOrderAt: daysAgo(seeded(i + 23, 90)),
    status: seeded(i + 29, 10) > 1 ? 'active' : 'inactive',
  }
})

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export type AdminOrderStatus =
  | 'awaiting_rx'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'delivery_failed'
  | 'cancelled'

export type AdminPaymentMethod = 'cod' | 'jazzcash' | 'easypaisa'
export type AdminPaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'

export interface AdminOrder {
  id: string
  orderNumber: string
  customerId: string
  customerName: string
  city: string
  placedAt: string
  status: AdminOrderStatus
  paymentMethod: AdminPaymentMethod
  paymentStatus: AdminPaymentStatus
  itemCount: number
  requiresPrescription: boolean
  hasLabItems: boolean
  totalPaisa: number
}

const ORDER_STATUSES: AdminOrderStatus[] = [
  'awaiting_rx', 'confirmed', 'processing', 'shipped', 'delivered',
  'delivered', 'delivered', 'delivery_failed', 'cancelled',
]

export const adminOrders: AdminOrder[] = Array.from({ length: 87 }, (_, i) => {
  const customer = adminCustomers[seeded(i + 31, adminCustomers.length)]
  const status = ORDER_STATUSES[seeded(i + 37, ORDER_STATUSES.length)]
  const method: AdminPaymentMethod = (['cod', 'cod', 'cod', 'jazzcash', 'easypaisa'] as const)[
    seeded(i + 41, 5)
  ]
  const paymentStatus: AdminPaymentStatus =
    status === 'cancelled' ? 'refunded'
      : status === 'delivered' ? 'paid'
        : method === 'cod' ? 'pending' : 'paid'

  return {
    id: `ord-${i}`,
    orderNumber: `HC-${100_000 + i * 7}`,
    customerId: customer.id,
    customerName: customer.name,
    city: customer.city,
    placedAt: daysAgo(seeded(i + 43, 60)),
    status,
    paymentMethod: method,
    paymentStatus,
    itemCount: 1 + seeded(i + 47, 6),
    requiresPrescription: status === 'awaiting_rx' || seeded(i + 53, 4) === 0,
    hasLabItems: seeded(i + 59, 3) === 0,
    totalPaisa: 35_000 + seeded(i + 61, 480_000),
  }
}).sort((a, b) => b.placedAt.localeCompare(a.placedAt))

// ---------------------------------------------------------------------------
// Lab bookings
// ---------------------------------------------------------------------------

export type BookingStatus =
  | 'scheduled' | 'sample_collected' | 'in_lab' | 'report_ready' | 'cancelled' | 'no_show'

export interface AdminBooking {
  id: string
  bookingNumber: string
  patientName: string
  testName: string
  labName: string
  city: string
  scheduledAt: string
  slot: string
  collectionMode: 'home' | 'lab_visit'
  status: BookingStatus
  pricePaisa: number
}

const SLOTS = ['7:00 – 9:00 AM', '9:00 – 11:00 AM', '11:00 AM – 1:00 PM', '4:00 – 6:00 PM']
const BOOKING_STATUSES: BookingStatus[] = [
  'scheduled', 'scheduled', 'sample_collected', 'in_lab', 'report_ready', 'report_ready', 'cancelled', 'no_show',
]

const bookableItems = [
  ...labTests.map((t) => ({ name: t.name, lab: t.labName, price: t.pricePaisa })),
  ...healthPackages.map((p) => ({ name: p.name, lab: p.labName, price: p.pricePaisa })),
]

export const adminBookings: AdminBooking[] = Array.from({ length: 41 }, (_, i): AdminBooking => {
  const customer = adminCustomers[seeded(i + 67, adminCustomers.length)]
  const item = bookableItems[seeded(i + 71, bookableItems.length)]
  return {
    id: `bk-${i}`,
    bookingNumber: `LB-${100_000 + i * 3}`,
    patientName: customer.name,
    testName: item.name,
    labName: item.lab,
    city: customer.city,
    scheduledAt: daysAgo(seeded(i + 73, 20) - 5),
    slot: SLOTS[seeded(i + 79, SLOTS.length)],
    collectionMode: seeded(i + 83, 5) === 0 ? 'lab_visit' : 'home',
    status: BOOKING_STATUSES[seeded(i + 89, BOOKING_STATUSES.length)],
    pricePaisa: item.price,
  }
}).sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))

// ---------------------------------------------------------------------------
// Inventory batches — drives the expiry warnings on the dashboard
// ---------------------------------------------------------------------------

export interface AdminBatch {
  id: string
  batchNumber: string
  /** Real FK. Keying on product name would break the moment one is renamed. */
  productId: string
  productName: string
  variantId: string
  sku: string
  pharmacy: string
  expiryDate: string
  quantityOnHand: number
  quantityReserved: number
}

const PHARMACIES = ['Karachi — Clifton', 'Lahore — Gulberg', 'Islamabad — F-7']

export const adminBatches: AdminBatch[] = products.flatMap((product, pi) =>
  product.variants.map((variant, vi) => {
    const i = pi * 10 + vi
    // A deliberate spread: a few expired, a few expiring soon, most healthy.
    const daysToExpiry = [-40, -8, 22, 61, 88, 140, 260, 420, 600][seeded(i + 97, 9)]
    return {
      id: `batch-${i}`,
      batchNumber: `B-${2000 + i * 13}`,
      productId: product.id,
      productName: product.name,
      variantId: variant.id,
      sku: variant.sku,
      pharmacy: PHARMACIES[seeded(i + 101, PHARMACIES.length)],
      expiryDate: new Date(BASE + daysToExpiry * DAY).toISOString(),
      quantityOnHand: seeded(i + 103, 1400),
      quantityReserved: seeded(i + 107, 40),
    }
  }),
)

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

export interface AdminCoupon {
  id: string
  code: string
  discountType: 'percentage' | 'fixed_amount' | 'free_shipping'
  discountValue: number
  minOrderPaisa: number
  maxDiscountPaisa: number | null
  usageLimit: number | null
  usageCount: number
  startsAt: string
  expiresAt: string | null
  isActive: boolean
}

export const adminCoupons: AdminCoupon[] = [
  { id: 'c1', code: 'SAVE10', discountType: 'percentage', discountValue: 10, minOrderPaisa: 100_000, maxDiscountPaisa: 50_000, usageLimit: 1000, usageCount: 428, startsAt: daysAgo(60), expiresAt: daysAgo(-30), isActive: true },
  { id: 'c2', code: 'FIRST15', discountType: 'percentage', discountValue: 15, minOrderPaisa: 150_000, maxDiscountPaisa: 75_000, usageLimit: 500, usageCount: 187, startsAt: daysAgo(90), expiresAt: daysAgo(-60), isActive: true },
  { id: 'c3', code: 'FREESHIP', discountType: 'free_shipping', discountValue: 100, minOrderPaisa: 50_000, maxDiscountPaisa: null, usageLimit: null, usageCount: 1204, startsAt: daysAgo(180), expiresAt: null, isActive: true },
  { id: 'c4', code: 'LABS200', discountType: 'fixed_amount', discountValue: 200, minOrderPaisa: 300_000, maxDiscountPaisa: 20_000, usageLimit: 300, usageCount: 296, startsAt: daysAgo(45), expiresAt: daysAgo(-14), isActive: true },
  { id: 'c5', code: 'RAMADAN25', discountType: 'percentage', discountValue: 25, minOrderPaisa: 200_000, maxDiscountPaisa: 100_000, usageLimit: 2000, usageCount: 1998, startsAt: daysAgo(150), expiresAt: daysAgo(120), isActive: false },
  { id: 'c6', code: 'WELCOME50', discountType: 'fixed_amount', discountValue: 50, minOrderPaisa: 0, maxDiscountPaisa: 5_000, usageLimit: null, usageCount: 3421, startsAt: daysAgo(365), expiresAt: null, isActive: true },
  { id: 'c7', code: 'WINTER20', discountType: 'percentage', discountValue: 20, minOrderPaisa: 250_000, maxDiscountPaisa: 60_000, usageLimit: 800, usageCount: 0, startsAt: daysAgo(-30), expiresAt: daysAgo(-90), isActive: false },
]

// ---------------------------------------------------------------------------
// Shipping
// ---------------------------------------------------------------------------

export interface AdminShippingZone {
  id: string
  name: string
  cities: string[]
  carrier: string
  ratePaisa: number
  freeAbovePaisa: number | null
  minDays: number
  maxDays: number
  supportsCod: boolean
  isActive: boolean
}

export const adminShippingZones: AdminShippingZone[] = [
  { id: 'z1', name: 'Karachi Metro', cities: ['Karachi'], carrier: 'In-house fleet', ratePaisa: 9_900, freeAbovePaisa: 200_000, minDays: 0, maxDays: 1, supportsCod: true, isActive: true },
  { id: 'z2', name: 'Lahore Metro', cities: ['Lahore'], carrier: 'In-house fleet', ratePaisa: 9_900, freeAbovePaisa: 200_000, minDays: 0, maxDays: 1, supportsCod: true, isActive: true },
  { id: 'z3', name: 'Twin Cities', cities: ['Islamabad', 'Rawalpindi'], carrier: 'TCS Overnight', ratePaisa: 15_000, freeAbovePaisa: 200_000, minDays: 1, maxDays: 2, supportsCod: true, isActive: true },
  { id: 'z4', name: 'Punjab Upcountry', cities: ['Faisalabad', 'Multan', 'Sialkot', 'Gujranwala'], carrier: 'Leopards Standard', ratePaisa: 19_900, freeAbovePaisa: 300_000, minDays: 2, maxDays: 3, supportsCod: true, isActive: true },
  { id: 'z5', name: 'KPK & Balochistan', cities: ['Peshawar', 'Quetta', 'Abbottabad'], carrier: 'TCS Standard', ratePaisa: 24_900, freeAbovePaisa: 400_000, minDays: 3, maxDays: 5, supportsCod: false, isActive: true },
  { id: 'z6', name: 'Sindh Interior', cities: ['Hyderabad', 'Sukkur', 'Larkana'], carrier: 'Leopards Standard', ratePaisa: 19_900, freeAbovePaisa: 300_000, minDays: 2, maxDays: 4, supportsCod: true, isActive: true },
  { id: 'z7', name: 'Gilgit-Baltistan', cities: ['Gilgit', 'Skardu'], carrier: 'TCS Standard', ratePaisa: 34_900, freeAbovePaisa: null, minDays: 5, maxDays: 8, supportsCod: false, isActive: false },
]

// ---------------------------------------------------------------------------
// Derived admin views
//
// Product, category, brand and batch projections moved to admin-catalog.ts,
// which reads the MUTABLE store. Keeping them here as module constants would
// snapshot the seed data at import and never reflect an admin edit.
// ---------------------------------------------------------------------------

export const adminLabTests = labTests.map((test) => ({
  ...test,
  bookingCount: adminBookings.filter((b) => b.testName === test.name).length,
  isActive: true,
}))

// ---------------------------------------------------------------------------
// Dashboard metrics
// ---------------------------------------------------------------------------

export async function getDashboardMetrics() {
  if (useDb()) {
    const { getDashboardMetricsDb } = await import('./db/admin-db')
    return getDashboardMetricsDb()
  }
  const delivered = adminOrders.filter((o) => o.status === 'delivered')
  const revenuePaisa = delivered.reduce((sum, o) => sum + o.totalPaisa, 0)

  return {
    revenuePaisa,
    orderCount: adminOrders.length,
    awaitingRx: adminOrders.filter((o) => o.status === 'awaiting_rx').length,
    pendingBookings: adminBookings.filter((b) => b.status === 'scheduled').length,
    customerCount: adminCustomers.length,
    averageOrderPaisa: delivered.length ? Math.round(revenuePaisa / delivered.length) : 0,
    codPendingPaisa: adminOrders
      .filter((o) => o.paymentMethod === 'cod' && o.paymentStatus === 'pending')
      .reduce((sum, o) => sum + o.totalPaisa, 0),
  }
}

/** Revenue for the last 14 days, for the dashboard chart. */
export async function getRevenueSeries() {
  if (useDb()) {
    const { getRevenueSeriesDb } = await import('./db/admin-db')
    return getRevenueSeriesDb()
  }
  return Array.from({ length: 14 }, (_, i) => {
    const dayIndex = 13 - i
    const date = new Date(BASE - dayIndex * DAY)
    const dayOrders = adminOrders.filter(
      (o) => new Date(o.placedAt).toDateString() === date.toDateString(),
    )
    return {
      date: date.toISOString(),
      label: date.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' }),
      revenuePaisa: dayOrders.reduce((sum, o) => sum + o.totalPaisa, 0),
      orderCount: dayOrders.length,
    }
  })
}

/** Deterministic units-sold figure for a product, used by the reports pages. */
export function unitsSoldFor(index: number): number {
  return 40 + seeded(index + 113, 380)
}

// ---------------------------------------------------------------------------
// Async seams (lib/data/source.ts): DB projections when configured, the demo
// rows above otherwise. Pages call these and never know the backend.
// ---------------------------------------------------------------------------

export interface AdminLabTestRow {
  id: string
  slug: string
  name: string
  shortCode: string
  parameters: string[]
  labName: string
  sampleType: string
  fastingRequired: boolean
  fastingHours: number | null
  turnaroundHours: number
  bookingCount: number
  pricePaisa: number
  isActive: boolean
}

export async function getAdminLabTests(): Promise<AdminLabTestRow[]> {
  if (useDb()) {
    const { getAdminLabTestsDb } = await import('./db/lab-admin-db')
    return getAdminLabTestsDb()
  }
  return adminLabTests
}

export async function getAdminBookings(): Promise<AdminBooking[]> {
  if (useDb()) {
    const { getAdminBookingsDb } = await import('./db/lab-admin-db')
    return getAdminBookingsDb()
  }
  // Scaffold: checkout-placed bookings lead, then the seeded demo rows.
  const { allBookings } = await import('./lab-store')
  const live: AdminBooking[] = allBookings().map((booking) => ({
    id: booking.id,
    bookingNumber: booking.bookingNumber,
    patientName: booking.patientName,
    testName:
      booking.tests.length === 1
        ? booking.tests[0].name
        : `${booking.tests.length} tests (${booking.tests.map((t) => t.shortCode).join(', ')})`,
    labName: booking.labName,
    city: booking.city,
    scheduledAt: booking.slotDate,
    slot: booking.slotLabel,
    collectionMode: booking.collectionMode,
    status: booking.status,
    pricePaisa: booking.totalPaisa,
  }))
  return [...live, ...adminBookings]
}

export async function getAdminCustomers(): Promise<AdminCustomer[]> {
  if (useDb()) {
    const { getAdminCustomersDb } = await import('./db/lab-admin-db')
    return getAdminCustomersDb()
  }
  return adminCustomers
}

export async function getAdminCoupons(): Promise<AdminCoupon[]> {
  if (useDb()) {
    const { getAdminCouponsDb } = await import('./db/lab-admin-db')
    return getAdminCouponsDb()
  }
  return adminCoupons
}

export async function getAdminShippingZones(): Promise<AdminShippingZone[]> {
  if (useDb()) {
    const { getAdminShippingZonesDb } = await import('./db/lab-admin-db')
    return getAdminShippingZonesDb()
  }
  return adminShippingZones
}

export async function getAdminOrders(): Promise<AdminOrder[]> {
  if (useDb()) {
    const { getAdminOrdersDb } = await import('./db/admin-db')
    return getAdminOrdersDb()
  }
  return adminOrders
}

/** Reference "today" for the admin console, so expiry maths stays deterministic. */
export const ADMIN_NOW = BASE
