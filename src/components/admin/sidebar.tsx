'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ExternalLink, Menu, X } from 'lucide-react'
import { adminNav, type AdminBadgeKey } from '@/config/admin-nav'
import { siteConfig } from '@/config/site'
import { cn } from '@/lib/utils'

type Badges = Partial<Record<AdminBadgeKey, number>>

function NavLinks({ badges, onNavigate }: { badges: Badges; onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Admin" className="flex flex-col gap-5 p-3">
      {adminNav.map((section, index) => (
        <div key={section.group ?? `section-${index}`}>
          {section.group && (
            <h2 className="mb-1.5 px-3 text-[10.5px] font-bold uppercase tracking-[0.09em] text-gray-400">
              {section.group}
            </h2>
          )}
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const exact = 'exact' in item && item.exact
              const active = exact ? pathname === item.href : pathname.startsWith(item.href)
              const Icon = item.icon
              const badgeKey = 'badge' in item ? (item.badge as AdminBadgeKey) : undefined
              const count = badgeKey ? badges[badgeKey] : undefined

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-9 items-center gap-2.5 rounded-sm px-3 py-1.5 text-[13.5px] font-medium transition-colors duration-fast',
                      active
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900',
                    )}
                  >
                    <Icon
                      className={cn('h-4 w-4 shrink-0', active ? 'text-white' : 'text-gray-400')}
                      aria-hidden="true"
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    {count !== undefined && count > 0 && (
                      <span
                        className={cn(
                          'tabular flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold',
                          active ? 'bg-white/20 text-white' : 'bg-amber-600/[0.15] text-amber-700',
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

export function AdminSidebar({ badges }: { badges: Badges }) {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => setOpen(false), [pathname])

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-gray-200 bg-white px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open admin menu"
          aria-expanded={open}
          className="-ml-2 flex h-10 w-10 items-center justify-center rounded-sm text-gray-700 hover:bg-gray-100"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <Brand />
      </header>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-gray-200 bg-white lg:flex">
        <div className="flex h-14 items-center border-b border-gray-200 px-4">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavLinks badges={badges} />
        </div>
        <StoreLink />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-gray-900/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white">
            <div className="flex h-14 items-center justify-between border-b border-gray-200 px-4">
              <Brand />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close admin menu"
                className="flex h-10 w-10 items-center justify-center rounded-sm text-gray-700 hover:bg-gray-100"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NavLinks badges={badges} onNavigate={() => setOpen(false)} />
            </div>
            <StoreLink />
          </div>
        </div>
      )}
    </>
  )
}

function Brand() {
  return (
    <Link href="/admin" className="flex items-center gap-2 rounded-sm">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-[13px] font-bold text-white">
        S
      </span>
      <span className="text-[14px] font-bold tracking-[-0.01em] text-gray-900">
        {siteConfig.name}
      </span>
      <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.05em] text-gray-500">
        Admin
      </span>
    </Link>
  )
}

function StoreLink() {
  return (
    <div className="border-t border-gray-200 p-3">
      <Link
        href="/"
        className="flex min-h-9 items-center gap-2.5 rounded-sm px-3 py-1.5 text-[13px] font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900"
      >
        <ExternalLink className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
        View storefront
      </Link>
    </div>
  )
}
