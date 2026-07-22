-- 0012_payments.sql
-- Payment attempts, refunds, and COD cash reconciliation.

-- ---------------------------------------------------------------------------
-- payments
--
-- One row per ATTEMPT, not one per order. A customer whose JazzCash payment
-- fails and who then retries with Easypaisa produces three rows across two
-- attempts; the order's payment state is derived from them. Storing a single
-- payment row per order loses the failure history that fraud review and
-- gateway disputes depend on.
--
-- gateway_reference is the gateway's own transaction id -- the join key when
-- reconciling against a gateway settlement file.
--
-- gateway_response jsonb keeps the raw callback payload verbatim. In a payment
-- dispute the unparsed original is the evidence; parsed columns are convenience.
-- ---------------------------------------------------------------------------
create table payments (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references orders(id) on delete restrict,
  method            payment_method not null,
  status            payment_status not null default 'pending',

  amount_paisa      bigint not null check (amount_paisa > 0),
  currency          char(3) not null default 'PKR',

  gateway_reference text,
  gateway_response  jsonb not null default '{}',
  failure_reason    text,

  paid_at           timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index payments_order_idx on payments (order_id, created_at desc);
create index payments_status_idx on payments (status, created_at desc);
-- A gateway reference is unique per gateway. This is the idempotency guard:
-- payment webhooks are retried, and a duplicate delivery must not double-credit
-- an order. Insert on this index conflicts instead of inserting twice.
create unique index payments_gateway_reference_key
  on payments (method, gateway_reference) where gateway_reference is not null;
create trigger payments_updated_at before update on payments
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- refunds
--
-- Separate table because refunds are partial and repeatable: one order can have
-- several refunds (a returned item, then a goodwill adjustment). A
-- refunded_amount column on payments could not express that history.
-- ---------------------------------------------------------------------------
create table refunds (
  id                uuid primary key default gen_random_uuid(),
  payment_id        uuid not null references payments(id) on delete restrict,
  order_id          uuid not null references orders(id) on delete restrict,
  amount_paisa      bigint not null check (amount_paisa > 0),
  reason            text not null,
  status            refund_status not null default 'pending',
  gateway_reference text,
  processed_by      uuid references profiles(id) on delete set null,
  processed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index refunds_payment_idx on refunds (payment_id);
create index refunds_order_idx   on refunds (order_id);
create trigger refunds_updated_at before update on refunds
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- cod_collections: cash reconciliation.
--
-- COD is not "paid on delivery" from an accounting standpoint -- it is paid when
-- the courier remits the cash, which can be days later and is frequently short.
-- This table tracks the gap between amount collected and amount remitted, which
-- is a real and material source of loss in Pakistani e-commerce.
--
-- Omitting this is the most common accounting gap in COD-heavy stores.
-- ---------------------------------------------------------------------------
create table cod_collections (
  id                 uuid primary key default gen_random_uuid(),
  -- UNIQUE: one cash collection record per parcel. Without it the same
  -- delivery could be recorded twice and reconcile against phantom cash.
  shipment_id        uuid not null unique references shipments(id) on delete restrict,
  order_id           uuid not null references orders(id) on delete restrict,
  amount_collected_paisa bigint not null check (amount_collected_paisa >= 0),
  collected_at       timestamptz not null default now(),

  amount_remitted_paisa  bigint check (amount_remitted_paisa >= 0),
  remitted_at        timestamptz,
  remittance_reference text,
  is_reconciled      boolean not null default false,
  variance_notes     text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index cod_collections_order_idx on cod_collections (order_id);
create trigger cod_collections_updated_at before update on cod_collections
  for each row execute function set_updated_at();
-- The finance worklist: cash collected but not yet remitted.
create index cod_collections_unreconciled_idx
  on cod_collections (collected_at) where not is_reconciled;
