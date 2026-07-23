'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, ExternalLink, Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { adminNav, type AdminBadgeKey, type AdminNavItem } from '@/config/admin-nav'
import { siteConfig } from '@/config/site'
import { cn } from '@/lib/utils'

type Badges = Partial<Record<AdminBadgeKey, number>>

/**
 * Dark console navigation (gray-900 = #0F172A) with a teal active pill, one
 * level of sub-items (Products → All / Add / Bulk Edit / Import), and a
 * collapsible icon-only mode. Nav data lives in config/admin-nav.ts; the
 * collapsed width is published as a CSS variable so the layout's padding
 * follows without a re-render.
 */

const RAIL_EXPANDED = '16rem'
const RAIL_COLLAPSED = '5rem'
const STORAGE_KEY = 'admin-sidebar-collapsed'

function childActive(pathname: string, child: { href: string; exact?: boolean }) {
  return child.exact ? pathname === child.href : pathname.startsWith(child.href)
}

function itemActive(pathname: string, item: AdminNavItem) {
  if (item.exact) return pathname === item.href
  if (pathname.startsWith(item.href)) return true
  return item.children?.some((child) => childActive(pathname, child)) ?? false
}

function NavEntry({
  item,
  badges,
  collapsed,
  onNavigate,
}: {
  item: AdminNavItem
  badges: Badges
  collapsed: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const active = itemActive(pathname, item)
  const hasChildren = Boolean(item.children?.length)
  // Sub-menus open themselves when one of their pages is active.
  const [open, setOpen] = React.useState(active)
  React.useEffect(() => {
    if (active) setOpen(true)
  }, [active])

  const Icon = item.icon
  const count = item.badge ? badges[item.badge] : undefined

  return (
    <li>
      <div className="flex items-center gap-1">
        <Link
          href={item.href}
          onClick={onNavigate}
          title={collapsed ? item.label : undefined}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'group flex min-h-9 flex-1 items-center gap-3 rounded-md px-3 py-2 text-[13.5px] font-medium transition-all duration-medium',
            collapsed && 'justify-center px-0',
            active
              ? 'bg-blue-600 font-semibold text-white shadow-[0_4px_12px_rgb(15_118_110_/_0.35)]'
              : 'text-white/60 hover:bg-white/[0.06] hover:text-white',
            !active && !collapsed && 'hover:translate-x-0.5',
          )}
        >
          <Icon
            className={cn(
              'h-4 w-4 shrink-0 transition-colors duration-medium',
              active ? 'text-white' : 'text-white/40 group-hover:text-white/80',
            )}
            aria-hidden="true"
          />
          {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
          {!collapsed && count !== undefined && count > 0 && (
            <span
              className={cn(
                'tabular flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold',
                active ? 'bg-white/20 text-white' : 'bg-amber-600 text-white',
              )}
            >
              {count}
            </span>
          )}
        </Link>

        {hasChildren && !collapsed && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={`${open ? 'Collapse' : 'Expand'} ${item.label} menu`}
            className="flex h-8 w-7 shrink-0 items-center justify-center rounded-md text-white/40 transition-colors duration-fast hover:bg-white/[0.06] hover:text-white"
          >
            <ChevronDown
              className={cn('h-3.5 w-3.5 transition-transform duration-medium', open && 'rotate-180')}
              aria-hidden="true"
            />
          </button>
        )}
      </div>

      {hasChildren && open && !collapsed && (
        <ul className="ml-[1.35rem] mt-1 flex flex-col gap-0.5 border-l border-white/10 pl-3">
          {item.children!.map((child) => {
            const isActive = childActive(pathname, child)
            return (
              <li key={child.href + child.label}>
                <Link
                  href={child.href}
                  onClick={onNavigate}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex min-h-8 items-center rounded-md px-2.5 py-1.5 text-[12.5px] font-medium transition-all duration-medium',
                    isActive
                      ? 'bg-white/[0.08] font-semibold text-white'
                      : 'text-white/50 hover:translate-x-0.5 hover:bg-white/[0.05] hover:text-white',
                  )}
                >
                  {child.label}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}

function NavLinks({
  badges,
  collapsed = false,
  onNavigate,
}: {
  badges: Badges
  collapsed?: boolean
  onNavigate?: () => void
}) {
  return (
    <nav aria-label="Admin" className={cn('flex flex-col gap-6 py-4', collapsed ? 'px-3' : 'px-3')}>
      {adminNav.map((section, index) => (
        <div key={section.group ?? `section-${index}`}>
          {section.group && !collapsed && (
            <h2 className="mb-2 px-3 text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/35">
              {section.group}
            </h2>
          )}
          {section.group && collapsed && (
            <div className="mx-auto mb-2 h-px w-6 bg-white/10" aria-hidden="true" />
          )}
          <ul className="flex flex-col gap-1">
            {section.items.map((item) => (
              <NavEntry
                key={item.href + item.label}
                item={item}
                badges={badges}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

export function AdminSidebar({ badges }: { badges: Badges }) {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const [collapsed, setCollapsed] = React.useState(false)

  React.useEffect(() => setOpen(false), [pathname])

  // Publish the rail width as a CSS variable so the server-rendered layout's
  // left padding follows the collapse state with a pure CSS transition.
  React.useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) === '1'
    setCollapsed(stored)
    document.documentElement.style.setProperty('--admin-rail', stored ? RAIL_COLLAPSED : RAIL_EXPANDED)
  }, [])

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current
      window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      document.documentElement.style.setProperty('--admin-rail', next ? RAIL_COLLAPSED : RAIL_EXPANDED)
      return next
    })
  }

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 bg-gray-900 px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open admin menu"
          aria-expanded={open}
          className="-ml-2 flex h-10 w-10 items-center justify-center rounded-md text-white/70 transition-colors duration-fast hover:bg-white/10 hover:text-white"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <Brand />
      </header>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 hidden flex-col bg-gray-900 transition-[width] duration-slow lg:flex',
          collapsed ? 'w-20' : 'w-64',
        )}
      >
        <div
          className={cn(
            'flex h-16 shrink-0 items-center border-b border-white/[0.08]',
            collapsed ? 'justify-center px-2' : 'justify-between px-4',
          )}
        >
          {collapsed ? <BrandMark /> : <Brand />}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/50 transition-colors duration-fast hover:bg-white/10 hover:text-white',
              collapsed && 'absolute right-1 top-[4.5rem]',
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
        <div
          className={cn(
            'flex-1 overflow-y-auto [scrollbar-color:rgb(255_255_255_/_0.15)_transparent] [scrollbar-width:thin]',
            collapsed && 'pt-8',
          )}
        >
          <NavLinks badges={badges} collapsed={collapsed} />
        </div>
        <StoreLink collapsed={collapsed} />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-gray-900/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 flex w-64 animate-slide-up flex-col bg-gray-900">
            <div className="flex h-14 items-center justify-between border-b border-white/[0.08] px-4">
              <Brand />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close admin menu"
                className="flex h-10 w-10 items-center justify-center rounded-md text-white/70 transition-colors duration-fast hover:bg-white/10 hover:text-white"
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

function BrandMark() {
  return (
    <Link href="/admin" aria-label="Admin dashboard" className="rounded-md">
      <Image
        src={siteConfig.logo}
        alt=""
        width={36}
        height={36}
        className="h-9 w-9 shrink-0 rounded-md bg-white/95 object-contain p-0.5"
      />
    </Link>
  )
}

function Brand() {
  return (
    <Link href="/admin" className="flex min-w-0 items-center gap-2.5 rounded-md">
      <Image
        src={siteConfig.logo}
        alt=""
        width={36}
        height={36}
        className="h-9 w-9 shrink-0 rounded-md bg-white/95 object-contain p-0.5"
      />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-[13.5px] font-bold tracking-[-0.01em] text-white">
          {siteConfig.name}
        </span>
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-blue-500">
          Admin Console
        </span>
      </span>
    </Link>
  )
}

function StoreLink({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="border-t border-white/[0.08] p-3">
      <Link
        href="/"
        title={collapsed ? 'View storefront' : undefined}
        className={cn(
          'flex min-h-9 items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium text-white/50 transition-colors duration-medium hover:bg-white/[0.06] hover:text-white',
          collapsed && 'justify-center px-0',
        )}
      >
        <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
        {!collapsed && 'View storefront'}
      </Link>
    </div>
  )
}
