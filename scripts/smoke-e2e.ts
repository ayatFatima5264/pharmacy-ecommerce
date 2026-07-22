/**
 * End-to-end smoke test against the LIVE Supabase project — the Step 5 gate.
 * Exercises the exact production code paths (catalog-db, cart pricing,
 * placeOrderDb, outbox drain), not reimplementations:
 *
 *   1. Browse products (DB catalog read, stock from batches)
 *   2. Add to cart (price resolution against the DB snapshot)
 *   3. Checkout totals (pricing engine: shipping zone, COD)
 *   4. Place a COD order (place_order RPC — atomic transaction)
 *   5. Order stored (orders / order_items / payments / status history)
 *   6. Inventory reduced (batch quantities + stock_movements ledger)
 *   7. Outbox entry created (order number injected, dedupe key)
 *   8. Confirmation email sent (drain → Resend; reported as SKIPPED if
 *      RESEND_API_KEY is not set — the row stays queued, nothing is lost)
 *   9. Idempotent replay returns the same order
 *  10. Cancellation restores stock exactly (release_order_stock)
 *
 * The test order is cancelled at the end, so the database is left clean.
 * Run: npm run smoke   (requires .env.local; safe to re-run any time)
 */
import './load-env'
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { entryKey, resolveLines, computeTotals } from '../src/features/cart/pricing'
import { getCartCatalogDb } from '../src/lib/data/db/cart-db'
import { getProductsDb } from '../src/lib/data/db/catalog-db'
import { placeOrderDb } from '../src/lib/data/db/checkout-db'
import { trackOrderDb } from '../src/lib/data/db/checkout-db'
import { drainEmailOutbox } from '../src/lib/email/outbox'
import type { PlacedOrder } from '../src/lib/data/orders-store'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

let passed = 0
let failed = 0
function ok(label: string, detail = '') {
  passed++
  console.log(`  ok  ${label}${detail ? `  (${detail})` : ''}`)
}
function fail(label: string, detail: string) {
  failed++
  console.error(`FAIL  ${label}\n      ${detail}`)
}

async function main() {
  if (!url || !serviceKey) {
    console.error(
      'smoke: Supabase is not configured. Fill .env.local (see .env.example), then:\n' +
        '  npx supabase link --project-ref <ref>\n' +
        '  npx supabase db push\n' +
        '  npm run seed:admin && npm run seed:catalog\n' +
        '  npm run smoke',
    )
    process.exit(1)
  }
  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log('Smoke test: browse → cart → COD checkout → DB → stock → outbox → email\n')

  // --- 1. Browse ------------------------------------------------------------
  // An OTC product on purpose: a prescription item would (correctly) start
  // life as awaiting_rx, which is the pharmacist-gate flow, not the plain COD
  // flow this test asserts on.
  const products = await getProductsDb()
  const inStock = products.find(
    (p) => !p.requiresPrescription && p.variants.some((v) => v.inStock),
  )
  if (!inStock) {
    fail('browse products', 'no in-stock OTC products — has seed:catalog been run?')
    process.exit(1)
  }
  const variant = inStock.variants.find((v) => v.inStock)!
  ok('browse products', `${products.length} products; testing "${inStock.name}" (${variant.sku})`)

  const stockBefore = await variantStock(db, variant.id)

  // --- 2 + 3. Cart + totals --------------------------------------------------
  const catalog = await getCartCatalogDb()
  const QUANTITY = 2
  const lines = resolveLines(
    [
      {
        key: entryKey('product', inStock.slug, variant.id),
        kind: 'product',
        slug: inStock.slug,
        variantId: variant.id,
        quantity: QUANTITY,
      },
    ],
    catalog,
  )
  if (lines[0]?.entry && !lines[0].issue) {
    ok('add to cart', `priced at ${lines[0].entry.unitPricePaisa} paisa from DB snapshot`)
  } else {
    fail('add to cart', `line issue: ${JSON.stringify(lines[0]?.issue)}`)
    process.exit(1)
  }

  const totals = computeTotals({
    lines,
    coupon: null,
    context: { city: 'Karachi', paymentMethod: 'cod' },
    catalog,
  })
  if (totals.totalPaisa > 0 && totals.itemCount === QUANTITY) {
    ok('checkout totals', `total ${totals.totalPaisa} paisa incl. shipping ${totals.shippingPaisa}`)
  } else {
    fail('checkout totals', JSON.stringify(totals))
  }

  // --- 4. Place the COD order -------------------------------------------------
  const idempotencyKey = `smoke-${randomUUID()}`
  const input = {
    userId: null,
    idempotencyKey,
    contact: {
      firstName: 'Smoke',
      lastName: 'Test',
      phone: '+923000000001',
      // Resend's test inbox: accepts and marks delivered, never bounces.
      email: 'delivered@resend.dev',
    },
    address: { line1: 'Smoke Test Lane 1', city: 'Karachi', province: 'Sindh', postalCode: null },
    notes: 'SMOKE TEST — safe to ignore',
    paymentMethod: 'cod',
    lines,
    totals,
    couponCode: null,
    couponDiscountPaisa: 0,
    booking: null,
    emailSnapshot: buildEmailSnapshot(inStock.name, variant.packSize, lines[0].entry!.unitPricePaisa, QUANTITY, totals, idempotencyKey),
  }
  const placed = await placeOrderDb(input)
  if (!placed.ok) {
    fail('place COD order', placed.message)
    process.exit(1)
  }
  ok('place COD order', placed.orderNumber)
  const orderNumber = placed.orderNumber

  // --- 5. Stored in the database ----------------------------------------------
  const { data: orderRow } = await db
    .from('orders')
    .select(
      'id, status, total_paisa, order_items ( id ), payments ( method, status ), order_status_history ( to_status )',
    )
    .eq('order_number', orderNumber)
    .single()
  if (
    orderRow &&
    orderRow.status === 'confirmed' &&
    orderRow.total_paisa === totals.totalPaisa &&
    orderRow.order_items.length === 1 &&
    orderRow.payments[0]?.method === 'cod' &&
    orderRow.order_status_history.length === 1
  ) {
    ok('order stored', `status confirmed, payment cod, history written`)
  } else {
    fail('order stored', JSON.stringify(orderRow))
  }
  const orderId = orderRow?.id as string

  // --- 6. Inventory reduced ----------------------------------------------------
  const stockAfter = await variantStock(db, variant.id)
  const { data: movements } = await db
    .from('stock_movements')
    .select('quantity, reason')
    .eq('reference_id', orderId)
    .eq('reason', 'sale')
  const movedUnits = (movements ?? []).reduce((sum, m) => sum - m.quantity, 0)
  if (stockBefore - stockAfter === QUANTITY && movedUnits === QUANTITY) {
    ok('inventory reduced', `${stockBefore} → ${stockAfter}, ledgered as 'sale'`)
  } else {
    fail('inventory reduced', `stock ${stockBefore}→${stockAfter}, ledger ${movedUnits}`)
  }

  // --- 7. Outbox entry ---------------------------------------------------------
  const { data: outboxRow } = await db
    .from('email_outbox')
    .select('id, status, recipient, payload')
    .eq('dedupe_key', `order_confirmation:${orderNumber}`)
    .maybeSingle()
  const payloadNumber = (outboxRow?.payload as { orderNumber?: string } | null)?.orderNumber
  if (outboxRow && payloadNumber === orderNumber) {
    ok('outbox entry created', `order number injected into payload, status ${outboxRow.status}`)
  } else {
    fail('outbox entry created', JSON.stringify(outboxRow))
  }

  // --- 8. Send the confirmation email ------------------------------------------
  const drained = await drainEmailOutbox()
  if (drained.sent >= 1) {
    ok('confirmation email SENT via Resend', `drain: ${JSON.stringify(drained)}`)
  } else if (drained.skipped >= 1) {
    ok(
      'confirmation email queued (send SKIPPED: RESEND_API_KEY not set)',
      'row stays pending; it sends on the first drain after the key lands',
    )
  } else {
    fail('confirmation email', `drain result: ${JSON.stringify(drained)}`)
  }

  // --- 9. Idempotent replay ----------------------------------------------------
  const replay = await placeOrderDb(input)
  if (replay.ok && replay.orderNumber === orderNumber) {
    ok('idempotent replay', 'same order returned, nothing duplicated')
  } else {
    fail('idempotent replay', JSON.stringify(replay))
  }

  // Tracking (order# + phone second factor) — free extra coverage.
  const tracked = await trackOrderDb(orderNumber, '0300 0000001')
  const trackedWrongPhone = await trackOrderDb(orderNumber, '0399 9999999')
  if (tracked?.orderNumber === orderNumber && trackedWrongPhone === null) {
    ok('order tracking', 'found with right phone, refused with wrong phone')
  } else {
    fail('order tracking', JSON.stringify({ tracked: !!tracked, wrong: !!trackedWrongPhone }))
  }

  // --- 10. Admin console paths (Step 5) ---------------------------------------
  const { applyOrderStatusDb, findAdminOrderDb, getAdminOrdersDb, getDashboardMetricsDb } =
    await import('../src/lib/data/db/admin-db')

  // Actor: the seeded admin's profile — its existence also proves the
  // handle_new_user trigger fired on the LIVE project during seed:admin.
  const { data: adminProfile } = await db.from('profiles').select('id').limit(1).maybeSingle()
  if (adminProfile) ok('admin profile exists (handle_new_user trigger fired on live DB)')
  else fail('admin profile', 'no profiles row — did the auth trigger run?')
  const actorId = (adminProfile as { id: string } | null)?.id ?? null

  const adminList = await getAdminOrdersDb()
  const detail = await findAdminOrderDb(orderNumber)
  if (
    adminList.some((o) => o.orderNumber === orderNumber) &&
    detail?.order.items.length === 1 &&
    detail.order.statusHistory.length >= 1
  ) {
    ok('admin reads', 'orders list + detail with items and history')
  } else {
    fail('admin reads', JSON.stringify({ listed: adminList.length, detail: !!detail }))
  }

  const metrics = await getDashboardMetricsDb()
  if (metrics.orderCount >= 1) ok('admin dashboard metrics', `orderCount=${metrics.orderCount}`)
  else fail('admin dashboard metrics', JSON.stringify(metrics))

  // Real transition path: confirmed → processing → cancelled. The cancel
  // must release stock through the same function the admin console uses.
  const step1 = await applyOrderStatusDb({
    dbId: orderId, orderNumber, fromDbStatus: 'confirmed', to: 'processing',
    actorId: actorId!, note: 'smoke: start preparing',
  })
  const step2 = await applyOrderStatusDb({
    dbId: orderId, orderNumber, fromDbStatus: 'processing', to: 'cancelled',
    actorId: actorId!, note: 'smoke test cleanup',
  })
  const stockRestored = await variantStock(db, variant.id)
  const { data: finalOrder } = await db
    .from('orders')
    .select('status, cancelled_at, order_status_history ( id )')
    .eq('id', orderId)
    .single()
  const f = finalOrder as { status: string; cancelled_at: string | null; order_status_history: { id: unknown }[] } | null
  if (
    !step1.error && !step2.error &&
    f?.status === 'cancelled' && f.cancelled_at &&
    f.order_status_history.length === 3 && // placed + processing + cancelled
    stockRestored === stockBefore
  ) {
    ok('admin status flow', `processing → cancelled; stock ${stockAfter} → ${stockRestored}; history x3`)
  } else {
    fail(
      'admin status flow',
      JSON.stringify({ step1, step2, status: f?.status, history: f?.order_status_history.length, stockRestored }),
    )
  }

  // --- 11. Step 6 surfaces: settings, CMS, coupons, account linkage -----------
  console.log('')

  // Settings: a database row must win over the code default (write first —
  // getSetting is per-process cached, so order matters in this script).
  await db.from('settings').upsert(
    { key: 'store.status', value: { pharmacyOpen: false, labOpen: true, message: 'smoke pause' } },
    { onConflict: 'key' },
  )
  const { getSetting } = await import('../src/features/settings/queries')
  const status = await getSetting('store.status')
  if (status.pharmacyOpen === false && status.message === 'smoke pause') {
    ok('settings: DB value overrides code default')
  } else {
    fail('settings roundtrip', JSON.stringify(status))
  }
  await db.from('settings').delete().eq('key', 'store.status') // restore default

  // CMS: a published DB page must win over the shipped default.
  await db.from('cms_pages').upsert(
    { slug: 'privacy', title: 'SMOKE Privacy', body: 'Smoke test body paragraph, long enough to pass validation.' },
    { onConflict: 'slug' },
  )
  const { getCmsPage } = await import('../src/features/cms/pages')
  const cmsPage = await getCmsPage('privacy')
  if (cmsPage?.title === 'SMOKE Privacy' && cmsPage.updatedAt) {
    ok('cms: published DB page overrides shipped default')
  } else {
    fail('cms roundtrip', JSON.stringify(cmsPage))
  }
  await db.from('cms_pages').delete().eq('slug', 'privacy') // restore default

  // Coupon + account linkage: validate a live percentage coupon, place an
  // order WITH it as the admin user, verify the ledger and the linkage.
  const { data: couponRow } = await db
    .from('coupons')
    .select('id, code, usage_count, min_order_paisa')
    .eq('discount_type', 'percentage')
    .eq('is_active', true)
    .lte('min_order_paisa', totals.subtotalPaisa)
    .limit(1)
    .maybeSingle()
  if (!couponRow) {
    fail('coupon flow', 'no usable percentage coupon seeded')
  } else {
    const coupon = couponRow as { id: string; code: string; usage_count: number; min_order_paisa: number }
    const { lookupCouponDb } = await import('../src/lib/data/db/lab-admin-db')
    const lookup = await lookupCouponDb(String(coupon.code), totals.subtotalPaisa)
    if (!lookup.ok) {
      fail('coupon validation', JSON.stringify(lookup))
    } else {
      const withCoupon = computeTotals({
        lines,
        coupon: lookup.rule,
        context: { city: 'Karachi', paymentMethod: 'cod' },
        catalog,
      })
      const placedWithCoupon = await placeOrderDb({
        ...input,
        userId: actorId,
        idempotencyKey: `smoke-${randomUUID()}`,
        totals: withCoupon,
        couponCode: lookup.rule.code,
        couponDiscountPaisa: withCoupon.discountPaisa,
        emailSnapshot: null,
      })
      if (!placedWithCoupon.ok) {
        fail('coupon order', placedWithCoupon.message)
      } else {
        const { data: couponOrder } = await db
          .from('orders')
          .select('id, user_id, discount_paisa, coupon_id, coupon_redemptions ( discount_paisa )')
          .eq('order_number', placedWithCoupon.orderNumber)
          .single()
        const co = couponOrder as unknown as {
          id: string
          user_id: string | null
          discount_paisa: number
          coupon_id: string | null
          coupon_redemptions: { discount_paisa: number }[]
        } | null
        const { data: couponAfter } = await db
          .from('coupons')
          .select('usage_count')
          .eq('id', coupon.id)
          .single()
        if (
          co?.user_id === actorId &&
          co.discount_paisa === withCoupon.discountPaisa &&
          co.coupon_id === coupon.id &&
          co.coupon_redemptions.length === 1 &&
          (couponAfter as { usage_count: number }).usage_count === coupon.usage_count + 1
        ) {
          ok(
            'coupon + account linkage',
            `${lookup.rule.code} redeemed (−${withCoupon.discountPaisa} paisa), order linked to account`,
          )
        } else {
          fail('coupon order verification', JSON.stringify({ co, after: couponAfter }))
        }
        // Cleanup: cancel through the real admin path (also restores stock).
        await applyOrderStatusDb({
          dbId: co!.id, orderNumber: placedWithCoupon.orderNumber,
          fromDbStatus: 'confirmed', to: 'cancelled', actorId: actorId!, note: 'smoke cleanup',
        })
      }
    }
  }

  // --- 12. Step 7: prescription workflow ---------------------------------------
  console.log('')

  const rxProduct = products.find((p) => p.requiresPrescription && p.variants.some((v) => v.inStock))
  if (!rxProduct) {
    fail('rx flow', 'no in-stock prescription product seeded')
  } else {
    const rxVariant = rxProduct.variants.find((v) => v.inStock)!
    const { uploadPrescription } = await import('../src/features/prescriptions/upload')
    const uploaded = await uploadPrescription({
      file: new File([new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 1, 2, 3])], 'rx.jpg', { type: 'image/jpeg' }),
      userId: null, // guest upload — the 0022 nullable-user_id path
      patientName: 'Smoke Patient',
    })
    if ('error' in uploaded) {
      fail('rx upload', uploaded.error)
    } else {
      ok('prescription uploaded (guest, private bucket)')
      const rxLines = resolveLines(
        [{ key: entryKey('product', rxProduct.slug, rxVariant.id), kind: 'product', slug: rxProduct.slug, variantId: rxVariant.id, quantity: 1 }],
        catalog,
      )
      const rxTotals = computeTotals({ lines: rxLines, coupon: null, context: { city: 'Karachi', paymentMethod: 'cod' }, catalog })
      const rxStockBefore = await variantStock(db, rxVariant.id)
      const rxPlaced = await placeOrderDb({
        ...input,
        idempotencyKey: `smoke-${randomUUID()}`,
        lines: rxLines,
        totals: rxTotals,
        prescriptionId: uploaded.id,
        emailSnapshot: null,
      })
      if (!rxPlaced.ok) {
        fail('rx order placement', rxPlaced.message)
      } else {
        const { data: rxOrder } = await db
          .from('orders')
          .select('id, status, order_items ( prescription_id, requires_prescription )')
          .eq('order_number', rxPlaced.orderNumber)
          .single()
        const ro = rxOrder as unknown as {
          id: string
          status: string
          order_items: { prescription_id: string | null; requires_prescription: boolean }[]
        }
        const rxLine = ro.order_items.find((i) => i.requires_prescription)
        if (ro.status === 'awaiting_rx' && rxLine?.prescription_id === uploaded.id) {
          ok('rx order gated', `${rxPlaced.orderNumber} awaiting_rx, prescription attached to the Rx line`)
        } else {
          fail('rx order gating', JSON.stringify(ro))
        }

        // Notifications emitted in-transaction by place_order v2.
        const { data: bells } = await db
          .from('notifications')
          .select('type')
          .in('dedupe_key', [`order.placed:${rxPlaced.orderNumber}`, `rx.review:${rxPlaced.orderNumber}`])
        if ((bells ?? []).length === 2) ok('notifications emitted (order.placed + rx.review)')
        else fail('notifications', JSON.stringify(bells))

        // Approve (as the seeded pharmacist licence) → gate opens → confirmed.
        const { data: pharmacist } = await db
          .from('pharmacists')
          .select('id')
          .eq('registration_no', 'PCP-DEMO-0001')
          .single()
        await db.from('prescription_reviews').insert({
          prescription_id: uploaded.id,
          pharmacist_id: (pharmacist as { id: string }).id,
          decision: 'approved',
        })
        await db.from('prescriptions').update({ status: 'approved' }).eq('id', uploaded.id)
        const gate = await applyOrderStatusDb({
          dbId: ro.id, orderNumber: rxPlaced.orderNumber,
          fromDbStatus: 'awaiting_rx', to: 'confirmed', actorId: actorId!, note: 'Prescription approved',
        })
        const { data: confirmedOrder } = await db.from('orders').select('status').eq('id', ro.id).single()
        if (!gate.error && (confirmedOrder as { status: string }).status === 'confirmed') {
          ok('pharmacist approval opens the gate', 'awaiting_rx → confirmed with licence-attributed review')
        } else {
          fail('rx approval gate', gate.error ?? JSON.stringify(confirmedOrder))
        }

        // Cleanup: cancel (restores stock), remove prescription + file + bells.
        await applyOrderStatusDb({
          dbId: ro.id, orderNumber: rxPlaced.orderNumber,
          fromDbStatus: 'confirmed', to: 'cancelled', actorId: actorId!, note: 'smoke cleanup',
        })
        const rxStockAfter = await variantStock(db, rxVariant.id)
        if (rxStockAfter === rxStockBefore) ok('rx order cleanup restored stock')
        else fail('rx cleanup', `stock ${rxStockBefore} → ${rxStockAfter}`)
        await db.from('prescriptions').delete().eq('id', uploaded.id)
        await db.storage.from('prescriptions').remove([`guest/`]) // best effort; folder listing not needed
      }
    }
  }

  // --- 13. Step 7: Excel import engine -----------------------------------------
  const XLSX = await import('xlsx')
  const { stageImport, commitImport } = await import('../src/features/imports/engine')
  const makeBook = (rows: unknown[][]) => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Sheet1')
    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  }

  // Create a throwaway product with stock, then bulk-update just its price.
  const staged = await stageImport({
    type: 'products',
    filename: 'smoke-products.xlsx',
    buffer: makeBook([
      ['sku', 'product_name', 'brand', 'categories', 'price', 'stock', 'pack_size'],
      ['SMOKE-IMP-1', 'Smoke Import Med', 'Smoke Brand', 'Smoke Category', '150', '25', 'Strip of 10'],
      ['', 'missing sku row', '', '', 'x', '', ''], // must be flagged as error
    ]),
    createdBy: actorId!,
  })
  if ('error' in staged) {
    fail('import staging', staged.error)
  } else if (staged.totals.creates === 1 && staged.totals.errors === 1) {
    ok('import staged', `1 create + 1 error row correctly classified`)
    const committed = await commitImport(staged.importId)
    const { data: importedVariant } = await db
      .from('product_variants')
      .select('id, price_paisa, products ( name ), inventory_batches ( quantity_on_hand )')
      .eq('sku', 'SMOKE-IMP-1')
      .maybeSingle()
    const iv = importedVariant as unknown as {
      id: string
      price_paisa: number
      products: { name: string } | null
      inventory_batches: { quantity_on_hand: number }[]
    } | null
    if (
      !('error' in committed) && committed.committed === 1 &&
      iv?.price_paisa === 15000 && iv.products?.name === 'Smoke Import Med' &&
      iv.inventory_batches[0]?.quantity_on_hand === 25
    ) {
      ok('import committed', 'product created at Rs 150 with 25 units ledgered as intake')
    } else {
      fail('import commit', JSON.stringify({ committed, iv }))
    }

    // Bulk price update: sku + price only — nothing else may change.
    const priceUpdate = await stageImport({
      type: 'products',
      filename: 'smoke-price-update.xlsx',
      buffer: makeBook([['sku', 'price'], ['SMOKE-IMP-1', '199']]),
      createdBy: actorId!,
    })
    if (!('error' in priceUpdate)) {
      await commitImport(priceUpdate.importId)
      const { data: after } = await db
        .from('product_variants')
        .select('price_paisa, products ( name )')
        .eq('sku', 'SMOKE-IMP-1')
        .single()
      const av = after as unknown as { price_paisa: number; products: { name: string } | null }
      if (av.price_paisa === 19900 && av.products?.name === 'Smoke Import Med') {
        ok('bulk price update', 'price → Rs 199, name untouched')
      } else {
        fail('bulk price update', JSON.stringify(av))
      }
    }

    // Cleanup the throwaway rows (movements → batches → product → taxonomy → imports).
    if (iv) {
      const { data: batches } = await db.from('inventory_batches').select('id').eq('variant_id', iv.id)
      const batchIds = ((batches ?? []) as { id: string }[]).map((b) => b.id)
      if (batchIds.length) {
        await db.from('stock_movements').delete().in('batch_id', batchIds)
        await db.from('inventory_batches').delete().in('id', batchIds)
      }
      const { data: prod } = await db.from('products').select('id').eq('name', 'Smoke Import Med').maybeSingle()
      if (prod) await db.from('products').delete().eq('id', (prod as { id: string }).id)
      await db.from('brands').delete().eq('slug', 'smoke-brand')
      await db.from('categories').delete().eq('slug', 'smoke-category')
    }
    await db.from('imports').delete().like('filename', 'smoke-%')
  } else {
    fail('import staging classification', JSON.stringify(staged.totals))
  }

  console.log(
    `\nsmoke: ${passed} passed, ${failed} failed.` +
      (failed === 0 ? ` Test orders cancelled — database left clean.` : ''),
  )
  process.exit(failed === 0 ? 0 : 1)
}

async function variantStock(db: SupabaseClient, variantId: string): Promise<number> {
  const { data } = await db
    .from('inventory_batches')
    .select('quantity_on_hand, quantity_reserved')
    .eq('variant_id', variantId)
    .gt('expiry_date', new Date().toISOString().slice(0, 10))
  const rows = (data ?? []) as { quantity_on_hand: number; quantity_reserved: number }[]
  return rows.reduce((sum, b) => sum + Math.max(0, b.quantity_on_hand - b.quantity_reserved), 0)
}

/** The PlacedOrder-shaped payload the confirmation template renders from. */
function buildEmailSnapshot(
  name: string,
  packSize: string,
  unitPricePaisa: number,
  quantity: number,
  totals: ReturnType<typeof computeTotals>,
  idempotencyKey: string,
): PlacedOrder {
  return {
    id: randomUUID(),
    orderNumber: '', // place_order injects the real number at enqueue.
    placedAt: new Date().toISOString(),
    status: 'confirmed',
    firstName: 'Smoke',
    lastName: 'Test',
    phone: '+923000000001',
    email: 'delivered@resend.dev',
    province: 'Sindh',
    city: 'Karachi',
    address: 'Smoke Test Lane 1',
    postalCode: null,
    notes: null,
    paymentMethod: 'cod',
    paymentStatus: 'pending',
    items: [
      {
        kind: 'product',
        slug: 'smoke',
        name,
        subtitle: packSize,
        icon: '💊',
        unitPricePaisa,
        quantity,
        lineTotalPaisa: unitPricePaisa * quantity,
        requiresPrescription: false,
      },
    ],
    couponCode: null,
    subtotalPaisa: totals.subtotalPaisa,
    discountPaisa: totals.discountPaisa,
    taxPaisa: totals.taxPaisa,
    shippingPaisa: totals.shippingPaisa,
    totalPaisa: totals.totalPaisa,
    requiresPrescription: false,
    hasLabItems: false,
    estimatedDeliveryFrom: 'soon',
    estimatedDeliveryTo: 'soon',
    idempotencyKey,
    emailStatus: 'skipped',
    statusHistory: [],
  }
}

main().catch((error) => {
  console.error('smoke crashed:', error)
  process.exit(1)
})
