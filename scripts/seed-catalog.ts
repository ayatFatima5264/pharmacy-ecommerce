/**
 * Seeds the demo catalog into a live Supabase project. Idempotent — rows are
 * upserted on their natural keys (slug / sku / batch identity), so re-running
 * updates rather than duplicates.
 *
 * Source of truth: the SAME data the in-memory scaffold serves
 * (src/lib/data/catalog.ts, admin.ts, lab-store.ts) — the storefront's Step 4
 * flip from scaffold to database must not change what customers see.
 *
 * String ids like 'p1' / 'v1a' become DETERMINISTIC UUIDs (sha1-derived), so
 * cross-references (brand→product→variant→batch) survive re-runs and future
 * partial seeds without a lookup table.
 *
 * Run with a configured .env.local:
 *   npm run seed:catalog
 *
 * NOT seeded on purpose:
 *  - coupons (checkout treats couponless-DB coupons as code-only until the
 *    admin coupon module lands)
 *  - emoji icons on categories/products (presentation concern; Step 4 maps
 *    slug→icon in code, where the design system owns it)
 *  - demo orders/customers (fabricated history does not belong in a real DB)
 */
import './load-env'
import { createClient } from '@supabase/supabase-js'
import { deterministicId as uid } from '../src/lib/supabase/deterministic-id'
import { brands, categories, products, labTests, healthPackages } from '../src/lib/data/catalog'
import { adminBatches, adminCoupons, adminShippingZones } from '../src/lib/data/admin'
import { PHARMACIES } from '../src/lib/data/admin-catalog'
import { SLOT_TEMPLATES, HOME_COLLECTION_CITIES } from '../src/lib/data/lab-store'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

/** Phlebotomist capacity per city (mirrors lab-store's private map). */
const SLOT_CAPACITY: Record<string, number> = {
  Karachi: 8, Lahore: 8, Islamabad: 6, Rawalpindi: 5, Faisalabad: 4,
  Multan: 4, Peshawar: 3, Hyderabad: 3, Quetta: 2, Sialkot: 2,
}

async function main() {
  if (!url || !serviceKey) {
    console.error('seed-catalog: Supabase env vars missing (see .env.example).')
    process.exit(1)
  }
  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const step = async (label: string, fn: () => Promise<number>) => {
    const count = await fn()
    console.log(`  ok  ${label} (${count})`)
  }

  console.log('Seeding catalog...\n')

  // --- Pharmacies (branches; the first is the fulfilling "main" branch) -----
  await step('pharmacies', async () => {
    const rows = PHARMACIES.map((name, i) => ({
      id: uid('pharmacy', name),
      name,
      slug: slugify(name),
      drap_license_no: `DRAP-${1000 + i}`,
      license_expiry: '2027-12-31',
      phone: '+9221111734728',
      line1: name.split('—')[1]?.trim() ?? name,
      city: name.split('—')[0]?.trim() ?? 'Karachi',
      province: 'Sindh',
    }))
    const { error } = await db.from('pharmacies').upsert(rows, { onConflict: 'slug' })
    if (error) throw new Error(`pharmacies: ${error.message}`)
    return rows.length
  })

  // --- Brands & categories --------------------------------------------------
  await step('brands', async () => {
    const rows = brands.map((b) => ({ id: uid('brand', b.id), name: b.name, slug: b.slug }))
    const { error } = await db.from('brands').upsert(rows, { onConflict: 'slug' })
    if (error) throw new Error(`brands: ${error.message}`)
    return rows.length
  })

  await step('categories', async () => {
    const rows = categories.map((c) => ({
      id: uid('category', c.id),
      parent_id: c.parentId ? uid('category', c.parentId) : null,
      name: c.name,
      slug: c.slug,
      description: c.description,
    }))
    const { error } = await db.from('categories').upsert(rows, { onConflict: 'slug' })
    if (error) throw new Error(`categories: ${error.message}`)
    return rows.length
  })

  // --- Products, variants, category links, images ---------------------------
  await step('products', async () => {
    const rows = products.map((p) => ({
      id: uid('product', p.id),
      brand_id: uid('brand', p.brandId),
      name: p.name,
      slug: p.slug,
      generic_name: p.genericName,
      description: p.description,
      short_description: p.shortDescription,
      requires_prescription: p.requiresPrescription,
      dosage_form: p.dosageForm,
      strength: p.strength,
      storage_instructions: p.storageInstructions,
      clinical_info: {
        composition: p.composition,
        side_effects: p.sideEffects,
        warnings: p.warnings,
      },
    }))
    const { error } = await db.from('products').upsert(rows, { onConflict: 'slug' })
    if (error) throw new Error(`products: ${error.message}`)
    return rows.length
  })

  await step('product_categories', async () => {
    const rows = products.flatMap((p) =>
      p.categorySlugs.map((slug, i) => {
        const category = categories.find((c) => c.slug === slug)
        if (!category) throw new Error(`product ${p.slug}: unknown category ${slug}`)
        return {
          product_id: uid('product', p.id),
          category_id: uid('category', category.id),
          is_primary: i === 0,
        }
      }),
    )
    const { error } = await db
      .from('product_categories')
      .upsert(rows, { onConflict: 'product_id,category_id' })
    if (error) throw new Error(`product_categories: ${error.message}`)
    return rows.length
  })

  await step('product_variants', async () => {
    const rows = products.flatMap((p) =>
      p.variants.map((v) => ({
        id: uid('variant', v.id),
        product_id: uid('product', p.id),
        sku: v.sku,
        pack_size: v.packSize,
        units_per_pack: v.unitsPerPack,
        price_paisa: v.pricePaisa,
        compare_at_price_paisa: v.compareAtPricePaisa,
      })),
    )
    const { error } = await db.from('product_variants').upsert(rows, { onConflict: 'sku' })
    if (error) throw new Error(`product_variants: ${error.message}`)
    return rows.length
  })

  await step('product_images', async () => {
    const rows = products.flatMap((p) =>
      (p.images ?? []).map((img, i) => ({
        id: uid('image', `${p.id}:${i}`),
        product_id: uid('product', p.id),
        url: img.url,
        alt_text: img.alt,
        position: i,
      })),
    )
    if (rows.length === 0) return 0
    const { error } = await db.from('product_images').upsert(rows, { onConflict: 'id' })
    if (error) throw new Error(`product_images: ${error.message}`)
    return rows.length
  })

  // --- Stock batches --------------------------------------------------------
  // quantity_reserved seeds as 0: reservations belong to real orders, and a
  // fresh database has none. Movements start from the order flow, not seeds.
  await step('inventory_batches', async () => {
    const rows = adminBatches.map((b) => ({
      id: uid('batch', b.id),
      pharmacy_id: uid('pharmacy', b.pharmacy),
      variant_id: uid('variant', b.variantId),
      batch_number: b.batchNumber,
      expiry_date: b.expiryDate,
      quantity_on_hand: b.quantityOnHand,
      quantity_reserved: 0,
    }))
    const { error } = await db
      .from('inventory_batches')
      .upsert(rows, { onConflict: 'pharmacy_id,variant_id,batch_number' })
    if (error) throw new Error(`inventory_batches: ${error.message}`)
    return rows.length
  })

  // --- Diagnostics: labs, tests, pricing, packages --------------------------
  const labNames = [...new Set([...labTests, ...healthPackages].map((t) => t.labName))]
  await step('labs', async () => {
    const rows = labNames.map((name) => ({
      id: uid('lab', name),
      name,
      slug: slugify(name),
      phone: '+9221111456789',
      city: 'Karachi',
    }))
    const { error } = await db.from('labs').upsert(rows, { onConflict: 'slug' })
    if (error) throw new Error(`labs: ${error.message}`)
    return rows.length
  })

  await step('lab_tests + pricing', async () => {
    const rows = labTests.map((t) => ({
      id: uid('test', t.id),
      name: t.name,
      slug: t.slug,
      short_code: t.shortCode,
      description: t.description,
      sample_type: t.sampleType,
      fasting_required: t.fastingRequired,
      fasting_hours: t.fastingHours,
      turnaround_hours: t.turnaroundHours,
    }))
    const { error } = await db.from('lab_tests').upsert(rows, { onConflict: 'slug' })
    if (error) throw new Error(`lab_tests: ${error.message}`)

    const pricing = labTests.map((t) => ({
      id: uid('pricing', t.id),
      lab_id: uid('lab', t.labName),
      test_id: uid('test', t.id),
      price_paisa: t.pricePaisa,
      home_collection_fee_paisa: t.homeCollectionFeePaisa,
    }))
    const { error: pricingError } = await db
      .from('lab_test_pricing')
      .upsert(pricing, { onConflict: 'lab_id,test_id' })
    if (pricingError) throw new Error(`lab_test_pricing: ${pricingError.message}`)
    return rows.length
  })

  await step('health_packages', async () => {
    const rows = healthPackages.map((p) => ({
      id: uid('package', p.id),
      lab_id: uid('lab', p.labName),
      name: p.name,
      slug: p.slug,
      description: p.description,
      price_paisa: p.pricePaisa,
      compare_at_price_paisa: p.compareAtPricePaisa,
      fasting_required: p.fastingRequired,
      turnaround_hours: p.turnaroundHours,
    }))
    const { error } = await db.from('health_packages').upsert(rows, { onConflict: 'slug' })
    if (error) throw new Error(`health_packages: ${error.message}`)

    const members = healthPackages.flatMap((p) =>
      p.includedTestSlugs.map((slug) => {
        const test = labTests.find((t) => t.slug === slug)
        if (!test) throw new Error(`package ${p.slug}: unknown test ${slug}`)
        return { package_id: uid('package', p.id), test_id: uid('test', test.id) }
      }),
    )
    const { error: memberError } = await db
      .from('health_package_tests')
      .upsert(members, { onConflict: 'package_id,test_id' })
    if (memberError) throw new Error(`health_package_tests: ${memberError.message}`)
    return rows.length
  })

  // --- Collection slots: next 14 days, per city, per daypart ---------------
  await step('collection_slots', async () => {
    const labId = uid('lab', labNames[0])
    const rows: Record<string, unknown>[] = []
    for (let day = 1; day <= 14; day++) {
      const date = new Date()
      date.setDate(date.getDate() + day)
      const slotDate = date.toISOString().slice(0, 10)
      for (const city of HOME_COLLECTION_CITIES) {
        for (const template of SLOT_TEMPLATES) {
          rows.push({
            id: uid('slot', `${labId}:${city}:${slotDate}:${template.id}`),
            lab_id: labId,
            city,
            slot_date: slotDate,
            starts_at: `${String(template.startHour).padStart(2, '0')}:00`,
            ends_at: `${String(template.startHour + 2).padStart(2, '0')}:00`,
            capacity: SLOT_CAPACITY[city] ?? 2,
          })
        }
      }
    }
    // ignoreDuplicates: existing slots keep their booked_count — a re-seed
    // must never reset live bookings.
    const { error } = await db.from('collection_slots').upsert(rows, {
      onConflict: 'lab_id,city,slot_date,starts_at',
      ignoreDuplicates: true,
    })
    if (error) throw new Error(`collection_slots: ${error.message}`)
    return rows.length
  })

  // --- Shipping: one zone + one method + stepped weight-band rates ---------
  const PER_KG_SURCHARGE_PAISA = 5_000
  await step('shipping zones/methods/rates', async () => {
    let rates = 0
    for (const zone of adminShippingZones) {
      const zoneId = uid('zone', zone.id)
      const methodId = uid('method', zone.id)

      const { error: zoneError } = await db
        .from('shipping_zones')
        .upsert({ id: zoneId, name: zone.name, is_active: zone.isActive }, { onConflict: 'id' })
      if (zoneError) throw new Error(`shipping_zones: ${zoneError.message}`)

      const areas = zone.cities.map((city) => ({
        id: uid('area', `${zone.id}:${city}`),
        zone_id: zoneId,
        city,
      }))
      const { error: areaError } = await db
        .from('shipping_zone_areas')
        .upsert(areas, { onConflict: 'id' })
      if (areaError) throw new Error(`shipping_zone_areas: ${areaError.message}`)

      const { error: methodError } = await db.from('shipping_methods').upsert(
        {
          id: methodId,
          name: `${zone.carrier} — ${zone.name}`,
          carrier: zone.carrier,
          min_days: zone.minDays,
          max_days: zone.maxDays,
          supports_cod: zone.supportsCod,
          is_active: zone.isActive,
        },
        { onConflict: 'id' },
      )
      if (methodError) throw new Error(`shipping_methods: ${methodError.message}`)

      // Stepped tariff mirroring the cart engine: base rate for the first kg,
      // +surcharge per additional kg, open-ended top band.
      const bands = Array.from({ length: 10 }, (_, i) => ({
        id: uid('rate', `${zone.id}:${i}`),
        zone_id: zoneId,
        method_id: methodId,
        min_weight_grams: i * 1000,
        max_weight_grams: i === 9 ? null : (i + 1) * 1000,
        rate_paisa: zone.ratePaisa + i * PER_KG_SURCHARGE_PAISA,
        free_above_paisa: zone.freeAbovePaisa,
      }))
      const { error: rateError } = await db
        .from('shipping_rates')
        .upsert(bands, { onConflict: 'id' })
      if (rateError) throw new Error(`shipping_rates: ${rateError.message}`)
      rates += bands.length
    }
    return adminShippingZones.length * 2 + rates
  })

  // --- Coupons (demo set; discount split per 0008's typed columns) ----------
  await step('coupons', async () => {
    const rows = adminCoupons.map((c) => ({
      id: uid('coupon', c.id),
      code: c.code.toUpperCase(),
      discount_type: c.discountType,
      discount_percent: c.discountType === 'percentage' ? c.discountValue : null,
      // Scaffold stores fixed discounts in RUPEES; the database stores paisa.
      discount_amount_paisa: c.discountType === 'fixed_amount' ? c.discountValue * 100 : null,
      min_order_paisa: c.minOrderPaisa,
      // The 0008 CHECK: a discount cap is only meaningful on percentage coupons.
      max_discount_paisa: c.discountType === 'percentage' ? c.maxDiscountPaisa : null,
      usage_limit: c.usageLimit,
      starts_at: c.startsAt,
      expires_at: c.expiresAt,
      is_active: c.isActive,
    }))
    const { error } = await db.from('coupons').upsert(rows, { onConflict: 'code' })
    if (error) throw new Error(`coupons: ${error.message}`)
    return rows.length
  })

  console.log('\nseed-catalog: done. The storefront data now exists in Postgres.')
}

main().catch((error) => {
  console.error('seed-catalog failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
