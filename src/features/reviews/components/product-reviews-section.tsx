import Link from 'next/link'
import { BadgeCheck } from 'lucide-react'
import { RatingStars } from '@/components/shared/rating-stars'
import { getApprovedReviews } from '@/features/reviews/queries'
import { formatDate } from '@/lib/utils'
import type { Product } from '@/types'

/**
 * The PDP reviews section: aggregate summary + approved reviews. Renders
 * server-side so the content crawlers index matches the AggregateRating the
 * page's JSON-LD declares.
 */
export async function ProductReviewsSection({ product }: { product: Product }) {
  const reviews = await getApprovedReviews(product.id)
  const rating = product.rating

  return (
    <section className="mt-16" aria-labelledby="pdp-reviews" id="reviews">
      <h2 id="pdp-reviews" className="text-h2">
        Customer reviews
      </h2>

      <div className="mt-6 grid gap-8 lg:grid-cols-[280px_1fr]">
        {/* ---------- Aggregate ---------- */}
        <div className="h-fit rounded-md border border-gray-200 bg-gray-50 p-6 text-center">
          {rating && rating.count > 0 ? (
            <>
              <p className="tabular text-[44px] font-bold leading-none tracking-[-0.02em] text-gray-900">
                {rating.average.toFixed(1)}
              </p>
              <RatingStars rating={rating.average} size="md" className="mt-3" />
              <p className="mt-2 text-body-sm text-gray-500">
                Based on {rating.count} verified review{rating.count === 1 ? '' : 's'}
              </p>
            </>
          ) : (
            <p className="text-body-sm text-gray-500">No reviews yet — be the first.</p>
          )}
          <p className="mt-4 border-t border-gray-200 pt-4 text-body-sm text-gray-500">
            Bought this item?{' '}
            <Link
              href="/account/orders"
              className="font-semibold text-blue-600 hover:underline"
            >
              Review it from your delivered order
            </Link>
            .
          </p>
        </div>

        {/* ---------- Review list ---------- */}
        {reviews.length > 0 ? (
          <ul className="flex flex-col divide-y divide-gray-100">
            {reviews.map((review) => (
              <li key={review.id} className="py-5 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="text-body-sm font-semibold text-gray-900">
                    {review.reviewerName}
                  </span>
                  {review.isVerified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-caption font-semibold text-green-700">
                      <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      Verified Buyer
                    </span>
                  )}
                  <span className="text-body-sm text-gray-400">{formatDate(review.createdAt)}</span>
                </div>
                <RatingStars rating={review.rating} className="mt-2" />
                {review.body && (
                  <p className="mt-2 max-w-2xl text-body leading-relaxed text-gray-700">
                    {review.body}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center rounded-md border border-gray-200 bg-white p-6">
            <p className="text-body text-gray-500">
              Reviews come from customers who purchased this item, after their order is
              delivered — so every one you read here is a real experience.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
