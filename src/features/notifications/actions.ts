'use server'

import { revalidatePath } from 'next/cache'
import { authorizeAction } from '@/features/auth/staff/guards'
import { useDb } from '@/lib/data/source'
import { supabaseService } from '@/lib/supabase/server'

/** Clears the bell. V1 note: read state is shared across staff (one row, one flag). */
export async function markAllNotificationsRead(): Promise<void> {
  const auth = await authorizeAction('orders.view') // any staff role holds this
  if (!auth.ok || !useDb()) return

  await supabaseService()
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null)

  revalidatePath('/admin/notifications')
  revalidatePath('/admin', 'layout')
}
