import * as React from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Paginated } from '@/lib/data/paginate'

/**
 * Pagination is real links carrying the current filters, not buttons.
 *
 * That makes a given page shareable, back-button-correct, and crawlable — and
 * lets the table stay a Server Component with no client JS at all.
 */
export function Pagination<T>({
  result,
  searchParams,
  basePath,
}: {
  result: Paginated<T>
  searchParams: Record<string, string | string[] | undefined>
  basePath: string
}) {
  const { page, pageCount, from, to, total } = result

  function hrefFor(target: number) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === 'page' || value === undefined) continue
      if (Array.isArray(value)) value.forEach((v) => params.append(key, v))
      else params.set(key, value)
    }
    if (target > 1) params.set('page', String(target))
    const qs = params.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  // Windowed page numbers: current ±1, always with first and last.
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1,
  )

  return (
    <nav
      aria-label="Pagination"
      className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row"
    >
      <p className="tabular text-[13px] text-gray-500">
        {total === 0 ? 'No records' : `Showing ${from}–${to} of ${total}`}
      </p>

      {pageCount > 1 && (
        <ul className="flex items-center gap-1">
          <li>
            <PageLink
              href={hrefFor(page - 1)}
              disabled={page === 1}
              label="Previous page"
              className="px-2"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </PageLink>
          </li>

          {pages.map((p, i) => {
            const prev = pages[i - 1]
            const gap = prev !== undefined && p - prev > 1
            return (
              <React.Fragment key={p}>
                {gap && (
                  <li aria-hidden="true" className="px-1 text-[13px] text-gray-400">
                    …
                  </li>
                )}
                <li>
                  <PageLink href={hrefFor(p)} current={p === page} label={`Page ${p}`}>
                    {p}
                  </PageLink>
                </li>
              </React.Fragment>
            )
          })}

          <li>
            <PageLink
              href={hrefFor(page + 1)}
              disabled={page === pageCount}
              label="Next page"
              className="px-2"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </PageLink>
          </li>
        </ul>
      )}
    </nav>
  )
}

function PageLink({
  href,
  children,
  current,
  disabled,
  label,
  className,
}: {
  href: string
  children: React.ReactNode
  current?: boolean
  disabled?: boolean
  label: string
  className?: string
}) {
  const base = cn(
    'tabular flex h-9 min-w-9 items-center justify-center rounded-sm px-2.5 text-[13px] font-semibold',
    className,
  )

  if (disabled) {
    return (
      <span aria-disabled="true" className={cn(base, 'cursor-not-allowed text-gray-400')}>
        <span className="sr-only">{label}</span>
        {children}
      </span>
    )
  }

  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={current ? 'page' : undefined}
      scroll={false}
      className={cn(
        base,
        current
          ? 'bg-blue-600 text-white'
          : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
      )}
    >
      {children}
    </Link>
  )
}
