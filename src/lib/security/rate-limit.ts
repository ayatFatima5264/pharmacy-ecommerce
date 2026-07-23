import 'server-only'

/**
 * Fixed-window rate limiting.
 *
 * WHY it exists: Server Actions are public POST endpoints. Without a limit,
 * `login` is an unlimited password-guessing oracle, `placeOrder` is an
 * order-flooding endpoint, and `validateCoupon` lets anyone brute-force the
 * coupon namespace.
 *
 * LIMITATION, stated plainly: this counts in process memory. It is correct for
 * a single instance and useless across a serverless fleet, where each lambda
 * keeps its own counter. Production needs Upstash Redis or the platform's own
 * limiter — the call sites below do not change, only this implementation does.
 */

interface Bucket {
  count: number
  resetAt: number
}

const globalStore = globalThis as unknown as { __rateLimitBuckets?: Map<string, Bucket> }

function buckets(): Map<string, Bucket> {
  globalStore.__rateLimitBuckets ??= new Map()
  return globalStore.__rateLimitBuckets
}

export interface RateLimitRule {
  /** Requests permitted per window. */
  limit: number
  windowMs: number
}

/**
 * Tuned per action, not one global number.
 *
 * Login is deliberately the strictest: brute force is the threat it faces, and
 * five attempts per fifteen minutes is generous for a human who has forgotten
 * which password they used.
 */
export const RATE_LIMITS = {
  login: { limit: 5, windowMs: 15 * 60 * 1000 },
  // Sign-up and reset-request flood control. Supabase Auth rate-limits these
  // endpoints too; ours is stricter and fails before the network call.
  register: { limit: 5, windowMs: 60 * 60 * 1000 },
  passwordReset: { limit: 5, windowMs: 60 * 60 * 1000 },
  placeOrder: { limit: 10, windowMs: 60 * 60 * 1000 },
  coupon: { limit: 20, windowMs: 10 * 60 * 1000 },
  trackOrder: { limit: 20, windowMs: 10 * 60 * 1000 },
  contact: { limit: 5, windowMs: 60 * 60 * 1000 },
  // Keyed by user id, not IP: reviews require a session, and 10/hour is
  // plenty for a human rating a delivered order's items.
  review: { limit: 10, windowMs: 60 * 60 * 1000 },
  adminWrite: { limit: 120, windowMs: 60 * 1000 },
} as const satisfies Record<string, RateLimitRule>

export type RateLimitKey = keyof typeof RATE_LIMITS

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

export function checkRateLimit(
  action: RateLimitKey,
  identifier: string,
): RateLimitResult {
  const rule = RATE_LIMITS[action]
  const key = `${action}:${identifier}`
  const now = Date.now()

  const bucket = buckets().get(key)

  if (!bucket || now >= bucket.resetAt) {
    buckets().set(key, { count: 1, resetAt: now + rule.windowMs })
    return { allowed: true, remaining: rule.limit - 1, retryAfterSeconds: 0 }
  }

  if (bucket.count >= rule.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    }
  }

  bucket.count++
  return {
    allowed: true,
    remaining: rule.limit - bucket.count,
    retryAfterSeconds: 0,
  }
}

/** Clears a bucket — used after a successful login so one bad guess earlier
 *  does not count against the user for the rest of the window. */
export function resetRateLimit(action: RateLimitKey, identifier: string): void {
  buckets().delete(`${action}:${identifier}`)
}

/**
 * Best-effort client IP.
 *
 * Trusts x-forwarded-for only because Vercel sets it and strips any
 * client-supplied value. Behind a different proxy this must be re-checked: a
 * spoofable header turns per-IP limiting into no limiting at all.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return headers.get('x-real-ip') ?? 'unknown'
}

/** Human-readable retry hint. */
export function retryMessage(seconds: number): string {
  if (seconds < 60) return `Try again in ${seconds} seconds.`
  const minutes = Math.ceil(seconds / 60)
  return `Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
}
