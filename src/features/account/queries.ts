import 'server-only'
import { supabaseUserClient } from '@/lib/supabase/clients'

/**
 * Customer-context reads. These run through the USER-BOUND client, so RLS
 * (0014) enforces row ownership at the database — there is deliberately no
 * `eq('user_id', ...)` here, because the policy `user_id = auth.uid()` IS the
 * filter. A bug in this file cannot leak another customer's orders.
 *
 * Guest orders (no account at checkout) are not shown here — guests track
 * via /track-order with order number + phone.
 */

export interface MyOrderRow {
  orderNumber: string
  placedAt: string
  status: string
  totalPaisa: number
  itemCount: number
  itemsPreview: string
}

export interface MyOrderDetail extends MyOrderRow {
  city: string
  address: string
  items: { name: string; packSize: string | null; quantity: number; lineTotalPaisa: number }[]
  subtotalPaisa: number
  discountPaisa: number
  shippingPaisa: number
  taxPaisa: number
  paymentMethod: string
  history: { toStatus: string; at: string }[]
}

interface OrderRow {
  order_number: string
  placed_at: string
  status: string
  total_paisa: number
  subtotal_paisa: number
  discount_paisa: number
  shipping_paisa: number
  tax_paisa: number
  shipping_city: string | null
  shipping_address: { line1?: string; city?: string } | null
  order_items: { item_name: string; pack_size: string | null; quantity: number; line_total_paisa: number }[]
  order_status_history: { to_status: string; created_at: string }[]
  payments: { method: string }[]
}

const SELECT = `
  order_number, placed_at, status, total_paisa, subtotal_paisa, discount_paisa,
  shipping_paisa, tax_paisa, shipping_city, shipping_address,
  order_items ( item_name, pack_size, quantity, line_total_paisa ),
  order_status_history ( to_status, created_at ),
  payments ( method )
`

export async function getMyOrders(): Promise<MyOrderRow[]> {
  const db = await supabaseUserClient()
  const { data, error } = await db
    .from('orders')
    .select(SELECT)
    .order('placed_at', { ascending: false })
    .limit(50)
  if (error) throw new Error(`my orders query failed: ${error.message}`)

  return ((data ?? []) as unknown as OrderRow[]).map((o) => ({
    orderNumber: o.order_number,
    placedAt: o.placed_at,
    status: o.status,
    totalPaisa: o.total_paisa,
    itemCount: o.order_items.reduce((sum, i) => sum + i.quantity, 0),
    itemsPreview: o.order_items
      .slice(0, 2)
      .map((i) => i.item_name)
      .join(', ')
      .concat(o.order_items.length > 2 ? ` +${o.order_items.length - 2} more` : ''),
  }))
}

export async function getMyOrder(orderNumber: string): Promise<MyOrderDetail | null> {
  const db = await supabaseUserClient()
  const { data, error } = await db
    .from('orders')
    .select(SELECT)
    .ilike('order_number', orderNumber.trim())
    .maybeSingle()
  if (error) throw new Error(`my order query failed: ${error.message}`)
  if (!data) return null // Not found OR not theirs — RLS makes both look identical.
  const o = data as unknown as OrderRow

  return {
    orderNumber: o.order_number,
    placedAt: o.placed_at,
    status: o.status,
    totalPaisa: o.total_paisa,
    itemCount: o.order_items.reduce((sum, i) => sum + i.quantity, 0),
    itemsPreview: '',
    city: o.shipping_city ?? o.shipping_address?.city ?? '',
    address: o.shipping_address?.line1 ?? '',
    items: o.order_items.map((i) => ({
      name: i.item_name,
      packSize: i.pack_size,
      quantity: i.quantity,
      lineTotalPaisa: i.line_total_paisa,
    })),
    subtotalPaisa: o.subtotal_paisa,
    discountPaisa: o.discount_paisa,
    shippingPaisa: o.shipping_paisa,
    taxPaisa: o.tax_paisa,
    paymentMethod: o.payments[0]?.method ?? 'cod',
    history: o.order_status_history
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((h) => ({ toStatus: h.to_status, at: h.created_at })),
  }
}
