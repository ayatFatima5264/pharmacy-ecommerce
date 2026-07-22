import { StatusPill } from './ui'
import type {
  AdminOrderStatus,
  AdminPaymentStatus,
  BookingStatus,
} from '@/lib/data/admin'

/**
 * One mapping from domain state to visual tone, used everywhere. Defining these
 * per page is how a "shipped" badge ends up green on one screen and blue on
 * another.
 */

const ORDER: Record<AdminOrderStatus, { label: string; tone: Parameters<typeof StatusPill>[0]['tone'] }> = {
  awaiting_rx: { label: 'Awaiting Rx', tone: 'warning' },
  confirmed: { label: 'Confirmed', tone: 'info' },
  processing: { label: 'Processing', tone: 'info' },
  shipped: { label: 'Shipped', tone: 'info' },
  delivered: { label: 'Delivered', tone: 'success' },
  delivery_failed: { label: 'Delivery failed', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
}

const PAYMENT: Record<AdminPaymentStatus, { label: string; tone: Parameters<typeof StatusPill>[0]['tone'] }> = {
  pending: { label: 'Pending', tone: 'warning' },
  paid: { label: 'Paid', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  refunded: { label: 'Refunded', tone: 'neutral' },
}

const BOOKING: Record<BookingStatus, { label: string; tone: Parameters<typeof StatusPill>[0]['tone'] }> = {
  scheduled: { label: 'Scheduled', tone: 'info' },
  sample_collected: { label: 'Sample collected', tone: 'info' },
  in_lab: { label: 'In lab', tone: 'info' },
  report_ready: { label: 'Report ready', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  no_show: { label: 'No show', tone: 'danger' },
}

export function OrderStatusPill({ status }: { status: AdminOrderStatus }) {
  const { label, tone } = ORDER[status]
  return <StatusPill tone={tone}>{label}</StatusPill>
}

export function PaymentStatusPill({ status }: { status: AdminPaymentStatus }) {
  const { label, tone } = PAYMENT[status]
  return <StatusPill tone={tone}>{label}</StatusPill>
}

export function BookingStatusPill({ status }: { status: BookingStatus }) {
  const { label, tone } = BOOKING[status]
  return <StatusPill tone={tone}>{label}</StatusPill>
}

export const orderStatusOptions = (Object.keys(ORDER) as AdminOrderStatus[]).map((value) => ({
  value,
  label: ORDER[value].label,
}))

export const bookingStatusOptions = (Object.keys(BOOKING) as BookingStatus[]).map((value) => ({
  value,
  label: BOOKING[value].label,
}))

export const paymentMethodLabels: Record<string, string> = {
  cod: 'Cash on delivery',
  jazzcash: 'JazzCash',
  easypaisa: 'Easypaisa',
}
