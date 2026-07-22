'use client'

import * as React from 'react'
import { Check, Minus, Plus, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCart } from '@/features/cart/cart-context'
import type { CartItemKind } from '@/features/cart/types'

/**
 * The single add-to-cart control used by cards, the PDP, and lab test pages.
 *
 * It passes identity only — kind, slug, variant. Price is never sent from the
 * button, because a price supplied by the client is a price a client can edit.
 *
 * Confirmation is inline and transient: a toast or a redirect to the cart both
 * interrupt browsing, which costs basket size.
 */
export function AddToCart({
  item,
  quantity = 1,
  disabled,
  variant = 'secondary',
  size = 'md',
  full = true,
  label = 'Add to cart',
}: {
  item: { kind: CartItemKind; slug: string; variantId?: string }
  quantity?: number
  disabled?: boolean
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
  full?: boolean
  label?: string
}) {
  const { add } = useCart()
  const [added, setAdded] = React.useState(false)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  function handleAdd() {
    add(item, quantity)
    setAdded(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setAdded(false), 1800)
  }

  if (disabled) {
    return (
      <Button variant="outline" size={size} full={full} disabled>
        Out of stock
      </Button>
    )
  }

  return (
    <Button variant={added ? 'primary' : variant} size={size} full={full} onClick={handleAdd}>
      {added ? (
        <>
          <Check className="h-4 w-4" aria-hidden="true" />
          Added
        </>
      ) : (
        <>
          <ShoppingCart className="h-4 w-4" aria-hidden="true" />
          {label}
        </>
      )}
    </Button>
  )
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  label = 'Quantity',
}: {
  value: number
  onChange: (next: number) => void
  min?: number
  max?: number
  label?: string
}) {
  return (
    <div className="flex h-11 items-center overflow-hidden rounded-md border border-gray-200 bg-white shadow-e1">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`Decrease ${label.toLowerCase()}`}
        className="flex h-full w-11 items-center justify-center text-gray-700 transition-colors duration-fast hover:bg-blue-50 hover:text-blue-600 disabled:text-gray-400 disabled:hover:bg-transparent disabled:hover:text-gray-400"
      >
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      <span className="tabular flex h-full w-10 items-center justify-center border-x border-gray-200 text-center text-body font-semibold text-gray-900" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`Increase ${label.toLowerCase()}`}
        className="flex h-full w-11 items-center justify-center text-gray-700 transition-colors duration-fast hover:bg-blue-50 hover:text-blue-600 disabled:text-gray-400 disabled:hover:bg-transparent disabled:hover:text-gray-400"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}
