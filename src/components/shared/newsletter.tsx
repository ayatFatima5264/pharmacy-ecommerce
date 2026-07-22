'use client'

import * as React from 'react'
import { CheckCircle2, Mail } from 'lucide-react'

/**
 * Newsletter capture — UI-layer only for now (no marketing backend exists;
 * see docs/EMAIL.md: transactional and marketing email are deliberately
 * separate systems). Submissions acknowledge locally; wiring to a marketing
 * list is a future feature with its own consent tracking.
 */
export function NewsletterForm() {
  const [email, setEmail] = React.useState('')
  const [done, setDone] = React.useState(false)

  if (done) {
    return (
      <p role="status" className="flex items-center justify-center gap-2 text-body font-semibold text-white">
        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
        Thanks — we&rsquo;ll keep you posted.
      </p>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (email.includes('@')) setDone(true)
      }}
      className="mx-auto flex w-full max-w-md gap-2"
    >
      <label htmlFor="newsletter-email" className="sr-only">
        Email address
      </label>
      <div className="relative flex-1">
        <Mail
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          aria-hidden="true"
        />
        <input
          id="newsletter-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email address"
          className="h-12 w-full rounded-md border-0 bg-white pl-10 pr-3.5 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/70"
        />
      </div>
      <button
        type="submit"
        className="h-12 shrink-0 rounded-md bg-gray-900 px-5 text-body-sm font-semibold text-white transition-colors duration-fast hover:bg-gray-700"
      >
        Subscribe
      </button>
    </form>
  )
}
