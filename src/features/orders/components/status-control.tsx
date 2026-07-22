'use client'

import * as React from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertCircle, Check, Loader2, Mail } from 'lucide-react'
import {
  STATUS_DESCRIPTIONS,
  STATUS_LABELS,
  STATUS_EMAIL,
  allowedTransitions,
  type OrderStatus,
} from '@/features/orders/status-machine'
import { updateOrderStatus, resendOrderEmail } from '@/features/orders/actions/order-actions'
import { idleStatusState } from '@/features/orders/action-state'
import { cn } from '@/lib/utils'

/**
 * Status control.
 *
 * Only LEGAL next statuses are offered. Rendering every status and rejecting
 * most of them on submit would train staff to expect failure; the machine's
 * rules are surfaced as the available choices instead.
 */
export function StatusControl({
  orderNumber,
  current,
  hasEmail,
}: {
  orderNumber: string
  current: OrderStatus
  hasEmail: boolean
}) {
  const [state, formAction] = useActionState(updateOrderStatus, idleStatusState)
  const [selected, setSelected] = React.useState<OrderStatus | ''>('')

  const options = allowedTransitions(current)

  if (options.length === 0) {
    return (
      <div className="rounded-sm bg-gray-50 p-4 text-[13px] text-gray-500">
        <strong className="font-semibold text-gray-900">{STATUS_LABELS[current]}</strong> is a
        final status. This order cannot be moved further.
      </div>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="orderNumber" value={orderNumber} />

      {state.status !== 'idle' && (
        <div
          role={state.status === 'error' ? 'alert' : 'status'}
          className={cn(
            'flex items-start gap-2 rounded-sm p-3 text-[13px]',
            state.status === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700',
          )}
        >
          {state.status === 'error' ? (
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          )}
          {state.message}
        </div>
      )}

      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold text-gray-700">Move this order to</legend>
        <div className="flex flex-col gap-2">
          {options.map((option) => {
            const notifies = STATUS_EMAIL[option] !== undefined
            return (
              <label
                key={option}
                className={cn(
                  'flex cursor-pointer items-start gap-2.5 rounded-sm border p-3',
                  selected === option
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-400',
                )}
              >
                <input
                  type="radio"
                  name="nextStatus"
                  value={option}
                  checked={selected === option}
                  onChange={() => setSelected(option)}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer border-gray-200 text-blue-600 focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold text-gray-900">
                    {STATUS_LABELS[option]}
                  </span>
                  <span className="block text-[12.5px] text-gray-500">
                    {STATUS_DESCRIPTIONS[option]}
                  </span>
                  {/* Say up front whether the customer gets an email, so a
                      status change is never an accidental notification. */}
                  {notifies && (
                    <span className="mt-1 flex items-center gap-1.5 text-[12px] text-blue-700">
                      <Mail className="h-3 w-3" aria-hidden="true" />
                      {hasEmail ? 'Emails the customer' : 'No email on file, nothing will be sent'}
                    </span>
                  )}
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      <label htmlFor="note" className="sr-only">
        Internal note
      </label>
      <input
        id="note"
        name="note"
        placeholder="Internal note (optional)"
        maxLength={300}
        className="h-9 w-full rounded-sm border border-gray-200 px-3 text-[13.5px] focus:border-blue-600 focus:outline-none focus:ring-[3px] focus:ring-blue-100"
      />

      <UpdateButton disabled={!selected} />
    </form>
  )
}

function UpdateButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className="inline-flex h-9 items-center justify-center gap-2 self-start rounded-sm bg-blue-600 px-4 text-[13.5px] font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {pending ? 'Updating' : 'Update status'}
    </button>
  )
}

export function ResendEmailButton({ orderNumber }: { orderNumber: string }) {
  const [state, formAction] = useActionState(resendOrderEmail, idleStatusState)

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="orderNumber" value={orderNumber} />
      <ResendButton />
      {state.status !== 'idle' && (
        <p
          role="status"
          className={cn(
            'text-[12.5px]',
            state.status === 'error' ? 'text-red-600' : 'text-green-700',
          )}
        >
          {state.message}
        </p>
      )}
    </form>
  )
}

function ResendButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-8 items-center gap-1.5 self-start rounded-sm border border-gray-200 bg-white px-3 text-[12.5px] font-semibold text-gray-700 hover:bg-gray-50 disabled:text-gray-400"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Mail className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {pending ? 'Sending' : 'Resend notification'}
    </button>
  )
}
