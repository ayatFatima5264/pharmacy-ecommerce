'use client'

import * as React from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

/**
 * Minimal toast for the admin console — one message at a time, bottom-right,
 * self-dismissing. Used for permission refusals ("You don't have permission…")
 * and transient confirmations where an inline banner has no anchor.
 */
export function useAdminToast() {
  const [message, setMessage] = React.useState<{ text: string; tone: 'error' | 'success' } | null>(
    null,
  )
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = React.useCallback((text: string, tone: 'error' | 'success' = 'error') => {
    if (timer.current) clearTimeout(timer.current)
    setMessage({ text, tone })
    timer.current = setTimeout(() => setMessage(null), 3500)
  }, [])

  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const toast = message ? (
    <div
      role={message.tone === 'error' ? 'alert' : 'status'}
      className={`fixed bottom-6 right-6 z-[70] flex max-w-sm animate-slide-up items-center gap-2.5 rounded-lg px-4 py-3 text-[13.5px] font-semibold text-white shadow-e3 ${
        message.tone === 'error' ? 'bg-gray-900' : 'bg-green-700'
      }`}
    >
      {message.tone === 'error' ? (
        <AlertCircle className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      {message.text}
    </div>
  ) : null

  return { toast, showToast }
}

export const NO_PERMISSION_MESSAGE =
  "You don't have permission to perform this action. Please contact your Administrator."

/**
 * A button-shaped permission refusal: looks like the real action, disabled
 * styling, and clicking explains instead of silently doing nothing. Pages
 * render this in place of the real button when `can(permission)` is false —
 * the server action still enforces independently.
 */
export function BlockedActionButton({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const { toast, showToast } = useAdminToast()
  return (
    <>
      {toast}
      <button
        type="button"
        aria-disabled="true"
        title={NO_PERMISSION_MESSAGE}
        onClick={() => showToast(NO_PERMISSION_MESSAGE)}
        className={
          className ??
          'flex h-10 cursor-not-allowed items-center gap-2 rounded-md bg-gray-100 px-4 text-[13.5px] font-semibold text-gray-400'
        }
      >
        {children}
      </button>
    </>
  )
}
