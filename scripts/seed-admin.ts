/**
 * Bootstrap staff access on a live Supabase project. Idempotent — safe to
 * re-run. Two jobs:
 *
 * 1. Mirror the code-side RBAC matrix (features/auth/staff/permissions.ts,
 *    the single source of truth) into roles / permissions / role_permissions,
 *    where the DB-side has_permission() reads it.
 * 2. Create (or reuse) the first ADMIN user via the Supabase Auth admin API
 *    and grant it the admin role.
 *
 * Requires in the environment (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD (>=12 chars)
 *
 * Run: npm run seed:admin
 */
import './load-env'
import { createClient } from '@supabase/supabase-js'
import {
  PERMISSIONS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  type RoleKey,
} from '../src/features/auth/staff/permissions'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const adminEmail = process.env.SEED_ADMIN_EMAIL
const adminPassword = process.env.SEED_ADMIN_PASSWORD

async function main() {
  if (!url || !serviceKey) {
    console.error('seed-admin: Supabase env vars missing (see .env.example).')
    process.exit(1)
  }
  if (!adminEmail || !adminPassword || adminPassword.length < 12) {
    console.error(
      'seed-admin: set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (>=12 chars). ' +
        'Refusing to create an admin account with a weak or missing password.',
    )
    process.exit(1)
  }

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // --- 1. RBAC matrix ------------------------------------------------------
  const roleKeys = Object.keys(ROLE_PERMISSIONS) as RoleKey[]

  const { error: rolesError } = await db.from('roles').upsert(
    roleKeys.map((key) => ({ key, name: ROLE_LABELS[key], is_system: true })),
    { onConflict: 'key' },
  )
  if (rolesError) throw new Error(`roles upsert: ${rolesError.message}`)

  const { error: permsError } = await db.from('permissions').upsert(
    PERMISSIONS.map((key) => {
      const [resource, action] = key.split('.')
      return { key, resource, action }
    }),
    { onConflict: 'key' },
  )
  if (permsError) throw new Error(`permissions upsert: ${permsError.message}`)

  const { data: roles } = await db.from('roles').select('id, key')
  const { data: permissions } = await db.from('permissions').select('id, key')
  if (!roles || !permissions) throw new Error('failed to read back roles/permissions')

  const roleId = new Map(roles.map((r) => [String(r.key), r.id as number]))
  const permissionId = new Map(permissions.map((p) => [String(p.key), p.id as number]))

  const pairs = roleKeys.flatMap((role) =>
    ROLE_PERMISSIONS[role].map((permission) => ({
      role_id: roleId.get(role)!,
      permission_id: permissionId.get(permission)!,
    })),
  )
  const { error: rpError } = await db
    .from('role_permissions')
    .upsert(pairs, { onConflict: 'role_id,permission_id', ignoreDuplicates: true })
  if (rpError) throw new Error(`role_permissions upsert: ${rpError.message}`)

  console.log(
    `seed-admin: RBAC mirrored (${roleKeys.length} roles, ${PERMISSIONS.length} permissions, ${pairs.length} grants).`,
  )

  // --- 2. First admin account ----------------------------------------------
  // email_confirm: staff onboarding is an operator act, not a signup funnel.
  let userId: string
  const { data: created, error: createError } = await db.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Administrator' },
  })

  if (createError) {
    if (!/already/i.test(createError.message)) {
      throw new Error(`createUser: ${createError.message}`)
    }
    // Existing account: look it up via its profile (synced by trigger).
    const { data: profile } = await db
      .from('profiles')
      .select('id')
      .eq('email', adminEmail)
      .maybeSingle()
    if (!profile) throw new Error(`user ${adminEmail} exists in auth but has no profile row`)
    userId = profile.id as string
    console.log(`seed-admin: ${adminEmail} already exists — ensuring admin role.`)
  } else {
    userId = created.user.id
    console.log(`seed-admin: created admin user ${adminEmail}.`)
  }

  const { error: grantError } = await db.from('user_roles').upsert(
    { user_id: userId, role_id: roleId.get('admin')! },
    { onConflict: 'user_id,role_id,pharmacy_id', ignoreDuplicates: true },
  )
  // The unique index uses COALESCE(pharmacy_id, ...), which upsert onConflict
  // cannot target; fall back to insert-if-absent.
  if (grantError) {
    const { data: existing } = await db
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role_id', roleId.get('admin')!)
      .is('pharmacy_id', null)
      .maybeSingle()
    if (!existing) {
      const { error: insertError } = await db
        .from('user_roles')
        .insert({ user_id: userId, role_id: roleId.get('admin')! })
      if (insertError) throw new Error(`user_roles insert: ${insertError.message}`)
    }
  }

  console.log(`seed-admin: ${adminEmail} holds the admin role. Sign in at /admin/login.`)
}

main().catch((error) => {
  console.error('seed-admin failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
