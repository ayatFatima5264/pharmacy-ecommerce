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
      className="mb-4 flex items-center gap-2.5 rounded-sm bg-green-50 p-3.5 text-[13.5px] text-green-700"
    >
      <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
      {messages[hit]}
    </div>
  )
}
