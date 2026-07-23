'use server'

import { revalidatePath } from 'next/cache'
import { authorizeAction } from '@/features/auth/staff/guards'
import { useDb } from '@/lib/data/source'
import { supabaseService } from '@/lib/supabase/server'
import { failure, success, type ActionState } from '@/features/catalog/actions/action-result'
import { SETTINGS, SOCIAL_NETWORKS, type SettingKey } from './registry'
import { getSetting } from './queries'

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
  // The footer renders business info + social links on every storefront page.
  revalidatePath('/', 'layout')
  return success('Settings saved.')
}

export async function saveBusinessInfo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // Merge over the stored value so the settings page's shorter form can never
  // wipe the contact-page-only fields (whatsapp, hours, …) back to defaults.
  const current = await getSetting('business.info')
  return save('business.info', {
    ...current,
    name: String(formData.get('name') ?? ''),
    tagline: String(formData.get('tagline') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    email: String(formData.get('email') ?? ''),
    address: String(formData.get('address') ?? ''),
  })
}

/** Contact Information page (V2): the full business-contact record. */
export async function saveContactInfo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const current = await getSetting('business.info')
  return save('business.info', {
    ...current,
    name: String(formData.get('name') ?? ''),
    tagline: String(formData.get('tagline') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    whatsapp: String(formData.get('whatsapp') ?? ''),
    email: String(formData.get('email') ?? ''),
    address: String(formData.get('address') ?? ''),
    hours: String(formData.get('hours') ?? ''),
    emergencyPhone: String(formData.get('emergencyPhone') ?? ''),
    mapsUrl: String(formData.get('mapsUrl') ?? ''),
  })
}

/** Social Media page (V2): per-network URL + visibility toggle. */
export async function saveSocialLinks(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const value = Object.fromEntries(
    SOCIAL_NETWORKS.map((network) => [
      network,
      {
        url: String(formData.get(`${network}.url`) ?? '').trim() || '#',
        enabled: formData.get(`${network}.enabled`) === 'on',
      },
    ]),
  )
  return save('social.links', value)
}

export async function saveStoreStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return save('store.status', {
    pharmacyOpen: formData.get('pharmacyOpen') === 'on',
    labOpen: formData.get('labOpen') === 'on',
    message: String(formData.get('message') ?? ''),
  })
}
