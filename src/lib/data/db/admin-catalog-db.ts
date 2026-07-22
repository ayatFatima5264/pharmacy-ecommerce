import 'server-only'
import { supabaseService } from '@/lib/supabase/server'
import { deterministicId } from '@/lib/supabase/deterministic-id'
import { uniqueSlug } from '@/lib/data/store'
import { PHARMACIES, EXPIRY_WARNING_DAYS, type AdminProductRow, type BatchRow } from '@/lib/data/admin-catalog'
import { fetchStockMap, getBrandsDb, getCategoriesDb, getProductsDb } from './catalog-db'
import type { ProductParsed } from '@/features/catalog/schemas/product-schema'
import type { Product } from '@/types'

/**
 * Admin catalog + inventory, database-backed: the projections the console
 * lists render from, and the mutations its forms call. Mutations run through
 * the service role, authorized upstream by authorizeAction() — same contract
 * as every admin write.
 *
 * Deviations from the scaffold, on purpose:
 *  - No `inStock` flag to flip: DB availability derives from batches. The
 *    "toggle stock" affordance maps to product is_active (delist/relist).
 *  - Deleting catalog rows with sales history is refused by the database
 *    (RESTRICT FKs). Those refusals surface as "deactivated instead" — a
 *    financial record must keep its references (0009's rule).
 *  - Category emoji icons remain code-side (owner decision, config/icons.ts);
 *    the schema's icon field is accepted from forms but not persisted.
 */

// ---------------------------------------------------------------------------
// Projections
// ---------------------------------------------------------------------------

export async function getAdminProductsDb(): Promise<AdminProductRow[]> {
  const [products, brands, categories, stock] = await Promise.all([
    getProductsDb(),
    getBrandsDb(),
    getCategoriesDb(),
    fetchStockMap(),
  ])
  return products.map((product) => {
    const variant = product.variants[0]
    const totalStock = product.variants.reduce((sum, v) => sum + (stock.get(v.id) ?? 0), 0)
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      icon: product.icon,
      sku: variant?.sku ?? '—',
      brandId: product.brandId,
      brandName: brands.find((b) => b.id === product.brandId)?.name ?? 'Unbranded',
      categoryName:
        categories.find((c) => c.slug === product.categorySlugs[0])?.name ?? 'Uncategorised',
      categorySlugs: product.categorySlugs,
      pricePaisa: variant?.pricePaisa ?? 0,
      compareAtPricePaisa: variant?.compareAtPricePaisa ?? null,
      stock: totalStock,
      requiresPrescription: product.requiresPrescription,
      inStock: totalStock > 0,
      variantCount: product.variants.length,
      imageCount: product.images?.length ?? 0,
    }
  })
}

export async function getAdminCategoriesDb() {
  const [categories, products] = await Promise.all([getCategoriesDb(), getProductsDb()])
  return categories.map((category) => ({
    ...category,
    productCount: products.filter((p) => p.categorySlugs.includes(category.slug)).length,
    childCount: categories.filter((c) => c.parentId === category.id).length,
    parentName: category.parentId
      ? (categories.find((c) => c.id === category.parentId)?.name ?? null)
      : null,
    isActive: true,
  }))
}

export async function getAdminBrandsDb() {
  const [brands, products] = await Promise.all([getBrandsDb(), getProductsDb()])
  return brands.map((brand) => ({
    ...brand,
    productCount: products.filter((p) => p.brandId === brand.id).length,
    isActive: true,
  }))
}

interface BatchDbRow {
  id: string
  batch_number: string
  expiry_date: string
  quantity_on_hand: number
  quantity_reserved: number
  pharmacies: { name: string } | null
  product_variants: { id: string; sku: string; products: { id: string; name: string } | null } | null
}

const BATCH_SELECT = `
  id, batch_number, expiry_date, quantity_on_hand, quantity_reserved,
  pharmacies ( name ),
  product_variants ( id, sku, products ( id, name ) )
`

export async function getBatchRowsDb(now = Date.now()): Promise<BatchRow[]> {
  const { data, error } = await supabaseService().from('inventory_batches').select(BATCH_SELECT)
  if (error) throw new Error(`batches query failed: ${error.message}`)
  const DAY = 86_400_000
  return ((data ?? []) as unknown as BatchDbRow[])
    .map((batch) => {
      const daysToExpiry = Math.round((new Date(batch.expiry_date).getTime() - now) / DAY)
      return {
        id: batch.id,
        batchNumber: batch.batch_number,
        productId: batch.product_variants?.products?.id ?? '',
        productName: batch.product_variants?.products?.name ?? 'Unknown product',
        variantId: batch.product_variants?.id ?? '',
        sku: batch.product_variants?.sku ?? '—',
        pharmacy: batch.pharmacies?.name ?? '—',
        expiryDate: batch.expiry_date,
        quantityOnHand: batch.quantity_on_hand,
        quantityReserved: batch.quantity_reserved,
        daysToExpiry,
        state:
          daysToExpiry <= 0
            ? ('expired' as const)
            : daysToExpiry <= EXPIRY_WARNING_DAYS
              ? ('expiring' as const)
              : ('healthy' as const),
        available: Math.max(0, batch.quantity_on_hand - batch.quantity_reserved),
      }
    })
    .sort((a, b) => a.daysToExpiry - b.daysToExpiry)
}

export async function getInventorySummaryDb(now = Date.now()) {
  const rows = await getBatchRowsDb(now)
  return {
    batchCount: rows.length,
    expired: rows.filter((r) => r.state === 'expired'),
    expiring: rows.filter((r) => r.state === 'expiring'),
    totalUnits: rows.reduce((sum, r) => sum + r.quantityOnHand, 0),
    reservedUnits: rows.reduce((sum, r) => sum + r.quantityReserved, 0),
    unitsAtRisk: rows
      .filter((r) => r.state !== 'healthy')
      .reduce((sum, r) => sum + r.quantityOnHand, 0),
  }
}

export async function getVariantOptionsDb() {
  const products = await getProductsDb()
  return products.map((product) => ({
    productId: product.id,
    productName: product.name,
    variants: product.variants.map((v) => ({ id: v.id, label: `${v.packSize} · ${v.sku}` })),
  }))
}

export async function findProductDb(id: string): Promise<Product | null> {
  return (await getProductsDb()).find((p) => p.id === id) ?? null
}

// ---------------------------------------------------------------------------
// Product mutations
// ---------------------------------------------------------------------------

type MutationResult = { ok: true; id?: string; note?: string } | { ok: false; message: string }

function clinicalInfo(parsed: ProductParsed) {
  return {
    composition: parsed.composition || null,
    side_effects: parsed.sideEffects,
    warnings: parsed.warnings,
  }
}

async function productSlugsDb(): Promise<string[]> {
  const { data, error } = await supabaseService().from('products').select('slug')
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => String(r.slug))
}

async function categoryIdsBySlug(slugs: string[]): Promise<Map<string, string>> {
  const { data, error } = await supabaseService()
    .from('categories')
    .select('id, slug')
    .in('slug', slugs)
  if (error) throw new Error(error.message)
  return new Map((data ?? []).map((r) => [String(r.slug), String(r.id)]))
}

export async function insertProductDb(parsed: ProductParsed): Promise<MutationResult> {
  const db = supabaseService()
  try {
    const slug = uniqueSlug(parsed.slug || parsed.name, await productSlugsDb())

    const { data: product, error } = await db
      .from('products')
      .insert({
        brand_id: parsed.brandId,
        name: parsed.name,
        slug,
        generic_name: parsed.genericName || null,
        description: parsed.description,
        short_description: parsed.shortDescription,
        requires_prescription: parsed.requiresPrescription,
        is_controlled: parsed.isControlled,
        clinical_info: clinicalInfo(parsed),
        dosage_form: parsed.dosageForm || null,
        strength: parsed.strength || null,
        storage_instructions: parsed.storageInstructions || null,
      })
      .select('id')
      .single()
    if (error) return { ok: false, message: error.message }
    const productId = (product as { id: string }).id

    const categories = await categoryIdsBySlug(parsed.categorySlugs)
    const links = parsed.categorySlugs
      .filter((s) => categories.has(s))
      .map((s, i) => ({ product_id: productId, category_id: categories.get(s)!, is_primary: i === 0 }))
    if (links.length) {
      const { error: linkError } = await db.from('product_categories').insert(links)
      if (linkError) return { ok: false, message: linkError.message }
    }

    const { error: variantError } = await db.from('product_variants').insert(
      parsed.variants.map((v) => ({
        product_id: productId,
        sku: v.sku,
        pack_size: v.packSize,
        units_per_pack: v.unitsPerPack,
        price_paisa: v.pricePaisa,
        compare_at_price_paisa: v.compareAtPricePaisa,
        is_active: v.inStock,
      })),
    )
    if (variantError) return { ok: false, message: variantError.message }

    if (parsed.images.length) {
      await db.from('product_images').insert(
        parsed.images.map((img, i) => ({
          product_id: productId,
          url: img.url,
          alt_text: img.alt,
          position: i,
        })),
      )
    }

    return { ok: true, id: productId }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Database error' }
  }
}

export async function updateProductDb(
  existing: Product,
  parsed: ProductParsed,
): Promise<MutationResult> {
  const db = supabaseService()
  try {
    const slug = parsed.slug
      ? uniqueSlug(parsed.slug, (await productSlugsDb()).filter((s) => s !== existing.slug))
      : existing.slug

    const { error } = await db
      .from('products')
      .update({
        brand_id: parsed.brandId,
        name: parsed.name,
        slug,
        generic_name: parsed.genericName || null,
        description: parsed.description,
        short_description: parsed.shortDescription,
        requires_prescription: parsed.requiresPrescription,
        is_controlled: parsed.isControlled,
        clinical_info: clinicalInfo(parsed),
        dosage_form: parsed.dosageForm || null,
        strength: parsed.strength || null,
        storage_instructions: parsed.storageInstructions || null,
      })
      .eq('id', existing.id)
    if (error) return { ok: false, message: error.message }

    // Category links: replace the set (tiny table, simplest correct move).
    await db.from('product_categories').delete().eq('product_id', existing.id)
    const categories = await categoryIdsBySlug(parsed.categorySlugs)
    const links = parsed.categorySlugs
      .filter((s) => categories.has(s))
      .map((s, i) => ({ product_id: existing.id, category_id: categories.get(s)!, is_primary: i === 0 }))
    if (links.length) await db.from('product_categories').insert(links)

    // Variants: update by id, insert the new, deactivate the removed. Removed
    // variants are DEACTIVATED, not deleted — order_items and batches hold
    // RESTRICT references, and history beats tidiness.
    let note: string | undefined
    const keptIds = new Set<string>()
    for (const v of parsed.variants) {
      if (v.id && existing.variants.some((ev) => ev.id === v.id)) {
        keptIds.add(v.id)
        const { error: vError } = await db
          .from('product_variants')
          .update({
            sku: v.sku,
            pack_size: v.packSize,
            units_per_pack: v.unitsPerPack,
            price_paisa: v.pricePaisa,
            compare_at_price_paisa: v.compareAtPricePaisa,
            is_active: v.inStock,
          })
          .eq('id', v.id)
        if (vError) return { ok: false, message: `Variant ${v.sku}: ${vError.message}` }
      } else {
        const { error: vError } = await db.from('product_variants').insert({
          product_id: existing.id,
          sku: v.sku,
          pack_size: v.packSize,
          units_per_pack: v.unitsPerPack,
          price_paisa: v.pricePaisa,
          compare_at_price_paisa: v.compareAtPricePaisa,
          is_active: v.inStock,
        })
        if (vError) return { ok: false, message: `Variant ${v.sku}: ${vError.message}` }
      }
    }
    const removed = existing.variants.filter((ev) => !keptIds.has(ev.id))
    for (const gone of removed) {
      await db.from('product_variants').update({ is_active: false }).eq('id', gone.id)
    }
    if (removed.length) note = `${removed.length} removed pack size(s) were deactivated (kept for order history).`

    // Images: replace the set.
    await db.from('product_images').delete().eq('product_id', existing.id)
    if (parsed.images.length) {
      await db.from('product_images').insert(
        parsed.images.map((img, i) => ({
          product_id: existing.id,
          url: img.url,
          alt_text: img.alt,
          position: i,
        })),
      )
    }

    return { ok: true, id: existing.id, note }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Database error' }
  }
}

/**
 * Delete, falling back to deactivation when the database refuses: a product
 * referenced by orders or batches is a record, not a row to tidy away.
 */
export async function deleteProductDb(productId: string): Promise<
  { ok: true; deactivated: boolean } | { ok: false; message: string }
> {
  const db = supabaseService()

  // Clear zero-quantity batches first (they RESTRICT variant deletion).
  const { data: variants } = await db
    .from('product_variants')
    .select('id')
    .eq('product_id', productId)
  const variantIds = ((variants ?? []) as { id: string }[]).map((v) => v.id)
  if (variantIds.length) {
    await db
      .from('inventory_batches')
      .delete()
      .in('variant_id', variantIds)
      .eq('quantity_on_hand', 0)
      .eq('quantity_reserved', 0)
  }

  const { error } = await db.from('products').delete().eq('id', productId)
  if (!error) return { ok: true, deactivated: false }

  // RESTRICT (foreign key) — sales or stock history exists. Deactivate.
  if (error.code === '23503' || /foreign key/i.test(error.message)) {
    const { error: deactivateError } = await db
      .from('products')
      .update({ is_active: false })
      .eq('id', productId)
    if (deactivateError) return { ok: false, message: deactivateError.message }
    return { ok: true, deactivated: true }
  }
  return { ok: false, message: error.message }
}

/** The "toggle stock" affordance in DB mode: delist/relist the product. */
export async function setProductActiveDb(productId: string, active: boolean): Promise<void> {
  await supabaseService().from('products').update({ is_active: active }).eq('id', productId)
}

// ---------------------------------------------------------------------------
// Taxonomy mutations
// ---------------------------------------------------------------------------

export async function saveCategoryDb(
  categoryId: string | null,
  input: { name: string; slug?: string; description: string; parentId?: string | null },
): Promise<MutationResult> {
  const db = supabaseService()
  const { data: existingRows } = await db.from('categories').select('id, slug')
  const slugs = ((existingRows ?? []) as { id: string; slug: string }[])
    .filter((r) => r.id !== categoryId)
    .map((r) => r.slug)
  const slug = uniqueSlug(input.slug || input.name, slugs)

  const row = {
    name: input.name,
    slug,
    description: input.description,
    parent_id: input.parentId || null,
  }
  const { data, error } = categoryId
    ? await db.from('categories').update(row).eq('id', categoryId).select('id').single()
    : await db.from('categories').insert(row).select('id').single()
  if (error) return { ok: false, message: error.message }
  return { ok: true, id: (data as { id: string }).id }
}

export async function deleteCategoryDb(categoryId: string): Promise<{ ok: boolean; reason?: string }> {
  const db = supabaseService()
  const [{ count: children }, { count: products }] = await Promise.all([
    db.from('categories').select('id', { count: 'exact', head: true }).eq('parent_id', categoryId),
    db
      .from('product_categories')
      .select('product_id', { count: 'exact', head: true })
      .eq('category_id', categoryId),
  ])
  if (children) return { ok: false, reason: 'This category has sub-categories. Move or delete them first.' }
  if (products) return { ok: false, reason: 'Products still use this category. Reassign them first.' }
  const { error } = await db.from('categories').delete().eq('id', categoryId)
  if (error) return { ok: false, reason: error.message }
  return { ok: true }
}

export async function saveBrandDb(
  brandId: string | null,
  input: { name: string; slug?: string },
): Promise<MutationResult> {
  const db = supabaseService()
  const { data: existingRows } = await db.from('brands').select('id, slug')
  const slugs = ((existingRows ?? []) as { id: string; slug: string }[])
    .filter((r) => r.id !== brandId)
    .map((r) => r.slug)
  const slug = uniqueSlug(input.slug || input.name, slugs)

  const { data, error } = brandId
    ? await db.from('brands').update({ name: input.name, slug }).eq('id', brandId).select('id').single()
    : await db.from('brands').insert({ name: input.name, slug }).select('id').single()
  if (error) return { ok: false, message: error.message }
  return { ok: true, id: (data as { id: string }).id }
}

export async function deleteBrandDb(brandId: string): Promise<{ ok: boolean; reason?: string }> {
  const db = supabaseService()
  const { count } = await db
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', brandId)
  if (count) return { ok: false, reason: 'Products still use this brand. Reassign them first.' }
  const { error } = await db.from('brands').delete().eq('id', brandId)
  if (error) return { ok: false, reason: error.message }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Inventory mutations (every change writes the stock_movements ledger)
// ---------------------------------------------------------------------------

export async function createBatchDb(input: {
  variantId: string
  batchNumber: string
  pharmacyName: string
  expiryDate: string
  quantityOnHand: number
}): Promise<MutationResult> {
  const db = supabaseService()
  const pharmacyId = PHARMACIES.includes(input.pharmacyName as (typeof PHARMACIES)[number])
    ? deterministicId('pharmacy', input.pharmacyName)
    : null
  if (!pharmacyId) return { ok: false, message: 'Unknown branch.' }

  const { data, error } = await db
    .from('inventory_batches')
    .insert({
      pharmacy_id: pharmacyId,
      variant_id: input.variantId,
      batch_number: input.batchNumber,
      expiry_date: input.expiryDate,
      quantity_on_hand: input.quantityOnHand,
    })
    .select('id')
    .single()
  if (error) return { ok: false, message: error.message }
  const batchId = (data as { id: string }).id

  if (input.quantityOnHand > 0) {
    await db.from('stock_movements').insert({
      batch_id: batchId,
      quantity: input.quantityOnHand,
      reason: 'purchase',
      reference_type: 'intake',
    })
  }
  return { ok: true, id: batchId }
}

export async function adjustStockDb(input: {
  batchId: string
  delta: number
  reason: 'purchase' | 'return' | 'damage' | 'expiry' | 'adjustment'
  note: string | null
}): Promise<MutationResult> {
  const db = supabaseService()
  const { data: batch, error: findError } = await db
    .from('inventory_batches')
    .select('quantity_on_hand, quantity_reserved')
    .eq('id', input.batchId)
    .maybeSingle()
  if (findError || !batch) return { ok: false, message: 'That batch no longer exists.' }

  const row = batch as { quantity_on_hand: number; quantity_reserved: number }
  const next = row.quantity_on_hand + input.delta
  if (next < 0) return { ok: false, message: 'Stock cannot go below zero.' }
  if (next < row.quantity_reserved)
    return { ok: false, message: `Cannot go below the ${row.quantity_reserved} reserved units.` }

  const { error } = await db
    .from('inventory_batches')
    .update({ quantity_on_hand: next })
    .eq('id', input.batchId)
  if (error) return { ok: false, message: error.message }

  await db.from('stock_movements').insert({
    batch_id: input.batchId,
    quantity: input.delta,
    reason: input.reason,
    reference_type: 'adjustment',
    notes: input.note,
  })
  return { ok: true }
}

export async function deleteBatchDb(batchId: string): Promise<MutationResult> {
  const db = supabaseService()
  const { error } = await db.from('inventory_batches').delete().eq('id', batchId)
  if (!error) return { ok: true }
  if (error.code === '23503' || /foreign key/i.test(error.message)) {
    return {
      ok: false,
      message: 'This batch has movement or order history — write it off instead of deleting.',
    }
  }
  return { ok: false, message: error.message }
}

export async function writeOffBatchDb(batchId: string): Promise<MutationResult> {
  const db = supabaseService()
  const { data: batch } = await db
    .from('inventory_batches')
    .select('quantity_on_hand, quantity_reserved')
    .eq('id', batchId)
    .maybeSingle()
  if (!batch) return { ok: false, message: 'That batch no longer exists.' }
  const row = batch as { quantity_on_hand: number; quantity_reserved: number }
  if (row.quantity_reserved > 0)
    return { ok: false, message: 'Units are reserved against open orders — resolve those first.' }
  if (row.quantity_on_hand === 0) return { ok: true }

  const { error } = await db
    .from('inventory_batches')
    .update({ quantity_on_hand: 0 })
    .eq('id', batchId)
  if (error) return { ok: false, message: error.message }

  await db.from('stock_movements').insert({
    batch_id: batchId,
    quantity: -row.quantity_on_hand,
    reason: 'expiry',
    reference_type: 'write_off',
  })
  return { ok: true }
}
