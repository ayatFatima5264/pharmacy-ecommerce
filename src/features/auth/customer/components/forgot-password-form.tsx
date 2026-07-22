'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Field, Input } from '@/components/ui/field'
import { requestPasswordReset } from '@/features/auth/customer/actions'
import { idleAuthState } from '@/features/auth/shared/action-state'
import {
  AuthSubmitButton,
  StateBanner,
  fieldError,
} from '@/features/auth/shared/components/form-bits'

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordReset, idleAuthState)

  if (state.status === 'success') {
    return <StateBanner state={state} />
  }

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <StateBanner state={state} />

      <Field label="Email" htmlFor="email" error={fieldError(state, 'email')} required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          autoFocus
          aria-invalid={!!fieldError(state, 'email')}
          required
          className="h-12"
        />
      </Field>

      <AuthSubmitButton label="Send reset link" pendingLabel="Sending" />

      <p className="text-center text-body-sm text-gray-500">
        Remembered it?{' '}
        <Link href="/login" className="font-semibold text-blue-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  )
}
