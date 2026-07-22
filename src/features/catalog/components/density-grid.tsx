'use client'

import * as React from 'react'
import { Grid2x2, Grid3x3 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Purely visual grid-density toggle. The cards arrive as server-rendered
 * children; the only client state is which column count to lay them out in,
 * so filters, sorting, and URLs are untouched.
 */
export function DensityGrid({
  toolbar,
  controls,
  children,
}: {
  /** Left side of the results header row (e.g. the live result count). */
  toolbar?: React.ReactNode
  /** Right side of the header row, before the density toggle (e.g. sort). */
  controls?: React.ReactNode
  children: React.ReactNode
}) {
  const [compact, setCompact] = React.useState(true)

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="mr-auto">{toolbar}</div>
        {controls}
        <div
          role="group"
          aria-label="Grid density"
          className="hidden items-center gap-0.5 rounded-md border border-gray-200 bg-white p-0.5 md:flex"
        >
          <button
            type="button"
            onClick={() => setCompact(false)}
            aria-pressed={!compact}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-sm transition-colors duration-fast',
              !compact ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-700',
            )}
          >
            <Grid2x2 className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Comfortable grid</span>
          </button>
          <button
            type="button"
            onClick={() => setCompact(true)}
            aria-pressed={compact}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-sm transition-colors duration-fast',
              compact ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-700',
            )}
          >
            <Grid3x3 className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Compact grid</span>
          </button>
        </div>
      </div>

      <div
        className={cn(
          'grid grid-cols-2 gap-4',
          compact
            ? 'md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
            : 'md:grid-cols-2 xl:grid-cols-3',
        )}
      >
        {children}
      </div>
    </>
  )
}
