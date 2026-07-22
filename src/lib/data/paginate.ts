export const PAGE_SIZE = 12

export interface Paginated<T> {
  rows: T[]
  page: number
  pageCount: number
  total: number
  from: number
  to: number
}

/**
 * In-memory pagination over the dummy data. Becomes `.range(from, to)` with an
 * exact count against Postgres — the returned shape is identical, so the table
 * and pagination components do not change.
 */
export function paginate<T>(items: T[], page: number, pageSize = PAGE_SIZE): Paginated<T> {
  const total = items.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  // Clamp: a hand-edited ?page=999 should show the last page, not an empty one.
  const safePage = Math.min(Math.max(1, page), pageCount)
  const start = (safePage - 1) * pageSize

  return {
    rows: items.slice(start, start + pageSize),
    page: safePage,
    pageCount,
    total,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, total),
  }
}

export function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = Number.parseInt(raw ?? '1', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

export function param(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const value = searchParams[key]
  return (Array.isArray(value) ? value[0] : value) ?? ''
}

/** Case-insensitive match across the given fields. */
export function matchesQuery<T>(row: T, query: string, fields: (keyof T)[]): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return fields.some((field) => String(row[field] ?? '').toLowerCase().includes(q))
}
