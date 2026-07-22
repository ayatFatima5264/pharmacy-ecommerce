'use client'

import { useFormStatus } from 'react-dom'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AuthFormState } from '@/features/auth/shared/action-state'

/** Shared presentation atoms for every auth form (customer and staff). */

export function StateBanner({ state }: { state: AuthFormState }) {
  if (state.status === 'idle') return null

  const isError = state.status === 'error'
  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={cn(
        'flex items-start gap-2.5 rounded-sm p-3.5 text-body-sm',
        isError ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700',
      )}
    >
      {isError ? (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <span>{state.message}</span>
    </div>
  )
}

export function AuthSubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className={cn(
        'mt-1 inline-flex h-12 items-center justify-center gap-2 rounded-md bg-blue-600 px-5',
        'text-base font-semibold text-white transition-colors duration-fast hover:bg-blue-700',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400',
      )}
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {pending ? pendingLabel : label}
    </button>
  )
}

export function fieldError(state: AuthFormState, key: string): string | undefined {
  return state.status === 'error' ? state.fieldErrors?.[key] : undefined
}
