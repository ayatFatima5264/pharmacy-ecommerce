-- 0023_imports.sql
-- Excel import engine, staged (docs/IMPORT-PRODUCTS.md, lean V1):
-- upload → parse + validate into import_rows → admin previews → commit.
-- Each row carries its own status, so a partial failure is visible per-row
-- and a re-upload of the same file is a harmless upsert.

create table imports (
  id           uuid primary key default gen_random_uuid(),
  type         text not null check (type in ('products', 'lab_tests')),
  filename     text not null,
  status       text not null default 'ready'
                 check (status in ('ready', 'completed', 'failed')),
  totals       jsonb not null default '{}',   -- {rows, creates, updates, errors, committed, failed}
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  committed_at timestamptz
);

create table import_rows (
  id          bigserial primary key,
  import_id   uuid not null references imports(id) on delete cascade,
  row_number  int not null,                    -- 1-based Excel row (after header)
  raw         jsonb not null,                  -- the row as uploaded
  action      text not null check (action in ('create', 'update', 'error')),
  messages    jsonb not null default '[]',     -- [{level: 'error'|'warning', message}]
  status      text not null default 'pending'
                check (status in ('pending', 'committed', 'failed')),
  result      text                             -- outcome note after commit
);
create index import_rows_import_idx on import_rows (import_id, row_number);

alter table imports enable row level security;      -- service-role only
alter table import_rows enable row level security;
