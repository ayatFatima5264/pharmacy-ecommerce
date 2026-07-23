import * as React from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Admin-only display primitives. Denser than the storefront equivalents. */

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-gray-900">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-gray-500">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}

type StatTone = 'neutral' | 'success' | 'warning' | 'danger'

/**
 * KPI card: label + value on the left, a soft-tinted icon chip on the right,
 * trend line underneath. Delta strings may lead with ↑ / ↓ — the arrow is
 * translated into a trend icon and color, so existing call sites keep working.
 */
export function StatCard({
  label,
  value,
  delta,
  tone = 'neutral',
  hint,
  icon: Icon,
}: {
  label: string
  value: string
  delta?: string
  tone?: StatTone
  hint?: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  const valueClass = {
    neutral: 'text-gray-900',
    success: 'text-gray-900',
    warning: 'text-amber-700',
    danger: 'text-red-600',
  }[tone]

  const chipClass = {
    neutral: 'bg-blue-50 text-blue-600',
    success: 'bg-green-50 text-green-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-red-50 text-red-600',
  }[tone]

  const up = delta?.startsWith('↑')
  const down = delta?.startsWith('↓')
  const deltaText = delta?.replace(/^[↑↓]\s*/, '')

  return (
    <div className="group rounded-lg border border-gray-200/80 bg-white p-5 shadow-e1 transition-all duration-medium hover:-translate-y-0.5 hover:shadow-e2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold text-gray-500">{label}</p>
          <p
            className={cn(
              'tabular mt-2 text-[26px] font-bold leading-none tracking-[-0.02em]',
              valueClass,
            )}
          >
            {value}
          </p>
        </div>
        {Icon && (
          <span
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-transform duration-medium group-hover:scale-105',
              chipClass,
            )}
            aria-hidden="true"
          >
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>
      {delta && (
        <p className="mt-3 flex items-center gap-1 text-[12.5px] font-semibold">
          {up && <TrendingUp className="h-3.5 w-3.5 text-green-700" aria-hidden="true" />}
          {down && <TrendingDown className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />}
          <span className={up ? 'text-green-700' : down ? 'text-red-600' : 'text-gray-500'}>
            {deltaText}
          </span>
        </p>
      )}
      {hint && !delta && <p className="mt-3 text-[12.5px] text-gray-500">{hint}</p>}
      {hint && delta && <p className="mt-1 text-[12.5px] text-gray-500">{hint}</p>}
    </div>
  )
}

type PillTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral' | 'accent'

/** State reads as form and text, never colour alone. */
export function StatusPill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  const toneClass = {
    success: 'bg-green-50 text-green-700 ring-green-600/20',
    info: 'bg-sky-50 text-sky-700 ring-sky-600/20',
    warning: 'bg-amber-50 text-amber-700 ring-amber-600/25',
    danger: 'bg-red-50 text-red-600 ring-red-600/20',
    neutral: 'bg-gray-100 text-gray-500 ring-gray-400/25',
    accent: 'bg-purple-50 text-purple-700 ring-purple-600/20',
  }[tone]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold leading-none ring-1 ring-inset',
        toneClass,
      )}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  )
}

/** A severity stripe makes a problem row visible before anyone reads it. */
export function SeverityStripe({ tone }: { tone: PillTone }) {
  const toneClass = {
    success: 'bg-green-600',
    info: 'bg-sky-600',
    warning: 'bg-amber-600',
    danger: 'bg-red-600',
    neutral: 'bg-gray-400',
    accent: 'bg-purple-600',
  }[tone]
  return (
    <span
      className={cn('mr-2.5 inline-block h-3.5 w-[3px] shrink-0 rounded-sm align-[-2px]', toneClass)}
      aria-hidden="true"
    />
  )
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'rounded-lg border border-gray-200/80 bg-white shadow-e1 transition-shadow duration-medium hover:shadow-e2',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <h2 className="text-[14px] font-bold tracking-[-0.01em] text-gray-900">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

/**
 * Bar chart drawn with CSS grid rather than a chart library.
 *
 * Fourteen bars do not justify shipping a charting runtime to every admin
 * session — this renders server-side with zero client JS.
 */
export function BarChart({
  data,
  format,
}: {
  data: { label: string; value: number }[]
  format: (value: number) => string
}) {
  const max = Math.max(...data.map((d) => d.value), 1)

  return (
    <div>
      <div
        className="flex h-44 items-end gap-2 border-b border-gray-100"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to top, transparent, transparent calc(25% - 1px), rgb(241 245 249) calc(25% - 1px), rgb(241 245 249) 25%)',
        }}
      >
        {data.map((point) => {
          const heightPercent = Math.max(2, (point.value / max) * 100)
          return (
            <div key={point.label} className="group relative flex h-full flex-1 flex-col items-center justify-end">
              <div
                className="w-full max-w-[24px] rounded-t-[5px] bg-gradient-to-t from-blue-600 to-blue-500 opacity-90 transition-all duration-medium group-hover:opacity-100 group-hover:from-blue-700 group-hover:to-blue-600"
                style={{ height: `${heightPercent}%` }}
              />
              <span className="sr-only">
                {point.label}: {format(point.value)}
              </span>
              <div
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1.5 text-[11.5px] font-semibold text-white shadow-e2 group-hover:block"
              >
                {format(point.value)}
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-2.5 flex gap-2">
        {data.map((point, i) => (
          <span
            key={point.label}
            className="flex-1 text-center text-[10.5px] font-medium text-gray-400"
            aria-hidden="true"
          >
            {/* Every other label, so they never collide on narrow screens. */}
            {i % 2 === 0 ? point.label.split(' ')[0] : ''}
          </span>
        ))}
      </div>
    </div>
  )
}
