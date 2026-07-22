'use client'

import { useActionState } from 'react'
import { Field, Input } from '@/components/ui/field'
import { updatePassword } from '@/features/auth/customer/actions'
import { idleAuthState } from '@/features/auth/shared/action-state'
import {
  AuthSubmitButton,
  StateBanner,
  fieldError,
} from '@/features/auth/shared/components/form-bits'

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(updatePassword, idleAuthState)

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <StateBanner state={state} />

      <Field
        label="New password"
        htmlFor="password"
        error={fieldError(state, 'password')}
        hint="At least 8 characters"
        required
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          autoFocus
          aria-invalid={!!fieldError(state, 'password')}
          required
        />
      </Field>

      <Field
        label="Confirm new password"
        htmlFor="confirm"
        error={fieldError(state, 'confirm')}
        required
      >
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!fieldError(state, 'confirm')}
          required
        />
      </Field>

      <AuthSubmitButton label="Update password" pendingLabel="Updating" />
    </form>
  )
}
