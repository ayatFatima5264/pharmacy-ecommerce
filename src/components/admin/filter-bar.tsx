'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FilterSelect {
  key: string
  label: string
  options: { value: string; label: string }[]
}

/**
 * Search and filters are URL state, so the table itself stays a Server
 * Component and every filtered view is a shareable link.
 *
 * Search is debounced — pushing a route on every keystroke would re-render the
 * server tree per character.
 */
export function FilterBar({
  searchPlaceholder = 'Search…',
  selects = [],
}: {
  searchPlaceholder?: string
  selects?: FilterSelect[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentQuery = searchParams.get('q') ?? ''
  const [query, setQuery] = React.useState(currentQuery)

  // Keep the input in sync when the URL changes from elsewhere (e.g. Reset).
  React.useEffect(() => setQuery(currentQuery), [currentQuery])

  const push = React.useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString())
      mutate(params)
      // Any filter change invalidates the current page offset.
      params.delete('page')
      const qs = params.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  React.useEffect(() => {
    if (query === currentQuery) return
    const timer = setTimeout(() => {
      push((params) => (query ? params.set('q', query) : params.delete('q')))
    }, 300)
    return () => clearTimeout(timer)
  }, [query, currentQuery, push])

  const activeFilters = selects.filter((s) => searchParams.get(s.key))
  const hasFilters = activeFilters.length > 0 || currentQuery !== ''

  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <label htmlFor="admin-search" className="sr-only">
            {searchPlaceholder}
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
          <input
            id="admin-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 w-full rounded-sm border border-gray-200 bg-white pl-9 pr-3 text-[13.5px] text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none focus:ring-[3px] focus:ring-blue-100"
          />
        </div>

        {selects.map((select) => (
          <div key={select.key}>
            <label htmlFor={`filter-${select.key}`} className="sr-only">
              {select.label}
            </label>
            <select
              id={`filter-${select.key}`}
              value={searchParams.get(select.key) ?? ''}
              onChange={(e) =>
                push((params) =>
                  e.target.value ? params.set(select.key, e.target.value) : params.delete(select.key),
                )
              }
              className={cn(
                'h-9 cursor-pointer rounded-sm border bg-white px-3 pr-8 text-[13.5px] focus:border-blue-600 focus:outline-none focus:ring-[3px] focus:ring-blue-100',
                searchParams.get(select.key)
                  ? 'border-blue-600 text-blue-700'
                  : 'border-gray-200 text-gray-700',
              )}
            >
              <option value="">{select.label}: All</option>
              {select.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ))}

        {hasFilters && (
          <button
            type="button"
            onClick={() => router.push(pathname, { scroll: false })}
            className="flex h-9 items-center gap-1.5 rounded-sm px-3 text-[13px] font-semibold text-gray-500 hover:bg-gray-100 hover:text-red-600"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Reset
          </button>
        )}
      </div>
    </div>
  )
}
