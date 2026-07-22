import 'server-only'
import { supabaseService } from '@/lib/supabase/server'
import { sendEmail } from './resend'
import {
  orderConfirmationEmail,
  orderDeliveredEmail,
  orderShippedEmail,
  prescriptionRejectedEmail,
  type PrescriptionRejectedPayload,
  type RenderedEmail,
} from './templates'
import type { PlacedOrder } from '@/lib/data/orders-store'

/**
 * Email outbox drain (docs/EMAIL.md, blueprint W5).
 *
 * Business transactions enqueue rows (place_order does it in-transaction);
 * this drain — called by /api/cron/outbox every minute — claims a batch,
 * renders, sends, and marks. claim_email_outbox (0016) already pushed each
 * claimed row's next_attempt_at into the future, so a crash mid-send simply
 * retries later; nothing needs cleanup and overlapping runs cannot
 * double-send (FOR UPDATE SKIP LOCKED + Resend idempotency would be the
 * belt-and-braces upgrade when volumes justify it).
 *
 * Renderers are a CODE registry: the payload column carries the full render
 * input snapshotted at enqueue time, so sending never re-queries business
 * tables and a later catalog edit cannot alter an already-queued invoice.
 */

const MAX_ATTEMPTS = 6 // ~5.5h of backoff (1m, 4m, 16m, ~1h, ~4h), then dead.

interface OutboxRow {
  id: string
  template_key: string
  recipient: string
  payload: unknown
  attempts: number
}

const RENDERERS: Record<string, (payload: unknown) => RenderedEmail> = {
  // The payload is always a PlacedOrder-shaped snapshot from enqueue time.
  order_confirmation: (payload) => orderConfirmationEmail(payload as PlacedOrder),
  order_shipped: (payload) => orderShippedEmail(payload as PlacedOrder),
  order_delivered: (payload) => orderDeliveredEmail(payload as PlacedOrder),
  prescription_rejected: (payload) =>
    prescriptionRejectedEmail(payload as PrescriptionRejectedPayload),
}

export interface DrainResult {
  claimed: number
  sent: number
  failed: number
  dead: number
  skipped: number
}

export async function drainEmailOutbox(limit = 20): Promise<DrainResult> {
  const db = supabaseService()
  const result: DrainResult = { claimed: 0, sent: 0, failed: 0, dead: 0, skipped: 0 }

  const { data, error } = await db.rpc('claim_email_outbox', { p_limit: limit })
  if (error) throw new Error(`claim_email_outbox failed: ${error.message}`)

  const rows = (data ?? []) as OutboxRow[]
  result.claimed = rows.length

  for (const row of rows) {
    const renderer = RENDERERS[row.template_key]
    if (!renderer) {
      // A template we cannot render will never succeed — dead-letter it now
      // rather than burning six retries.
      result.dead++
      await db
        .from('email_outbox')
        .update({ status: 'dead', last_error: `unknown template: ${row.template_key}` })
        .eq('id', row.id)
      continue
    }

    let outcome: Awaited<ReturnType<typeof sendEmail>>
    try {
      const rendered = renderer(row.payload)
      outcome = await sendEmail({ to: row.recipient, ...rendered })
    } catch (renderError) {
      outcome = {
        status: 'failed',
        reason: renderError instanceof Error ? renderError.message : 'render crashed',
      }
    }

    if (outcome.status === 'sent') {
      result.sent++
      await db
        .from('email_outbox')
        .update({
          status: 'sent',
          provider_message_id: outcome.id,
          sent_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', row.id)
    } else if (outcome.status === 'skipped') {
      // Email provider not configured: leave pending (claim already applied
      // backoff), so mail flows as soon as RESEND_API_KEY lands.
      result.skipped++
      await db.from('email_outbox').update({ last_error: outcome.reason }).eq('id', row.id)
    } else {
      const isDead = row.attempts >= MAX_ATTEMPTS
      if (isDead) result.dead++
      else result.failed++
      await db
        .from('email_outbox')
        .update({ status: isDead ? 'dead' : 'pending', last_error: outcome.reason })
        .eq('id', row.id)
    }
  }

  return result
}
