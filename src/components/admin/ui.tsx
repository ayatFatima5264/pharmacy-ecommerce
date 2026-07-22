import * as React from 'react'
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
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-gray-900">
          {title}
        </h1>
        {description && <p className="mt-1.5 max-w-2xl text-[13.5px] text-gray-500">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 gap-2">{action}</div>}
    </div>
  )
}

export function StatCard({
  label,
  value,
  delta,
  tone = 'neutral',
  hint,
}: {
  label: string
  value: string
  delta?: string
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
  hint?: string
}) {
  const toneClass = {
    neutral: 'text-gray-900',
    success: 'text-green-700',
    warning: 'text-amber-700',
    danger: 'text-red-600',
  }[tone]

  return (
    <div className="rounded-md border border-gray-200 bg-white p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-gray-500">{label}</p>
      <p className={cn('tabular mt-1.5 text-[23px] font-bold tracking-[-0.02em]', toneClass)}>
        {value}
      </p>
      {delta && <p className="mt-0.5 text-[12.5px] text-green-700">{delta}</p>}
      {hint && <p className="mt-0.5 text-[12.5px] text-gray-500">{hint}</p>}
    </div>
  )
}

type PillTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral'

/** State reads as form and text, never colour alone. */
export function StatusPill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  const toneClass = {
    success: 'bg-green-50 text-green-700',
    info: 'bg-blue-50 text-blue-700',
    warning: 'bg-amber-600/[0.12] text-amber-700',
    danger: 'bg-red-50 text-red-600',
    neutral: 'bg-gray-100 text-gray-500',
  }[tone]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold',
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
    info: 'bg-blue-600',
    warning: 'bg-amber-600',
    danger: 'bg-red-600',
    neutral: 'bg-gray-400',
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
    <section className={cn('rounded-md border border-gray-200 bg-white', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
        <h2 className="text-[14px] font-bold text-gray-900">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
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
      <div className="flex h-44 items-end gap-1.5">
        {data.map((point) => {
          const heightPercent = Math.max(2, (point.value / max) * 100)
          return (
            <div key={point.label} className="group relative flex flex-1 flex-col justify-end">
              <div
                className="rounded-t-sm bg-blue-600/85 transition-colors duration-fast group-hover:bg-blue-700"
                style={{ height: `${heightPercent}%` }}
              />
              <span className="sr-only">
                {point.label}: {format(point.value)}
              </span>
              <div
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-sm bg-gray-900 px-2 py-1 text-[11.5px] font-semibold text-white group-hover:block"
              >
                {format(point.value)}
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex gap-1.5">
        {data.map((point, i) => (
          <span
            key={point.label}
            className="flex-1 text-center text-[10.5px] text-gray-400"
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
