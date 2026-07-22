import 'server-only'
import * as XLSX from 'xlsx'
import { supabaseService } from '@/lib/supabase/server'
import { slugify } from '@/lib/data/store'
import { mainPharmacyId } from '@/lib/data/db/catalog-db'

/**
 * Excel import engine, lean V1 of docs/IMPORT-PRODUCTS.md /
 * IMPORT-LAB-TESTS.md. Two phases, both admin-triggered:
 *
 *   stage:  parse the workbook, validate every row, store rows with their
 *           action (create / update / error) and messages. Nothing touches
 *           the catalog.
 *   commit: apply valid rows one by one; each row succeeds or fails alone.
 *
 * Semantics that matter:
 *   - Upsert key: products by SKU, lab tests by test_code (short_code).
 *   - UPDATES touch only the columns present in the file — a sheet with just
 *     `sku` and `price` is exactly the bulk price-update path.
 *   - `stock` is INTAKE (units received), ledgered as a purchase into a new
 *     dated batch — never a silent absolute overwrite of on-hand counts.
 *   - Unknown brands/categories are auto-created with a warning.
 *
 * Guardrails: ≤5 MB, ≤2000 rows (single-request budget; the chunked/cron
 * variant of blueprint W8 arrives when catalog size demands it).
 */

export const MAX_FILE_BYTES = 5 * 1024 * 1024
export const MAX_ROWS = 2000

export type ImportType = 'products' | 'lab_tests'

export interface RowMessage {
  level: 'error' | 'warning'
  message: string
}

interface StagedRow {
  rowNumber: number
  raw: Record<string, unknown>
  action: 'create' | 'update' | 'error'
  messages: RowMessage[]
}

const PRODUCT_COLUMNS = [
  'sku', 'product_name', 'brand', 'categories', 'price', 'sale_price',
  'stock', 'rx_required', 'description', 'pack_size',
] as const

const LAB_COLUMNS = [
  'test_code', 'test_name', 'price', 'sample_type', 'fasting_hours',
  'report_hours', 'home_collection',
] as const

export const TEMPLATE_COLUMNS: Record<ImportType, readonly string[]> = {
  products: PRODUCT_COLUMNS,
  lab_tests: LAB_COLUMNS,
}

// --- Parsing helpers --------------------------------------------------------

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function text(row: Record<string, unknown>, key: string): string | undefined {
  const value = row[key]
  if (value === undefined || value === null) return undefined
  const s = String(value).trim()
  return s === '' ? undefined : s
}

function rupeesToPaisa(value: string): number | null {
  const n = Number(value.replace(/[,\s]/g, ''))
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

function boolish(value: string): boolean | null {
  const v = value.toLowerCase()
  if (['yes', 'y', 'true', '1'].includes(v)) return true
  if (['no', 'n', 'false', '0'].includes(v)) return false
  return null
}

export function parseWorkbook(buffer: ArrayBuffer): {
  rows: Record<string, unknown>[]
  headers: string[]
} {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) return { rows: [], headers: [] }
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null })
  const rows = rawRows.map((row) =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [normalizeHeader(k), v])),
  )
  const headers = rows.length ? Object.keys(rows[0]) : []
  return { rows, headers }
}

// --- Staging (parse + validate) ---------------------------------------------

export async function stageImport(input: {
  type: ImportType
  filename: string
  buffer: ArrayBuffer
  createdBy: string
}): Promise<{ importId: string; totals: Record<string, number> } | { error: string }> {
  const { rows, headers } = parseWorkbook(input.buffer)
  if (rows.length === 0) return { error: 'The file has no data rows.' }
  if (rows.length > MAX_ROWS) return { error: `Too many rows (${rows.length}). The limit is ${MAX_ROWS}.` }

  const known = TEMPLATE_COLUMNS[input.type]
  const unknown = headers.filter((h) => !known.includes(h))

  const staged =
    input.type === 'products' ? await stageProducts(rows) : await stageLabTests(rows)

  // File-level warning about ignored columns, attached to row 1.
  if (unknown.length && staged[0]) {
    staged[0].messages.push({
      level: 'warning',
      message: `Ignored unknown column(s): ${unknown.join(', ')}`,
    })
  }

  const totals = {
    rows: staged.length,
    creates: staged.filter((r) => r.action === 'create').length,
    updates: staged.filter((r) => r.action === 'update').length,
    errors: staged.filter((r) => r.action === 'error').length,
  }

  const db = supabaseService()
  const { data: importRow, error } = await db
    .from('imports')
    .insert({
      type: input.type,
      filename: input.filename,
      totals,
      created_by: input.createdBy,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }
  const importId = (importRow as { id: string }).id

  const { error: rowsError } = await db.from('import_rows').insert(
    staged.map((r) => ({
      import_id: importId,
      row_number: r.rowNumber,
      raw: r.raw,
      action: r.action,
      messages: r.messages,
    })),
  )
  if (rowsError) return { error: rowsError.message }

  return { importId, totals }
}

async function stageProducts(rows: Record<string, unknown>[]): Promise<StagedRow[]> {
  const db = supabaseService()
  const [{ data: variants }, { data: brands }, { data: categories }] = await Promise.all([
    db.from('product_variants').select('sku'),
    db.from('brands').select('slug'),
    db.from('categories').select('slug'),
  ])
  const knownSkus = new Set(((variants ?? []) as { sku: string }[]).map((v) => String(v.sku).toUpperCase()))
  const knownBrands = new Set(((brands ?? []) as { slug: string }[]).map((b) => String(b.slug)))
  const knownCategories = new Set(((categories ?? []) as { slug: string }[]).map((c) => String(c.slug)))
  const seenInFile = new Set<string>()

  return rows.map((raw, i) => {
    const messages: RowMessage[] = []
    const sku = text(raw, 'sku')?.toUpperCase()

    if (!sku) {
      messages.push({ level: 'error', message: 'sku is required' })
      return { rowNumber: i + 1, raw, action: 'error' as const, messages }
    }
    if (seenInFile.has(sku)) {
      messages.push({ level: 'error', message: `duplicate sku ${sku} earlier in this file` })
      return { rowNumber: i + 1, raw, action: 'error' as const, messages }
    }
    seenInFile.add(sku)

    const exists = knownSkus.has(sku)
    const price = text(raw, 'price')
    const salePrice = text(raw, 'sale_price')
    const stock = text(raw, 'stock')
    const rx = text(raw, 'rx_required')

    if (!exists) {
      // Creates need the full identity of a product.
      for (const required of ['product_name', 'brand', 'categories', 'price'] as const) {
        if (!text(raw, required)) messages.push({ level: 'error', message: `${required} is required to create ${sku}` })
      }
    }
    if (price !== undefined && rupeesToPaisa(price) === null)
      messages.push({ level: 'error', message: `price "${price}" is not a valid amount` })
    if (salePrice !== undefined) {
      const sale = rupeesToPaisa(salePrice)
      const base = price !== undefined ? rupeesToPaisa(price) : null
      if (sale === null) messages.push({ level: 'error', message: `sale_price "${salePrice}" is not valid` })
      else if (base !== null && sale >= base)
        messages.push({ level: 'error', message: 'sale_price must be below price' })
    }
    if (stock !== undefined && (!Number.isInteger(Number(stock)) || Number(stock) < 0))
      messages.push({ level: 'error', message: `stock "${stock}" must be a whole number ≥ 0` })
    if (rx !== undefined && boolish(rx) === null)
      messages.push({ level: 'warning', message: `rx_required "${rx}" not understood — ignored` })

    const brand = text(raw, 'brand')
    if (brand && !knownBrands.has(slugify(brand)))
      messages.push({ level: 'warning', message: `brand "${brand}" will be created` })
    for (const c of (text(raw, 'categories') ?? '').split('|').map((s) => s.trim()).filter(Boolean)) {
      if (!knownCategories.has(slugify(c)))
        messages.push({ level: 'warning', message: `category "${c}" will be created` })
    }

    const hasError = messages.some((m) => m.level === 'error')
    return {
      rowNumber: i + 1,
      raw,
      action: hasError ? ('error' as const) : exists ? ('update' as const) : ('create' as const),
      messages,
    }
  })
}

async function stageLabTests(rows: Record<string, unknown>[]): Promise<StagedRow[]> {
  const db = supabaseService()
  const { data: tests } = await db.from('lab_tests').select('short_code')
  const knownCodes = new Set(
    ((tests ?? []) as { short_code: string | null }[])
      .map((t) => t.short_code?.toUpperCase())
      .filter((c): c is string => Boolean(c)),
  )
  const seenInFile = new Set<string>()

  return rows.map((raw, i) => {
    const messages: RowMessage[] = []
    const code = text(raw, 'test_code')?.toUpperCase()

    if (!code) {
      messages.push({ level: 'error', message: 'test_code is required' })
      return { rowNumber: i + 1, raw, action: 'error' as const, messages }
    }
    if (seenInFile.has(code)) {
      messages.push({ level: 'error', message: `duplicate test_code ${code} earlier in this file` })
      return { rowNumber: i + 1, raw, action: 'error' as const, messages }
    }
    seenInFile.add(code)

    const exists = knownCodes.has(code)
    if (!exists) {
      for (const required of ['test_name', 'price'] as const) {
        if (!text(raw, required)) messages.push({ level: 'error', message: `${required} is required to create ${code}` })
      }
    }
    const price = text(raw, 'price')
    if (price !== undefined && rupeesToPaisa(price) === null)
      messages.push({ level: 'error', message: `price "${price}" is not a valid amount` })
    const fasting = text(raw, 'fasting_hours')
    if (fasting !== undefined && (!Number.isInteger(Number(fasting)) || Number(fasting) < 0))
      messages.push({ level: 'error', message: `fasting_hours "${fasting}" must be a whole number` })

    const hasError = messages.some((m) => m.level === 'error')
    return {
      rowNumber: i + 1,
      raw,
      action: hasError ? ('error' as const) : exists ? ('update' as const) : ('create' as const),
      messages,
    }
  })
}

// --- Commit ------------------------------------------------------------------

export async function commitImport(importId: string): Promise<
  { committed: number; failed: number } | { error: string }
> {
  const db = supabaseService()
  const { data: importRow } = await db
    .from('imports')
    .select('id, type, status')
    .eq('id', importId)
    .maybeSingle()
  if (!importRow) return { error: 'Import not found.' }
  const meta = importRow as { id: string; type: ImportType; status: string }
  if (meta.status !== 'ready') return { error: 'This import has already been committed.' }

  const { data: rowsData } = await db
    .from('import_rows')
    .select('id, row_number, raw, action')
    .eq('import_id', importId)
    .neq('action', 'error')
    .order('row_number')
  const rows = (rowsData ?? []) as { id: number; row_number: number; raw: Record<string, unknown>; action: string }[]

  let committed = 0
  let failed = 0
  for (const row of rows) {
    const result =
      meta.type === 'products' ? await commitProductRow(row.raw) : await commitLabTestRow(row.raw)
    if ('error' in result) {
      failed++
      await db
        .from('import_rows')
        .update({ status: 'failed', result: result.error })
        .eq('id', row.id)
    } else {
      committed++
      await db
        .from('import_rows')
        .update({ status: 'committed', result: result.note })
        .eq('id', row.id)
    }
  }

  await db
    .from('imports')
    .update({
      status: 'completed',
      committed_at: new Date().toISOString(),
      totals: { committed, failed },
    })
    .eq('id', importId)

  return { committed, failed }
}

async function ensureBrand(name: string): Promise<string> {
  const db = supabaseService()
  const slug = slugify(name)
  const { data } = await db.from('brands').select('id').eq('slug', slug).maybeSingle()
  if (data) return (data as { id: string }).id
  const { data: created, error } = await db
    .from('brands')
    .insert({ name, slug })
    .select('id')
    .single()
  if (error) throw new Error(`brand "${name}": ${error.message}`)
  return (created as { id: string }).id
}

async function ensureCategory(name: string): Promise<string> {
  const db = supabaseService()
  const slug = slugify(name)
  const { data } = await db.from('categories').select('id').eq('slug', slug).maybeSingle()
  if (data) return (data as { id: string }).id
  const { data: created, error } = await db
    .from('categories')
    .insert({ name, slug, description: `${name} products` })
    .select('id')
    .single()
  if (error) throw new Error(`category "${name}": ${error.message}`)
  return (created as { id: string }).id
}

async function commitProductRow(
  raw: Record<string, unknown>,
): Promise<{ note: string } | { error: string }> {
  const db = supabaseService()
  try {
    const sku = text(raw, 'sku')!.toUpperCase()
    const price = text(raw, 'price')
    const salePrice = text(raw, 'sale_price')
    const stock = text(raw, 'stock')

    const { data: variantRow } = await db
      .from('product_variants')
      .select('id, product_id')
      .eq('sku', sku)
      .maybeSingle()

    let variantId: string
    const notes: string[] = []

    if (variantRow) {
      // UPDATE: only the columns present in the file.
      const variant = variantRow as { id: string; product_id: string }
      variantId = variant.id
      const patch: Record<string, unknown> = {}
      if (price !== undefined) patch.price_paisa = rupeesToPaisa(price)
      const pack = text(raw, 'pack_size')
      if (pack) patch.pack_size = pack
      // Sale model: sale_price becomes the live price; the regular price (when
      // provided) becomes the struck-through compare-at.
      if (salePrice !== undefined) {
        patch.price_paisa = rupeesToPaisa(salePrice)
        if (price !== undefined) patch.compare_at_price_paisa = rupeesToPaisa(price)
      }
      if (Object.keys(patch).length) {
        const { error } = await db.from('product_variants').update(patch).eq('id', variantId)
        if (error) return { error: error.message }
        notes.push('variant updated')
      }
      const productPatch: Record<string, unknown> = {}
      const name = text(raw, 'product_name')
      const description = text(raw, 'description')
      const rx = text(raw, 'rx_required')
      if (name) productPatch.name = name
      if (description) productPatch.description = description
      if (rx && boolish(rx) !== null) productPatch.requires_prescription = boolish(rx)
      if (Object.keys(productPatch).length) {
        const { error } = await db.from('products').update(productPatch).eq('id', variant.product_id)
        if (error) return { error: error.message }
        notes.push('product updated')
      }
    } else {
      // CREATE
      const name = text(raw, 'product_name')!
      const brandId = await ensureBrand(text(raw, 'brand')!)
      const categoryNames = (text(raw, 'categories') ?? '').split('|').map((s) => s.trim()).filter(Boolean)
      const basePaisa = rupeesToPaisa(price!)!
      const salePaisa = salePrice !== undefined ? rupeesToPaisa(salePrice) : null

      const { data: slugRows } = await db.from('products').select('slug')
      const taken = ((slugRows ?? []) as { slug: string }[]).map((r) => String(r.slug))
      let slug = slugify(name)
      let n = 2
      while (taken.includes(slug)) slug = `${slugify(name)}-${n++}`

      const { data: product, error: productError } = await db
        .from('products')
        .insert({
          name,
          slug,
          brand_id: brandId,
          description: text(raw, 'description') ?? name,
          short_description: (text(raw, 'description') ?? name).slice(0, 180),
          requires_prescription: boolish(text(raw, 'rx_required') ?? 'no') ?? false,
        })
        .select('id')
        .single()
      if (productError) return { error: productError.message }
      const productId = (product as { id: string }).id

      for (const [i, categoryName] of categoryNames.entries()) {
        const categoryId = await ensureCategory(categoryName)
        await db
          .from('product_categories')
          .upsert(
            { product_id: productId, category_id: categoryId, is_primary: i === 0 },
            { onConflict: 'product_id,category_id' },
          )
      }

      const { data: variant, error: variantError } = await db
        .from('product_variants')
        .insert({
          product_id: productId,
          sku,
          pack_size: text(raw, 'pack_size') ?? 'Each',
          price_paisa: salePaisa ?? basePaisa,
          compare_at_price_paisa: salePaisa !== null ? basePaisa : null,
        })
        .select('id')
        .single()
      if (variantError) return { error: variantError.message }
      variantId = (variant as { id: string }).id
      notes.push('created')
    }

    // Stock intake: a new dated batch + purchase ledger entry.
    if (stock !== undefined && Number(stock) > 0) {
      const qty = Number(stock)
      const today = new Date()
      const expiry = new Date(today)
      expiry.setFullYear(expiry.getFullYear() + 2)
      const batchNumber = `IMP-${today.toISOString().slice(0, 10).replace(/-/g, '')}`
      const { data: batch, error: batchError } = await db
        .from('inventory_batches')
        .upsert(
          {
            pharmacy_id: mainPharmacyId(),
            variant_id: variantId,
            batch_number: batchNumber,
            expiry_date: expiry.toISOString().slice(0, 10),
            quantity_on_hand: qty,
          },
          { onConflict: 'pharmacy_id,variant_id,batch_number', ignoreDuplicates: true },
        )
        .select('id')
        .maybeSingle()
      if (batchError) return { error: `stock intake: ${batchError.message}` }
      if (batch) {
        await db.from('stock_movements').insert({
          batch_id: (batch as { id: string }).id,
          quantity: qty,
          reason: 'purchase',
          reference_type: 'import',
        })
        notes.push(`+${qty} stock (${batchNumber})`)
      } else {
        notes.push(`stock skipped — batch ${batchNumber} already received today`)
      }
    }

    return { note: notes.join('; ') || 'no changes' }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'commit failed' }
  }
}

async function commitLabTestRow(
  raw: Record<string, unknown>,
): Promise<{ note: string } | { error: string }> {
  const db = supabaseService()
  try {
    const code = text(raw, 'test_code')!.toUpperCase()
    const price = text(raw, 'price')
    const { data: existing } = await db
      .from('lab_tests')
      .select('id')
      .eq('short_code', code)
      .maybeSingle()

    let testId: string
    const notes: string[] = []

    if (existing) {
      testId = (existing as { id: string }).id
      const patch: Record<string, unknown> = {}
      const name = text(raw, 'test_name')
      const sample = text(raw, 'sample_type')
      const fasting = text(raw, 'fasting_hours')
      const report = text(raw, 'report_hours')
      if (name) patch.name = name
      if (sample) patch.sample_type = sample
      if (fasting !== undefined) {
        patch.fasting_required = Number(fasting) > 0
        patch.fasting_hours = Number(fasting) > 0 ? Number(fasting) : null
      }
      if (report !== undefined && Number(report) > 0) patch.turnaround_hours = Number(report)
      if (Object.keys(patch).length) {
        const { error } = await db.from('lab_tests').update(patch).eq('id', testId)
        if (error) return { error: error.message }
        notes.push('test updated')
      }
    } else {
      const name = text(raw, 'test_name')!
      const { data: slugRows } = await db.from('lab_tests').select('slug')
      const taken = ((slugRows ?? []) as { slug: string }[]).map((r) => String(r.slug))
      let slug = slugify(name)
      let n = 2
      while (taken.includes(slug)) slug = `${slugify(name)}-${n++}`

      const fasting = Number(text(raw, 'fasting_hours') ?? 0)
      const { data: created, error } = await db
        .from('lab_tests')
        .insert({
          name,
          slug,
          short_code: code,
          sample_type: text(raw, 'sample_type') ?? 'blood',
          fasting_required: fasting > 0,
          fasting_hours: fasting > 0 ? fasting : null,
          turnaround_hours: Number(text(raw, 'report_hours') ?? 24),
        })
        .select('id')
        .single()
      if (error) return { error: error.message }
      testId = (created as { id: string }).id
      notes.push('created')
    }

    if (price !== undefined) {
      // Price lands on the first active lab's pricing row (single-lab V1).
      const { data: lab } = await db
        .from('labs')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()
      if (!lab) return { error: 'no active lab to price this test against' }
      const { error } = await db.from('lab_test_pricing').upsert(
        {
          lab_id: (lab as { id: string }).id,
          test_id: testId,
          price_paisa: rupeesToPaisa(price)!,
        },
        { onConflict: 'lab_id,test_id' },
      )
      if (error) return { error: error.message }
      notes.push('price set')
    }

    return { note: notes.join('; ') || 'no changes' }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'commit failed' }
  }
}
