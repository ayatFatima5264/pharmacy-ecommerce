import 'server-only'
import { cache } from 'react'
import { entryKey } from '@/features/cart/pricing'
import { supabaseService } from '@/lib/supabase/server'
import { DEFAULT_ICONS } from '@/config/icons'
import {
  healthPackages as scaffoldPackages,
  products as scaffoldProducts,
} from '@/lib/data/catalog'
import { fetchStockMap, getProductsDb } from './catalog-db'
import type { CartCatalog, CatalogEntry, ShippingZoneSnapshot } from '@/features/cart/types'

/**
 * Database-backed cart pricing snapshot — same shape, same rules as the
 * scaffold version in features/cart/catalog-snapshot.ts, sourced from
 * Postgres. This is what makes DB prices and DB stock authoritative for
 * every cart total and for checkout re-pricing.
 */

// Free delivery is disabled — shipping is always charged normally.
export const FREE_DELIVERY_THRESHOLD_PAISA = 0
const DEFAULT_WEIGHT_GRAMS = 60
const DEVICE_WEIGHT_GRAMS = 700
const FALLBACK_PER_KG_SURCHARGE_PAISA = 5_000

const scaffoldProductIcon = new Map(scaffoldProducts.map((p) => [p.slug, p.icon]))
const scaffoldPackageIcon = new Map(scaffoldPackages.map((p) => [p.slug, p.icon]))

interface TestRow {
  slug: string
  name: string
  fasting_required: boolean
  fasting_hours: number | null
  is_active: boolean
  lab_test_pricing: {
    price_paisa: number
    is_available: boolean
    labs: { name: string } | null
  }[]
}

interface PackageRow {
  slug: string
  name: string
  price_paisa: number
  compare_at_price_paisa: number | null
  fasting_required: boolean
  is_active: boolean
  labs: { name: string } | null
  health_package_tests: {
    lab_tests: { fasting_required: boolean; fasting_hours: number | null } | null
  }[]
}

interface RateRow {
  zone_id: string
  min_weight_grams: number
  rate_paisa: number
  free_above_paisa: number | null
  shipping_zones: {
    id: string
    name: string
    is_active: boolean
    shipping_zone_areas: { city: string }[]
  } | null
  shipping_methods: {
    carrier: string
    min_days: number
    max_days: number
    supports_cod: boolean
  } | null
}

export const getCartCatalogDb = cache(async (): Promise<CartCatalog> => {
  const db = supabaseService()
  const [products, stock, testsResult, packagesResult, ratesResult] = await Promise.all([
    getProductsDb(),
    fetchStockMap(),
    db
      .from('lab_tests')
      .select(
        'slug, name, fasting_required, fasting_hours, is_active, lab_test_pricing ( price_paisa, is_available, labs ( name ) )',
      )
      .eq('is_active', true),
    db
      .from('health_packages')
      .select(
        'slug, name, price_paisa, compare_at_price_paisa, fasting_required, is_active, labs ( name ), health_package_tests ( lab_tests ( fasting_required, fasting_hours ) )',
      )
      .eq('is_active', true),
    db
      .from('shipping_rates')
      .select(
        'zone_id, min_weight_grams, rate_paisa, free_above_paisa, shipping_zones ( id, name, is_active, shipping_zone_areas ( city ) ), shipping_methods ( carrier, min_days, max_days, supports_cod )',
      )
      .eq('is_active', true),
  ])
  if (testsResult.error) throw new Error(`lab_tests query failed: ${testsResult.error.message}`)
  if (packagesResult.error)
    throw new Error(`health_packages query failed: ${packagesResult.error.message}`)
  if (ratesResult.error)
    throw new Error(`shipping_rates query failed: ${ratesResult.error.message}`)

  const entries: Record<string, CatalogEntry> = {}

  for (const product of products) {
    const isDevice = product.categorySlugs.includes('medical-devices')
    for (const variant of product.variants) {
      entries[entryKey('product', product.slug, variant.id)] = {
        kind: 'product',
        slug: product.slug,
        variantId: variant.id,
        name: product.name,
        subtitle: variant.packSize,
        icon: scaffoldProductIcon.get(product.slug) ?? product.icon,
        unitPricePaisa: variant.pricePaisa,
        compareAtPricePaisa: variant.compareAtPricePaisa,
        requiresPrescription: product.requiresPrescription,
        taxRatePercent: 0,
        weightGrams: isDevice ? DEVICE_WEIGHT_GRAMS : DEFAULT_WEIGHT_GRAMS,
        // Exact sellable units, so the cart's "only N left" capping matches
        // what reserve_stock will actually allow at checkout.
        availableStock: stock.get(variant.id) ?? 0,
        isAvailable: variant.inStock,
        href: `/products/${product.slug}`,
      }
    }
  }

  for (const test of (testsResult.data ?? []) as unknown as TestRow[]) {
    const pricing = test.lab_test_pricing.find((p) => p.is_available)
    if (!pricing) continue // A test no lab offers is not sellable.
    entries[entryKey('test', test.slug)] = {
      kind: 'test',
      slug: test.slug,
      name: test.name,
      subtitle: `${pricing.labs?.name ?? 'Partner lab'} · Home collection`,
      icon: DEFAULT_ICONS.test,
      unitPricePaisa: pricing.price_paisa,
      compareAtPricePaisa: null,
      requiresPrescription: false,
      taxRatePercent: 0,
      weightGrams: 0,
      availableStock: null,
      isAvailable: true,
      href: `/lab-tests/${test.slug}`,
      fastingHours: test.fasting_required ? (test.fasting_hours ?? 8) : null,
    }
  }

  for (const pkg of (packagesResult.data ?? []) as unknown as PackageRow[]) {
    const memberFasting = pkg.health_package_tests
      .map((m) => m.lab_tests)
      .filter((t): t is NonNullable<typeof t> => Boolean(t?.fasting_required))
      .map((t) => t.fasting_hours ?? 8)
    entries[entryKey('package', pkg.slug)] = {
      kind: 'package',
      slug: pkg.slug,
      name: pkg.name,
      subtitle: `${pkg.labs?.name ?? 'Partner lab'} · ${pkg.health_package_tests.length} tests`,
      icon: scaffoldPackageIcon.get(pkg.slug) ?? DEFAULT_ICONS.package,
      unitPricePaisa: pkg.price_paisa,
      compareAtPricePaisa: pkg.compare_at_price_paisa,
      requiresPrescription: false,
      taxRatePercent: 0,
      weightGrams: 0,
      availableStock: null,
      isAvailable: true,
      href: `/health-packages/${pkg.slug}`,
      fastingHours: pkg.fasting_required ? Math.max(8, ...memberFasting) : null,
    }
  }

  // Reassemble zone snapshots from the banded tariff: the lowest band is the
  // base rate; the step to the next band is the per-kg surcharge.
  const zoneMap = new Map<string, { snapshot: ShippingZoneSnapshot; bands: RateRow[] }>()
  for (const rate of (ratesResult.data ?? []) as unknown as RateRow[]) {
    if (!rate.shipping_zones?.is_active || !rate.shipping_methods) continue
    let zone = zoneMap.get(rate.zone_id)
    if (!zone) {
      zone = {
        snapshot: {
          id: rate.shipping_zones.id,
          name: rate.shipping_zones.name,
          cities: rate.shipping_zones.shipping_zone_areas.map((a) => a.city),
          carrier: rate.shipping_methods.carrier,
          ratePaisa: 0,
          // Free-above thresholds are ignored storefront-side: no free delivery.
          freeAbovePaisa: null,
          minDays: rate.shipping_methods.min_days,
          maxDays: rate.shipping_methods.max_days,
          supportsCod: rate.shipping_methods.supports_cod,
          perKgSurchargePaisa: FALLBACK_PER_KG_SURCHARGE_PAISA,
        },
        bands: [],
      }
      zoneMap.set(rate.zone_id, zone)
    }
    zone.bands.push(rate)
  }
  const zones: ShippingZoneSnapshot[] = [...zoneMap.values()].map(({ snapshot, bands }) => {
    const sorted = bands.slice().sort((a, b) => a.min_weight_grams - b.min_weight_grams)
    snapshot.ratePaisa = sorted[0]?.rate_paisa ?? 0
    if (sorted.length > 1) {
      snapshot.perKgSurchargePaisa = Math.max(0, sorted[1].rate_paisa - sorted[0].rate_paisa)
    }
    return snapshot
  })

  return { entries, zones, freeDeliveryThresholdPaisa: FREE_DELIVERY_THRESHOLD_PAISA }
})

export async function getDeliverableCitiesDb(): Promise<string[]> {
  const { zones } = await getCartCatalogDb()
  return [...new Set(zones.flatMap((z) => z.cities))].sort()
}
