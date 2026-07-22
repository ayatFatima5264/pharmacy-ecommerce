'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { env } from '@/config/env'
import { checkRateLimit, clientIp, resetRateLimit, retryMessage } from '@/lib/security/rate-limit'
import { supabaseUserClient } from '@/lib/supabase/clients'
import { getAuthUser, safeNextPath } from '@/features/auth/shared/session'
import { fieldErrorsFrom, type AuthFormState } from '@/features/auth/shared/action-state'
import {
  customerLoginSchema,
  customerRegisterSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './schemas'

/**
 * CUSTOMER authentication actions, backed by Supabase Auth.
 *
 * Supabase Auth owns the hard parts: hashing, verification emails, recovery
 * links, token refresh, and its own endpoint rate limits. These actions add
 * our validation, our per-IP budgets (defence in depth), and our redirects.
 *
 * An account is OPTIONAL by design (guest checkout is first-class, COD
 * market). Nothing in this module is ever invoked on the checkout path.
 *
 * Staff authorization lives in features/auth/staff/ -- no role or permission
 * logic belongs in this file. A staff account signing in here simply lands on
 * the storefront like any other user.
 *
 * CSRF: Server Actions verify Origin against Host; auth cookies are
 * SameSite=Lax. See docs/SECURITY.md.
 */

function siteOrigin(): string {
  return env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
}

export async function customerLogin(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const ip = clientIp(await headers())
  const limit = checkRateLimit('login', ip)
  if (!limit.allowed) {
    return {
      status: 'error',
      message: `Too many sign-in attempts. ${retryMessage(limit.retryAfterSeconds)}`,
    }
  }

  const parsed = customerLoginSchema.safeParse({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  })
  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Please check the fields below.',
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    }
  }

  const supabase = await supabaseUserClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) {
    // Generic on purpose: anything more specific is an enumeration oracle.
    return { status: 'error', message: 'Email or password is incorrect.' }
  }

  resetRateLimit('login', ip)
  redirect(safeNextPath(formData.get('next'), '/account'))
}

export async function customerRegister(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const ip = clientIp(await headers())
  const limit = checkRateLimit('register', ip)
  if (!limit.allowed) {
    return {
      status: 'error',
      message: `Too many attempts. ${retryMessage(limit.retryAfterSeconds)}`,
    }
  }

  const parsed = customerRegisterSchema.safeParse({
    fullName: String(formData.get('fullName') ?? ''),
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  })
  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Please check the fields below.',
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    }
  }

  const supabase = await supabaseUserClient()
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // handle_new_user (0002) copies this into profiles.full_name.
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${siteOrigin()}/callback?next=${encodeURIComponent('/account?verified=1')}`,
    },
  })

  if (error) {
    // Supabase's message here is safe (weak password, malformed email). An
    // already-registered email does NOT error -- Supabase obfuscates it, and
    // the confirmation-sent message below covers both cases identically,
    // which is exactly the enumeration behavior we want.
    return { status: 'error', message: error.message }
  }

  return {
    status: 'success',
    message:
      'Almost there — check your email and click the confirmation link to activate your account.',
  }
}

export async function customerLogout(): Promise<void> {
  const supabase = await supabaseUserClient()
  await supabase.auth.signOut()
  redirect('/')
}

export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const ip = clientIp(await headers())
  const limit = checkRateLimit('passwordReset', ip)
  if (!limit.allowed) {
    return {
      status: 'error',
      message: `Too many attempts. ${retryMessage(limit.retryAfterSeconds)}`,
    }
  }

  const parsed = forgotPasswordSchema.safeParse({
    email: String(formData.get('email') ?? ''),
  })
  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Please check the fields below.',
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    }
  }

  const supabase = await supabaseUserClient()
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteOrigin()}/callback?next=${encodeURIComponent('/reset-password')}`,
  })

  // Identical response whether or not the account exists.
  return {
    status: 'success',
    message: 'If an account exists for that email, a reset link is on its way.',
  }
}

/** Requires the recovery session established by the emailed reset link. */
export async function updatePassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const user = await getAuthUser()
  if (!user) {
    return {
      status: 'error',
      message: 'This reset link has expired. Request a new one from the forgot-password page.',
    }
  }

  const parsed = resetPasswordSchema.safeParse({
    password: String(formData.get('password') ?? ''),
    confirm: String(formData.get('confirm') ?? ''),
  })
  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Please check the fields below.',
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    }
  }

  const supabase = await supabaseUserClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) {
    return { status: 'error', message: error.message }
  }

  // A password change ends every OTHER session -- if the reset was prompted
  // by a compromise, the attacker's sessions die with it.
  await supabase.auth.signOut({ scope: 'others' })

  redirect('/account?password-updated=1')
}
