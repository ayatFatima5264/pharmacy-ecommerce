/**
 * Live-database check: verifies the configured Supabase project is reachable
 * and the migration set has been applied to it (core tables answer queries
 * through the service role).
 *
 * SKIPS with exit 0 when Supabase env vars are absent -- the repo must keep
 * passing `npm run check` on machines with no database during the W1
 * transition. Once every module is DB-backed, flip REQUIRED to true.
 */
import './load-env'
import { createClient } from '@supabase/supabase-js'

const REQUIRED = false

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Ordered roughly by migration; one representative table per module.
const CORE_TABLES = [
  'profiles', 'user_roles',
  'pharmacies', 'products', 'product_variants',
  'inventory_batches', 'lab_tests', 'health_packages',
  'prescriptions', 'coupons', 'orders', 'order_items',
  'lab_bookings', 'shipments', 'payments',
  'rate_limits', 'email_outbox',
]

async function main() {
  if (!url || !serviceKey) {
    if (REQUIRED) {
      console.error('db-check: Supabase env vars missing and REQUIRED=true.')
      process.exit(1)
    }
    console.log('db-check: Supabase not configured - skipping (see .env.example).')
    process.exit(0)
  }

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let failures = 0
  for (const table of CORE_TABLES) {
    const { error } = await db.from(table).select('*', { count: 'exact', head: true }).limit(0)
    if (error) {
      failures++
      console.error(`FAIL  ${table}: ${error.message}`)
    } else {
      console.log(`  ok  ${table}`)
    }
  }

  if (failures) {
    console.error(
      `\ndb-check: ${failures} table(s) unreachable. Have the migrations been applied?` +
        '\nApply with: npx supabase db push  (after npx supabase link)',
    )
    process.exit(1)
  }
  console.log(`\ndb-check: connected; all ${CORE_TABLES.length} core tables present.`)
}

main().catch((error) => {
  console.error('db-check crashed:', error)
  process.exit(1)
})
