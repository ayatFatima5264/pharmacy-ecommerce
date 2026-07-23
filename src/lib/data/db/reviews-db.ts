import 'server-only'
import { cache } from 'react'
import { supabaseService } from '@/lib/supabase/server'
import type { RatingSummary } from '@/types'

/**
 * Rating aggregates for the catalog read path.
 *
 * Only APPROVED reviews count — the aggregate must match what a visitor can
 * actually read on the page, or the schema.org AggregateRating lies to Google.
 *
 * FAIL-SOFT on purpose: this feeds fetchAllProducts (catalog-db.ts), which
 * renders the whole storefront. If the 0025 migration has not reached the
 * database yet, a missing-table error here must degrade to "no ratings shown",
 * never to a broken pharmacy page.
 */
export const fetchRatingSummaries = cache(async (): Promise<Map<string, RatingSummary>> => {
  const { data, error } = await supabaseService()
    .from('product_reviews')
    .select('product_id, rating')
    .eq('status', 'approved')

  const map = new Map<string, RatingSummary>()
  if (error) {
    console.warn(`rating summaries unavailable: ${error.message}`)
    return map
  }

  const totals = new Map<string, { sum: number; count: number }>()
  for (const row of (data ?? []) as { product_id: string; rating: number }[]) {
    const t = totals.get(row.product_id) ?? { sum: 0, count: 0 }
    t.sum += row.rating
    t.count += 1
    totals.set(row.product_id, t)
  }
  for (const [productId, t] of totals) {
    map.set(productId, { average: Math.round((t.sum / t.count) * 10) / 10, count: t.count })
  }
  return map
})
