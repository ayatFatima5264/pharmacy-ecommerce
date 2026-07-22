import 'server-only'
import { entryKey } from './pricing'
import { allProducts, sellableStock } from '@/lib/data/store'
import { adminShippingZones } from '@/lib/data/admin'
import { healthPackages, labTests } from '@/lib/data/catalog'
import { useDb } from '@/lib/data/source'
import { getCartCatalogDb, getDeliverableCitiesDb } from '@/lib/data/db/cart-db'
import type { CartCatalog, CatalogEntry, ShippingZoneSnapshot } from './types'

/**
 * Builds the serializable catalog snapshot the cart resolves prices against.
 *
 * Passed from a Server Component into the client provider, so the cart never
 * trusts a price it persisted earlier. This is the mechanism that makes
 * "prices are read live" actually true rather than merely commented.
 *
 * Database-backed when Supabase is configured (lib/data/db/cart-db.ts);
 * the scaffold below serves machines without a project. Same shape either way.
 */

/**
 * Free delivery is disabled — shipping is always charged normally. Set to 0 so
 * no order subtotal can ever cross the threshold. (The pricing engine keeps
 * threshold support so re-enabling later is a one-line change.)
 */
export const FREE_DELIVERY_THRESHOLD_PAISA = 0

/** Rough dispatch weights. Real values come from product_variants.weight_grams. */
const DEFAULT_WEIGHT_GRAMS = 60
const DEVICE_WEIGHT_GRAMS = 700

export async function getCartCatalog(): Promise<CartCatalog> {
  if (useDb()) return getCartCatalogDb()
  return buildScaffoldCatalog()
}

function buildScaffoldCatalog(): CartCatalog {
  const entries: Record<string, CatalogEntry> = {}

  for (const product of allProducts()) {
    const stock = sellableStock(product.id)

    for (const variant of product.variants) {
      const key = entryKey('product', product.slug, variant.id)
      const isDevice = product.categorySlugs.includes('medical-devices')

      entries[key] = {
        kind: 'product',
        slug: product.slug,
        variantId: variant.id,
        name: product.name,
        subtitle: variant.packSize,
        icon: product.icon,
        unitPricePaisa: variant.pricePaisa,
        compareAtPricePaisa: variant.compareAtPricePaisa,
        requiresPrescription: product.requiresPrescription,
        // Zero-rated today. The engine multiplies through regardless, so
        // switching a category to 17% is a data change, not a code change.
        taxRatePercent: 0,
        weightGrams: isDevice ? DEVICE_WEIGHT_GRAMS : DEFAULT_WEIGHT_GRAMS,
        availableStock: variant.inStock ? stock : 0,
        isAvailable: variant.inStock,
        href: `/products/${product.slug}`,
      }
    }
  }

  for (const test of labTests) {
    entries[entryKey('test', test.slug)] = {
      kind: 'test',
      slug: test.slug,
      name: test.name,
      subtitle: `${test.labName} · Home collection`,
      icon: '🔬',
      unitPricePaisa: test.pricePaisa,
      compareAtPricePaisa: test.compareAtPricePaisa,
      requiresPrescription: false,
      taxRatePercent: 0,
      weightGrams: 0, // Nothing ships for a lab booking.
      availableStock: null, // Not stock-tracked — capacity is a slot, not a unit.
      isAvailable: true,
      href: `/lab-tests/${test.slug}`,
      fastingHours: test.fastingRequired ? (test.fastingHours ?? 8) : null,
    }
  }

  for (const pkg of healthPackages) {
    entries[entryKey('package', pkg.slug)] = {
      kind: 'package',
      slug: pkg.slug,
      name: pkg.name,
      subtitle: `${pkg.labName} · ${pkg.includedTestSlugs.length} tests`,
      icon: pkg.icon,
      unitPricePaisa: pkg.pricePaisa,
      compareAtPricePaisa: pkg.compareAtPricePaisa,
      requiresPrescription: false,
      taxRatePercent: 0,
      weightGrams: 0,
      availableStock: null,
      isAvailable: true,
      href: `/health-packages/${pkg.slug}`,
      // A package inherits the strictest fasting rule among its member tests.
      fastingHours: pkg.fastingRequired
        ? Math.max(
            8,
            ...pkg.includedTestSlugs
              .map((slug) => labTests.find((t) => t.slug === slug))
              .filter((t): t is NonNullable<typeof t> => Boolean(t) && t!.fastingRequired)
              .map((t) => t.fastingHours ?? 8),
          )
        : null,
    }
  }

  const zones: ShippingZoneSnapshot[] = adminShippingZones
    .filter((zone) => zone.isActive)
    .map((zone) => ({
      id: zone.id,
      name: zone.name,
      cities: [...zone.cities],
      carrier: zone.carrier,
      ratePaisa: zone.ratePaisa,
      // Free-above thresholds are ignored storefront-side: no free delivery.
      freeAbovePaisa: null,
      minDays: zone.minDays,
      maxDays: zone.maxDays,
      supportsCod: zone.supportsCod,
      // Stepped tariff above the first kilogram.
      perKgSurchargePaisa: 5_000,
    }))

  return { entries, zones, freeDeliveryThresholdPaisa: FREE_DELIVERY_THRESHOLD_PAISA }
}

/** Cities the cart can quote a delivery estimate for. */
export async function getDeliverableCities(): Promise<string[]> {
  if (useDb()) return getDeliverableCitiesDb()
  return [...new Set(adminShippingZones.filter((z) => z.isActive).flatMap((z) => z.cities))].sort()
}
