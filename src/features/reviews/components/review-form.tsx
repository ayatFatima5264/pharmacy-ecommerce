'use client'

import * as React from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertCircle, CheckCircle2, Loader2, Star } from 'lucide-react'
import { Field, Textarea } from '@/components/ui/field'
import { submitReview } from '@/features/reviews/actions'
import type { ReviewStatus } from '@/features/reviews/queries'
import type { ActionState } from '@/features/catalog/actions/action-result'
import { cn } from '@/lib/utils'

const idle: ActionState = { status: 'idle' }

const STATUS_NOTES: Record<ReviewStatus, string> = {
  pending: 'Your review is awaiting approval.',
  approved: 'Your review is live on the product page. Editing sends it for re-approval.',
  rejected: 'Your review was not published. You can edit and resubmit it.',
  hidden: 'Your review is currently hidden by the store.',
}

/**
 * Write-or-edit form for ONE product on ONE delivered order. The star picker
 * is a real radio group — five sr-only radios whose labels draw the stars —
 * so keyboard and screen-reader users rate exactly like everyone else.
 */
export function ReviewForm({
  orderNumber,
  productId,
  productName,
  existing,
}: {
  orderNumber: string
  productId: string
  productName: string
  existing: { rating: number; body: string; status: ReviewStatus } | null
}) {
  const [state, formAction] = useActionState(submitReview, idle)
  const [rating, setRating] = React.useState(existing?.rating ?? 0)
  const [hovered, setHovered] = React.useState(0)
  const groupId = `rate-${productId}`

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      <input type="hidden" name="orderNumber" value={orderNumber} />
      <input type="hidden" name="productId" value={productId} />

      {existing && state.status === 'idle' && (
        <p className="rounded-sm bg-blue-50 p-2.5 text-[13px] text-blue-700" role="status">
          {STATUS_NOTES[existing.status]}
        </p>
      )}

      {state.status === 'success' && (
        <p role="status" className="flex items-center gap-2 rounded-sm bg-green-50 p-2.5 text-[13px] text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          {state.message}
        </p>
      )}
      {state.status === 'error' && (
        <p role="alert" className="flex items-center gap-2 rounded-sm bg-red-50 p-2.5 text-[13px] text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {state.message}
        </p>
      )}

      <fieldset>
        <legend className="text-body-sm font-semibold text-gray-700">
          Your rating
          <span className="ml-0.5 text-red-600" aria-hidden="true">*</span>
        </legend>
        <div
          className="mt-1.5 flex w-fit gap-1"
          onMouseLeave={() => setHovered(0)}
        >
          {[1, 2, 3, 4, 5].map((value) => {
            const filled = value <= (hovered || rating)
            return (
              <label
                key={value}
                htmlFor={`${groupId}-${value}`}
                onMouseEnter={() => setHovered(value)}
                className="cursor-pointer rounded-sm p-0.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-600 has-[:focus-visible]:ring-offset-1"
              >
                <input
                  type="radio"
                  id={`${groupId}-${value}`}
                  name="rating"
                  value={value}
                  checked={rating === value}
                  onChange={() => setRating(value)}
                  className="sr-only"
                  aria-label={`${value} star${value === 1 ? 's' : ''}`}
                />
                <Star
                  className={cn(
                    'h-7 w-7 transition-colors duration-fast',
                    filled ? 'fill-current text-green-600' : 'text-gray-300',
                  )}
                  aria-hidden="true"
                />
              </label>
            )
          })}
        </div>
        {state.status === 'error' && state.fieldErrors?.rating && (
          <p className="mt-1 flex items-center gap-1.5 text-body-sm text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {state.fieldErrors.rating}
          </p>
        )}
      </fieldset>

      <Field
        label="Your review"
        htmlFor={`${groupId}-body`}
        error={state.status === 'error' ? state.fieldErrors?.body : undefined}
        required
      >
        <Textarea
          id={`${groupId}-body`}
          name="body"
          rows={3}
          defaultValue={existing?.body ?? ''}
          maxLength={2000}
          placeholder={`How did ${productName} work for you?`}
          aria-invalid={state.status === 'error' && !!state.fieldErrors?.body}
        />
      </Field>

      <SubmitButton isEdit={Boolean(existing)} />
    </form>
  )
}

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-10 w-fit items-center gap-2 rounded-md bg-blue-600 px-5 text-[13.5px] font-semibold text-white transition-colors duration-fast hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:bg-gray-100 disabled:text-gray-400"
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {pending ? 'Submitting' : isEdit ? 'Update review' : 'Submit review'}
    </button>
  )
}
