'use client'

import * as React from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { siteConfig } from '@/config/site'
import { cn } from '@/lib/utils'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    // Replaced by the error reporter (Sentry) in production.
    console.error(error)
  }, [error])

  return (
    <div className="container flex max-w-lg flex-col items-center py-24 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertTriangle className="h-8 w-8" aria-hidden="true" />
      </span>

      <h1 className="mt-6 text-h1">Something went wrong</h1>
      <p className="mt-3 text-body text-gray-500">
        This is on us, not you. Nothing in your cart was lost — try again, and if it keeps
        happening give us a call.
      </p>

      {error.digest && (
        <p className="tabular mt-4 text-body-sm text-gray-400">Reference: {error.digest}</p>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button size="lg" onClick={reset}>
          Try again
        </Button>
        <Link href="/" className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }))}>
          Back to home
        </Link>
      </div>

      <p className="mt-8 text-body-sm text-gray-500">
        Need help now? Call{' '}
        <a
          href={`tel:${siteConfig.phone.replace(/\s/g, '')}`}
          className="rounded-sm font-semibold text-blue-600 hover:underline"
        >
          {siteConfig.phone}
        </a>
      </p>
    </div>
  )
}
