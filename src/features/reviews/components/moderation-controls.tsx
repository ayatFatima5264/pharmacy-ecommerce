'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertCircle, Loader2 } from 'lucide-react'
import { moderateReview } from '@/features/reviews/actions'
import type { ReviewStatus } from '@/features/reviews/queries'
import type { ActionState } from '@/features/catalog/actions/action-result'

const idle: ActionState = { status: 'idle' }

type Decision = 'approve' | 'reject' | 'hide' | 'delete'

/**
 * Moderation buttons for one review row. Same hidden-decision-input pattern
 * as the prescription queue; the row's current status decides which actions
 * make sense to offer. On success the page revalidates, so no local state
 * mirrors the row.
 */
export function ModerationControls({
  reviewId,
  status,
}: {
  reviewId: string
  status: ReviewStatus
}) {
  const [state, formAction] = useActionState(moderateReview, idle)
  const [decision, setDecision] = useState<Decision>('approve')

  return (
    <form action={formAction} className="flex flex-col items-end gap-1.5">
      <input type="hidden" name="reviewId" value={reviewId} />
      <input type="hidden" name="decision" value={decision} />

      {state.status === 'error' && (
        <p role="alert" className="flex items-center gap-1.5 text-[12px] text-red-600">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-1.5">
        {status !== 'approved' && (
          <DecisionButton
            label="Approve"
            className="bg-green-600 text-white hover:bg-green-700"
            onSelect={() => setDecision('approve')}
          />
        )}
        {status !== 'rejected' && (
          <DecisionButton
            label="Reject"
            className="bg-red-50 text-red-600 hover:bg-red-600 hover:text-white"
            onSelect={() => setDecision('reject')}
          />
        )}
        {status === 'approved' && (
          <DecisionButton
            label="Hide"
            className="bg-gray-100 text-gray-600 hover:bg-gray-900 hover:text-white"
            onSelect={() => setDecision('hide')}
          />
        )}
        <DecisionButton
          label="Delete"
          className="bg-white text-gray-500 ring-1 ring-inset ring-gray-200 hover:bg-red-600 hover:text-white hover:ring-red-600"
          confirmMessage="Permanently delete this review? This cannot be undone."
          onSelect={() => setDecision('delete')}
        />
      </div>
    </form>
  )
}

function DecisionButton({
  label,
  className,
  onSelect,
  confirmMessage,
}: {
  label: string
  className: string
  onSelect: () => void
  confirmMessage?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault()
          return
        }
        onSelect()
      }}
      className={`inline-flex h-8 items-center gap-1.5 rounded-sm px-3 text-[12.5px] font-semibold transition-colors duration-fast disabled:bg-gray-100 disabled:text-gray-400 disabled:ring-0 ${className}`}
    >
      {pending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
      {label}
    </button>
  )
}
