/**
 * Applies supabase/migrations to the LIVE project over a direct Postgres
 * connection — no CLI login required, only SUPABASE_DB_PASSWORD in .env.local.
 *
 * Compatible with the Supabase CLI: applied versions are recorded in
 * supabase_migrations.schema_migrations (the CLI's own ledger), so a later
 * `supabase db push` sees these migrations as already applied.
 *
 * Connection strategy: the direct host (db.<ref>.supabase.co) is IPv6-only on
 * new projects, so after trying it this falls back to probing the IPv4
 * connection poolers across common regions — a wrong region answers
 * "Tenant or user not found", which is our signal to try the next.
 *
 * Idempotent: already-recorded versions are skipped. Each file applies inside
 * its own transaction — a failing migration rolls back cleanly and stops.
 *
 * Run: npm run db:migrate
 */
import './load-env'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const password = process.env.SUPABASE_DB_PASSWORD

const POOLER_REGIONS = [
  'ap-south-1', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1',
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-north-1',
  'ca-central-1', 'sa-east-1',
]

async function tryConnect(config: {
  host: string
  port: number
  user: string
  label: string
}): Promise<Client | null> {
  const client = new Client({
    host: config.host,
    port: config.port,
    user: config.user,
    password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  })
  try {
    await client.connect()
    console.log(`  connected via ${config.label}`)
    return client
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.log(`  no   ${config.label}: ${message.split('\n')[0]}`)
    await client.end().catch(() => {})
    return null
  }
}

async function connect(ref: string): Promise<Client> {
  console.log('Connecting...')
  // 1. Direct host (works where IPv6 is available).
  const direct = await tryConnect({
    host: `db.${ref}.supabase.co`,
    port: 5432,
    user: 'postgres',
    label: `direct db.${ref}.supabase.co`,
  })
  if (direct) return direct

  // 2. IPv4 session poolers, region by region.
  for (const prefix of ['aws-0', 'aws-1']) {
    for (const region of POOLER_REGIONS) {
      const client = await tryConnect({
        host: `${prefix}-${region}.pooler.supabase.com`,
        port: 5432,
        user: `postgres.${ref}`,
        label: `pooler ${prefix}-${region}`,
      })
      if (client) return client
    }
  }
  console.error(
    'db-migrate: could not reach the database on any known endpoint. ' +
      'Check the project ref and SUPABASE_DB_PASSWORD.',
  )
  process.exit(1)
}

async function main() {
  if (!url || !password) {
    console.error(
      'db-migrate: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD in .env.local.',
    )
    process.exit(1)
  }
  const ref = new URL(url).hostname.split('.')[0]
  const client = await connect(ref)

  // The Supabase CLI's migration ledger — created if this runner gets there first.
  await client.query(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key,
      statements text[],
      name text
    );
  `)
  const { rows: appliedRows } = await client.query<{ version: string }>(
    'select version from supabase_migrations.schema_migrations',
  )
  const applied = new Set(appliedRows.map((r) => r.version))

  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
  let ran = 0

  for (const file of files) {
    const version = file.split('_')[0]
    const name = file.replace(/^\d+_/, '').replace(/\.sql$/, '')
    if (applied.has(version)) {
      console.log(`  skip ${file} (already applied)`)
      continue
    }
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
    try {
      await client.query('begin')
      await client.query(sql)
      await client.query(
        'insert into supabase_migrations.schema_migrations (version, name) values ($1, $2)',
        [version, name],
      )
      await client.query('commit')
      ran++
      console.log(`  ok   ${file}`)
    } catch (error) {
      await client.query('rollback').catch(() => {})
      console.error(
        `FAIL  ${file}\n      ${error instanceof Error ? error.message : String(error)}`,
      )
      await client.end()
      process.exit(1)
    }
  }

  await client.end()
  console.log(`\ndb-migrate: ${ran} applied, ${files.length - ran} already in place.`)
}

main().catch((error) => {
  console.error('db-migrate crashed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
