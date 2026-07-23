'use server'

import { revalidatePath } from 'next/cache'
import * as XLSX from 'xlsx'
import { z } from 'zod'
import { authorizeAction } from '@/features/auth/staff/guards'
import { useDb } from '@/lib/data/source'
import { stageImport, commitImport } from '@/features/imports/engine'
import { failure, success, type ActionState } from '@/features/catalog/actions/action-result'

/**
 * Inline bulk edit (V2) — a grid front-end over the EXISTING import engine.
 *
 * The engine's documented invariant is that updates touch only the columns
 * present, so a synthetic one-sheet workbook of changed rows IS the bulk
 * update path — same validation, same FEFO-safe stock intake ledger, and a
 * full audit record in /admin/imports history for free. No new write logic.
 */

const MONEY = /^\d+(\.\d{1,2})?$/

const changeSchema = z
  .object({
    sku: z.string().trim().min(1).max(60),
    price: z.string().trim().regex(MONEY, 'invalid price').optional(),
    salePrice: z.string().trim().regex(MONEY, 'invalid sale price').optional(),
    stock: z.string().trim().regex(/^\d+$/, 'invalid stock').optional(),
  })
  .refine((row) => row.price || row.salePrice || row.stock, {
    message: 'row has no changes',
  })

const payloadSchema = z.array(changeSchema).min(1, 'No changes to save.').max(500)

export async function bulkEditProducts(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction('products.manage')
  if (!auth.ok) return failure(auth.message)
  if (!useDb()) return failure('Bulk edit needs a configured database.')

  let raw: unknown
  try {
    raw = JSON.parse(String(formData.get('changes') ?? '[]'))
  } catch {
    return failure('Invalid change payload.')
  }
  const parsed = payloadSchema.safeParse(raw)
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? 'Invalid changes.')
  }

  // One sheet, only the touched columns per row — empty cells read as
  // "not provided" in the engine, so mixed rows are safe.
  const rows = parsed.data.map((change) => ({
    sku: change.sku,
    ...(change.price !== undefined ? { price: change.price } : {}),
    ...(change.salePrice !== undefined ? { sale_price: change.salePrice } : {}),
    ...(change.stock !== undefined ? { stock: change.stock } : {}),
  }))

  const sheet = XLSX.utils.json_to_sheet(rows)
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'BulkEdit')
  const buffer = XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer

  const staged = await stageImport({
    type: 'products',
    filename: `Bulk edit — ${rows.length} row(s)`,
    buffer,
    createdBy: auth.user.id,
  })
  if ('error' in staged) return failure(staged.error)

  const staleRows = staged.totals.errors ?? 0

  const committed = await commitImport(staged.importId)
  if ('error' in committed) return failure(committed.error)

  revalidatePath('/admin/products')
  revalidatePath('/admin/products/bulk')
  revalidatePath('/admin/inventory')
  revalidatePath('/admin/imports')
  revalidatePath('/pharmacy')

  const failed = committed.failed + staleRows
  if (failed > 0) {
    return {
      status: 'error',
      message: `${committed.committed} row(s) saved, ${failed} failed — see Imports history for row-level details.`,
    }
  }
  return success(`${committed.committed} row(s) updated.`)
}
