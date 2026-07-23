/**
 * Applies every migration in supabase/migrations, in order, against an
 * in-process Postgres (PGlite), then behavior-tests the security model.
 *
 * A shim recreates the slice of hosted Supabase the migrations touch:
 *   - anon / authenticated roles (so grants execute for real)
 *   - auth schema + auth.users + auth.uid() reading request.jwt.claim.sub,
 *     exactly like GoTrue's helper -- which lets this script impersonate
 *     users with SET ROLE + set_config and PROVE the RLS policies hold.
 * Storage remains absent here; 0015 skips itself (its guard is part of what
 * this script verifies).
 *
 * Tolerated environment gap: pgcrypto may be missing from PGlite; nothing
 * depends on it at DDL time (gen_random_uuid() is a builtin since PG13).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { citext } from '@electric-sql/pglite/contrib/citext'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations')

const AUTH_SHIM = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb not null default '{}',
    created_at timestamptz not null default now()
  );
  -- Mirrors GoTrue: the uid is the JWT 'sub' claim of the current request.
  create function auth.uid() returns uuid
  language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`

const USER_A = '11111111-1111-1111-1111-111111111111'
const USER_B = '22222222-2222-2222-2222-222222222222'

let failures = 0
function ok(label: string) {
  console.log(`  ok  ${label}`)
}
function fail(label: string, detail?: string) {
  failures++
  console.error(`FAIL  ${label}${detail ? `\n      ${detail}` : ''}`)
}

/** Run a query impersonating a PostgREST role, optionally as a logged-in user. */
async function as(
  db: PGlite,
  role: 'anon' | 'authenticated',
  userId: string | null,
  sql: string,
): Promise<{ rows: unknown[]; error?: string }> {
  try {
    await db.exec(
      `begin;
       set local role ${role};
       select set_config('request.jwt.claim.sub', '${userId ?? ''}', true);`,
    )
    const result = await db.query(sql)
    return { rows: result.rows }
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : String(error) }
  } finally {
    await db.exec('rollback;')
  }
}

async function main() {
  const db = await PGlite.create({ extensions: { citext, pg_trgm } })
  await db.exec(AUTH_SHIM)

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  console.log(`Applying ${files.length} migrations against in-process Postgres (with auth shim)...\n`)

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
    try {
      await db.exec(sql)
      ok(file)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (/pgcrypto/.test(message) && file.startsWith('0001')) {
        const stripped = sql.replace(/^create extension if not exists "pgcrypto";.*$/m, '')
        try {
          await db.exec(stripped)
          ok(`${file} (pgcrypto unavailable in PGlite - skipped that line only)`)
          continue
        } catch (retryError) {
          fail(file, retryError instanceof Error ? retryError.message : String(retryError))
          break
        }
      }
      fail(file, message)
      break // later migrations depend on earlier ones
    }
  }

  if (failures === 0) {
    console.log('\nStructural assertions:\n')

    const expectedTables = [
      'profiles', 'addresses', 'roles', 'permissions', 'role_permissions',
      'user_roles', 'audit_log', 'pharmacies', 'pharmacists',
      'brands', 'categories', 'products', 'product_categories',
      'product_variants', 'product_images', 'inventory_batches', 'stock_movements',
      'labs', 'lab_tests', 'lab_test_pricing', 'health_packages', 'health_package_tests',
      'prescriptions', 'prescription_reviews', 'coupons', 'coupon_scopes',
      'coupon_redemptions', 'carts', 'cart_items', 'orders', 'order_items',
      'order_item_batches', 'order_status_history', 'collection_slots',
      'lab_bookings', 'lab_booking_items', 'lab_reports', 'shipping_zones',
      'shipping_zone_areas', 'shipping_methods', 'shipping_rates', 'shipments',
      'shipment_items', 'payments', 'refunds', 'cod_collections', 'rate_limits',
      'email_outbox', 'product_reviews', 'product_review_images',
    ]
    const { rows: tables } = await db.query<{ tablename: string }>(
      `select tablename from pg_tables where schemaname = 'public'`,
    )
    const present = new Set(tables.map((t) => t.tablename))
    const missing = expectedTables.filter((t) => !present.has(t))
    if (missing.length) fail('all expected tables exist', `missing: ${missing.join(', ')}`)
    else ok(`all ${expectedTables.length} expected tables exist`)

    // Supabase-Auth adoption: no custom credential/session tables remain.
    for (const gone of ['user_credentials', 'sessions']) {
      if (present.has(gone)) fail(`${gone} removed (Supabase Auth owns this)`)
      else ok(`${gone} does not exist (Supabase Auth owns this)`)
    }

    // profiles is keyed to auth.users again.
    const { rows: fk } = await db.query(
      `select 1 from pg_constraint c
       join pg_class t on t.oid = c.conrelid
       where t.relname = 'profiles' and c.contype = 'f'
         and c.confrelid = 'auth.users'::regclass`,
    )
    if (fk.length) ok('profiles.id references auth.users (cascade)')
    else fail('profiles.id references auth.users')

    const { rows: noRls } = await db.query<{ relname: string }>(
      `select c.relname from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    )
    if (noRls.length) fail('RLS enabled on every table', `unprotected: ${noRls.map((r) => r.relname).join(', ')}`)
    else ok('RLS enabled on every public table')

    // Money/stock write paths must have NO non-select policies (durable rule 2).
    const { rows: writePolicies } = await db.query<{ tablename: string; policyname: string }>(
      `select tablename, policyname from pg_policies
       where schemaname = 'public'
         and tablename in ('orders','order_items','payments','refunds',
                           'lab_bookings','inventory_batches','stock_movements')
         and cmd <> 'SELECT'`,
    )
    if (writePolicies.length)
      fail('no client write policies on financial tables', writePolicies.map((p) => `${p.tablename}.${p.policyname}`).join(', '))
    else ok('financial/stock tables: SELECT-only policies (writes are service-role)')

    console.log('\nRLS behavior (impersonating PostgREST roles):\n')

    // Seed: two auth users (exercises handle_new_user), catalog rows, an order each.
    await db.exec(`
      insert into auth.users (id, email, raw_user_meta_data) values
        ('${USER_A}', 'a@example.com', '{"full_name": "User A"}'),
        ('${USER_B}', 'b@example.com', '{}');
      insert into brands (id, slug, name, is_active) values
        ('aaaaaaaa-0000-0000-0000-000000000001', 'good-brand', 'Good Brand', true),
        ('aaaaaaaa-0000-0000-0000-000000000002', 'draft-brand', 'Draft Brand', false);
      insert into orders (id, user_id, subtotal_paisa, total_paisa) values
        ('bbbbbbbb-0000-0000-0000-000000000001', '${USER_A}', 100000, 100000),
        ('bbbbbbbb-0000-0000-0000-000000000002', '${USER_B}', 200000, 200000);
    `)

    // handle_new_user auto-provisioned profiles, with metadata mapped.
    const { rows: profiles } = await db.query<{ id: string; email: string; full_name: string | null }>(
      `select id, email, full_name from profiles order by email`,
    )
    if (profiles.length === 2 && profiles[0].full_name === 'User A')
      ok('handle_new_user: profiles auto-created from auth.users, metadata mapped')
    else fail('handle_new_user trigger', JSON.stringify(profiles))

    // anon: sees active catalog only; cannot see orders at all.
    const anonBrands = await as(db, 'anon', null, 'select slug from brands')
    if (!anonBrands.error && anonBrands.rows.length === 1) ok('anon reads only ACTIVE catalog rows')
    else fail('anon catalog read', anonBrands.error ?? `saw ${anonBrands.rows.length} brands`)

    const anonOrders = await as(db, 'anon', null, 'select id from orders')
    if (anonOrders.error) ok('anon cannot read orders (permission denied)')
    else fail('anon blocked from orders', `read ${anonOrders.rows.length} rows`)

    // authenticated: sees own order only; cannot forge one.
    const aOrders = await as(db, 'authenticated', USER_A, 'select id from orders')
    if (!aOrders.error && aOrders.rows.length === 1) ok('authenticated reads OWN orders only (1 of 2 visible)')
    else fail('own-orders isolation', aOrders.error ?? `saw ${aOrders.rows.length}`)

    const forged = await as(
      db,
      'authenticated',
      USER_A,
      `insert into orders (user_id, subtotal_paisa, total_paisa) values ('${USER_A}', 1, 1) returning id`,
    )
    if (forged.error) ok('authenticated cannot INSERT an order (service-role-only write path)')
    else fail('order forgery blocked', 'client insert succeeded')

    // Cross-user profile access is invisible; own profile is updatable.
    const bProfile = await as(db, 'authenticated', USER_A, `select id from profiles where id = '${USER_B}'`)
    if (!bProfile.error && bProfile.rows.length === 0) ok("authenticated cannot see another user's profile")
    else fail('profile isolation', bProfile.error ?? 'row visible')

    const emailRewrite = await as(
      db,
      'authenticated',
      USER_A,
      `update profiles set email = 'evil@example.com' where id = '${USER_A}'`,
    )
    if (emailRewrite.error) ok('authenticated cannot rewrite own email (column grant excludes it)')
    else fail('email column protected', 'update succeeded')

    console.log('\nCommerce engine (place_order / reserve_stock / outbox):\n')

    const PHARMACY = 'cccccccc-0000-0000-0000-000000000001'
    const PRODUCT = 'dddddddd-0000-0000-0000-000000000001'
    const VARIANT = 'dddddddd-0000-0000-0000-000000000011'
    const LAB = 'eeeeeeee-0000-0000-0000-000000000001'
    const LABTEST = 'eeeeeeee-0000-0000-0000-000000000011'
    const SLOT = 'eeeeeeee-0000-0000-0000-000000000021'
    const COUPON = 'ffffffff-0000-0000-0000-000000000001'
    const B1 = '99999999-0000-0000-0000-000000000001' // expires soonest, qty 5
    const B2 = '99999999-0000-0000-0000-000000000002' // expires later,  qty 10
    const B3 = '99999999-0000-0000-0000-000000000003' // EXPIRED,        qty 50

    await db.exec(`
      insert into pharmacies (id, name, slug, drap_license_no, license_expiry, phone, line1, city, province)
        values ('${PHARMACY}', 'Main Branch', 'main-branch', 'DRAP-001', current_date + 365, '+920000000000', 'Street 1', 'Karachi', 'Sindh');
      insert into products (id, brand_id, name, slug)
        values ('${PRODUCT}', 'aaaaaaaa-0000-0000-0000-000000000001', 'Test Med', 'test-med');
      insert into product_variants (id, product_id, sku, pack_size, price_paisa)
        values ('${VARIANT}', '${PRODUCT}', 'TEST-SKU-1', 'Strip of 10', 10000);
      insert into inventory_batches (id, pharmacy_id, variant_id, batch_number, expiry_date, quantity_on_hand) values
        ('${B1}', '${PHARMACY}', '${VARIANT}', 'BATCH-A', current_date + 30, 5),
        ('${B2}', '${PHARMACY}', '${VARIANT}', 'BATCH-B', current_date + 90, 10),
        ('${B3}', '${PHARMACY}', '${VARIANT}', 'BATCH-X', current_date - 1, 50);
      insert into labs (id, name, slug, phone, city)
        values ('${LAB}', 'Test Lab', 'test-lab', '+920000000001', 'Karachi');
      insert into lab_tests (id, name, slug, sample_type)
        values ('${LABTEST}', 'CBC', 'cbc', 'blood');
      insert into collection_slots (id, lab_id, city, slot_date, starts_at, ends_at, capacity)
        values ('${SLOT}', '${LAB}', 'Karachi', current_date + 1, '08:00', '10:00', 1);
      insert into coupons (id, code, discount_type, discount_percent, usage_limit)
        values ('${COUPON}', 'SAVE10', 'percentage', 10, 1);
    `)

    const payload = (overrides: Record<string, unknown>) => ({
      idempotency_key: 'order-A',
      user_id: null,
      pharmacy_id: PHARMACY,
      contact: { email: 'buyer@example.com', phone: '+923001234567' },
      address: { line1: 'House 1', city: 'Karachi' },
      city: 'Karachi',
      payment_method: 'cod',
      notes: null,
      totals: { subtotal: 100000, discount: 10000, shipping: 15000, tax: 0, total: 105000 },
      coupon: { id: COUPON, code: 'SAVE10', discount_paisa: 10000 },
      items: [
        { kind: 'product', variant_id: VARIANT, name: 'Test Med', sku: 'TEST-SKU-1',
          pack_size: 'Strip of 10', unit_price_paisa: 10000, quantity: 7, requires_prescription: false },
        { kind: 'test', test_id: LABTEST, lab_id: LAB, name: 'CBC',
          unit_price_paisa: 30000, quantity: 1, requires_prescription: false },
      ],
      booking: {
        lab_id: LAB, slot_id: SLOT, scheduled_at: new Date(Date.now() + 86400000).toISOString(),
        patient_name: 'Patient One', patient_age: 40, patient_gender: 'female',
        patient_phone: '+923001234567', collection_mode: 'home',
        collection_address: { line1: 'House 1', city: 'Karachi' },
        tests: [{ test_id: LABTEST, test_name: 'CBC', item_index: 1 }],
      },
      email: {
        template_key: 'order_confirmation', recipient: 'buyer@example.com',
        dedupe_key: 'order_confirmation:order-A', payload: { orderNumber: 'filled-later' },
      },
      ...overrides,
    })

    const placeOrder = async (p: unknown) => {
      try {
        const { rows } = await db.query<{ place_order: Record<string, unknown> }>(
          'select place_order($1::jsonb)',
          [JSON.stringify(p)],
        )
        return { result: rows[0].place_order, error: undefined }
      } catch (error) {
        return { result: undefined, error: error instanceof Error ? error.message : String(error) }
      }
    }

    // 1. Happy path: product (FEFO split across batches) + lab test + booking
    //    + coupon + outbox email, one atomic call.
    const orderA = await placeOrder(payload({}))
    if (orderA.error) fail('place_order happy path', orderA.error)
    else {
      const num = String(orderA.result!.order_number)
      if (/^HC-\d+$/.test(num)) ok(`place_order creates order ${num} (+ booking ${orderA.result!.booking_number})`)
      else fail('order number format', num)

      const { rows: picks } = await db.query<{ batch_id: string; quantity: number }>(
        `select batch_id, quantity from order_item_batches order by quantity desc`,
      )
      const fefo =
        picks.length === 2 &&
        picks[0].batch_id === B1 && picks[0].quantity === 5 &&
        picks[1].batch_id === B2 && picks[1].quantity === 2
      if (fefo) ok('FEFO: 7 units split 5 (soonest expiry) + 2 (next); expired batch untouched')
      else fail('FEFO batch picking', JSON.stringify(picks))

      const { rows: batches } = await db.query<{ id: string; quantity_on_hand: number }>(
        `select id, quantity_on_hand from inventory_batches where id in ('${B1}','${B2}','${B3}') order by id`,
      )
      const stockOk = batches.every((b) =>
        b.id === B1 ? b.quantity_on_hand === 0 : b.id === B2 ? b.quantity_on_hand === 8 : b.quantity_on_hand === 50,
      )
      if (stockOk) ok('stock decremented (5→0, 10→8), expired batch untouched (50)')
      else fail('stock decrement', JSON.stringify(batches))

      const { rows: side } = await db.query<{ n: string; c: number }>(`
        select 'movements' as n, count(*)::int as c from stock_movements where reason = 'sale'
        union all select 'slot', booked_count::int from collection_slots where id = '${SLOT}'
        union all select 'booking_items', count(*)::int from lab_booking_items
        union all select 'coupon_uses', usage_count::int from coupons where id = '${COUPON}'
        union all select 'redemptions', count(*)::int from coupon_redemptions
        union all select 'payments', count(*)::int from payments
        union all select 'history', count(*)::int from order_status_history
        union all select 'outbox', count(*)::int from email_outbox
      `)
      const sideMap = Object.fromEntries(side.map((r) => [r.n, r.c]))
      const expected = { movements: 2, slot: 1, booking_items: 1, coupon_uses: 1, redemptions: 1, payments: 1, history: 1, outbox: 1 }
      const sideOk = Object.entries(expected).every(([k, v]) => sideMap[k] === v)
      if (sideOk) ok('one transaction wrote: movements, slot claim, booking items, coupon ledger, payment, history, outbox')
      else fail('atomic side effects', JSON.stringify(sideMap))
    }

    // 2. Idempotent replay returns the ORIGINAL order and writes nothing new.
    const replay = await placeOrder(payload({}))
    if (!replay.error && replay.result!.existing === true && replay.result!.order_number === orderA.result?.order_number) {
      const { rows } = await db.query<{ c: number }>(`select count(*)::int as c from email_outbox`)
      if (rows[0].c === 1) ok('idempotent replay: same order returned, no duplicate email queued')
      else fail('replay side effects', `outbox rows: ${rows[0].c}`)
    } else fail('idempotent replay', replay.error ?? JSON.stringify(replay.result))

    // 3. Oversell rolls back the WHOLE order, not just the stock write.
    const oversell = await placeOrder(payload({
      idempotency_key: 'order-B',
      coupon: null, booking: null, email: null,
      totals: { subtotal: 990000, discount: 0, shipping: 0, tax: 0, total: 990000 },
      items: [{ kind: 'product', variant_id: VARIANT, name: 'Test Med',
        unit_price_paisa: 10000, quantity: 99, requires_prescription: false }],
    }))
    if (oversell.error?.includes('insufficient_stock')) {
      const { rows } = await db.query<{ c: number }>(
        `select count(*)::int as c from orders where idempotency_key = 'order-B'`,
      )
      if (rows[0].c === 0) ok('oversell: insufficient_stock raised, entire order rolled back')
      else fail('oversell atomicity', 'order row survived the failure')
    } else fail('oversell rejected', oversell.error ?? 'no error raised')

    // 4. Full slot refuses the booking (capacity 1, already claimed by order A).
    const slotFull = await placeOrder(payload({
      idempotency_key: 'order-C',
      coupon: null, email: null,
      totals: { subtotal: 30000, discount: 0, shipping: 0, tax: 0, total: 30000 },
      items: [{ kind: 'test', test_id: LABTEST, lab_id: LAB, name: 'CBC',
        unit_price_paisa: 30000, quantity: 1, requires_prescription: false }],
      booking: {
        lab_id: LAB, slot_id: SLOT, scheduled_at: new Date(Date.now() + 86400000).toISOString(),
        patient_name: 'Patient Two', patient_age: 30, patient_gender: 'male',
        patient_phone: '+923009999999', collection_mode: 'lab_visit', collection_address: null,
        tests: [{ test_id: LABTEST, test_name: 'CBC', item_index: 0 }],
      },
    }))
    if (slotFull.error?.includes('slot_unavailable')) ok('full slot: booking refused, order rolled back')
    else fail('slot capacity guard', slotFull.error ?? 'no error raised')

    // 5. Exhausted coupon (usage_limit 1, used by order A) fails the order.
    const couponGone = await placeOrder(payload({
      idempotency_key: 'order-D',
      booking: null, email: null,
      totals: { subtotal: 10000, discount: 1000, shipping: 0, tax: 0, total: 9000 },
      items: [{ kind: 'product', variant_id: VARIANT, name: 'Test Med',
        unit_price_paisa: 10000, quantity: 1, requires_prescription: false }],
      coupon: { id: COUPON, code: 'SAVE10', discount_paisa: 1000 },
    }))
    if (couponGone.error?.includes('coupon_exhausted')) ok('exhausted coupon budget fails the order (no over-redemption)')
    else fail('coupon budget guard', couponGone.error ?? 'no error raised')

    // 6. Cancellation restore is exact and idempotent.
    const orderAId = String(orderA.result?.order_id)
    const { rows: rel1 } = await db.query<{ release_order_stock: number }>(
      `select release_order_stock('${orderAId}')`,
    )
    const { rows: rel2 } = await db.query<{ release_order_stock: number }>(
      `select release_order_stock('${orderAId}')`,
    )
    const { rows: after } = await db.query<{ id: string; quantity_on_hand: number }>(
      `select id, quantity_on_hand from inventory_batches where id in ('${B1}','${B2}')`,
    )
    const restored = after.every((b) => (b.id === B1 ? b.quantity_on_hand === 5 : b.quantity_on_hand === 10))
    if (rel1[0].release_order_stock === 7 && rel2[0].release_order_stock === 0 && restored)
      ok('release_order_stock: restores 7 units exactly once (repeat call is a no-op)')
    else
      fail('cancellation restore', `first=${rel1[0].release_order_stock} second=${rel2[0].release_order_stock} batches=${JSON.stringify(after)}`)

    // 7. Outbox claim: visibility timeout prevents double-claiming.
    const { rows: claim1 } = await db.query(`select id, attempts from claim_email_outbox(10)`)
    const { rows: claim2 } = await db.query(`select id from claim_email_outbox(10)`)
    if (claim1.length === 1 && claim2.length === 0)
      ok('claim_email_outbox: claims once, immediate re-claim gets nothing (backoff)')
    else fail('outbox claim semantics', `first=${claim1.length} second=${claim2.length}`)
  }

  await db.close()

  console.log(
    failures === 0
      ? `\nmigrations-check: all ${files.length} migrations apply cleanly; RLS behavior verified.`
      : `\nmigrations-check: ${failures} FAILURE(S).`,
  )
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error('migrations-check crashed:', error)
  process.exit(1)
})
