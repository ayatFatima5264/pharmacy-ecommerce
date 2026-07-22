'use server'

import { revalidatePath } from 'next/cache'
import { batchSchema, stockAdjustmentSchema } from '../schemas/product-schema'
import { failure, invalid, success, type ActionState } from './action-result'
import { findBatch, findProduct, insertBatch, removeBatch, replaceBatch } from '@/lib/data/store'
import { authorizeAction } from '@/features/auth/staff/guards'
import { useDb } from '@/lib/data/source'
import {
  adjustStockDb,
  createBatchDb,
  deleteBatchDb,
  findProductDb,
  writeOffBatchDb,
} from '@/lib/data/db/admin-catalog-db'

/** Each action authorizes independently - see the note in product-actions.ts. */

function revalidateInventory() {
  revalidatePath('/admin/inventory')
  revalidatePath('/admin/products')
  revalidatePath('/admin')
  revalidatePath('/pharmacy')
}

export async function createBatch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction('inventory.manage')
  if (!auth.ok) return failure(auth.message)

  const parsed = batchSchema.safeParse({
    productId: String(formData.get('productId') ?? ''),
    variantId: String(formData.get('variantId') ?? ''),
    batchNumber: String(formData.get('batchNumber') ?? ''),
    pharmacy: String(formData.get('pharmacy') ?? ''),
    expiryDate: String(formData.get('expiryDate') ?? ''),
    quantityOnHand: String(formData.get('quantityOnHand') ?? ''),
    quantityReserved: String(formData.get('quantityReserved') ?? ''),
  })
  if (!parsed.success) return invalid(parsed.error)

  const data = parsed.data
  const product = useDb() ? await findProductDb(data.productId) : findProduct(data.productId)
  if (!product) return failure('That product no longer exists.')

  const variant = product.variants.find((v) => v.id === data.variantId)
  if (!variant) {
    return {
      status: 'error',
      message: 'Choose a pack size that belongs to this product.',
      fieldErrors: { variantId: 'This pack size is not part of the selected product.' },
    }
  }

  // Receiving stock that is already expired is always a data-entry mistake.
  if (new Date(data.expiryDate).getTime() <= Date.now()) {
    return {
      status: 'error',
      message: 'That expiry date has already passed.',
      fieldErrors: { expiryDate: 'Expiry must be in the future for incoming stock.' },
    }
  }

  if (useDb()) {
    // Ledger-first: the intake writes a 'purchase' movement alongside the batch.
    const result = await createBatchDb({
      variantId: variant.id,
      batchNumber: data.batchNumber.toUpperCase(),
      pharmacyName: data.pharmacy,
      expiryDate: new Date(data.expiryDate).toISOString().slice(0, 10),
      quantityOnHand: data.quantityOnHand,
    })
    if (!result.ok) return failure(result.message)
    revalidateInventory()
    return success(`Batch ${data.batchNumber.toUpperCase()} received.`)
  }

  insertBatch({
    batchNumber: data.batchNumber.toUpperCase(),
    productId: product.id,
    productName: product.name,
    variantId: variant.id,
    sku: variant.sku,
    pharmacy: data.pharmacy,
    expiryDate: new Date(data.expiryDate).toISOString(),
    quantityOnHand: data.quantityOnHand,
    quantityReserved: data.quantityReserved,
  })

  revalidateInventory()
  return success(`Batch ${data.batchNumber.toUpperCase()} received.`)
}

/**
 * Signed stock adjustment.
 *
 * The real implementation writes a `stock_movements` row and lets the batch
 * total be derived from the ledger. Here it mutates the running total directly
 * and records the reason - the shape of the call is what matters for the swap.
 */
export async function adjustStock(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction('inventory.manage')
  if (!auth.ok) return failure(auth.message)

  const parsed = stockAdjustmentSchema.safeParse({
    batchId: String(formData.get('batchId') ?? ''),
    delta: String(formData.get('delta') ?? ''),
    reason: String(formData.get('reason') ?? ''),
    note: String(formData.get('note') ?? ''),
  })
  if (!parsed.success) return invalid(parsed.error)

  const { batchId, delta, reason } = parsed.data

  if (useDb()) {
    const result = await adjustStockDb({
      batchId,
      delta,
      reason,
      note: parsed.data.note || null,
    })
    if (!result.ok) return failure(result.message)
    revalidateInventory()
    const verb = delta > 0 ? 'Added' : 'Removed'
    return success(`${verb} ${Math.abs(delta)} units (${reason}) — ledgered.`)
  }

  const batch = findBatch(batchId)
  if (!batch) return failure('That batch no longer exists.')

  const nextOnHand = batch.quantityOnHand + delta
  if (nextOnHand < 0) {
    return {
      status: 'error',
      message: `Only ${batch.quantityOnHand} units are on hand.`,
      fieldErrors: { delta: 'Adjustment would take stock below zero.' },
    }
  }
  // Reserved stock is already committed to unshipped orders; letting on-hand
  // fall below it would oversell.
  if (nextOnHand < batch.quantityReserved) {
    return {
      status: 'error',
      message: `${batch.quantityReserved} units are reserved for open orders.`,
      fieldErrors: { delta: 'Adjustment would take stock below the reserved quantity.' },
    }
  }

  replaceBatch(batchId, { ...batch, quantityOnHand: nextOnHand })
  revalidateInventory()

  const verb = delta > 0 ? 'Added' : 'Removed'
  return success(`${verb} ${Math.abs(delta)} units (${reason}). Now ${nextOnHand} on hand.`)
}

export async function deleteBatch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction('inventory.manage')
  if (!auth.ok) return failure(auth.message)

  const batchId = String(formData.get('batchId') ?? '')

  if (useDb()) {
    const result = await deleteBatchDb(batchId)
    if (!result.ok) return failure(result.message)
    revalidateInventory()
    return success('Batch removed.')
  }

  const batch = findBatch(batchId)
  if (!batch) return failure('That batch no longer exists.')

  if (batch.quantityReserved > 0) {
    return failure(
      `${batch.quantityReserved} units are reserved for open orders. Release them before deleting this batch.`,
    )
  }

  removeBatch(batchId)
  revalidateInventory()
  return success(`Batch ${batch.batchNumber} removed.`)
}

/** Writes expired stock down to zero - the routine end of an expiry sweep. */
export async function writeOffExpired(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction('inventory.manage')
  if (!auth.ok) return failure(auth.message)

  const batchId = String(formData.get('batchId') ?? '')

  if (useDb()) {
    // The DB path ledgers the write-off as an 'expiry' movement.
    const result = await writeOffBatchDb(batchId)
    if (!result.ok) return failure(result.message)
    revalidateInventory()
    return success('Expired stock written off and ledgered.')
  }

  const batch = findBatch(batchId)
  if (!batch) return failure('That batch no longer exists.')

  if (new Date(batch.expiryDate).getTime() > Date.now()) {
    return failure('That batch has not expired yet.')
  }

  const written = batch.quantityOnHand
  replaceBatch(batchId, { ...batch, quantityOnHand: 0, quantityReserved: 0 })
  revalidateInventory()
  return success(`Wrote off ${written.toLocaleString('en-PK')} expired units from ${batch.batchNumber}.`)
}
