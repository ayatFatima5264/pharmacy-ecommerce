import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Money is stored as integer paisa everywhere (see docs/DATABASE.md §3).
 * Formatting to a display string happens only here.
 */
export function formatPrice(paisa: number): string {
  const rupees = paisa / 100
  return `Rs ${rupees.toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: rupees % 1 === 0 ? 0 : 2,
  })}`
}

export function discountPercent(price: number, compareAt: number | null): number | null {
  if (!compareAt || compareAt <= price) return null
  return Math.round(((compareAt - price) / compareAt) * 100)
}

/** Per-unit price, shown on multi-unit packs so sizes are comparable. */
export function formatUnitPrice(paisa: number, units: number | null): string | null {
  if (!units || units <= 1) return null
  return `${formatPrice(Math.round(paisa / units))} per unit`
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-PK', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Karachi',
  })
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('en-PK', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Karachi',
  })
}

/** Delivery estimate, skipping Sundays. */
export function deliveryEstimate(daysFromNow = 2): string {
  const d = new Date()
  let added = 0
  while (added < daysFromNow) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() !== 0) added++
  }
  return formatDate(d)
}

export function turnaroundLabel(hours: number): string {
  if (hours <= 24) return 'Report in 24 hours'
  if (hours <= 48) return 'Report in 48 hours'
  return `Report in ${Math.round(hours / 24)} days`
}
