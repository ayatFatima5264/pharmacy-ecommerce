'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { Field, Textarea } from '@/components/ui/field'
import { reviewPrescription } from '@/features/prescriptions/actions'
import type { ActionState } from '@/features/catalog/actions/action-result'

const idle: ActionState = { status: 'idle' }

/** Approve / reject controls for one prescription in the review queue. */
export function ReviewControls({ prescriptionId }: { prescriptionId: string }) {
  const [state, formAction] = useActionState(reviewPrescription, idle)
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved')

  if (state.status === 'success') {
    return (
      <p role="status" className="flex items-center gap-2 rounded-sm bg-green-50 p-2.5 text-[13px] text-green-700">
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        {state.message}
      </p>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="prescriptionId" value={prescriptionId} />
      <input type="hidden" name="decision" value={decision} />

      {state.status === 'error' && (
        <p role="alert" className="flex items-center gap-2 rounded-sm bg-red-50 p-2.5 text-[13px] text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {state.message}
        </p>
      )}

      <Field
        label={decision === 'rejected' ? 'Rejection reason (sent to the customer)' : 'Notes (optional)'}
        htmlFor={`${prescriptionId}-reason`}
        error={state.status === 'error' ? state.fieldErrors?.reason : undefined}
        required={decision === 'rejected'}
      >
        <Textarea
          id={`${prescriptionId}-reason`}
          name="reason"
          rows={2}
          placeholder={
            decision === 'rejected'
              ? 'e.g. The prescription has expired / the dosage is not legible…'
              : ''
          }
        />
      </Field>

      <div className="flex gap-2">
        <DecisionButton
          label="Approve"
          pendingLabel="Approving"
          className="bg-green-600 hover:bg-green-700"
          onSelect={() => setDecision('approved')}
        />
        <DecisionButton
          label="Reject"
          pendingLabel="Rejecting"
          className="bg-red-600 hover:bg-red-700"
          onSelect={() => setDecision('rejected')}
        />
      </div>
    </form>
  )
}

function DecisionButton({
  label,
  pendingLabel,
  className,
  onSelect,
}: {
  label: string
  pendingLabel: string
  className: string
  onSelect: () => void
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      onClick={onSelect}
      disabled={pending}
      className={`inline-flex h-9 items-center gap-2 rounded-md px-4 text-[13px] font-semibold text-white disabled:bg-gray-100 disabled:text-gray-400 ${className}`}
    >
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
      {pending ? pendingLabel : label}
    </button>
  )
}
