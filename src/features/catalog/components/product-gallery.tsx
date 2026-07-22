'use client'

import * as React from 'react'
import { MediaPlaceholder } from '@/components/shared/primitives'
import { cn } from '@/lib/utils'
import type { ProductImage } from '@/types'

/**
 * PDP media column. Real photos when the product has them, the tinted glyph
 * tile otherwise — both hold the exact same square so the layout never shifts.
 *
 * Zoom is pure CSS: the image scales inside an overflow-hidden frame on hover.
 * No library, no layout cost, and it degrades to nothing on touch.
 */
export function ProductGallery({
  images,
  icon,
  name,
}: {
  images?: ProductImage[]
  icon: string
  name: string
}) {
  const list = images ?? []
  const [active, setActive] = React.useState(0)
  const current = list[active] ?? list[0]

  return (
    <div className="flex flex-col gap-3">
      <div className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-white">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.url}
            alt={current.alt || name}
            className="h-full w-full object-cover transition-transform duration-slow ease-out group-hover:scale-110"
          />
        ) : (
          <MediaPlaceholder
            icon={icon}
            size="lg"
            className="h-full w-full transition-transform duration-slow group-hover:scale-105"
          />
        )}
      </div>

      {list.length > 1 && (
        <div className="flex flex-wrap gap-2.5" role="group" aria-label="Product images">
          {list.map((image, i) => {
            const selected = i === active
            return (
              <button
                key={image.url}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`View image ${i + 1} of ${list.length}`}
                aria-pressed={selected}
                className={cn(
                  'h-16 w-16 shrink-0 overflow-hidden rounded-sm border bg-white transition-all duration-fast',
                  selected
                    ? 'border-blue-600 ring-1 ring-blue-600'
                    : 'border-gray-200 opacity-80 hover:border-gray-400 hover:opacity-100',
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt="" className="h-full w-full object-cover" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
