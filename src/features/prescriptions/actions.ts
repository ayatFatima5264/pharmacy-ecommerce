'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { authorizeAction } from '@/features/auth/staff/guards'
import { useDb } from '@/lib/data/source'
import { supabaseService } from '@/lib/supabase/server'
import { applyOrderStatusDb, findAdminOrderDb } from '@/lib/data/db/admin-db'
import { drainEmailOutbox } from '@/lib/email/outbox'
import { failure, success, type ActionState } from '@/features/catalog/actions/action-result'

/**
 * Pharmacist review (blueprint W14: the fulfilment gate).
 *
 * Approving is a licensed professional act: the review row references the
 * pharmacist's LICENCE record (pharmacists table), not just their login.
 * A staff account without a licence record cannot record a decision, no
 * matter what role it holds — an admin cannot self-grant clinical authority.
 *
 * Approve: prescription → approved; every awaiting_rx order whose Rx lines
 * are now all approved transitions to confirmed (history + notification).
 * Reject: prescription → rejected; the order STAYS awaiting_rx (customer can
 * send a new prescription; staff cancel manually if unreachable), and the
 * customer is emailed the reason through the outbox.
 */

const reviewSchema = z.object({
  prescriptionId: z.string().uuid(),
  decision: z.enum(['approved', 'rejected']),
  reason: z.string().trim().max(300).optional().default(''),
})

export async function reviewPrescription(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await authorizeAction('rx.verify')
  if (!auth.ok) return failure(auth.message)
  if (!useDb()) return failure('Prescription review needs a configured database.')

  const parsed = reviewSchema.safeParse({
    prescriptionId: String(formData.get('prescriptionId') ?? ''),
    decision: String(formData.get('decision') ?? ''),
    reason: String(formData.get('reason') ?? ''),
  })
  if (!parsed.success) return failure('Invalid review submission.')
  const { prescriptionId, decision, reason } = parsed.data

  if (decision === 'rejected' && !reason) {
    return {
      status: 'error',
      message: 'A rejection must state its reason — the customer reads it.',
      fieldErrors: { reason: 'Required when rejecting' },
    }
  }

  const db = supabaseService()

  // The licence gate.
  const { data: pharmacist } = await db
    .from('pharmacists')
    .select('id')
    .eq('user_id', auth.user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (!pharmacist) {
    return failure(
      'Your account has no active pharmacist licence record, so it cannot record clinical decisions.',
    )
  }

  const { data: rx } = await db
    .from('prescriptions')
    .select('id, status, patient_name')
    .eq('id', prescriptionId)
    .maybeSingle()
  if (!rx) return failure('That prescription no longer exists.')
  if ((rx as { status: string }).status !== 'pending_review') {
    return failure('This prescription has already been reviewed.')
  }

  // Append-only decision record, attributable to the licence.
  const { error: reviewError } = await db.from('prescription_reviews').insert({
    prescription_id: prescriptionId,
    pharmacist_id: (pharmacist as { id: string }).id,
    decision,
    rejection_reason: decision === 'rejected' ? reason : null,
    notes: decision === 'approved' && reason ? reason : null,
  })
  if (reviewError) return failure(reviewError.message)

  const { error: statusError } = await db
    .from('prescriptions')
    .update({ status: decision })
    .eq('id', prescriptionId)
  if (statusError) return failure(statusError.message)

  // Orders gated by this prescription.
  const { data: gated } = await db
    .from('order_items')
    .select('orders ( order_number, status )')
    .eq('prescription_id', prescriptionId)
  const orderNumbers = [
    ...new Set(
      ((gated ?? []) as unknown as { orders: { order_number: string; status: string } | null }[])
        .filter((row) => row.orders?.status === 'awaiting_rx')
        .map((row) => row.orders!.order_number),
    ),
  ]

  let outcome = ''
  for (const orderNumber of orderNumbers) {
    const detail = await findAdminOrderDb(orderNumber)
    if (!detail) continue

    if (decision === 'approved') {
      // Confirm only when EVERY Rx line of the order is now approved.
      const { data: lines } = await db
        .from('order_items')
        .select('requires_prescription, prescriptions ( status )')
        .eq('order_id', detail.dbId)
      const allApproved = (
        (lines ?? []) as unknown as {
          requires_prescription: boolean
          prescriptions: { status: string } | null
        }[]
      )
        .filter((l) => l.requires_prescription)
        .every((l) => l.prescriptions?.status === 'approved')

      if (allApproved) {
        const applied = await applyOrderStatusDb({
          dbId: detail.dbId,
          orderNumber,
          fromDbStatus: detail.dbStatus,
          to: 'confirmed',
          actorId: auth.user.id,
          note: 'Prescription approved',
        })
        if (!applied.error) outcome = ` Order ${orderNumber} confirmed for fulfilment.`
      } else {
        outcome = ` Order ${orderNumber} still waits on another prescription.`
      }
    } else if (detail.order.email) {
      // Rejection: tell the customer why, durably (outbox), send now.
      await db.from('email_outbox').insert({
        template_key: 'prescription_rejected',
        recipient: detail.order.email,
        payload: {
          orderNumber,
          customerName: detail.order.firstName,
          reason,
        },
        dedupe_key: `prescription_rejected:${orderNumber}:${prescriptionId}`,
      })
      await drainEmailOutbox()
      outcome = ` Customer notified at ${detail.order.email}.`
    }

    await db.from('notifications').insert({
      type: `rx.${decision}`,
      title: `Prescription ${decision} — ${orderNumber}`,
      body: decision === 'rejected' ? reason : `By ${auth.user.name}`,
      link_url: `/admin/orders/${orderNumber}`,
      dedupe_key: `rx.${decision}:${prescriptionId}:${orderNumber}`,
    })
  }

  revalidatePath('/admin/prescriptions')
  revalidatePath('/admin/orders')
  revalidatePath('/admin')
  return success(`Prescription ${decision}.${outcome}`)
}
