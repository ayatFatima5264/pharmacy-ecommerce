import { siteConfig } from '@/config/site'

/**
 * WhatsApp deep links — the single place that knows how wa.me URLs are built.
 *
 * Importable from server and client components alike (no server-only): the
 * floating button renders on the server, future "share product / share cart /
 * share prescription" actions will compose messages on the client. Adding a
 * share surface means adding a message builder here, not another URL format.
 */

export const DEFAULT_WHATSAPP_MESSAGE = 'Hello, I need assistance regarding my order.'

/** wa.me requires the number as bare digits with country code — no +, spaces, or dashes. */
function whatsappNumber(): string {
  return siteConfig.whatsapp.replace(/\D/g, '')
}

/** Chat link with an optional prefilled message. */
export function whatsappLink(message: string = DEFAULT_WHATSAPP_MESSAGE): string {
  return `https://wa.me/${whatsappNumber()}?text=${encodeURIComponent(message)}`
}

/* -------------------------------------------------------------------------
 * Message builders for future share surfaces (V1.2+). Kept here so the
 * wording lives beside the link format; wiring them into UI is a later phase.
 * ------------------------------------------------------------------------- */

export function whatsappProductMessage(productName: string, productUrl: string): string {
  return `Hello, I have a question about this product: ${productName} — ${productUrl}`
}

export function whatsappOrderMessage(orderNumber: string): string {
  return `Hello, I need assistance regarding my order ${orderNumber}.`
}

export function whatsappPrescriptionMessage(): string {
  return 'Hello, I would like help with my prescription.'
}
