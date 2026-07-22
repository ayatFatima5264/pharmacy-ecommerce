/**
 * Staff roles and permissions -- the single source of truth.
 *
 * Permissions are granted to ROLES and roles to USERS (user_roles table).
 * Application code asks `can(user, 'orders.refund')` and NEVER
 * `user.role === 'admin'`. That indirection is what stops
 * `if (role === 'admin' || role === 'manager')` spreading across two hundred
 * files, and it makes adding a role a data change.
 *
 * This matrix is mirrored to the database by `npm run seed:admin`
 * (roles / permissions / role_permissions), where the DB-side
 * has_permission() reads it for future staff RLS policies. The code matrix
 * remains authoritative: guards check against it after resolving the user's
 * role keys from user_roles.
 *
 * NOTE: no 'customer' role exists on purpose. Customers are simply
 * authenticated users with ZERO user_roles rows -- their authorization is row
 * ownership via RLS, not permissions. Holding any role is what makes an
 * account a staff account.
 */

export const PERMISSIONS = [
  'orders.view',
  'orders.update_status',
  'orders.refund',
  'products.view',
  'products.manage',
  'inventory.manage',
  'customers.view',
  'lab.view',
  'lab.manage',
  'rx.verify',
  'reports.view',
  'settings.manage',
] as const

export type Permission = (typeof PERMISSIONS)[number]

export type RoleKey = 'admin' | 'manager' | 'pharmacist' | 'support'

export const ROLE_PERMISSIONS: Record<RoleKey, Permission[]> = {
  admin: [...PERMISSIONS],
  manager: [
    'orders.view', 'orders.update_status', 'orders.refund',
    'products.view', 'products.manage', 'inventory.manage',
    'customers.view', 'lab.view', 'lab.manage', 'reports.view',
  ],
  // A pharmacist verifies prescriptions. That is a licensed professional act,
  // so the permission is theirs alone — an admin cannot self-grant clinical
  // authority by virtue of seniority.
  pharmacist: ['orders.view', 'orders.update_status', 'products.view', 'inventory.manage', 'rx.verify'],
  support: ['orders.view', 'customers.view', 'lab.view'],
}

export const ROLE_LABELS: Record<RoleKey, string> = {
  admin: 'Administrator',
  manager: 'Store manager',
  pharmacist: 'Pharmacist',
  support: 'Support agent',
}

/** Display precedence when an account holds several roles. */
export const ROLE_PRECEDENCE: RoleKey[] = ['admin', 'manager', 'pharmacist', 'support']

export function isRoleKey(value: string): value is RoleKey {
  return value in ROLE_PERMISSIONS
}

export function permissionsFor(role: RoleKey): Permission[] {
  return ROLE_PERMISSIONS[role] ?? []
}

export function roleHasPermission(role: RoleKey, permission: Permission): boolean {
  return permissionsFor(role).includes(permission)
}

export function anyRoleHasPermission(roles: RoleKey[], permission: Permission): boolean {
  return roles.some((role) => roleHasPermission(role, permission))
}
