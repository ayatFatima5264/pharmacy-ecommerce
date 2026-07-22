import 'server-only'
import { isSupabaseConfigured } from '@/config/env'

/**
 * THE data-source seam (blueprint W1).
 *
 * One switch: Supabase configured → Postgres is the source of truth for every
 * module that has been wired over; not configured → the in-memory scaffold
 * keeps the app fully working (dev machines without a project, CI).
 *
 * Wired so far: pharmacy catalog reads, cart pricing snapshot, checkout
 * writes (place_order RPC), order tracking, lab slot availability.
 * Still scaffold-only (flip in Step 5+): lab content pages, admin console.
 *
 * When the last module flips, this file and the scaffold delete together.
 */
export function useDb(): boolean {
  return isSupabaseConfigured()
}
