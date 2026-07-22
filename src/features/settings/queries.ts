import 'server-only'
import { cache } from 'react'
import { isSupabaseConfigured } from '@/config/env'
import { supabaseService } from '@/lib/supabase/server'
import { SETTINGS, type SettingKey } from './registry'
import type { z } from 'zod'

/**
 * Read a setting: database value if present AND valid, code default
 * otherwise. Fail-safe by construction — a bad row degrades to defaults,
 * never to a broken page. Cached per request.
 */
export const getSetting = cache(
  async <K extends SettingKey>(key: K): Promise<z.infer<(typeof SETTINGS)[K]['schema']>> => {
    const entry = SETTINGS[key]
    if (!isSupabaseConfigured()) return entry.defaults

    const { data, error } = await supabaseService()
      .from('settings')
      .select('value')
      .eq('key', key)
      .maybeSingle()
    if (error || !data) return entry.defaults

    const parsed = entry.schema.safeParse((data as { value: unknown }).value)
    return parsed.success ? parsed.data : entry.defaults
  },
)
