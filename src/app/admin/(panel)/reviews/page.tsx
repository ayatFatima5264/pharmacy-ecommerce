import Link from 'next/link'
import { BadgeCheck, CheckCircle2, Clock, ShoppingBag, Star, TrendingUp } from 'lucide-react'
import { PageHeader, StatCard, StatusPill } from '@/components/admin/ui'
import { AdminEmptyState, Avatar, SegmentedTabs } from '@/components/admin/blocks'
import { FilterBar } from '@/components/admin/filter-bar'
import { Pagination } from '@/components/admin/pagination'
import { RatingStars } from '@/components/shared/rating-stars'
import { can, requireUser } from '@/features/auth/staff/guards'
import { getAdminReviews, type ReviewStatus } from '@/features/reviews/queries'
import { ModerationControls } from '@/features/reviews/components/moderation-controls'
import { matchesQuery, paginate, param, parsePage } from '@/lib/data/paginate'
import { useDb } from '@/lib/data/source'
import { formatDate } from '@/lib/utils'

export const metadata = { title: 'Reviews' }
export const dynamic = 'force-dynamic'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const STATUS_TONES: Record<ReviewStatus, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  hidden: 'neutral',
}

const STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  hidden: 'Hidden',
}

export default async function AdminReviewsPage({ searchParams }: { searchParams: SearchParams }) {
  // Staff can SEE the review stream (monitoring); moderating needs the
  // permission — controls are hidden and the actions enforce independently.
  await requireUser('/admin')
  const canModerate = await can('reviews.moderate')
  const params = await searchParams
  const reviews = useDb() ? await getAdminReviews() : []

  const query = param(params, 'q')
  const status = param(params, 'status')
  const rating = param(params, 'rating')

  const filtered = reviews.filter((review) => {
    if (!matchesQuery(review, query, ['productName', 'reviewerName', 'orderNumber'])) return false
    if (status && review.status !== status) return false
    if (rating && String(review.rating) !== rating) return false
    return true
  })

  const result = paginate(filtered, parsePage(params.page))

  const pending = reviews.filter((r) => r.status === 'pending').length
  const approved = reviews.filter((r) => r.status === 'approved')
  const averageApproved =
    approved.length > 0
      ? (approved.reduce((sum, r) => sum + r.rating, 0) / approved.length).toFixed(1)
      : '—'

  // Status tabs own the status filter; hrefs keep search + rating alive.
  function tabHref(target?: string) {
    const qs = new URLSearchParams()
    if (query) qs.set('q', query)
    if (rating) qs.set('rating', rating)
    if (target) qs.set('status', target)
    const s = qs.toString()
    return s ? `/admin/reviews?${s}` : '/admin/reviews'
  }
  const statusTabs = [
    { label: 'All', href: tabHref(), active: !status, count: reviews.length },
    ...(Object.keys(STATUS_LABELS) as ReviewStatus[]).map((key) => ({
      label: STATUS_LABELS[key],
      href: tabHref(key),
      active: status === key,
      count: reviews.filter((r) => r.status === key).length,
    })),
  ]

  return (
    <>
      <PageHeader
        title="Reviews"
        description="Customer product reviews. Nothing is public until approved here; every review is tied to a delivered order."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total reviews" icon={Star} value={String(reviews.length)} />
        <StatCard
          label="Awaiting approval"
          icon={Clock}
          value={String(pending)}
          tone={pending > 0 ? 'warning' : 'neutral'}
        />
        <StatCard label="Approved" icon={CheckCircle2} value={String(approved.length)} tone="success" />
        <StatCard label="Average rating" icon={TrendingUp} value={averageApproved} hint="Across approved reviews" />
      </div>

      <SegmentedTabs tabs={statusTabs} label="Review status" />

      <FilterBar
        searchPlaceholder="Search product, customer, or order…"
        selects={[
          {
            key: 'rating',
            label: 'Rating',
            options: [
              { value: '5', label: '5 stars' },
              { value: '4', label: '4 stars' },
              { value: '3', label: '3 stars' },
              { value: '2', label: '2 stars' },
              { value: '1', label: '1 star' },
            ],
          },
        ]}
      />

      {/* Rating cards, not table rows — a review is prose with a verdict, and
          prose needs room to be judged fairly. */}
      {result.rows.length === 0 ? (
        <div className="rounded-lg border border-gray-200/80 bg-white shadow-e1">
          <AdminEmptyState
            icon={Star}
            title="No reviews here"
            description="Reviews appear as customers rate delivered orders. Try another status tab or clear the filters."
          />
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {result.rows.map((review) => (
            <li
              key={review.id}
              className="flex flex-col rounded-lg border border-gray-200/80 bg-white p-5 shadow-e1 transition-shadow duration-medium hover:shadow-e2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={review.reviewerName} />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-[13.5px] font-bold text-gray-900">
                      {review.reviewerName}
                      <BadgeCheck
                        className="h-3.5 w-3.5 shrink-0 text-green-600"
                        aria-label="Verified buyer"
                      />
                    </p>
                    <p className="tabular truncate text-[12px] text-gray-500">
                      {review.orderNumber} · {formatDate(review.createdAt)}
                    </p>
                  </div>
                </div>
                <StatusPill tone={STATUS_TONES[review.status]}>
                  {STATUS_LABELS[review.status]}
                </StatusPill>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <RatingStars rating={review.rating} size="md" />
                <span className="tabular text-[13px] font-bold text-gray-900">
                  {review.rating}.0
                </span>
              </div>

              <p className="mt-2.5 line-clamp-4 flex-1 text-[13.5px] leading-relaxed text-gray-700">
                {review.body || <span className="italic text-gray-400">Rating only — no text.</span>}
              </p>

              <div className="mt-4 flex items-end justify-between gap-3 border-t border-gray-100 pt-3.5">
                {review.productSlug ? (
                  <Link
                    href={`/products/${review.productSlug}#reviews`}
                    className="flex min-w-0 items-center gap-1.5 rounded-sm text-[12.5px] font-semibold text-blue-600 hover:underline"
                  >
                    <ShoppingBag className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{review.productName}</span>
                  </Link>
                ) : (
                  <span className="truncate text-[12.5px] font-semibold text-gray-500">
                    {review.productName}
                  </span>
                )}
              </div>
              {canModerate && (
                <div className="mt-3">
                  <ModerationControls reviewId={review.id} status={review.status} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Pagination result={result} searchParams={params} basePath="/admin/reviews" />
    </>
  )
}
