import 'server-only'
import { cache } from 'react'
import type { User } from '@supabase/supabase-js'
import { isSupabaseConfigured } from '@/config/env'
import { supabaseUserClient } from '@/lib/supabase/clients'

/**
 * Shared AUTHENTICATION primitives -- "who is this request", nothing more.
 *
 * Authorization is deliberately NOT here. Customer authorization lives in
 * features/auth/customer/ (ownership via RLS); staff authorization lives in
 * features/auth/staff/ (roles/permissions). The two sides share only this
 * file, which is what keeps them logically separated without duplicating the
 * cookie plumbing.
 */

/**
 * The Supabase Auth user for this request, or null.
 *
 * getUser() validates against the auth server -- it never trusts the JWT
 * blindly, so a revoked user is rejected mid-session. React cache() keeps it
 * to one round trip per request no matter how many guards ask.
 *
 * Returns null (rather than throwing) when Supabase is unconfigured, so
 * public pages still render on a machine with no .env.local.
 */
export const getAuthUser = cache(async (): Promise<User | null> => {
  if (!isSupabaseConfigured()) return null
  const supabase = await supabaseUserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ?? null
})

/**
 * Open-redirect guard for ?next= parameters: only same-origin relative paths
 * are honoured, so ?next=https://evil.example (or //evil.example) cannot
 * bounce a freshly-authenticated user to a phishing page.
 */
export function safeNextPath(raw: unknown, fallback: string): string {
  const value = typeof raw === 'string' ? raw : ''
  return value.startsWith('/') && !value.startsWith('//') ? value : fallback
}
