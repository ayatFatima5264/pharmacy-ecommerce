import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/config/env'
import { drainEmailOutbox } from '@/lib/email/outbox'

export const dynamic = 'force-dynamic'

/**
 * Outbox drain endpoint — invoked every minute by the platform scheduler
 * (vercel.json cron, or any curl with the secret).
 *
 * Guarded by CRON_SECRET (Bearer): route handlers sit outside Server Action
 * origin checks, so an unauthenticated drain endpoint would let anyone burn
 * the send quota. 503 (not 500) when unconfigured — "not ready", not "broken".
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || !isSupabaseConfigured()) {
    return NextResponse.json({ error: 'outbox drain is not configured' }, { status: 503 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await drainEmailOutbox()
    return NextResponse.json(result)
  } catch (error) {
    console.error('[cron/outbox] drain failed', error)
    return NextResponse.json({ error: 'drain failed' }, { status: 500 })
  }
}

export { handle as GET, handle as POST }
