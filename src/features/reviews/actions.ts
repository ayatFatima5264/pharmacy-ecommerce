'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCustomer } from '@/features/auth/customer/guards'
import { authorizeAction } from '@/features/auth/staff/guards'
import { useDb } from '@/lib/data/source'
import { supabaseService } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { failure, invalid, success, type ActionState } from '@/features/catalog/actions/action-result'

/**
 * Review writes (V1.1).
 *
 * The eligibility rule — "you may review a product only on YOUR order that
 * was DELIVERED and CONTAINED it" — is re-verified here on every submit, not
 * trusted from the form. The unique (order_id, product_id) constraint is the
 * backstop; this action decides insert-vs-edit on the same key.
 *
 * Every write (including an edit of an approved review) lands as 'pending':
 * nothing reaches the public page without a moderator's approval.
 */

const submitSchema = z.object({
  orderNumber: z.string().trim().min(1),
  productId: z.string().uuid(),
  rating: z.coerce.number().int().min(1, 'Pick a star rating').max(5),
  body: z
    .string()
    .trim()
    .min(10, 'Tell other customers a little more — at least 10 characters')
    .max(2000, 'Please keep your review under 2000 characters'),
})

export async function submitReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const customer = await getCustomer()
  if (!customer) return failure('Sign in to review your purchases.')
  if (!useDb()) return failure('Reviews need a configured database.')

  const limit = checkRateLimit('review', customer.id)
  if (!limit.allowed) {
    return failure(`Too many review submissions — try again in ${limit.retryAfterSeconds}s.`)
  }

  const parsed = submitSchema.safeParse({
    orderNumber: String(formData.get('orderNumber') ?? ''),
    productId: String(formData.get('productId') ?? ''),
    rating: String(formData.get('rating') ?? ''),
    body: String(formData.get('body') ?? ''),
  })
  if (!parsed.success) return invalid(parsed.error)
  const { orderNumber, productId, rating, body } = parsed.data

  const db = supabaseService()

  // Gate 1: the order exists, is the customer's own, and was delivered.
  const { data: order, error: orderError } = await db
    .from('orders')
    .select('id, status, user_id')
    .ilike('order_number', orderNumber)
    .maybeSingle()
  if (orderError) return failure(orderError.message)
  if (!order || order.user_id !== customer.id) return failure('That order could not be found.')
  if (order.status !== 'delivered') {
    return failure('You can review items once the order has been delivered.')
  }

  // Gate 2: the product was actually part of that order.
  const { data: lines, error: linesError } = await db
    .from('order_items')
    .select('product_variants ( product_id )')
    .eq('order_id', order.id)
  if (linesError) return failure(linesError.message)
  const purchased = ((lines ?? []) as unknown as {
    product_variants: { product_id: string } | null
  }[]).some((line) => line.product_variants?.product_id === productId)
  if (!purchased) return failure('That product is not part of this order.')

  // One review per product per order: same key edits, new key inserts.
  const { data: existing, error: existingError } = await db
    .from('product_reviews')
    .select('id')
    .eq('order_id', order.id)
    .eq('product_id', productId)
    .maybeSingle()
  if (existingError) return failure(existingError.message)

  if (existing) {
    const { error } = await db
      .from('product_reviews')
      .update({
        rating,
        body,
        reviewer_name: customer.name,
        // Edits re-enter the moderation queue.
        status: 'pending',
        moderated_by: null,
        moderated_at: null,
        moderation_note: null,
      })
      .eq('id', existing.id)
      .eq('user_id', customer.id) // belt-and-braces: never edit another customer's row
    if (error) return failure(error.message)
  } else {
    const { error } = await db.from('product_reviews').insert({
      product_id: productId,
      order_id: order.id,
      user_id: customer.id,
      rating,
      body,
      reviewer_name: customer.name,
    })
    if (error) return failure(error.message)
  }

  revalidatePath(`/account/orders/${orderNumber}`)
  return success(
    existing
      ? 'Review updated — it will reappear once approved.'
      : 'Thank you! Your review will appear once approved.',
  )
}

/* ------------------------------- Admin ---------------------------------- */

const moderateSchema = z.object({
  reviewId: z.string().uuid(),
  decision: z.enum(['approve', 'reject', 'hide', 'delete']),
})

const DECISION_STATUS = { approve: 'approved', reject: 'rejected', hide: 'hidden' } as const

export async function moderateReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction('reviews.moderate')
  if (!auth.ok) return failure(auth.message)
  if (!useDb()) return failure('Review moderation needs a configured database.')

  const parsed = moderateSchema.safeParse({
    reviewId: String(formData.get('reviewId') ?? ''),
    decision: String(formData.get('decision') ?? ''),
  })
  if (!parsed.success) return failure('Invalid moderation request.')
  const { reviewId, decision } = parsed.data

  const db = supabaseService()
  const { data: review, error: fetchError } = await db
    .from('product_reviews')
    .select('id, products ( slug )')
    .eq('id', reviewId)
    .maybeSingle()
  if (fetchError) return failure(fetchError.message)
  if (!review) return failure('That review no longer exists.')
  const slug = (review as unknown as { products: { slug: string } | null }).products?.slug

  if (decision === 'delete') {
    const { error } = await db.from('product_reviews').delete().eq('id', reviewId)
    if (error) return failure(error.message)
  } else {
    const { error } = await db
      .from('product_reviews')
      .update({
        status: DECISION_STATUS[decision],
        moderated_by: auth.user.id,
        moderated_at: new Date().toISOString(),
      })
      .eq('id', reviewId)
    if (error) return failure(error.message)
  }

  revalidatePath('/admin/reviews')
  // Public surfaces that bake the aggregate: the product page now, listing
  // pages on their own ISR cadence (revalidate 3600).
  if (slug) revalidatePath(`/products/${slug}`)
  revalidatePath('/pharmacy')

  const labels = {
    approve: 'Review approved — it is now public.',
    reject: 'Review rejected.',
    hide: 'Review hidden from the storefront.',
    delete: 'Review deleted.',
  } as const
  return success(labels[decision])
}
