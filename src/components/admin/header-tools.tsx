'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronRight, Moon, Search } from 'lucide-react'
import { adminNav } from '@/config/admin-nav'

/**
 * Client-side chrome for the admin header: breadcrumb and global search.
 * Both are pure navigation — no data access, no business logic — which is
 * why they can live in the header without touching any server code.
 */

/** href → label, resolved once from the nav config so names never drift. */
const LABELS: Record<string, string> = Object.fromEntries(
  adminNav.flatMap((section) => section.items.map((item) => [item.href, item.label])),
)

export function AdminBreadcrumb() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean) // ['admin', 'orders', 'HC-100012']

  const crumbs = segments.slice(1).map((segment, i) => {
    const href = `/admin/${segments.slice(1, i + 2).join('/')}`
    const label =
      LABELS[href] ??
      // Detail segments (order numbers, ids) read as themselves, capped so a
      // uuid never floods the header.
      (segment.length > 18 ? `${segment.slice(0, 8)}…` : decodeURIComponent(segment))
    return { href, label }
  })

  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center md:flex">
      <ol className="flex min-w-0 items-center gap-1.5 text-[13px]">
        <li>
          <Link
            href="/admin"
            className="rounded-sm font-medium text-gray-500 transition-colors duration-fast hover:text-blue-600"
          >
            Dashboard
          </Link>
        </li>
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1
          return (
            <li key={crumb.href} className="flex min-w-0 items-center gap-1.5">
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
              {last ? (
                <span aria-current="page" className="truncate font-semibold text-gray-900">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="truncate rounded-sm font-medium text-gray-500 transition-colors duration-fast hover:text-blue-600"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/**
 * Global search. Order numbers (HC-…, or any digit-led query) land on the
 * orders list; everything else searches the product catalog. Both targets
 * already accept ?q= — this just routes to them.
 */
export function AdminSearch() {
  const router = useRouter()
  const inputRef = React.useRef<HTMLInputElement>(null)

  // "/" focuses search from anywhere, like every 2026 SaaS console.
  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable
      if (event.key === '/' && !typing) {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = inputRef.current?.value.trim() ?? ''
    if (!query) return
    const target = /^(hc-?|#)?\d/i.test(query) ? '/admin/orders' : '/admin/products'
    router.push(`${target}?q=${encodeURIComponent(query.replace(/^#/, ''))}`)
  }

  return (
    <form role="search" onSubmit={onSubmit} className="relative hidden w-full max-w-xs sm:block">
      <label htmlFor="admin-global-search" className="sr-only">
        Search orders and products
      </label>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        id="admin-global-search"
        type="search"
        placeholder="Search orders, products…"
        className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 pl-9 pr-9 text-[13px] text-gray-900 transition-all duration-medium placeholder:text-gray-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-[3px] focus:ring-blue-100"
      />
      <kbd
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 top-1/2 hidden h-5 -translate-y-1/2 items-center rounded border border-gray-200 bg-white px-1.5 text-[10.5px] font-semibold text-gray-400 md:flex"
      >
        /
      </kbd>
    </form>
  )
}

/** Visual affordance only — theming ships in a later phase. */
export function DarkModeToggle() {
  return (
    <button
      type="button"
      disabled
      title="Dark mode — coming soon"
      aria-label="Dark mode — coming soon"
      className="hidden h-9 w-9 items-center justify-center rounded-md text-gray-300 md:flex"
    >
      <Moon className="h-4 w-4" aria-hidden="true" />
    </button>
  )
}
