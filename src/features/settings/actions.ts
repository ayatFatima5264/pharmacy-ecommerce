'use server'

import { revalidatePath } from 'next/cache'
import { authorizeAction } from '@/features/auth/staff/guards'
import { useDb } from '@/lib/data/source'
import { supabaseService } from '@/lib/supabase/server'
import { failure, success, type ActionState } from '@/features/catalog/actions/action-result'
import { SETTINGS, type SettingKey } from './registry'

/** Writes one settings group: validate → upsert → history snapshot. */
async function save(key: SettingKey, value: unknown): Promise<ActionState> {
  const auth = await authorizeAction('settings.manage')
  if (!auth.ok) return failure(auth.message)
  if (!useDb()) return failure('Settings need a configured database.')

  const parsed = SETTINGS[key].schema.safeParse(value)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? '')
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message
    }
    return { status: 'error', message: 'Please check the highlighted fields.', fieldErrors }
  }

  const db = supabaseService()
  const { error } = await db.from('settings').upsert(
    { key, value: parsed.data, updated_by: auth.user.id, updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  )
  if (error) return failure(error.message)

  // Attributable, revertible history — every change, no exceptions.
  await db
    .from('settings_history')
    .insert({ key, value: parsed.data, changed_by: auth.user.id })

  revalidatePath('/admin/settings')
  revalidatePath('/checkout')
  return success('Settings saved.')
}

export async function saveBusinessInfo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return save('business.info', {
    name: String(formData.get('name') ?? ''),
    tagline: String(formData.get('tagline') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    email: String(formData.get('email') ?? ''),
    address: String(formData.get('address') ?? ''),
  })
}

export async function saveStoreStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return save('store.status', {
    pharmacyOpen: formData.get('pharmacyOpen') === 'on',
    labOpen: formData.get('labOpen') === 'on',
    message: String(formData.get('message') ?? ''),
  })
}
