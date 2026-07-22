'use client'

import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AccordionItemProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}

/**
 * Native <details>/<summary>: keyboard-operable and screen-reader-correct with
 * no JS, and it degrades gracefully if hydration is slow on a weak connection.
 */
export function AccordionItem({ title, children, defaultOpen = false }: AccordionItemProps) {
  return (
    <details className="group border-b border-gray-200 last:border-b-0" open={defaultOpen}>
      <summary
        className={cn(
          'flex cursor-pointer list-none items-center justify-between gap-4 py-4',
          'text-h3 text-gray-900 marker:hidden',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2',
        )}
      >
        {title}
        <ChevronDown
          className="h-5 w-5 shrink-0 text-gray-400 transition-transform duration-fast group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="pb-5 text-body text-gray-700">{children}</div>
    </details>
  )
}

export function Accordion({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('rounded-md border border-gray-200 px-5', className)}>{children}</div>
}
