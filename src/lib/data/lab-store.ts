import 'server-only'

/**
 * Collection slots and lab bookings.
 *
 * Capacity is the point. A lab can send a finite number of phlebotomists to a
 * city on a given morning, so a slot is a countable resource — modelling it as
 * rows lets availability be enforced rather than hoped for.
 *
 * Same limitation as the other stores: process memory, not persistence. In
 * Postgres, `collection_slots.booked_count <= capacity` is a CHECK constraint,
 * and the reserve step becomes a conditional UPDATE that either wins or loses
 * atomically — which is what makes overbooking impossible under concurrency
 * rather than merely unlikely.
 */

export interface SlotTemplate {
  id: string
  label: string
  startHour: number
  /** Fasting is easiest overnight, so morning slots are flagged for it. */
  suitableForFasting: boolean
}

export const SLOT_TEMPLATES: SlotTemplate[] = [
  { id: 'early-morning', label: '7:00 – 9:00 AM', startHour: 7, suitableForFasting: true },
  { id: 'morning', label: '9:00 – 11:00 AM', startHour: 9, suitableForFasting: true },
  { id: 'midday', label: '11:00 AM – 1:00 PM', startHour: 11, suitableForFasting: false },
  { id: 'afternoon', label: '2:00 – 4:00 PM', startHour: 14, suitableForFasting: false },
  { id: 'evening', label: '4:00 – 6:00 PM', startHour: 16, suitableForFasting: false },
]

/** Phlebotomists available per slot, per city. Bigger cities carry more. */
const CAPACITY_BY_CITY: Record<string, number> = {
  Karachi: 8,
  Lahore: 8,
  Islamabad: 6,
  Rawalpindi: 5,
  Faisalabad: 4,
  Multan: 4,
  Peshawar: 3,
  Hyderabad: 3,
  Quetta: 2,
  Sialkot: 2,
}
const DEFAULT_CAPACITY = 2

/** Cities where home collection is offered at all. */
export const HOME_COLLECTION_CITIES = Object.keys(CAPACITY_BY_CITY)

interface LabStore {
  /** `${date}|${slotId}|${city}` → units already booked. */
  booked: Record<string, number>
  bookings: LabBooking[]
  sequence: number
}

export interface LabBookingTest {
  slug: string
  name: string
  shortCode: string
  fastingRequired: boolean
}

export interface LabBooking {
  id: string
  bookingNumber: string
  orderNumber: string
  createdAt: string

  patientName: string
  patientAge: number
  patientGender: 'male' | 'female' | 'other'
  patientPhone: string

  collectionMode: 'home' | 'lab_visit'
  city: string
  address: string | null
  slotDate: string
  slotId: string
  slotLabel: string

  labName: string
  tests: LabBookingTest[]
  fastingHours: number | null
  status: 'scheduled' | 'sample_collected' | 'in_lab' | 'report_ready' | 'cancelled'
  totalPaisa: number
}

const globalStore = globalThis as unknown as { __labStore?: LabStore }

function store(): LabStore {
  globalStore.__labStore ??= { booked: {}, bookings: [], sequence: 100_000 }
  return globalStore.__labStore
}

function capacityFor(city: string): number {
  return CAPACITY_BY_CITY[city] ?? DEFAULT_CAPACITY
}

function slotKey(date: string, slotId: string, city: string): string {
  return `${date}|${slotId}|${city}`
}

export interface AvailableSlot {
  id: string
  label: string
  capacity: number
  booked: number
  remaining: number
  isFull: boolean
  suitableForFasting: boolean
  /** True when the slot's start time has already passed today. */
  isPast: boolean
}

export interface AvailableDate {
  date: string
  label: string
  weekday: string
  isToday: boolean
  slotsRemaining: number
}

/**
 * Bookable dates. Today is included only while some slot has not yet started,
 * so the picker never offers an appointment that already happened.
 */
export function getAvailableDates(city: string, days = 10, now = new Date()): AvailableDate[] {
  const dates: AvailableDate[] = []

  for (let offset = 0; offset < days + 1 && dates.length < days; offset++) {
    const date = new Date(now)
    date.setDate(date.getDate() + offset)
    const iso = date.toISOString().slice(0, 10)

    const slots = getSlotsForDate(city, iso, now)
    const remaining = slots.reduce((sum, s) => sum + (s.isPast ? 0 : s.remaining), 0)

    // Skip a day only when nothing on it is bookable.
    if (remaining === 0) continue

    dates.push({
      date: iso,
      label: date.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' }),
      weekday: offset === 0 ? 'Today' : date.toLocaleDateString('en-PK', { weekday: 'short' }),
      isToday: offset === 0,
      slotsRemaining: remaining,
    })
  }

  return dates
}

export function getSlotsForDate(city: string, date: string, now = new Date()): AvailableSlot[] {
  const capacity = capacityFor(city)
  const today = now.toISOString().slice(0, 10)
  const isToday = date === today
  // A date earlier than today is entirely in the past. Checking only the hour
  // would leave every slot on a past date bookable — which a hand-crafted POST
  // would happily exploit.
  const isPastDate = date < today

  return SLOT_TEMPLATES.map((template) => {
    const booked = store().booked[slotKey(date, template.id, city)] ?? 0
    const remaining = Math.max(0, capacity - booked)
    // A one-hour lead time: a slot starting within the hour cannot be staffed.
    const isPast = isPastDate || (isToday && now.getHours() >= template.startHour - 1)

    return {
      id: template.id,
      label: template.label,
      capacity,
      booked,
      remaining,
      isFull: remaining === 0,
      suitableForFasting: template.suitableForFasting,
      isPast,
    }
  })
}

export function isSlotBookable(
  city: string,
  date: string,
  slotId: string,
  now = new Date(),
): { ok: true } | { ok: false; reason: string } {
  const slot = getSlotsForDate(city, date, now).find((s) => s.id === slotId)
  if (!slot) return { ok: false, reason: 'That time slot does not exist.' }
  if (slot.isPast) return { ok: false, reason: 'That time slot has already started.' }
  if (slot.isFull) return { ok: false, reason: 'That time slot is now full. Please pick another.' }
  return { ok: true }
}

/**
 * Reserves one unit of capacity.
 *
 * Check and increment happen together so two simultaneous bookings cannot both
 * see the last space. In Postgres this is a single conditional UPDATE guarded
 * by the capacity CHECK.
 */
export function reserveSlot(
  city: string,
  date: string,
  slotId: string,
  now = new Date(),
): { ok: true } | { ok: false; reason: string } {
  const check = isSlotBookable(city, date, slotId, now)
  if (!check.ok) return check

  const key = slotKey(date, slotId, city)
  store().booked[key] = (store().booked[key] ?? 0) + 1
  return { ok: true }
}

export function releaseSlot(city: string, date: string, slotId: string): void {
  const key = slotKey(date, slotId, city)
  const current = store().booked[key] ?? 0
  if (current > 0) store().booked[key] = current - 1
}

export function nextBookingNumber(): string {
  const s = store()
  s.sequence += 1
  return `LB-${s.sequence}`
}

export function insertBooking(booking: LabBooking): LabBooking {
  store().bookings.unshift(booking)
  return booking
}

export function findBookingByNumber(bookingNumber: string): LabBooking | undefined {
  return store().bookings.find(
    (b) => b.bookingNumber.toUpperCase() === bookingNumber.trim().toUpperCase(),
  )
}

export function findBookingsByOrder(orderNumber: string): LabBooking[] {
  return store().bookings.filter((b) => b.orderNumber === orderNumber)
}

export function allBookings(): LabBooking[] {
  return store().bookings
}

export function supportsHomeCollection(city: string): boolean {
  return HOME_COLLECTION_CITIES.includes(city)
}
