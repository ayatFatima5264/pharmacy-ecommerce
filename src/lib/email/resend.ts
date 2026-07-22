import 'server-only'

/**
 * Minimal Resend client over their REST API.
 *
 * Written against fetch rather than pulling in the SDK: one endpoint is used,
 * and the SDK would add a dependency for a single POST.
 *
 * When RESEND_API_KEY is absent the send is SKIPPED and logged, never faked and
 * never thrown. A missing email key must not stop someone buying medicine.
 */

export type SendResult =
  | { status: 'sent'; id: string }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string }

interface SendArgs {
  to: string
  subject: string
  html: string
  text: string
  replyTo?: string
}

export async function sendEmail({ to, subject, html, text, replyTo }: SendArgs): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM

  if (!apiKey || !from) {
    // Loud in dev, harmless in production — the order still exists either way.
    console.warn(
      `[email] RESEND_API_KEY or EMAIL_FROM not set — skipping "${subject}" to ${to}`,
    )
    return { status: 'skipped', reason: 'Email is not configured' }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
      // A slow mail provider must not hold up the order confirmation page.
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) {
      const body = await response.text()
      console.error(`[email] Resend rejected the request (${response.status}): ${body}`)
      return { status: 'failed', reason: `Resend returned ${response.status}` }
    }

    const data = (await response.json()) as { id?: string }
    return { status: 'sent', id: data.id ?? 'unknown' }
  } catch (error) {
    console.error('[email] Send failed', error)
    return {
      status: 'failed',
      reason: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
