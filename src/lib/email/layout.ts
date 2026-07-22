import 'server-only'
import { siteConfig } from '@/config/site'

/**
 * Shared email shell.
 *
 * Email is not the web. Rules this layout obeys, and why:
 *  - Tables for layout. Outlook renders through Word's engine, which has no
 *    flexbox and no grid.
 *  - Inline styles only. Gmail strips <style> blocks in many contexts, and no
 *    client reliably loads an external stylesheet.
 *  - Max width 560px, with everything fluid below it. Most mobile clients show
 *    ~320–420px of usable width.
 *  - Every colour is a literal hex. CSS custom properties do not work in email.
 *  - A plain-text alternative always ships alongside: some clients block HTML
 *    entirely, and text is what a screen reader gets cleanly.
 */

/** Brand palette, matching docs/DESIGN-SYSTEM.md. Literals, not variables. */
export const BRAND = {
  blue: '#0057d9',
  blueDark: '#0046ae',
  blueTint: '#eff5ff',
  green: '#047857',
  greenTint: '#ecfdf5',
  amber: '#b45309',
  amberTint: '#fffbeb',
  red: '#dc2626',
  ink: '#0f172a',
  body: '#334155',
  muted: '#64748b',
  line: '#e2e8f0',
  surface: '#f8fafc',
  white: '#ffffff',
} as const

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

export function rupees(paisa: number): string {
  return `Rs ${(paisa / 100).toLocaleString('en-PK')}`
}

/**
 * HTML-escapes interpolated values.
 *
 * Customer-supplied strings (names, addresses, notes) end up inside this markup.
 * Without escaping, a name containing markup would be injected into the email
 * body — the same class of bug as XSS, just delivered by mail.
 */
export function esc(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function button(href: string, label: string): string {
  return `<a href="${esc(href)}" style="display:inline-block;background:${BRAND.blue};color:#ffffff;text-decoration:none;font-family:${FONT};font-size:15px;font-weight:600;line-height:1;padding:14px 24px;border-radius:8px;">${esc(label)}</a>`
}

export function panel(
  content: string,
  tone: 'info' | 'success' | 'warning' | 'plain' = 'plain',
): string {
  const background = {
    info: BRAND.blueTint,
    success: BRAND.greenTint,
    warning: BRAND.amberTint,
    plain: BRAND.surface,
  }[tone]

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${background};border-radius:8px;margin:0 0 4px;">
    <tr><td style="padding:14px 16px;font-family:${FONT};font-size:13.5px;line-height:1.6;color:${BRAND.body};">${content}</td></tr>
  </table>`
}

export function totalsRow(
  label: string,
  value: string,
  opts: { bold?: boolean; tone?: 'default' | 'green' } = {},
): string {
  const size = opts.bold ? '16px' : '14px'
  const weight = opts.bold ? '700' : '600'
  const colour = opts.tone === 'green' ? BRAND.green : BRAND.ink
  const topRule = opts.bold ? `padding-top:12px;border-top:1px solid ${BRAND.line};` : ''

  return `<tr>
    <td style="padding:4px 0;${topRule}font-family:${FONT};font-size:${size};color:${opts.bold ? BRAND.ink : BRAND.muted};${opts.bold ? 'font-weight:700;' : ''}">${esc(label)}</td>
    <td style="padding:4px 0;${topRule}font-family:${FONT};font-size:${size};font-weight:${weight};color:${colour};text-align:right;white-space:nowrap;">${esc(value)}</td>
  </tr>`
}

export function itemRows(
  items: { name: string; subtitle: string; quantity: number; lineTotalPaisa: number; showQuantity: boolean }[],
): string {
  return items
    .map(
      (item) => `<tr>
        <td style="padding:12px 0;border-bottom:1px solid ${BRAND.line};font-family:${FONT};">
          <div style="font-size:14px;font-weight:600;color:${BRAND.ink};">${esc(item.name)}</div>
          <div style="font-size:13px;color:${BRAND.muted};margin-top:2px;">${esc(item.subtitle)}${
            item.showQuantity ? ` &times; ${item.quantity}` : ''
          }</div>
        </td>
        <td style="padding:12px 0;border-bottom:1px solid ${BRAND.line};font-family:${FONT};font-size:14px;font-weight:600;color:${BRAND.ink};text-align:right;white-space:nowrap;">${rupees(item.lineTotalPaisa)}</td>
      </tr>`,
    )
    .join('')
}

export function sectionLabel(text: string): string {
  return `<div style="font-family:${FONT};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${BRAND.muted};">${esc(text)}</div>`
}

/**
 * Wraps content in the branded shell.
 *
 * `preheader` is the snippet inbox lists show next to the subject. Hidden in the
 * body but present in the source — without it, clients scrape the first visible
 * text, which is usually the logo alt or a stray link.
 */
export function emailShell({
  preheader,
  heading,
  intro,
  body,
}: {
  preheader: string
  heading: string
  intro: string
  body: string
}): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${esc(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.surface};-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(preheader)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.surface};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.white};border:1px solid ${BRAND.line};border-radius:12px;overflow:hidden;">

        <tr><td style="padding:24px 24px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right:8px;">
                <div style="width:28px;height:28px;background:${BRAND.blue};border-radius:8px;color:#ffffff;font-family:${FONT};font-size:14px;font-weight:700;text-align:center;line-height:28px;">S</div>
              </td>
              <td style="font-family:${FONT};font-size:16px;font-weight:700;color:${BRAND.ink};">${esc(siteConfig.name)}</td>
            </tr>
          </table>
        </td></tr>

        <tr><td style="padding:20px 24px 0;">
          <h1 style="margin:0;font-family:${FONT};font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;color:${BRAND.ink};">${esc(heading)}</h1>
          <p style="margin:8px 0 0;font-family:${FONT};font-size:15px;line-height:1.6;color:${BRAND.body};">${esc(intro)}</p>
        </td></tr>

        ${body}

        <tr><td style="padding:22px 24px;border-top:1px solid ${BRAND.line};">
          <div style="font-family:${FONT};font-size:12.5px;line-height:1.65;color:${BRAND.muted};">
            Questions? Call <a href="tel:${siteConfig.phone.replace(/\s/g, '')}" style="color:${BRAND.blue};text-decoration:none;">${esc(siteConfig.phone)}</a><br>
            ${esc(siteConfig.name)} &mdash; DRAP Licence ${esc(siteConfig.drapLicense)}<br>
            Superintendent pharmacist: ${esc(siteConfig.pharmacist)}<br>
            <span style="color:#94a3b8;">${esc(siteConfig.address)}</span>
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

/** A padded content block inside the shell. */
export function block(content: string, paddingTop = 20): string {
  return `<tr><td style="padding:${paddingTop}px 24px 0;">${content}</td></tr>`
}
