'use client'

import { useSearchParams } from 'next/navigation'
import { useActionState } from 'react'
import { Field, Input } from '@/components/ui/field'
import { staffLogin } from '@/features/auth/staff/actions'
import { idleAuthState } from '@/features/auth/shared/action-state'
import {
  AuthSubmitButton,
  StateBanner,
  fieldError,
} from '@/features/auth/shared/components/form-bits'

export function StaffLoginForm() {
  const params = useSearchParams()
  const [state, formAction] = useActionState(staffLogin, idleAuthState)
  const next = params.get('next') ?? ''

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      {/* Carried through so a deep link lands where it was aimed. The server
          only honours same-origin relative paths. */}
      <input type="hidden" name="next" value={next} />

      <StateBanner state={state} />

      <Field label="Work email" htmlFor="email" error={fieldError(state, 'email')} required>
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

      <Field label="Password" htmlFor="password" error={fieldError(state, 'password')} required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!fieldError(state, 'password')}
          required
          className="h-12"
        />
      </Field>

      <AuthSubmitButton label="Sign in" pendingLabel="Signing in" />
    </form>
  )
}
