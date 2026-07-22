-- 0019_settings.sql
-- Typed settings registry (docs/SETTINGS.md, lean V1).
--
-- jsonb value per key; the SHAPE is owned by Zod schemas in code
-- (features/settings/registry.ts) with code defaults as the fallback layer —
-- a missing or invalid row can never blank the storefront. History rows make
-- every change attributable and revertible.

create table settings (
  key        text primary key,                -- 'business.info', 'store.status'
  value      jsonb not null,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table settings_history (
  id         bigserial primary key,
  key        text not null,
  value      jsonb not null,
  changed_by uuid references profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index settings_history_key_idx on settings_history (key, changed_at desc);

-- Service-role only (admin writes are permission-gated in the app layer).
alter table settings enable row level security;
alter table settings_history enable row level security;
