import { NextResponse, type NextRequest } from 'next/server'
import { supabaseUserClient } from '@/lib/supabase/clients'
import { safeNextPath } from '@/features/auth/shared/session'

/**
 * Supabase Auth code-exchange endpoint (/callback).
 *
 * Every emailed link — signup confirmation, password recovery, future OAuth —
 * lands here with a one-time ?code. Exchanging it sets the session cookies,
 * then the user continues to ?next (email verify → /account, recovery →
 * /reset-password). One route for all flows keeps the redirect allow-list in
 * the Supabase dashboard to a single entry.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNextPath(searchParams.get('next'), '/account')

  if (code) {
    const supabase = await supabaseUserClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next, origin))
    }
  }

  // Expired/reused link. Send them somewhere they can restart the flow.
  const fallback = next.startsWith('/reset-password') ? '/forgot-password' : '/login'
  return NextResponse.redirect(new URL(`${fallback}?error=link-expired`, origin))
}
