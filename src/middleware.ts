import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Edge middleware. Two jobs:
 *
 * 1. TOKEN REFRESH (@supabase/ssr): when auth cookies are present, ask
 *    Supabase for the user; an expiring JWT is refreshed and the new cookies
 *    are written onto the response. Without this, Server Components — which
 *    cannot write cookies — would watch sessions rot.
 * 2. CHEAP REJECTION, not a security boundary: signed-out visitors bounce off
 *    /admin and /account before any page work. The real boundaries are the
 *    guards (features/auth/{staff,customer}/guards.ts) and RLS — a Server
 *    Action can be invoked without ever passing through a page render, and a
 *    mis-specified matcher silently disables protection for a subtree.
 *
 * Public storefront and guest checkout never require auth — this file must
 * never gate /cart, /checkout, or any shop route.
 */

const PROTECTED_PREFIXES = ['/account'] as const
const STAFF_LOGIN = '/admin/login'
const CUSTOMER_LOGIN = '/login'

function isSupabaseAuthCookie(name: string): boolean {
  return name.startsWith('sb-') && name.includes('-auth-token')
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  let response = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const hasAuthCookies = request.cookies.getAll().some((c) => isSupabaseAuthCookie(c.name))

  let isAuthenticated = false

  // Only pay the auth-server round trip when cookies exist to validate.
  if (supabaseUrl && supabaseAnonKey && hasAuthCookies) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet)
            response.cookies.set(name, value, options)
        },
      },
    })
    const {
      data: { user },
    } = await supabase.auth.getUser()
    isAuthenticated = Boolean(user)
  }

  /** Redirect that keeps any refreshed auth cookies from this request. */
  const redirectTo = (path: string, search = '') => {
    const url = request.nextUrl.clone()
    url.pathname = path
    url.search = search
    const redirect = NextResponse.redirect(url)
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie)
    return redirect
  }

  const isAdminArea = pathname.startsWith('/admin') && pathname !== STAFF_LOGIN
  const isCustomerArea = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))

  if (isAdminArea && !isAuthenticated) {
    return redirectTo(STAFF_LOGIN, `?next=${encodeURIComponent(pathname)}`)
  }
  if (isCustomerArea && !isAuthenticated) {
    return redirectTo(CUSTOMER_LOGIN, `?next=${encodeURIComponent(pathname)}`)
  }
  // Already signed in? Don't show a login form again. (Whether the user may
  // actually ENTER /admin is the staff guard's decision, not ours.)
  if (isAuthenticated && pathname === STAFF_LOGIN) return redirectTo('/admin')
  if (isAuthenticated && pathname === CUSTOMER_LOGIN) return redirectTo('/account')

  // Admin pages must never be cached by a shared proxy — one staff member's
  // rendered customer list could otherwise be served to another visitor.
  if (pathname.startsWith('/admin') || pathname.startsWith('/account')) {
    response.headers.set('Cache-Control', 'no-store, must-revalidate')
  }

  return response
}

export const config = {
  // Static assets are excluded so they do not pay the middleware cost.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)'],
}
