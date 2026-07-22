import 'server-only'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { env, isSupabaseConfigured } from '@/config/env'

/**
 * USER-BOUND Supabase client (anon key + the caller's auth cookies).
 *
 * Everything it does runs under RLS (0014_rls.sql) as the signed-in user --
 * or as `anon` when nobody is signed in. This is the client for customer
 * context: reading "my orders", updating "my profile". The database enforces
 * ownership; app code does not need to remember a WHERE user_id clause.
 *
 * For admin/staff work, guest checkout, webhooks, and cron, use
 * supabaseService() (service role, RLS bypassed, app-layer authorization).
 *
 * A NEW client per request, never a singleton: it is bound to the caller's
 * cookies. Caching one across requests would leak sessions between users.
 */
export async function supabaseUserClient(): Promise<SupabaseClient> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase is not configured (see .env.example). Authentication requires ' +
        'NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.',
    )
  }

  const cookieStore = await cookies()

  return createServerClient(env().NEXT_PUBLIC_SUPABASE_URL!, env().NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Called from a Server Component, where Next.js forbids cookie
          // writes. Safe to ignore: middleware refreshes tokens, so a Server
          // Component never NEEDS to persist a refresh itself.
        }
      },
    },
  })
}
