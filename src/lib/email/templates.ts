import 'server-only'
import {
  BRAND,
  block,
  button,
  emailShell,
  esc,
  itemRows,
  panel,
  rupees,
  sectionLabel,
  totalsRow,
} from './layout'
import { BANK_DETAILS, PAYMENT_METHODS } from '@/config/locations'
import { siteConfig } from '@/config/site'
import type { PlacedOrder } from '@/lib/data/orders-store'
import type { LabBooking } from '@/lib/data/lab-store'

/**
 * The four transactional emails.
 *
 * Each returns { subject, html, text }. The plain-text version is not a
 * courtesy — some clients block HTML outright, and text is what a screen reader
 * handles most reliably.
 */

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

function trackUrl(orderNumber: string): string {
  return `${siteConfig.url}/track-order?order=${encodeURIComponent(orderNumber)}`
}

function orderItemsBlock(order: PlacedOrder): string {
  return (
    block(sectionLabel('Your order')) +
    block(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows(
        order.items.map((item) => ({
          name: item.name,
          subtitle: item.subtitle,
          quantity: item.quantity,
          lineTotalPaisa: item.lineTotalPaisa,
          showQuantity: item.kind === 'product',
        })),
      )}</table>`,
      8,
    ) +
    block(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${totalsRow('Subtotal', rupees(order.subtotalPaisa))}
        ${order.discountPaisa > 0 ? totalsRow(`Discount (${order.couponCode ?? ''})`, `− ${rupees(order.discountPaisa)}`, { tone: 'green' }) : ''}
        ${order.taxPaisa > 0 ? totalsRow('Tax', rupees(order.taxPaisa)) : ''}
        ${totalsRow('Delivery', order.shippingPaisa === 0 ? 'Free' : rupees(order.shippingPaisa), { tone: order.shippingPaisa === 0 ? 'green' : 'default' })}
        ${totalsRow('Total', rupees(order.totalPaisa), { bold: true })}
      </table>`,
      12,
    )
  )
}

function orderItemsText(order: PlacedOrder): string[] {
  return [
    'ITEMS',
    ...order.items.map(
      (item) =>
        `  ${item.kind === 'product' ? `${item.quantity} x ` : ''}${item.name} (${item.subtitle}) — ${rupees(item.lineTotalPaisa)}`,
    ),
    '',
    `Subtotal: ${rupees(order.subtotalPaisa)}`,
    ...(order.discountPaisa > 0 ? [`Discount (${order.couponCode}): -${rupees(order.discountPaisa)}`] : []),
    ...(order.taxPaisa > 0 ? [`Tax: ${rupees(order.taxPaisa)}`] : []),
    `Delivery: ${order.shippingPaisa === 0 ? 'Free' : rupees(order.shippingPaisa)}`,
    `TOTAL: ${rupees(order.totalPaisa)}`,
  ]
}

function footerText(orderNumber: string): string[] {
  return [
    '',
    `Track your order: ${trackUrl(orderNumber)}`,
    `Questions? Call ${siteConfig.phone}`,
    '',
    `${siteConfig.name} — DRAP Licence ${siteConfig.drapLicense}`,
  ]
}

// ---------------------------------------------------------------------------
// 1. Order confirmation
// ---------------------------------------------------------------------------

export function orderConfirmationEmail(order: PlacedOrder): RenderedEmail {
  const method = PAYMENT_METHODS.find((m) => m.id === order.paymentMethod)

  const addressPanel = panel(
    `<strong style="color:${BRAND.ink};font-size:14px;">Arriving ${esc(order.estimatedDeliveryFrom)} – ${esc(order.estimatedDeliveryTo)}</strong><br>
     <span style="color:${BRAND.muted};">${esc(order.address)}<br>${esc(order.city)}, ${esc(order.province)}${order.postalCode ? ` ${esc(order.postalCode)}` : ''}</span>`,
    'info',
  )

  const rxPanel = order.requiresPrescription
    ? block(
        panel(
          `<strong style="color:${BRAND.amber};">Prescription required.</strong> <span style="color:${BRAND.amber};">A licensed pharmacist will review it before we dispatch. We will call you if anything needs clarifying.</span>`,
          'warning',
        ),
        12,
      )
    : ''

  const bankPanel =
    order.paymentMethod === 'bank_transfer'
      ? block(
          panel(
            `<strong style="color:${BRAND.ink};">Bank transfer details</strong><br>
             ${esc(BANK_DETAILS.bankName)}<br>${esc(BANK_DETAILS.accountTitle)}<br>
             Account: ${esc(BANK_DETAILS.accountNumber)}<br>IBAN: ${esc(BANK_DETAILS.iban)}<br>
             <span style="color:${BRAND.muted};">Send the receipt to ${esc(siteConfig.email)} quoting ${esc(order.orderNumber)}. We dispatch once it clears.</span>`,
          ),
          12,
        )
      : ''

  const html = emailShell({
    preheader: `Order ${order.orderNumber} confirmed — arriving ${order.estimatedDeliveryFrom}.`,
    heading: 'Order confirmed',
    intro: `Thanks ${order.firstName} — we have your order and will start preparing it.`,
    body:
      block(
        `<div style="font-family:${FONT};font-size:14px;color:${BRAND.muted};">Order <strong style="color:${BRAND.ink};">${esc(order.orderNumber)}</strong></div>`,
        12,
      ) +
      block(addressPanel, 16) +
      rxPanel +
      bankPanel +
      orderItemsBlock(order) +
      block(
        `<div style="font-family:${FONT};font-size:13px;color:${BRAND.muted};">Payment: <strong style="color:${BRAND.ink};">${esc(method?.label ?? order.paymentMethod)}</strong></div>`,
        16,
      ) +
      block(button(trackUrl(order.orderNumber), 'Track your order'), 22) +
      block('', 4),
  })

  const text = [
    `Thanks ${order.firstName}, your order is confirmed.`,
    '',
    `Order number: ${order.orderNumber}`,
    `Arriving: ${order.estimatedDeliveryFrom} – ${order.estimatedDeliveryTo}`,
    '',
    ...orderItemsText(order),
    '',
    `Payment: ${method?.label ?? order.paymentMethod}`,
    '',
    'DELIVERING TO',
    `  ${order.firstName} ${order.lastName}`,
    `  ${order.address}`,
    `  ${order.city}, ${order.province}${order.postalCode ? ` ${order.postalCode}` : ''}`,
    `  ${order.phone}`,
    ...(order.requiresPrescription
      ? ['', 'PRESCRIPTION REQUIRED', '  A licensed pharmacist will review it before dispatch.']
      : []),
    ...(order.paymentMethod === 'bank_transfer'
      ? [
          '',
          'BANK TRANSFER',
          `  ${BANK_DETAILS.bankName} — ${BANK_DETAILS.accountTitle}`,
          `  Account: ${BANK_DETAILS.accountNumber}`,
          `  IBAN: ${BANK_DETAILS.iban}`,
        ]
      : []),
    ...footerText(order.orderNumber),
  ].join('\n')

  return { subject: `Order ${order.orderNumber} confirmed — ${siteConfig.name}`, html, text }
}

// ---------------------------------------------------------------------------
// 2. Order shipped
// ---------------------------------------------------------------------------

export function orderShippedEmail(order: PlacedOrder): RenderedEmail {
  const codDue = order.paymentMethod === 'cod'

  const html = emailShell({
    preheader: `Order ${order.orderNumber} is on its way — arriving ${order.estimatedDeliveryFrom}.`,
    heading: 'Your order is on the way',
    intro: `${order.firstName}, your order has left our store and is with the courier.`,
    body:
      block(
        `<div style="font-family:${FONT};font-size:14px;color:${BRAND.muted};">Order <strong style="color:${BRAND.ink};">${esc(order.orderNumber)}</strong></div>`,
        12,
      ) +
      block(
        panel(
          `<strong style="color:${BRAND.ink};font-size:14px;">Arriving ${esc(order.estimatedDeliveryFrom)} – ${esc(order.estimatedDeliveryTo)}</strong><br>
           <span style="color:${BRAND.muted};">${esc(order.address)}<br>${esc(order.city)}, ${esc(order.province)}</span>`,
          'info',
        ),
        16,
      ) +
      // COD riders carry limited change, so the amount is stated prominently.
      (codDue
        ? block(
            panel(
              `<strong style="color:${BRAND.amber};">Please have ${rupees(order.totalPaisa)} ready.</strong> <span style="color:${BRAND.amber};">Our rider collects cash on delivery and may not carry change.</span>`,
              'warning',
            ),
            12,
          )
        : '') +
      block(sectionLabel('In this delivery'), 20) +
      block(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows(
          order.items
            .filter((item) => item.kind === 'product')
            .map((item) => ({
              name: item.name,
              subtitle: item.subtitle,
              quantity: item.quantity,
              lineTotalPaisa: item.lineTotalPaisa,
              showQuantity: true,
            })),
        )}</table>`,
        8,
      ) +
      block(
        panel(
          `Keep your phone nearby — the rider will call before arriving. If nobody is available, we will try again the next working day.`,
        ),
        16,
      ) +
      block(button(trackUrl(order.orderNumber), 'Track your order'), 20) +
      block('', 4),
  })

  const text = [
    `${order.firstName}, your order is on the way.`,
    '',
    `Order number: ${order.orderNumber}`,
    `Arriving: ${order.estimatedDeliveryFrom} – ${order.estimatedDeliveryTo}`,
    `Delivering to: ${order.address}, ${order.city}, ${order.province}`,
    '',
    ...(codDue
      ? [`PLEASE HAVE ${rupees(order.totalPaisa)} READY — our rider may not carry change.`, '']
      : []),
    'IN THIS DELIVERY',
    ...order.items
      .filter((item) => item.kind === 'product')
      .map((item) => `  ${item.quantity} x ${item.name} (${item.subtitle})`),
    '',
    'The rider will call before arriving. If nobody is available we will retry the next working day.',
    ...footerText(order.orderNumber),
  ].join('\n')

  return { subject: `Order ${order.orderNumber} is on the way — ${siteConfig.name}`, html, text }
}

// ---------------------------------------------------------------------------
// 3. Order delivered
// ---------------------------------------------------------------------------

export function orderDeliveredEmail(order: PlacedOrder): RenderedEmail {
  const hasMedicine = order.items.some((item) => item.kind === 'product')

  const html = emailShell({
    preheader: `Order ${order.orderNumber} was delivered. Thank you for choosing ${siteConfig.name}.`,
    heading: 'Delivered',
    intro: `${order.firstName}, your order has been delivered. Thank you for choosing us.`,
    body:
      block(
        `<div style="font-family:${FONT};font-size:14px;color:${BRAND.muted};">Order <strong style="color:${BRAND.ink};">${esc(order.orderNumber)}</strong></div>`,
        12,
      ) +
      block(
        panel(
          `<strong style="color:${BRAND.green};">Delivered to ${esc(order.address)}, ${esc(order.city)}.</strong>`,
          'success',
        ),
        16,
      ) +
      // A pharmacy has a duty of care beyond the sale; storage and the
      // pharmacist line are the useful things to say at this moment.
      (hasMedicine
        ? block(
            panel(
              `<strong style="color:${BRAND.ink};">Storing your medicine</strong><br>
               Keep it below 25°C, out of direct sunlight and away from children. Check the expiry date on the pack before use.<br><br>
               <span style="color:${BRAND.muted};">Questions about dosage or interactions? Our pharmacists answer free of charge on ${esc(siteConfig.phone)}.</span>`,
            ),
            12,
          )
        : '') +
      block(sectionLabel('What you received'), 20) +
      block(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows(
          order.items.map((item) => ({
            name: item.name,
            subtitle: item.subtitle,
            quantity: item.quantity,
            lineTotalPaisa: item.lineTotalPaisa,
            showQuantity: item.kind === 'product',
          })),
        )}</table>`,
        8,
      ) +
      block(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${totalsRow('Total paid', rupees(order.totalPaisa), { bold: true })}</table>`,
        12,
      ) +
      block(
        panel(
          `Something wrong with your order? Sealed, unopened items can be returned within 7 days — just call us.`,
        ),
        16,
      ) +
      block(button(`${siteConfig.url}/pharmacy`, 'Order again'), 20) +
      block('', 4),
  })

  const text = [
    `${order.firstName}, your order has been delivered.`,
    '',
    `Order number: ${order.orderNumber}`,
    `Delivered to: ${order.address}, ${order.city}`,
    '',
    'WHAT YOU RECEIVED',
    ...order.items.map(
      (item) => `  ${item.kind === 'product' ? `${item.quantity} x ` : ''}${item.name}`,
    ),
    '',
    `Total paid: ${rupees(order.totalPaisa)}`,
    ...(hasMedicine
      ? [
          '',
          'STORING YOUR MEDICINE',
          '  Keep below 25°C, out of sunlight and away from children.',
          '  Check the expiry date on the pack before use.',
          `  Questions about dosage? Our pharmacists answer free on ${siteConfig.phone}.`,
        ]
      : []),
    '',
    'Sealed, unopened items can be returned within 7 days.',
    ...footerText(order.orderNumber),
  ].join('\n')

  return { subject: `Order ${order.orderNumber} delivered — ${siteConfig.name}`, html, text }
}

// ---------------------------------------------------------------------------
// 4. Lab booking confirmation
// ---------------------------------------------------------------------------

export function labBookingEmail(booking: LabBooking, customerFirstName: string): RenderedEmail {
  const testList = booking.tests
    .map(
      (test) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid ${BRAND.line};font-family:${FONT};font-size:14px;color:${BRAND.ink};">${esc(test.name)}<span style="color:${BRAND.muted};"> · ${esc(test.shortCode)}</span></td></tr>`,
    )
    .join('')

  const html = emailShell({
    preheader: `Lab appointment ${booking.bookingNumber} confirmed for ${booking.slotDate}, ${booking.slotLabel}.`,
    heading: 'Lab appointment confirmed',
    intro: `${customerFirstName}, the appointment for ${booking.patientName} is booked.`,
    body:
      block(
        `<div style="font-family:${FONT};font-size:14px;color:${BRAND.muted};">Booking <strong style="color:${BRAND.ink};">${esc(booking.bookingNumber)}</strong></div>`,
        12,
      ) +
      block(
        panel(
          `<strong style="color:${BRAND.ink};font-size:15px;">${esc(booking.slotDate)} · ${esc(booking.slotLabel)}</strong><br>
           <span style="color:${BRAND.muted};">${
             booking.collectionMode === 'home'
               ? `Home collection — ${esc(booking.address ?? '')}, ${esc(booking.city)}`
               : `Visit ${esc(booking.labName)}, ${esc(booking.city)}`
           }</span>`,
          'info',
        ),
        16,
      ) +
      // Fasting is the single most common reason a sample gets rejected and the
      // visit has to be repeated, so it is impossible to miss here.
      (booking.fastingHours !== null
        ? block(
            panel(
              `<strong style="color:${BRAND.amber};">Fast for ${booking.fastingHours} hours beforehand.</strong> <span style="color:${BRAND.amber};">Water is fine — nothing else. Keep taking any prescribed medication unless your doctor says otherwise.</span>`,
              'warning',
            ),
            12,
          )
        : '') +
      block(sectionLabel('Patient'), 20) +
      block(
        `<div style="font-family:${FONT};font-size:14px;color:${BRAND.ink};">${esc(booking.patientName)}</div>
         <div style="font-family:${FONT};font-size:13px;color:${BRAND.muted};margin-top:2px;">Age ${booking.patientAge} · ${esc(booking.patientGender)} · ${esc(booking.patientPhone)}</div>`,
        8,
      ) +
      block(sectionLabel(`${booking.tests.length} test${booking.tests.length === 1 ? '' : 's'} booked`), 20) +
      block(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${testList}</table>`, 8) +
      block(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${totalsRow('Total', rupees(booking.totalPaisa), { bold: true })}</table>`,
        12,
      ) +
      block(
        panel(
          booking.collectionMode === 'home'
            ? `Our phlebotomist will call ${esc(booking.patientPhone)} about 30 minutes before arriving. Please keep a CNIC handy.`
            : `Please arrive within your slot and bring a CNIC. Reports are delivered digitally.`,
        ),
        16,
      ) +
      block(button(trackUrl(booking.orderNumber), 'View booking'), 20) +
      block('', 4),
  })

  const text = [
    `${customerFirstName}, the lab appointment for ${booking.patientName} is confirmed.`,
    '',
    `Booking number: ${booking.bookingNumber}`,
    `Date: ${booking.slotDate}`,
    `Time: ${booking.slotLabel}`,
    booking.collectionMode === 'home'
      ? `Home collection: ${booking.address ?? ''}, ${booking.city}`
      : `Lab visit: ${booking.labName}, ${booking.city}`,
    '',
    'PATIENT',
    `  ${booking.patientName}, age ${booking.patientAge}, ${booking.patientGender}`,
    `  ${booking.patientPhone}`,
    '',
    `TESTS (${booking.tests.length})`,
    ...booking.tests.map((test) => `  ${test.name} (${test.shortCode})`),
    '',
    `Total: ${rupees(booking.totalPaisa)}`,
    ...(booking.fastingHours !== null
      ? [
          '',
          `FASTING REQUIRED: ${booking.fastingHours} hours`,
          '  Water is fine — nothing else.',
          '  Keep taking prescribed medication unless your doctor says otherwise.',
        ]
      : []),
    '',
    booking.collectionMode === 'home'
      ? `  Our phlebotomist will call ${booking.patientPhone} about 30 minutes before arriving.`
      : '  Please arrive within your slot. Bring a CNIC.',
    ...footerText(booking.orderNumber),
  ].join('\n')

  return {
    subject: `Lab appointment ${booking.bookingNumber} confirmed — ${siteConfig.name}`,
    html,
    text,
  }
}

/** Sent when a pharmacist rejects the prescription behind an order. */
export interface PrescriptionRejectedPayload {
  orderNumber: string
  customerName: string
  reason: string
}

export function prescriptionRejectedEmail(p: PrescriptionRejectedPayload): RenderedEmail {
  const html = emailShell({
    preheader: `We need a new prescription for order ${p.orderNumber}.`,
    heading: 'About your prescription',
    intro: `${p.customerName}, our pharmacist reviewed the prescription for order ${p.orderNumber} and could not approve it.`,
    body:
      block(
        panel(
          `<strong style="color:${BRAND.amber};">Reason:</strong> <span style="color:${BRAND.amber};">${esc(p.reason)}</span>`,
          'warning',
        ),
        12,
      ) +
      block(
        `<div style="font-family:${FONT};font-size:14px;color:${BRAND.muted};line-height:1.6;">
          Your order is on hold. Reply to this email with a clearer photo of a valid
          prescription, or send it to us on WhatsApp at ${esc(siteConfig.phone)} —
          our pharmacist will re-review it right away. If we cannot reach you, the
          order will be cancelled and nothing is charged.
        </div>`,
        8,
      ) +
      block(button('Track your order', trackUrl(p.orderNumber)), 16),
  })

  const text = [
    `${p.customerName}, our pharmacist could not approve the prescription for order ${p.orderNumber}.`,
    '',
    `Reason: ${p.reason}`,
    '',
    `Reply with a clearer photo of a valid prescription, or send it on WhatsApp at ${siteConfig.phone}.`,
    'If we cannot reach you, the order will be cancelled and nothing is charged.',
    '',
    `Track your order: ${trackUrl(p.orderNumber)}`,
  ].join('\n')

  return { subject: `Action needed on order ${p.orderNumber} — prescription`, html, text }
}