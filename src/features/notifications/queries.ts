import 'server-only'
import { useDb } from '@/lib/data/source'
import { supabaseService } from '@/lib/supabase/server'

/**
 * Staff notification feed (lean V1): broadcast rows written in-transaction by
 * place_order and by the review actions. Count renders in the admin chrome on
 * every navigation — no polling infrastructure until the team outgrows it.
 */

export interface NotificationRow {
  id: string
  type: string
  title: string
  body: string | null
  linkUrl: string | null
  readAt: string | null
  createdAt: string
}

export async function getUnreadCount(): Promise<number> {
  if (!useDb()) return 0
  const { count } = await supabaseService()
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
  return count ?? 0
}

export async function getNotifications(limit = 50): Promise<NotificationRow[]> {
  if (!useDb()) return []
  const { data, error } = await supabaseService()
    .from('notifications')
    .select('id, type, title, body, link_url, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`notifications query failed: ${error.message}`)
  return ((data ?? []) as {
    id: string
    type: string
    title: string
    body: string | null
    link_url: string | null
    read_at: string | null
    created_at: string
  }[]).map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    linkUrl: n.link_url,
    readAt: n.read_at,
    createdAt: n.created_at,
  }))
}
