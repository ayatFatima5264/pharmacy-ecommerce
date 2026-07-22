import { createHash } from 'node:crypto'

/**
 * Deterministic UUID from a namespaced string (v5-style, sha1-derived).
 *
 * The seed pipeline (scripts/seed-catalog.ts) uses this to turn the
 * scaffold's string ids ('p1', 'v1a', pharmacy names) into stable UUIDs; the
 * app uses the SAME function to address seeded rows (e.g. the main fulfilling
 * pharmacy) without a lookup query. One implementation, imported by both.
 */
export function deterministicId(namespace: string, key: string): string {
  const hex = createHash('sha1').update(`sehat:${namespace}:${key}`).digest('hex').slice(0, 32)
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join('-')
}
