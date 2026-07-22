'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { checkRateLimit, clientIp, resetRateLimit, retryMessage } from '@/lib/security/rate-limit'
import { supabaseUserClient } from '@/lib/supabase/clients'
import { safeNextPath } from '@/features/auth/shared/session'
import { fieldErrorsFrom, type AuthFormState } from '@/features/auth/shared/action-state'
import { getCurrentUser } from './guards'

/**
 * STAFF sign-in. Same identity provider as customers (Supabase Auth), but a
 * separate action with a separate rule: authenticating is not enough — the
 * account must hold at least one staff role, or the fresh session is
 * discarded on the spot. A customer credential can never "fall through" into
 * the admin console.
 *
 * CSRF: Server Actions verify Origin against Host before the body runs, and
 * Supabase auth cookies are SameSite=Lax. See docs/SECURITY.md.
 */

const staffLoginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address').max(120),
  password: z.string().min(1, 'Enter your password').max(200),
})

export async function staffLogin(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const ip = clientIp(await headers())

  // Rate limit BEFORE touching credentials, so a flood costs us nothing.
  // Supabase Auth applies its own limits upstream; this is defence in depth
  // with a stricter budget for the admin surface.
  const limit = checkRateLimit('login', ip)
  if (!limit.allowed) {
    return {
      status: 'error',
      message: `Too many sign-in attempts. ${retryMessage(limit.retryAfterSeconds)}`,
    }
  }

  const parsed = staffLoginSchema.safeParse({
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
    // One generic message for every failure mode: distinguishing "no such
    // user" from "wrong password" is a user-enumeration oracle.
    return { status: 'error', message: 'Email or password is incorrect.' }
  }

  // The staff gate. Authentication succeeded; authorization decides entry.
  const staffUser = await getCurrentUser()
  if (!staffUser) {
    await supabase.auth.signOut()
    return {
      status: 'error',
      message: 'This account does not have staff access. Use the customer sign-in instead.',
    }
  }

  resetRateLimit('login', ip)
  redirect(safeNextPath(formData.get('next'), '/admin'))
}

export async function staffLogout(): Promise<void> {
  const supabase = await supabaseUserClient()
  await supabase.auth.signOut()
  redirect('/admin/login')
}
