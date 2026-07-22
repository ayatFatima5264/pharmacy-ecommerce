'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Field, Input } from '@/components/ui/field'
import { customerRegister } from '@/features/auth/customer/actions'
import { idleAuthState } from '@/features/auth/shared/action-state'
import {
  AuthSubmitButton,
  StateBanner,
  fieldError,
} from '@/features/auth/shared/components/form-bits'

export function RegisterForm() {
  const [state, formAction] = useActionState(customerRegister, idleAuthState)

  // After a successful sign-up the form's job is done: show only the
  // check-your-email confirmation instead of inviting a duplicate submit.
  if (state.status === 'success') {
    return <StateBanner state={state} />
  }

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <StateBanner state={state} />

      <Field label="Full name" htmlFor="fullName" error={fieldError(state, 'fullName')} required>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          autoFocus
          aria-invalid={!!fieldError(state, 'fullName')}
          required
        />
      </Field>

      <Field label="Email" htmlFor="email" error={fieldError(state, 'email')} required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          aria-invalid={!!fieldError(state, 'email')}
          required
        />
      </Field>

      <Field
        label="Password"
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
          aria-invalid={!!fieldError(state, 'password')}
          required
        />
      </Field>

      <AuthSubmitButton label="Create account" pendingLabel="Creating account" />

      <p className="text-center text-body-sm text-gray-500">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-blue-600 hover:underline">
          Sign in
        </Link>
        . An account is optional — checkout works without one.
      </p>
    </form>
  )
}
