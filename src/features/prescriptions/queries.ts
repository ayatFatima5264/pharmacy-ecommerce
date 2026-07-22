import 'server-only'
import { supabaseService } from '@/lib/supabase/server'

/**
 * Pharmacist review queue: pending prescriptions with the orders they gate
 * and a short-lived signed URL to view the file (health record — the URL is
 * minted per page render for the reviewing pharmacist only).
 */

export interface ReviewQueueItem {
  id: string
  patientName: string
  fileMime: string
  fileUrl: string | null
  submittedAt: string
  status: string
  orderNumbers: string[]
  rxItems: { name: string; quantity: number; orderNumber: string }[]
}

export async function getReviewQueue(): Promise<ReviewQueueItem[]> {
  const db = supabaseService()
  const { data, error } = await db
    .from('prescriptions')
    .select(
      `id, patient_name, file_path, file_mime, status, created_at,
       order_items ( item_name, quantity, orders ( order_number ) )`,
    )
    .order('created_at', { ascending: true })
    .limit(100)
  if (error) throw new Error(`review queue query failed: ${error.message}`)

  const rows = (data ?? []) as unknown as {
    id: string
    patient_name: string
    file_path: string
    file_mime: string
    status: string
    created_at: string
    order_items: { item_name: string; quantity: number; orders: { order_number: string } | null }[]
  }[]

  return Promise.all(
    rows.map(async (row) => {
      // 10 minutes: long enough to review, short enough to not be a link that
      // floats around. Every mint could also write audit_log (next phase).
      const { data: signed } = await db.storage
        .from('prescriptions')
        .createSignedUrl(row.file_path, 600)
      const rxItems = row.order_items.map((item) => ({
        name: item.item_name,
        quantity: item.quantity,
        orderNumber: item.orders?.order_number ?? '—',
      }))
      return {
        id: row.id,
        patientName: row.patient_name,
        fileMime: row.file_mime,
        fileUrl: signed?.signedUrl ?? null,
        submittedAt: row.created_at,
        status: row.status,
        orderNumbers: [...new Set(rxItems.map((i) => i.orderNumber))],
        rxItems,
      }
    }),
  )
}

/** Rx orders with NO prescription attached — staff must chase these. */
export async function getUnattachedRxOrders(): Promise<
  { orderNumber: string; placedAt: string; phone: string | null }[]
> {
  const db = supabaseService()
  const { data, error } = await db
    .from('orders')
    .select('order_number, placed_at, guest_phone, order_items ( requires_prescription, prescription_id )')
    .eq('status', 'awaiting_rx')
    .order('placed_at', { ascending: true })
  if (error) throw new Error(`rx orders query failed: ${error.message}`)

  return ((data ?? []) as unknown as {
    order_number: string
    placed_at: string
    guest_phone: string | null
    order_items: { requires_prescription: boolean; prescription_id: string | null }[]
  }[])
    .filter((o) => o.order_items.some((i) => i.requires_prescription && !i.prescription_id))
    .map((o) => ({ orderNumber: o.order_number, placedAt: o.placed_at, phone: o.guest_phone }))
}
