/**
 * Code-side slug→icon mapping (decision: no icon column in the database).
 *
 * Resolution order used by the DB mappers (lib/data/db/):
 *   1. The scaffold catalog's own icon for the same slug (content overlay) —
 *      covers every seeded row exactly as the storefront shows it today.
 *   2. This map — for rows created later through the admin console.
 *   3. The kind default.
 */

export const CATEGORY_ICONS: Record<string, string> = {
  'pain-relief': '💊',
  antibiotics: '💊',
  'diabetes-care': '🩸',
  'vitamins-supplements': '🌿',
  'cold-flu': '🤧',
  'digestive-health': '🫁',
  'skin-care': '🧴',
  'medical-devices': '🩺',
}

export const DEFAULT_ICONS = {
  category: '💊',
  product: '💊',
  test: '🔬',
  package: '🩺',
} as const

export function categoryIcon(slug: string): string {
  return CATEGORY_ICONS[slug] ?? DEFAULT_ICONS.category
}
