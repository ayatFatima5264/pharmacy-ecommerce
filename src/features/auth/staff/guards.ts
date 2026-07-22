import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { getAuthUser } from '@/features/auth/shared/session'
import { supabaseService } from '@/lib/supabase/server'
import {
  ROLE_PRECEDENCE,
  anyRoleHasPermission,
  isRoleKey,
  type Permission,
  type RoleKey,
} from './permissions'

/**
 * STAFF authorization guards.
 *
 * Called at the START of every admin page and every mutating admin Server
 * Action. Middleware is NOT enough on its own: it runs on the edge, is easy
 * to misconfigure with a matcher, and a Server Action can be invoked directly
 * without ever passing through a page render. Defence in depth means the
 * check lives next to the thing being protected.
 *
 * "Staff" is defined by DATA, not by identity provider mechanics: a staff
 * account is an auth user holding at least one row in user_roles. Customers
 * authenticate through the very same Supabase Auth but hold zero roles, so
 * every guard in this file rejects them -- the two populations never share
 * authorization logic (see permissions.ts).
 */

export interface AuthUser {
  id: string
  email: string
  name: string
  /** Highest-precedence role, for display. Checks always use `roles`. */
  role: RoleKey
  roles: RoleKey[]
}

/**
 * Role keys for an auth user, from user_roles via the service client (RLS
 * does not expose RBAC tables to any client-facing role). Expired grants are
 * filtered here, mirroring the SQL has_permission(). One query per request
 * via cache().
 */
const fetchStaffContext = cache(
  async (userId: string): Promise<{ roles: RoleKey[]; isActive: boolean }> => {
    const db = supabaseService()

    const [profileResult, rolesResult] = await Promise.all([
      db.from('profiles').select('is_active').eq('id', userId).maybeSingle(),
      db
        .from('user_roles')
        .select('expires_at, roles ( key )')
        .eq('user_id', userId),
    ])

    if (profileResult.error || rolesResult.error) {
      // Fail CLOSED: a database error must never grant admin access.
      return { roles: [], isActive: false }
    }

    const now = Date.now()
    const roles: RoleKey[] = []
    for (const row of rolesResult.data ?? []) {
      if (row.expires_at && new Date(row.expires_at).getTime() <= now) continue
      const key = (row.roles as { key?: string } | null)?.key
      if (key && isRoleKey(key) && !roles.includes(key)) roles.push(key)
    }

    return { roles, isActive: profileResult.data?.is_active ?? false }
  },
)

/** The signed-in STAFF user, or null. Never throws — for optional UI. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const authUser = await getAuthUser()
  if (!authUser) return null

  const { roles, isActive } = await fetchStaffContext(authUser.id)
  // A deactivated account must lose access immediately, even mid-session;
  // an account with no roles is a customer, not staff.
  if (!isActive || roles.length === 0) return null

  const role = ROLE_PRECEDENCE.find((r) => roles.includes(r)) ?? roles[0]
  const name =
    (authUser.user_metadata?.full_name as string | undefined)?.trim() ||
    authUser.email ||
    'Staff member'

  return { id: authUser.id, email: authUser.email ?? '', name, role, roles }
}

/** Requires a signed-in staff user, or redirects. */
export async function requireUser(returnTo?: string): Promise<AuthUser> {
  const user = await getCurrentUser()
  if (!user) {
    // An authenticated NON-staff user gets sent to the storefront, not the
    // staff login — looping a customer through a login they already passed
    // would be both confusing and a privilege-probing aid.
    if (await getAuthUser()) redirect('/')
    const target = returnTo ? `?next=${encodeURIComponent(returnTo)}` : ''
    redirect(`/admin/login${target}`)
  }
  return user
}

/**
 * Requires a specific permission.
 *
 * Redirects to a 403 page rather than to login, because the user IS
 * authenticated — telling them to sign in again would be a lie and a loop.
 */
export async function requirePermission(permission: Permission): Promise<AuthUser> {
  const user = await requireUser()
  if (!anyRoleHasPermission(user.roles, permission)) {
    redirect(`/admin/forbidden?permission=${encodeURIComponent(permission)}`)
  }
  return user
}

/**
 * Permission check for Server Actions.
 *
 * Returns a result instead of redirecting: an action should reply with an
 * error the form can render, not throw the user out of a half-filled page.
 */
export async function authorizeAction(
  permission: Permission,
): Promise<{ ok: true; user: AuthUser } | { ok: false; message: string }> {
  const user = await getCurrentUser()

  if (!user) {
    return { ok: false, message: 'Your session has expired. Please sign in again.' }
  }
  if (!anyRoleHasPermission(user.roles, permission)) {
    return {
      ok: false,
      message: 'You do not have permission to do that. Ask an administrator if you need access.',
    }
  }
  return { ok: true, user }
}

/** Non-throwing check for conditional UI — hide a button the user cannot use. */
export async function can(permission: Permission): Promise<boolean> {
  const user = await getCurrentUser()
  return user ? anyRoleHasPermission(user.roles, permission) : false
}
