'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ProductTab {
  id: string
  label: string
  /** Server-rendered content — the page builds it, this component only shows/hides. */
  content: React.ReactNode
}

/**
 * Accessible tabs for the PDP information sections.
 *
 * Follows the WAI-ARIA tabs pattern: roving tabindex, arrow-key navigation,
 * aria-selected/aria-controls wiring. Panels are hidden (not unmounted) so the
 * server-rendered content stays in the DOM for crawlers and find-in-page.
 */
export function ProductTabs({ tabs }: { tabs: ProductTab[] }) {
  const [activeId, setActiveId] = React.useState(tabs[0]?.id)
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([])

  if (tabs.length === 0) return null

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    let next: number | null = null
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = tabs.length - 1
    if (next === null) return
    event.preventDefault()
    setActiveId(tabs[next].id)
    tabRefs.current[next]?.focus()
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Product information"
        className="flex gap-1 overflow-x-auto border-b border-gray-200"
      >
        {tabs.map((tab, i) => {
          const selected = tab.id === activeId
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[i] = el
              }}
              type="button"
              role="tab"
              id={`product-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`product-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveId(tab.id)}
              onKeyDown={(event) => onKeyDown(event, i)}
              className={cn(
                '-mb-px whitespace-nowrap rounded-t-sm border-b-2 px-4 py-3 text-body-sm font-semibold transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600',
                selected
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`product-panel-${tab.id}`}
          aria-labelledby={`product-tab-${tab.id}`}
          hidden={tab.id !== activeId}
          tabIndex={0}
          className="animate-fade-in pt-6 focus-visible:outline-none"
        >
          {tab.content}
        </div>
      ))}
    </div>
  )
}
