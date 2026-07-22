'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/field'
import { cn } from '@/lib/utils'
import type { Brand } from '@/types'

/**
 * Filters are URL state, not component state. That makes filtered views
 * shareable, correct under the back button, and server-renderable — the grid
 * itself stays a Server Component.
 */
export function ProductFilters({
  brands,
  className,
}: {
  brands: Brand[]
  className?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const selectedBrands = searchParams.getAll('brand')
  const otcOnly = searchParams.get('otc') === '1'
  const inStockOnly = searchParams.get('stock') === '1'
  const sort = searchParams.get('sort') ?? 'relevance'
  const activeCount = selectedBrands.length + (otcOnly ? 1 : 0) + (inStockOnly ? 1 : 0)

  const update = React.useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString())
      mutate(params)
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  function toggleBrand(slug: string) {
    update((params) => {
      const current = params.getAll('brand')
      params.delete('brand')
      const next = current.includes(slug) ? current.filter((b) => b !== slug) : [...current, slug]
      next.forEach((b) => params.append('brand', b))
    })
  }

  function toggleFlag(key: string, on: boolean) {
    update((params) => (on ? params.set(key, '1') : params.delete(key)))
  }

  function clearAll() {
    update((params) => {
      params.delete('brand')
      params.delete('otc')
      params.delete('stock')
    })
  }

  const panel = (
    <div className="flex flex-col gap-7">
      <fieldset>
        <legend className="mb-3 text-caption uppercase tracking-[0.06em] text-gray-900">
          Availability
        </legend>
        <div className="flex flex-col gap-2.5">
          <Checkbox
            id="f-stock"
            label="In stock only"
            checked={inStockOnly}
            onChange={(v) => toggleFlag('stock', v)}
          />
          {/* One of the most common real intents: someone who cannot see a
              doctor today wants to know what they can actually buy now. */}
          <Checkbox
            id="f-otc"
            label="No prescription needed"
            checked={otcOnly}
            onChange={(v) => toggleFlag('otc', v)}
          />
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-caption uppercase tracking-[0.06em] text-gray-900">Brand</legend>
        <div className="flex flex-col gap-2.5">
          {brands.map((brand) => (
            <Checkbox
              key={brand.id}
              id={`f-brand-${brand.slug}`}
              label={brand.name}
              checked={selectedBrands.includes(brand.slug)}
              onChange={() => toggleBrand(brand.slug)}
            />
          ))}
        </div>
      </fieldset>

      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={clearAll} className="self-start">
          Clear all filters
        </Button>
      )}
    </div>
  )

  return (
    <>
      {/* Mobile control bar */}
      <div className={cn('flex items-center gap-3 lg:hidden', className)}>
        <Button variant="outline" size="sm" onClick={() => setMobileOpen(true)} className="gap-2">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filters
          {activeCount > 0 && (
            <span className="tabular flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[11px] font-bold text-white">
              {activeCount}
            </span>
          )}
        </Button>
        <SortSelect value={sort} onChange={(v) => update((p) => p.set('sort', v))} />
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block">
        <div className="sticky top-32">
          <h2 className="mb-5 text-h3">Filters</h2>
          {panel}
        </div>
      </aside>

      {/* Mobile sheet */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-gray-900/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] animate-slide-up overflow-y-auto rounded-t-lg bg-white">
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4">
              <h2 className="text-h3">Filters</h2>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close filters"
                className="flex h-11 w-11 items-center justify-center rounded-sm text-gray-700 hover:bg-gray-100"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="p-5">{panel}</div>
            <div className="sticky bottom-0 border-t border-gray-200 bg-white p-4">
              <Button full onClick={() => setMobileOpen(false)}>
                Show results
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function SortSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <>
      <label htmlFor="sort" className="sr-only">
        Sort products
      </label>
      <Select
        id="sort"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-auto py-0 text-body-sm"
      >
        <option value="relevance">Sort: Relevance</option>
        <option value="price-asc">Price: Low to high</option>
        <option value="price-desc">Price: High to low</option>
        <option value="name">Name: A–Z</option>
      </Select>
    </>
  )
}

function Checkbox({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 text-body-sm text-gray-700">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-[18px] w-[18px] shrink-0 cursor-pointer rounded-[4px] border-gray-200 text-blue-600 focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
      />
      {label}
    </label>
  )
}

/** Desktop-only sort bar, so the mobile control row stays uncluttered. */
export function DesktopSort() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const sort = searchParams.get('sort') ?? 'relevance'

  return (
    <div className="hidden lg:block">
      <SortSelect
        value={sort}
        onChange={(v) => {
          const params = new URLSearchParams(searchParams.toString())
          params.set('sort', v)
          router.push(`${pathname}?${params.toString()}`, { scroll: false })
        }}
      />
    </div>
  )
}
