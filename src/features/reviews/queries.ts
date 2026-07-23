import 'server-only'
import { cache } from 'react'
import { supabaseService } from '@/lib/supabase/server'
import { useDb } from '@/lib/data/source'

/**
 * Review read paths.
 *
 * All reads run on the service client for one uniform, session-free path
 * (same reasoning as catalog-db.ts) — visibility rules are applied explicitly
 * here: public surfaces only ever query status = 'approved'; the customer's
 * own order page sees their rows in any status because the query is keyed to
 * their user id by the caller (which got it from the verified session).
 *
 * Storefront-facing reads FAIL SOFT: a missing table (migration not yet
 * applied) or transient error renders as "no reviews", never a broken page.
 */

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'hidden'

export interface PublicReview {
  id: string
  reviewerName: string
  rating: number
  body: string
  createdAt: string
  isVerified: boolean
}

/** Approved reviews for a product page, newest first. */
export const getApprovedReviews = cache(async (productId: string): Promise<PublicReview[]> => {
  if (!useDb()) return [] // scaffold mode: reviews live only in the database
  const { data, error } = await supabaseService()
    .from('product_reviews')
    .select('id, reviewer_name, rating, body, created_at, is_verified')
    .eq('product_id', productId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) {
    console.warn(`product reviews unavailable: ${error.message}`)
    return []
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    reviewerName: row.reviewer_name,
    rating: row.rating,
    body: row.body,
    createdAt: row.created_at,
    isVerified: row.is_verified,
  }))
})

export interface OrderReviewable {
  productId: string
  name: string
  slug: string
  /** The customer's existing review for this product on this order, if any. */
  existing: { rating: number; body: string; status: ReviewStatus } | null
}

interface ReviewableOrderRow {
  id: string
  status: string
  user_id: string | null
  order_items: {
    product_variants: { product_id: string; products: { name: string; slug: string } | null } | null
  }[]
}

/**
 * The products a customer may review on one of THEIR DELIVERED orders,
 * with any review they have already written. Returns null unless the order
 * exists, belongs to the user, and is delivered — the same gate the write
 * action enforces, so the form never renders where submission would fail.
 */
export async function getOrderReviewables(
  orderNumber: string,
  userId: string,
): Promise<OrderReviewable[] | null> {
  if (!useDb()) return null
  const db = supabaseService()
  const { data, error } = await db
    .from('orders')
    .select(
      `id, status, user_id,
       order_items ( product_variants ( product_id, products ( name, slug ) ) )`,
    )
    .ilike('order_number', orderNumber.trim())
    .maybeSingle()
  if (error) {
    console.warn(`reviewables query failed: ${error.message}`)
    return null
  }
  const order = data as unknown as ReviewableOrderRow | null
  if (!order || order.user_id !== userId || order.status !== 'delivered') return null

  // Lab tests and packages have no variant — only product lines are reviewable.
  // Two pack sizes of one product collapse to a single review target.
  const products = new Map<string, { name: string; slug: string }>()
  for (const item of order.order_items) {
    const pv = item.product_variants
    if (pv?.products) products.set(pv.product_id, { name: pv.products.name, slug: pv.products.slug })
  }
  if (products.size === 0) return []

  const { data: reviews, error: reviewsError } = await db
    .from('product_reviews')
    .select('product_id, rating, body, status')
    .eq('order_id', order.id)
    .eq('user_id', userId)
  if (reviewsError) {
    console.warn(`existing reviews query failed: ${reviewsError.message}`)
    return null
  }
  const existingByProduct = new Map(
    (reviews ?? []).map((r) => [
      r.product_id,
      { rating: r.rating, body: r.body, status: r.status as ReviewStatus },
    ]),
  )

  return [...products.entries()].map(([productId, p]) => ({
    productId,
    name: p.name,
    slug: p.slug,
    existing: existingByProduct.get(productId) ?? null,
  }))
}

/* ------------------------------- Admin ---------------------------------- */

export interface AdminReview {
  id: string
  productName: string
  productSlug: string
  orderNumber: string
  reviewerName: string
  rating: number
  body: string
  status: ReviewStatus
  createdAt: string
}

interface AdminReviewRow {
  id: string
  rating: number
  body: string
  reviewer_name: string
  status: string
  created_at: string
  products: { name: string; slug: string } | null
  orders: { order_number: string } | null
}

/** Every review for the moderation console, newest first. */
export async function getAdminReviews(): Promise<AdminReview[]> {
  const { data, error } = await supabaseService()
    .from('product_reviews')
    .select('id, rating, body, reviewer_name, status, created_at, products ( name, slug ), orders ( order_number )')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw new Error(`admin reviews query failed: ${error.message}`)

  return ((data ?? []) as unknown as AdminReviewRow[]).map((row) => ({
    id: row.id,
    productName: row.products?.name ?? 'Deleted product',
    productSlug: row.products?.slug ?? '',
    orderNumber: row.orders?.order_number ?? '—',
    reviewerName: row.reviewer_name,
    rating: row.rating,
    body: row.body,
    status: row.status as ReviewStatus,
    createdAt: row.created_at,
  }))
}
