import 'server-only'
import { supabaseService } from '@/lib/supabase/server'
import { useDb } from '@/lib/data/source'
import { ROLE_PRECEDENCE, isRoleKey, type RoleKey } from '@/features/auth/staff/permissions'

/**
 * Staff directory reads. "Staff" = any account holding at least one role
 * (customers hold none, by design). Last sign-in comes from the Auth admin
 * API per user — the staff list is small, so N lookups beat paging through
 * every customer in auth.users.
 */

export interface StaffUser {
  id: string
  name: string
  email: string
  phone: string | null
  isActive: boolean
  roles: RoleKey[]
  /** Highest-precedence role, for the primary badge. */
  primaryRole: RoleKey
  createdAt: string
  lastSignInAt: string | null
}

interface UserRoleRow {
  user_id: string
  roles: { key: string } | null
  profiles: {
    id: string
    email: string
    full_name: string | null
    phone: string | null
    is_active: boolean
    created_at: string
  } | null
}

export async function getStaffUsers(): Promise<StaffUser[]> {
  if (!useDb()) return []
  const db = supabaseService()

  const { data, error } = await db
    .from('user_roles')
    .select('user_id, roles ( key ), profiles ( id, email, full_name, phone, is_active, created_at )')
  if (error) throw new Error(`staff users query failed: ${error.message}`)

  const byUser = new Map<string, StaffUser>()
  for (const row of (data ?? []) as unknown as UserRoleRow[]) {
    if (!row.profiles) continue
    const roleKey = row.roles?.key
    const existing = byUser.get(row.user_id)
    if (existing) {
      if (roleKey && isRoleKey(roleKey) && !existing.roles.includes(roleKey)) {
        existing.roles.push(roleKey)
      }
      continue
    }
    byUser.set(row.user_id, {
      id: row.profiles.id,
      name: row.profiles.full_name?.trim() || row.profiles.email,
      email: row.profiles.email,
      phone: row.profiles.phone,
      isActive: row.profiles.is_active,
      roles: roleKey && isRoleKey(roleKey) ? [roleKey] : [],
      primaryRole: 'support',
      createdAt: row.profiles.created_at,
      lastSignInAt: null,
    })
  }

  const users = [...byUser.values()]

  // Last sign-in, from Auth. Failure here degrades to "—", never breaks the page.
  await Promise.all(
    users.map(async (user) => {
      try {
        const { data: auth } = await db.auth.admin.getUserById(user.id)
        user.lastSignInAt = auth.user?.last_sign_in_at ?? null
      } catch {
        user.lastSignInAt = null
      }
    }),
  )

  for (const user of users) {
    user.primaryRole = ROLE_PRECEDENCE.find((role) => user.roles.includes(role)) ?? 'support'
  }

  return users.sort((a, b) => a.name.localeCompare(b.name))
}

export async function getStaffUser(id: string): Promise<StaffUser | null> {
  const users = await getStaffUsers()
  return users.find((user) => user.id === id) ?? null
}

/** Active administrators — the lockout guard's denominator. */
export function countActiveAdmins(users: StaffUser[]): number {
  return users.filter((user) => user.isActive && user.roles.includes('admin')).length
}
