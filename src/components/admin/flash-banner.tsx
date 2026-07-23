import { Check } from 'lucide-react'

/**
 * Confirms a redirect-carried outcome, e.g. ?deleted=1 after a delete.
 *
 * Redirect-then-flash is deliberate: it means a refresh cannot replay the
 * mutation, which a render-the-result-inline approach allows.
 */
export function FlashBanner({
  params,
  messages,
}: {
  params: Record<string, string | string[] | undefined>
  messages: Record<string, string>
}) {
  const hit = Object.keys(messages).find((key) => params[key] === '1')
  if (!hit) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-4 flex items-center gap-3 rounded-lg border border-green-600/15 bg-green-50 px-4 py-3.5 text-[13.5px] font-medium text-green-700 shadow-e1"
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      {messages[hit]}
    </div>
  )
}
