'use client'

import * as React from 'react'

/**
 * Wishlist — deliberately CLIENT-ONLY (localStorage). Saving products for
 * later is a browsing convenience, not commerce state: no backend, no
 * account requirement, nothing to sync. If it ever needs to follow the
 * customer across devices, a `wishlists` table becomes its own feature.
 */

const STORAGE_KEY = 'arms-wishlist-v1'

function readStorage(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : []
  } catch {
    return []
  }
}

export function useWishlist() {
  const [slugs, setSlugs] = React.useState<string[]>([])
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    setSlugs(readStorage())
    setHydrated(true)
    // Keep multiple tabs in sync.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setSlugs(readStorage())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const toggle = React.useCallback((slug: string) => {
    setSlugs((current) => {
      const next = current.includes(slug)
        ? current.filter((s) => s !== slug)
        : [...current, slug]
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Private mode / quota — the in-memory list still works for the session.
      }
      return next
    })
  }, [])

  const has = React.useCallback((slug: string) => slugs.includes(slug), [slugs])

  return { slugs, count: slugs.length, has, toggle, hydrated }
}
