'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { authorizeAction } from '@/features/auth/staff/guards'
import { useDb } from '@/lib/data/source'
import { failure, success, type ActionState } from '@/features/catalog/actions/action-result'
import { commitImport, stageImport, MAX_FILE_BYTES, type ImportType } from './engine'

export async function uploadImport(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction('products.manage')
  if (!auth.ok) return failure(auth.message)
  if (!useDb()) return failure('Imports need a configured database.')

  const type = String(formData.get('type') ?? '') as ImportType
  if (type !== 'products' && type !== 'lab_tests') return failure('Choose an import type.')

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return failure('Choose an Excel file.')
  if (file.size > MAX_FILE_BYTES) return failure('File is larger than 5 MB.')
  if (!/\.(xlsx|xls)$/i.test(file.name)) return failure('Upload an .xlsx or .xls file.')

  const staged = await stageImport({
    type,
    filename: file.name,
    buffer: await file.arrayBuffer(),
    createdBy: auth.user.id,
  })
  if ('error' in staged) return failure(staged.error)

  revalidatePath('/admin/imports')
  redirect(`/admin/imports/${staged.importId}`)
}

export async function runCommit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction('products.manage')
  if (!auth.ok) return failure(auth.message)
  if (!useDb()) return failure('Imports need a configured database.')

  const importId = String(formData.get('importId') ?? '')
  const result = await commitImport(importId)
  if ('error' in result) return failure(result.error)

  revalidatePath(`/admin/imports/${importId}`)
  revalidatePath('/admin/imports')
  revalidatePath('/admin/products')
  revalidatePath('/admin/inventory')
  revalidatePath('/admin/lab-tests')
  revalidatePath('/pharmacy')
  return success(`Committed ${result.committed} row(s); ${result.failed} failed.`)
}
