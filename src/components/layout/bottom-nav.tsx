'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Microscope, Package, ShoppingCart } from 'lucide-react'
import { useCart } from '@/features/cart/cart-context'
import { cn } from '@/lib/utils'

const items = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/pharmacy', label: 'Pharmacy', icon: Package },
  { href: '/lab-tests', label: 'Lab Tests', icon: Microscope },
  { href: '/cart', label: 'Cart', icon: ShoppingCart },
]

/**
 * Thumb-reachable primary navigation. Hidden on checkout — removing exits from
 * the funnel is deliberate.
 */
export function BottomNav() {
  const pathname = usePathname()
  const { totals, hydrated } = useCart()
  const itemCount = totals.itemCount

  if (pathname.startsWith('/checkout')) return null

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgb(15_23_42_/_0.06)] md:hidden"
    >
      <ul className="flex">
        {items.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors duration-fast',
                  active ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700',
                )}
              >
                {active && (
                  <span
                    className="absolute inset-x-1/4 top-0 h-[3px] rounded-b-full bg-blue-600"
                    aria-hidden="true"
                  />
                )}
                <span className="relative">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  {item.href === '/cart' && hydrated && itemCount > 0 && (
                    <span
                      className="tabular absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white"
                      aria-hidden="true"
                    >
                      {itemCount > 9 ? '9+' : itemCount}
                    </span>
                  )}
                </span>
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
