'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useActionState } from 'react'
import { Field, Input } from '@/components/ui/field'
import { customerLogin } from '@/features/auth/customer/actions'
import { idleAuthState } from '@/features/auth/shared/action-state'
import {
  AuthSubmitButton,
  StateBanner,
  fieldError,
} from '@/features/auth/shared/components/form-bits'

export function CustomerLoginForm() {
  const params = useSearchParams()
  const [state, formAction] = useActionState(customerLogin, idleAuthState)
  const next = params.get('next') ?? ''

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      {/* Carried through so a deep link lands where it was aimed. The server
          only honours same-origin relative paths. */}
      <input type="hidden" name="next" value={next} />

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

      <div className="flex items-center justify-end">
        <Link
          href="/forgot-password"
          className="text-body-sm font-semibold text-blue-600 hover:underline"
        >
          Forgot password?
        </Link>
      </div>

      <AuthSubmitButton label="Sign in" pendingLabel="Signing in" />

      <p className="text-center text-body-sm text-gray-500">
        New here?{' '}
        <Link href="/register" className="font-semibold text-blue-600 hover:underline">
          Create an account
        </Link>{' '}
        — or just{' '}
        <Link href="/pharmacy" className="font-semibold text-blue-600 hover:underline">
          shop as a guest
        </Link>
        .
      </p>
    </form>
  )
}
