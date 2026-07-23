import * as React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * Layout blocks for the admin console — the vocabulary that turns "a table
 * with filters" into a designed screen: segmented tabs, avatars, empty
 * states, distribution bars, date chips, and detail meta rows.
 *
 * All server-rendered; state lives in the URL, exactly like FilterBar.
 */

/* ------------------------------ SegmentedTabs ---------------------------- */

export interface SegmentedTab {
  label: string
  href: string
  active: boolean
  count?: number
}

/** Shopify-style status tabs. Links, not buttons — every view is shareable. */
export function SegmentedTabs({ tabs, label }: { tabs: SegmentedTab[]; label: string }) {
  return (
    <nav aria-label={label} className="mb-4 overflow-x-auto">
      <ul className="flex w-max min-w-full items-center gap-1 rounded-lg border border-gray-200/80 bg-white p-1 shadow-e1">
        {tabs.map((tab) => (
          <li key={tab.href + tab.label}>
            <Link
              href={tab.href}
              scroll={false}
              aria-current={tab.active ? 'page' : undefined}
              className={cn(
                'flex h-8 items-center gap-2 whitespace-nowrap rounded-md px-3.5 text-[13px] font-semibold transition-colors duration-fast',
                tab.active
                  ? 'bg-blue-600 text-white shadow-e1'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900',
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={cn(
                    'tabular rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none',
                    tab.active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500',
                  )}
                >
                  {tab.count}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/* -------------------------------- Avatar --------------------------------- */

const AVATAR_TINTS = [
  'bg-blue-50 text-blue-700 ring-blue-600/15',
  'bg-sky-50 text-sky-700 ring-sky-600/15',
  'bg-purple-50 text-purple-700 ring-purple-600/15',
  'bg-amber-50 text-amber-700 ring-amber-600/20',
  'bg-green-50 text-green-700 ring-green-600/15',
] as const

/** Initials avatar with a stable per-name tint, so lists read as people. */
export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string
  size?: 'md' | 'lg'
  className?: string
}) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 997
  const tint = AVATAR_TINTS[hash % AVATAR_TINTS.length]

  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-bold ring-1 ring-inset',
        size === 'lg' ? 'h-12 w-12 text-[15px]' : 'h-9 w-9 text-[12px]',
        tint,
        className,
      )}
    >
      {initials}
    </span>
  )
}

/* ------------------------------ EmptyState -------------------------------- */

/** Premium empty state: icon bubble, one-line story, optional action. */
export function AdminEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <div>
        <p className="text-[15px] font-bold text-gray-900">{title}</p>
        {description && (
          <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-gray-500">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

/* ----------------------------- DistributionBar ---------------------------- */

export interface DistributionSegment {
  label: string
  value: number
  colorClass: string // e.g. 'bg-green-600'
}

/** One stacked bar + legend: composition at a glance, no chart library. */
export function DistributionBar({ segments }: { segments: DistributionSegment[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  if (total === 0) return null

  return (
    <div>
      <div className="flex h-2.5 w-full gap-[3px] overflow-hidden rounded-full" role="img"
        aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(', ')}>
        {segments
          .filter((s) => s.value > 0)
          .map((segment) => (
            <span
              key={segment.label}
              className={cn('h-full rounded-full transition-all duration-slow', segment.colorClass)}
              style={{ width: `${(segment.value / total) * 100}%` }}
            />
          ))}
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center gap-1.5 text-[12.5px]">
            <span className={cn('h-2 w-2 rounded-full', segment.colorClass)} aria-hidden="true" />
            <dt className="text-gray-500">{segment.label}</dt>
            <dd className="tabular font-semibold text-gray-900">
              {segment.value.toLocaleString('en-PK')}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/* -------------------------------- DateChip -------------------------------- */

/** Calendar tile for appointment rows — the month/day reads before any text. */
export function DateChip({ date }: { date: string | Date }) {
  const d = new Date(date)
  const month = d.toLocaleDateString('en-PK', { month: 'short' })
  const day = d.getDate()

  return (
    <span
      aria-hidden="true"
      className="flex h-12 w-12 shrink-0 flex-col items-center justify-center overflow-hidden rounded-md border border-gray-200/80 bg-white text-center shadow-e1"
    >
      <span className="w-full bg-blue-600 py-px text-[9.5px] font-bold uppercase tracking-[0.08em] text-white">
        {month}
      </span>
      <span className="tabular flex-1 pt-0.5 text-[17px] font-bold leading-none text-gray-900">
        {day}
      </span>
    </span>
  )
}

/* -------------------------------- MetaItem -------------------------------- */

/** Icon + label + value row for detail pages. */
export function MetaItem({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-50 text-gray-400">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-gray-400">
          {label}
        </p>
        <div className="mt-0.5 text-[13.5px] text-gray-900">{children}</div>
      </div>
    </div>
  )
}
