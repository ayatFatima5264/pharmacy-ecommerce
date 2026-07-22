import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env, isSupabaseConfigured } from '@/config/env'

/**
 * Postgres access. Two client shapes exist in this architecture:
 *
 * 1. THIS FILE - the service-role client. Bypasses RLS. Used only from server
 *    code for work that has no user context or must cross users: admin/staff
 *    operations (guarded by authorizeAction/has_permission), guest checkout,
 *    payment webhooks, cron jobs.
 *
 * 2. The USER-BOUND client (arrives with customer auth, via @supabase/ssr):
 *    carries the customer's Supabase Auth JWT, so RLS policies (0014_rls.sql,
 *    keyed on auth.uid()) enforce row ownership at the database - account
 *    pages read "my orders" without trusting app-layer WHERE clauses.
 *
 * Rule of thumb: customer-context reads/writes use the user-bound client so
 * RLS does the authorization; everything else uses this one and is authorized
 * in the app layer.
 *
 * `import 'server-only'` makes bundling this file into a client component a
 * build error - the service key must never reach a browser bundle.
 *
 * Typing: `Database` generics are added when a live database exists to
 * generate from - `npm run db:types` writes src/lib/supabase/types.gen.ts.
 * Until then the client is untyped and feature queries own their row types,
 * exactly as the in-memory layer does today.
 */

const globalStore = globalThis as unknown as { __supabaseService?: SupabaseClient }

/**
 * Service-role client, singleton per server process.
 *
 * Throws when Supabase is not configured: callers that can fall back to the
 * in-memory scaffold must check isSupabaseConfigured() first; callers that
 * cannot should fail loudly rather than pretend a database exists.
 */
export function supabaseService(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL, ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in .env.local ' +
        '(see .env.example), or guard this call with isSupabaseConfigured().',
    )
  }

  globalStore.__supabaseService ??= createClient(
    env().NEXT_PUBLIC_SUPABASE_URL!,
    env().SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        // The service client is not a user-agent: no session to persist/refresh.
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  )
  return globalStore.__supabaseService
}

export { isSupabaseConfigured }
