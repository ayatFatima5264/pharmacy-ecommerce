'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, Search, ShieldCheck, ShoppingCart, Truck, X } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { useCart } from '@/features/cart/cart-context'
import { mainNav, siteConfig } from '@/config/site'
import { cn } from '@/lib/utils'

/**
 * The trust bar sits above everything and names the licence. In a market with
 * real counterfeit-medicine concern, legitimacy is what a first-time visitor
 * needs before any product.
 */
function TrustBar() {
  return (
    <div className="hidden border-b border-gray-200 bg-gray-50 md:block">
      <div className="container flex h-8 items-center gap-6 text-caption text-gray-500">
        <span className="flex items-center gap-1.5">
          <Truck className="h-3.5 w-3.5" aria-hidden="true" />
          Free delivery over Rs 2,000
        </span>
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          DRAP-licensed pharmacy · {siteConfig.drapLicense}
        </span>
        <span className="ml-auto">{siteConfig.hours}</span>
      </div>
    </div>
  )
}

function SearchForm({ autoFocus, onSubmit }: { autoFocus?: boolean; onSubmit?: () => void }) {
  const router = useRouter()
  const [query, setQuery] = React.useState('')

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        if (!query.trim()) return
        router.push(`/search?q=${encodeURIComponent(query.trim())}`)
        onSubmit?.()
      }}
      className="relative w-full"
    >
      <label htmlFor="site-search" className="sr-only">
        Search medicines, lab tests, and brands
      </label>
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
        aria-hidden="true"
      />
      <input
        id="site-search"
        type="search"
        autoFocus={autoFocus}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search medicines, tests, brands…"
        className="h-11 w-full rounded-sm border border-gray-200 bg-white pl-10 pr-3.5 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none focus:ring-[3px] focus:ring-blue-100"
      />
    </form>
  )
}

function CartLink({ className }: { className?: string }) {
  const { totals, hydrated } = useCart()
  const itemCount = totals.itemCount
  return (
    <Link
      href="/cart"
      className={cn(
        'relative flex h-11 items-center gap-2 rounded-sm px-3 text-body-sm font-semibold text-gray-700 hover:bg-gray-100',
        className,
      )}
    >
      <ShoppingCart className="h-5 w-5" aria-hidden="true" />
      <span className="hidden lg:inline">Cart</span>
      {/* aria-live so additions are announced to screen readers. */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {hydrated ? `${itemCount} items in cart` : ''}
      </span>
      {hydrated && itemCount > 0 && (
        <span
          className="tabular absolute -right-0.5 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[11px] font-bold text-white"
          aria-hidden="true"
        >
          {itemCount > 99 ? '99+' : itemCount}
        </span>
      )}
    </Link>
  )
}

export function Header() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [searchOpen, setSearchOpen] = React.useState(false)

  // Route change closes any open overlay.
  React.useEffect(() => {
    setMenuOpen(false)
    setSearchOpen(false)
  }, [pathname])

  // Body scroll lock while the mobile menu is open.
  React.useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
      <TrustBar />

      <div className="container flex h-14 items-center gap-3 md:h-16 md:gap-6">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          className="-ml-2 flex h-11 w-11 items-center justify-center rounded-sm text-gray-700 hover:bg-gray-100 md:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>

        <Link href="/" className="flex shrink-0 items-center gap-2 rounded-sm">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-base font-bold text-white">
            S
          </span>
          <span className="text-[17px] font-bold tracking-[-0.015em] text-gray-900">
            {siteConfig.name}
          </span>
        </Link>

        <div className="mx-auto hidden max-w-xl flex-1 md:block">
          <SearchForm />
        </div>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
            className="flex h-11 w-11 items-center justify-center rounded-sm text-gray-700 hover:bg-gray-100 md:hidden"
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </button>
          <CartLink />
        </div>
      </div>

      {/* Category nav — desktop only; mobile reaches these through the menu. */}
      <nav aria-label="Main" className="hidden border-t border-gray-200 md:block">
        <div className="container flex h-12 items-center gap-1">
          {mainNav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-sm px-3 py-2 text-body-sm font-semibold transition-colors duration-fast',
                  active ? 'text-blue-600' : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600',
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Mobile search overlay */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 animate-fade-in bg-white md:hidden">
          <div className="container flex h-14 items-center gap-3">
            <SearchForm autoFocus onSubmit={() => setSearchOpen(false)} />
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              className="shrink-0 rounded-sm p-2 text-body-sm font-semibold text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Mobile menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-gray-900/40"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 flex w-[85%] max-w-sm animate-slide-up flex-col bg-white">
            <div className="flex h-14 items-center justify-between border-b border-gray-200 px-4">
              <span className="font-bold text-gray-900">Menu</span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="flex h-11 w-11 items-center justify-center rounded-sm text-gray-700 hover:bg-gray-100"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="Mobile" className="flex-1 overflow-y-auto p-4">
              <ul className="flex flex-col gap-1">
                {mainNav.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex h-12 items-center rounded-sm px-3 text-body font-semibold text-gray-700 hover:bg-gray-100"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="border-t border-gray-200 p-4">
              {/* An anchor styled as a button — a nested <a> inside <button> is invalid HTML. */}
              <a
                href={`tel:${siteConfig.phone.replace(/\s/g, '')}`}
                className={cn(
                  buttonVariants({ variant: 'secondary', full: true }),
                  'h-11',
                )}
              >
                Call {siteConfig.phone}
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
