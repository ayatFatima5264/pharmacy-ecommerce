'use server'

import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { authorizeAction } from '@/features/auth/staff/guards'
import { isRoleKey, ROLE_LABELS, type RoleKey } from '@/features/auth/staff/permissions'
import { useDb } from '@/lib/data/source'
import { supabaseService } from '@/lib/supabase/server'
import { getStaffUsers, countActiveAdmins } from '@/features/users/queries'
import { failure, invalid, success, type ActionState } from '@/features/catalog/actions/action-result'

/**
 * Staff account management (V2). Only 'users.manage' (administrators) can
 * reach any of these, and three lockout rules hold everywhere:
 *
 *   1. You cannot change your own role or deactivate/delete yourself.
 *   2. The last active administrator can never be demoted, deactivated,
 *      or deleted — the console must always have an owner.
 *   3. Every mutation writes audit_log — who did what to whom, when.
 *
 * Accounts are Supabase Auth users; handle_new_user() provisions the profile
 * row, exactly like the seed script. A created user can sign in immediately.
 */

const roleSchema = z.string().refine(isRoleKey, 'Unknown role')

const createSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter the full name').max(80),
    email: z.string().trim().email('Enter a valid email'),
    phone: z.string().trim().max(20).optional().default(''),
    password: z.string().min(10, 'At least 10 characters'),
    confirmPassword: z.string(),
    role: roleSchema,
    active: z.boolean(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

const updateSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter the full name').max(80),
  email: z.string().trim().email('Enter a valid email'),
  phone: z.string().trim().max(20).optional().default(''),
  password: z.string().min(10, 'At least 10 characters').or(z.literal('')),
  role: roleSchema,
  active: z.boolean(),
})

async function audit(actorId: string, action: string, userId: string, metadata: Record<string, unknown>) {
  await supabaseService()
    .from('audit_log')
    .insert({ actor_id: actorId, action, entity_type: 'staff_user', entity_id: userId, metadata })
}

async function setSingleRole(userId: string, role: RoleKey, grantedBy: string): Promise<string | null> {
  const db = supabaseService()
  const { data: roleRow, error: roleError } = await db
    .from('roles')
    .select('id')
    .eq('key', role)
    .maybeSingle()
  if (roleError || !roleRow) return `Role "${role}" is not seeded in the database.`

  // Role assignment REPLACES: one account, one role, no residue.
  const { error: clearError } = await db.from('user_roles').delete().eq('user_id', userId)
  if (clearError) return clearError.message
  const { error: grantError } = await db
    .from('user_roles')
    .insert({ user_id: userId, role_id: roleRow.id, granted_by: grantedBy })
  if (grantError) return grantError.message
  return null
}

export async function createStaffUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction('users.manage')
  if (!auth.ok) return failure(auth.message)
  if (!useDb()) return failure('User management needs a configured database.')

  const parsed = createSchema.safeParse({
    fullName: String(formData.get('fullName') ?? ''),
    email: String(formData.get('email') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    password: String(formData.get('password') ?? ''),
    confirmPassword: String(formData.get('confirmPassword') ?? ''),
    role: String(formData.get('role') ?? ''),
    active: formData.get('active') === 'on',
  })
  if (!parsed.success) return invalid(parsed.error)
  const input = parsed.data

  const db = supabaseService()
  const { data: created, error: createError } = await db.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true, // admin-provisioned: usable immediately
    user_metadata: { full_name: input.fullName },
  })
  if (createError || !created.user) {
    return failure(createError?.message ?? 'Could not create the account.')
  }
  const userId = created.user.id

  // handle_new_user() has provisioned the profile; enrich it.
  await db
    .from('profiles')
    .update({ full_name: input.fullName, phone: input.phone || null, is_active: input.active })
    .eq('id', userId)

  const roleError = await setSingleRole(userId, input.role as RoleKey, auth.user.id)
  if (roleError) return failure(`Account created but role failed: ${roleError}`)

  await audit(auth.user.id, 'user.created', userId, {
    email: input.email,
    role: input.role,
    active: input.active,
  })

  revalidatePath('/admin/users')
  return success(
    `${input.fullName} can now sign in as ${ROLE_LABELS[input.role as RoleKey]} with the password you set.`,
  )
}

export async function updateStaffUser(
  userId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await authorizeAction('users.manage')
  if (!auth.ok) return failure(auth.message)
  if (!useDb()) return failure('User management needs a configured database.')

  const parsed = updateSchema.safeParse({
    fullName: String(formData.get('fullName') ?? ''),
    email: String(formData.get('email') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    password: String(formData.get('password') ?? ''),
    role: String(formData.get('role') ?? ''),
    active: formData.get('active') === 'on',
  })
  if (!parsed.success) return invalid(parsed.error)
  const input = parsed.data

  const users = await getStaffUsers()
  const target = users.find((user) => user.id === userId)
  if (!target) return failure('That staff account no longer exists.')

  const isSelf = userId === auth.user.id
  const roleChanged = target.primaryRole !== input.role || target.roles.length > 1
  if (isSelf && (target.primaryRole !== input.role || !input.active)) {
    return failure('You cannot change your own role or deactivate your own account.')
  }
  const losesAdmin = target.roles.includes('admin') && (input.role !== 'admin' || !input.active)
  if (losesAdmin && countActiveAdmins(users) <= 1) {
    return failure('This is the last active administrator — promote someone else first.')
  }

  const db = supabaseService()
  const { error: authError } = await db.auth.admin.updateUserById(userId, {
    email: input.email,
    ...(input.password ? { password: input.password } : {}),
    user_metadata: { full_name: input.fullName },
  })
  if (authError) return failure(authError.message)

  const { error: profileError } = await db
    .from('profiles')
    .update({
      full_name: input.fullName,
      email: input.email,
      phone: input.phone || null,
      is_active: input.active,
    })
    .eq('id', userId)
  if (profileError) return failure(profileError.message)

  if (roleChanged) {
    const roleError = await setSingleRole(userId, input.role as RoleKey, auth.user.id)
    if (roleError) return failure(roleError)
  }

  await audit(auth.user.id, 'user.updated', userId, {
    email: input.email,
    role: input.role,
    active: input.active,
    passwordChanged: Boolean(input.password),
    roleChanged,
  })

  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${userId}`)
  return success('Account updated.')
}

export async function resetStaffPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction('users.manage')
  if (!auth.ok) return failure(auth.message)
  if (!useDb()) return failure('User management needs a configured database.')

  const userId = String(formData.get('userId') ?? '')
  if (!userId) return failure('Missing account.')

  // 16 chars, mixed alphabet — shown ONCE to the administrator.
  const password = randomBytes(12).toString('base64url').slice(0, 16)
  const { error } = await supabaseService().auth.admin.updateUserById(userId, { password })
  if (error) return failure(error.message)

  await audit(auth.user.id, 'user.password_reset', userId, {})
  revalidatePath('/admin/users')
  return success(`Temporary password: ${password} — share it securely; it is shown only once.`)
}

export async function toggleStaffActive(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction('users.manage')
  if (!auth.ok) return failure(auth.message)
  if (!useDb()) return failure('User management needs a configured database.')

  const userId = String(formData.get('userId') ?? '')
  const users = await getStaffUsers()
  const target = users.find((user) => user.id === userId)
  if (!target) return failure('That staff account no longer exists.')
  if (userId === auth.user.id) return failure('You cannot deactivate your own account.')
  if (target.isActive && target.roles.includes('admin') && countActiveAdmins(users) <= 1) {
    return failure('This is the last active administrator — promote someone else first.')
  }

  const next = !target.isActive
  const { error } = await supabaseService()
    .from('profiles')
    .update({ is_active: next })
    .eq('id', userId)
  if (error) return failure(error.message)

  await audit(auth.user.id, next ? 'user.activated' : 'user.deactivated', userId, {})
  revalidatePath('/admin/users')
  return success(next ? `${target.name} reactivated.` : `${target.name} deactivated.`)
}

export async function deleteStaffUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction('users.manage')
  if (!auth.ok) return failure(auth.message)
  if (!useDb()) return failure('User management needs a configured database.')

  const userId = String(formData.get('userId') ?? '')
  const users = await getStaffUsers()
  const target = users.find((user) => user.id === userId)
  if (!target) return failure('That staff account no longer exists.')
  if (userId === auth.user.id) return failure('You cannot delete your own account.')
  if (target.roles.includes('admin') && countActiveAdmins(users) <= 1) {
    return failure('This is the last active administrator — promote someone else first.')
  }

  // Audit before the row disappears; the metadata keeps the identity.
  await audit(auth.user.id, 'user.deleted', userId, { email: target.email, name: target.name })

  const { error } = await supabaseService().auth.admin.deleteUser(userId)
  if (error) return failure(error.message)

  revalidatePath('/admin/users')
  return success(`${target.name} deleted.`)
}
