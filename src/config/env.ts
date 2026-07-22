import 'server-only'
import { z } from 'zod'

/**
 * Environment access, validated once.
 *
 * Every server module reads env through here, never process.env directly, so a
 * typo'd variable name fails loudly at first read instead of surfacing as an
 * undefined deep inside a request.
 *
 * Supabase variables are OPTIONAL AS A GROUP during the transition off the
 * in-memory data layer: the app must keep running without a database until
 * each module is wired over (docs/BLUEPRINT.md W1). Setting SOME of the group
 * but not all is always a mistake and fails validation.
 */

const schema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(3).optional(),

    NEXT_PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000'),

    // Consumed only by `npm run seed:admin` (bootstrap staff accounts).
    SEED_ADMIN_EMAIL: z.string().email().optional(),
    SEED_ADMIN_PASSWORD: z.string().min(12).optional(),

    // Bearer token guarding /api/cron/* (outbox drain). Any long random string.
    CRON_SECRET: z.string().min(16).optional(),

    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  })
  .superRefine((env, ctx) => {
    const supabaseVars = [
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      env.SUPABASE_SERVICE_ROLE_KEY,
    ]
    const set = supabaseVars.filter(Boolean).length
    if (set > 0 && set < supabaseVars.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Supabase configuration is partial. Set all of NEXT_PUBLIC_SUPABASE_URL, ' +
          'NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY, or none of them.',
      })
    }

    // The service key must never be exposed to the browser. A rename to
    // NEXT_PUBLIC_* is the classic way this leaks; refuse to boot instead.
    if (process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY is set. The service role key must ' +
          'NEVER be public - rename it to SUPABASE_SERVICE_ROLE_KEY.',
      })
    }

    // Supabase Auth is the identity provider: without it, nobody can sign in.
    // Enforced at SERVE time only — `next build` runs with NODE_ENV=production
    // but may legitimately have no env (CI compile checks); static generation
    // then bakes the scaffold, and runtime still refuses to serve unconfigured.
    const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'
    if (env.NODE_ENV === 'production' && !isBuildPhase && set < supabaseVars.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Supabase configuration is required in production (it is the identity provider).',
      })
    }
  })

export type Env = z.infer<typeof schema>

let cached: Env | undefined

/** Parse-once accessor. Throws with every problem listed, not just the first. */
export function env(): Env {
  if (cached) return cached
  // `KEY=` in an env file yields an EMPTY STRING, not undefined. An empty
  // optional var means "not configured", so strip them before validation —
  // otherwise every blank line in .env.local is a boot failure.
  const input = Object.fromEntries(
    Object.entries(process.env).filter(([, value]) => value !== ''),
  )
  const result = schema.safeParse(input)
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(env)'}: ${issue.message}`)
      .join('\n')
    throw new Error(`Invalid environment configuration:\n${issues}`)
  }
  cached = result.data
  return cached
}

/**
 * True once the Supabase env group is fully configured. Modules still on the
 * in-memory scaffold branch on this during the W1 transition; it disappears
 * when the last module is wired over.
 */
export function isSupabaseConfigured(): boolean {
  const e = env()
  return Boolean(
    e.NEXT_PUBLIC_SUPABASE_URL && e.NEXT_PUBLIC_SUPABASE_ANON_KEY && e.SUPABASE_SERVICE_ROLE_KEY,
  )
}
