import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/config/env'
import { supabaseService } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Nightly analytics rebuild (vercel.json cron): recomputes a 35-day window so
 * late mutations — refunds, cancellations landing days after the sale — heal
 * in the rollups. Same Bearer guard as the outbox drain.
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || !isSupabaseConfigured()) {
    return NextResponse.json({ error: 'analytics cron is not configured' }, { status: 503 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabaseService().rpc('rollup_analytics', { p_days: 35 })
  if (error) {
    console.error('[cron/analytics] rollup failed', error)
    return NextResponse.json({ error: 'rollup failed' }, { status: 500 })
  }
  return NextResponse.json({ rebuiltDays: data })
}

export { handle as GET, handle as POST }
