'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { authorizeAction } from '@/features/auth/staff/guards'
import { useDb } from '@/lib/data/source'
import { supabaseService } from '@/lib/supabase/server'
import { failure, success, type ActionState } from '@/features/catalog/actions/action-result'
import { CMS_SLUGS } from './pages'

const pageSchema = z.object({
  slug: z.string().refine((s) => CMS_SLUGS.includes(s), 'Unknown page'),
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(20).max(20_000),
})

/** Save (publish) a CMS page: upsert + version snapshot (W12: revertible). */
export async function saveCmsPage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction('settings.manage')
  if (!auth.ok) return failure(auth.message)
  if (!useDb()) return failure('Content editing needs a configured database.')

  const parsed = pageSchema.safeParse({
    slug: String(formData.get('slug') ?? ''),
    title: String(formData.get('title') ?? ''),
    body: String(formData.get('body') ?? ''),
  })
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? 'Please check the fields.')
  }

  const db = supabaseService()
  const { data, error } = await db
    .from('cms_pages')
    .upsert(
      {
        slug: parsed.data.slug,
        title: parsed.data.title,
        body: parsed.data.body,
        is_published: true,
        updated_by: auth.user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'slug' },
    )
    .select('id')
    .single()
  if (error) return failure(error.message)

  await db.from('cms_page_versions').insert({
    page_id: (data as { id: string }).id,
    title: parsed.data.title,
    body: parsed.data.body,
    saved_by: auth.user.id,
  })

  revalidatePath(`/policies/${parsed.data.slug}`)
  revalidatePath('/admin/cms')
  return success('Page published.')
}
