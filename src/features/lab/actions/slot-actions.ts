'use server'

import {
  getAvailableDates,
  getSlotsForDate,
  supportsHomeCollection,
  type AvailableDate,
  type AvailableSlot,
} from '@/lib/data/lab-store'
import { useDb } from '@/lib/data/source'
import { getAvailabilityDb } from '@/lib/data/db/lab-slots-db'

/**
 * Slot availability, read on demand.
 *
 * A Server Action rather than baked into the page, because availability changes
 * as other people book — a snapshot rendered at page load goes stale while the
 * customer is still filling in the form.
 *
 * DB mode reads collection_slots — whose booked_count place_order maintains —
 * so what this offers is exactly what checkout will accept.
 */

export interface SlotAvailability {
  dates: AvailableDate[]
  slots: AvailableSlot[]
  homeCollectionAvailable: boolean
}

export async function getAvailability(
  city: string,
  date?: string,
): Promise<SlotAvailability> {
  if (useDb()) return getAvailabilityDb(city, date)

  const dates = getAvailableDates(city)
  const chosen = date && dates.some((d) => d.date === date) ? date : dates[0]?.date

  return {
    dates,
    slots: chosen ? getSlotsForDate(city, chosen) : [],
    homeCollectionAvailable: supportsHomeCollection(city),
  }
}
