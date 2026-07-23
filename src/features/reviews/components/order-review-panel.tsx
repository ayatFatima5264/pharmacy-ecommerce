import { Star } from 'lucide-react'
import { Accordion, AccordionItem } from '@/components/ui/accordion'
import { ReviewForm } from '@/features/reviews/components/review-form'
import { getOrderReviewables } from '@/features/reviews/queries'

/**
 * "Rate your items" card on a DELIVERED order's detail page — the only place
 * a review can start from, which is what makes every review a verified
 * purchase. Renders nothing when the order is not reviewable (not delivered,
 * not the viewer's, or contains no product lines).
 */
export async function OrderReviewPanel({
  orderNumber,
  userId,
}: {
  orderNumber: string
  userId: string
}) {
  const reviewables = await getOrderReviewables(orderNumber, userId)
  if (!reviewables || reviewables.length === 0) return null

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6 shadow-e1">
      <h2 className="flex items-center gap-2 text-body font-semibold text-gray-900">
        <Star className="h-4 w-4 text-green-600" aria-hidden="true" />
        Rate your items
      </h2>
      <p className="mt-1 text-body-sm text-gray-500">
        Your review is published after a quick check by our team, and appears with a Verified
        Buyer badge.
      </p>

      <Accordion className="mt-4">
        {reviewables.map((item) => (
          <AccordionItem
            key={item.productId}
            title={item.name}
            defaultOpen={reviewables.length === 1 && !item.existing}
          >
            <ReviewForm
              orderNumber={orderNumber}
              productId={item.productId}
              productName={item.name}
              existing={item.existing}
            />
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
