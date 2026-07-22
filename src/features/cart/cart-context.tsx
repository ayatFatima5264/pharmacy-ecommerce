'use client'

import * as React from 'react'
import { computeTotals, entryKey, resolveLines } from './pricing'
import { validateCoupon } from './actions/coupon-actions'
import type {
  CartCatalog,
  CartItemKind,
  CartLine,
  CartRef,
  CartTotals,
  CouponRule,
  ShippingContext,
} from './types'

/**
 * Cart state.
 *
 * Persisted to localStorage as identity + quantity ONLY — never price. Prices,
 * stock and availability are resolved on every render against a catalog
 * snapshot the server passes in, which is what makes a stale cart impossible.
 *
 * Guest-first by design: no account is needed to build or keep a cart. When
 * Supabase auth lands this maps to a session-id cart merged into the user cart
 * on login, which is exactly what `carts.session_id` exists for.
 */

const STORAGE_KEY = 'hc.cart.v2'
const CITY_KEY = 'hc.cart.city'

interface PersistedCart {
  refs: CartRef[]
  coupon: CouponRule | null
}

interface CartContextValue {
  lines: CartLine[]
  totals: CartTotals
  coupon: CouponRule | null
  couponMessage: { ok: boolean; text: string } | null
  city: string | null
  hydrated: boolean
  couponPending: boolean
  add: (item: { kind: CartItemKind; slug: string; variantId?: string }, quantity?: number) => void
  updateQuantity: (key: string, quantity: number) => void
  remove: (key: string) => void
  clear: () => void
  removeUnavailable: () => void
  applyCoupon: (code: string) => Promise<void>
  removeCoupon: () => void
  setCity: (city: string | null) => void
  setPaymentMethod: (method: 'cod' | 'online') => void
}

const CartContext = React.createContext<CartContextValue | null>(null)

export function CartProvider({
  catalog,
  children,
}: {
  catalog: CartCatalog
  children: React.ReactNode
}) {
  const [refs, setRefs] = React.useState<CartRef[]>([])
  const [coupon, setCoupon] = React.useState<CouponRule | null>(null)
  const [couponMessage, setCouponMessage] = React.useState<{ ok: boolean; text: string } | null>(null)
  const [city, setCityState] = React.useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = React.useState<'cod' | 'online'>('cod')
  const [hydrated, setHydrated] = React.useState(false)
  const [couponPending, startCouponTransition] = React.useTransition()

  // Read once on mount. Rendering empty first and filling in avoids a
  // hydration mismatch between server HTML and localStorage.
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedCart
        if (Array.isArray(parsed.refs)) {
          // Defensive: drop anything malformed rather than crashing the cart.
          setRefs(
            parsed.refs.filter(
              (ref) => typeof ref?.slug === 'string' && Number.isFinite(ref?.quantity),
            ),
          )
        }
        setCoupon(parsed.coupon ?? null)
      }
      setCityState(window.localStorage.getItem(CITY_KEY))
    } catch {
      window.localStorage.removeItem(STORAGE_KEY)
    }
    setHydrated(true)
  }, [])

  React.useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ refs, coupon }))
    } catch {
      // Storage full or blocked (private mode) — the cart still works in memory.
    }
  }, [refs, coupon, hydrated])

  const lines = React.useMemo(() => resolveLines(refs, catalog), [refs, catalog])

  const context: ShippingContext = React.useMemo(() => ({ city, paymentMethod }), [city, paymentMethod])

  const totals = React.useMemo(
    () => computeTotals({ lines, coupon, context, catalog }),
    [lines, coupon, context, catalog],
  )

  // A coupon whose minimum no longer holds after items are removed stops
  // applying (discount computes to 0) but is not silently dropped — the
  // customer is told why in the summary.
  const add = React.useCallback(
    (item: { kind: CartItemKind; slug: string; variantId?: string }, quantity = 1) => {
      const key = entryKey(item.kind, item.slug, item.variantId)
      const entry = catalog.entries[key]
      const max = entry?.availableStock ?? Infinity

      setRefs((prev) => {
        const existing = prev.find((ref) => ref.key === key)
        if (existing) {
          return prev.map((ref) =>
            ref.key === key
              ? { ...ref, quantity: Math.min(ref.quantity + quantity, max) }
              : ref,
          )
        }
        return [
          ...prev,
          {
            key,
            kind: item.kind,
            slug: item.slug,
            variantId: item.variantId,
            quantity: Math.min(quantity, max),
          },
        ]
      })
    },
    [catalog],
  )

  const updateQuantity = React.useCallback(
    (key: string, quantity: number) => {
      setRefs((prev) => {
        if (quantity <= 0) return prev.filter((ref) => ref.key !== key)
        const max = catalog.entries[key]?.availableStock ?? Infinity
        return prev.map((ref) =>
          ref.key === key ? { ...ref, quantity: Math.min(quantity, max) } : ref,
        )
      })
    },
    [catalog],
  )

  const remove = React.useCallback((key: string) => {
    setRefs((prev) => prev.filter((ref) => ref.key !== key))
  }, [])

  const removeUnavailable = React.useCallback(() => {
    setRefs((prev) =>
      prev.filter((ref) => {
        const entry = catalog.entries[ref.key]
        return entry?.isAvailable && (entry.availableStock === null || entry.availableStock > 0)
      }),
    )
  }, [catalog])

  const clear = React.useCallback(() => {
    setRefs([])
    setCoupon(null)
    setCouponMessage(null)
  }, [])

  const applyCoupon = React.useCallback(
    async (code: string) => {
      // Validated server-side so coupon codes never reach the client bundle.
      startCouponTransition(async () => {
        const result = await validateCoupon(code, totals.subtotalPaisa)
        if (result.ok) {
          setCoupon(result.rule)
          setCouponMessage({ ok: true, text: result.message })
        } else {
          setCouponMessage({ ok: false, text: result.message })
        }
      })
    },
    [totals.subtotalPaisa],
  )

  const removeCoupon = React.useCallback(() => {
    setCoupon(null)
    setCouponMessage(null)
  }, [])

  const setCity = React.useCallback((next: string | null) => {
    setCityState(next)
    try {
      if (next) window.localStorage.setItem(CITY_KEY, next)
      else window.localStorage.removeItem(CITY_KEY)
    } catch {
      // Non-fatal.
    }
  }, [])

  const value: CartContextValue = {
    lines,
    totals,
    coupon,
    couponMessage,
    city,
    hydrated,
    couponPending,
    add,
    updateQuantity,
    remove,
    clear,
    removeUnavailable,
    applyCoupon,
    removeCoupon,
    setCity,
    setPaymentMethod,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = React.useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>')
  return ctx
}
