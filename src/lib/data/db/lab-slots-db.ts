import 'server-only'
import { supabaseService } from '@/lib/supabase/server'
import {
  SLOT_TEMPLATES,
  supportsHomeCollection,
  type AvailableDate,
  type AvailableSlot,
} from '@/lib/data/lab-store'

/**
 * Slot availability from collection_slots — booked_count is maintained by
 * place_order's guarded claim, so what this returns is what checkout will
 * actually accept.
 *
 * DB rows map back onto the UI's SLOT_TEMPLATES by start hour (the seed
 * writes slots from the same templates); the checkout DB path resolves the
 * chosen template back to the slot row's uuid the same way.
 */

interface SlotRow {
  id: string
  slot_date: string
  starts_at: string // 'HH:MM:SS'
  capacity: number
  booked_count: number
}

export function templateForStartHour(startsAt: string) {
  const hour = Number(startsAt.slice(0, 2))
  return SLOT_TEMPLATES.find((t) => t.startHour === hour) ?? null
}

export async function getAvailabilityDb(
  city: string,
  requestedDate?: string,
  now = new Date(),
): Promise<{ dates: AvailableDate[]; slots: AvailableSlot[]; homeCollectionAvailable: boolean }> {
  const today = now.toISOString().slice(0, 10)
  const horizon = new Date(now)
  horizon.setDate(horizon.getDate() + 10)

  const { data, error } = await supabaseService()
    .from('collection_slots')
    .select('id, slot_date, starts_at, capacity, booked_count')
    .eq('city', city)
    .eq('is_active', true)
    .gte('slot_date', today)
    .lte('slot_date', horizon.toISOString().slice(0, 10))
    .order('slot_date')
    .order('starts_at')
  if (error) throw new Error(`collection_slots query failed: ${error.message}`)

  const rows = (data ?? []) as SlotRow[]

  const toAvailableSlot = (row: SlotRow): AvailableSlot | null => {
    const template = templateForStartHour(row.starts_at)
    if (!template) return null // A slot shape the UI has no template for.
    const isToday = row.slot_date === today
    const remaining = Math.max(0, row.capacity - row.booked_count)
    return {
      id: template.id,
      label: template.label,
      capacity: row.capacity,
      booked: row.booked_count,
      remaining,
      isFull: remaining === 0,
      suitableForFasting: template.suitableForFasting,
      // Same one-hour staffing lead time as the scaffold.
      isPast: row.slot_date < today || (isToday && now.getHours() >= template.startHour - 1),
    }
  }

  const byDate = new Map<string, AvailableSlot[]>()
  for (const row of rows) {
    const slot = toAvailableSlot(row)
    if (!slot) continue
    const list = byDate.get(row.slot_date) ?? []
    list.push(slot)
    byDate.set(row.slot_date, list)
  }

  const dates: AvailableDate[] = []
  for (const [iso, slots] of [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const remaining = slots.reduce((sum, s) => sum + (s.isPast ? 0 : s.remaining), 0)
    if (remaining === 0) continue
    const date = new Date(`${iso}T00:00:00`)
    dates.push({
      date: iso,
      label: date.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' }),
      weekday:
        iso === today ? 'Today' : date.toLocaleDateString('en-PK', { weekday: 'short' }),
      isToday: iso === today,
      slotsRemaining: remaining,
    })
  }

  const chosen =
    requestedDate && dates.some((d) => d.date === requestedDate) ? requestedDate : dates[0]?.date

  return {
    dates,
    slots: chosen ? (byDate.get(chosen) ?? []) : [],
    // City coverage matches the seeded slot cities, which mirror the scaffold.
    homeCollectionAvailable: supportsHomeCollection(city),
  }
}

/** Resolves (city, date, UI template id) to the slot row for place_order. */
export async function resolveSlotDb(
  city: string,
  slotDate: string,
  templateId: string,
): Promise<{ id: string; lab_id: string } | null> {
  const template = SLOT_TEMPLATES.find((t) => t.id === templateId)
  if (!template) return null
  const { data, error } = await supabaseService()
    .from('collection_slots')
    .select('id, lab_id')
    .eq('city', city)
    .eq('slot_date', slotDate)
    .eq('starts_at', `${String(template.startHour).padStart(2, '0')}:00:00`)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`slot lookup failed: ${error.message}`)
  return data as { id: string; lab_id: string } | null
}
