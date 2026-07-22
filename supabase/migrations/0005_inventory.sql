-- 0005_inventory.sql
-- Batch-tracked stock. Per pharmacy, per variant, per batch.

-- ---------------------------------------------------------------------------
-- inventory_batches
--
-- Medicine cannot be dispensed without a known batch number and expiry date --
-- it is a legal requirement and the only way a recall is actionable. So stock is
-- (pharmacy, variant, batch), never a single stock_count integer on the variant.
--
-- This is the single most expensive thing to retrofit: adding batches later
-- rewrites checkout, fulfilment, returns, and every stock report.
--
-- quantity_reserved holds stock committed to unpaid/unshipped orders so two
-- customers cannot buy the last pack. Available = quantity_on_hand - reserved.
-- ---------------------------------------------------------------------------
create table inventory_batches (
  id                uuid primary key default gen_random_uuid(),
  pharmacy_id       uuid not null references pharmacies(id) on delete restrict,
  variant_id        uuid not null references product_variants(id) on delete restrict,

  batch_number      text not null,
  expiry_date       date not null,
  manufacture_date  date,

  quantity_on_hand  int not null default 0 check (quantity_on_hand >= 0),
  quantity_reserved int not null default 0 check (quantity_reserved >= 0),
  cost_paisa        bigint check (cost_paisa >= 0),

  supplier_name     text,
  received_at       timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint inventory_reserved_lte_on_hand check (quantity_reserved <= quantity_on_hand),
  constraint inventory_expiry_after_manufacture
    check (manufacture_date is null or expiry_date > manufacture_date)
);

-- The same batch of the same SKU arrives at a branch once.
create unique index inventory_batches_unique
  on inventory_batches (pharmacy_id, variant_id, batch_number);

-- Primary allocation query: "cheapest-expiry sellable stock for this SKU here".
-- Ordering by expiry_date implements FEFO (First-Expired-First-Out), which is
-- the correct picking strategy for perishable goods -- not FIFO.
create index inventory_batches_allocation_idx
  on inventory_batches (variant_id, pharmacy_id, expiry_date)
  where quantity_on_hand > quantity_reserved;

-- Powers the "expiring soon" admin report and automated expiry sweeps.
create index inventory_batches_expiry_idx
  on inventory_batches (expiry_date) where quantity_on_hand > 0;

create trigger inventory_batches_updated_at before update on inventory_batches
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- stock_movements: append-only ledger.
--
-- Every quantity change writes a row here. quantity is signed: negative for
-- sales and damage, positive for purchases and returns.
--
-- Why a ledger rather than only mutating quantity_on_hand: a bare counter can
-- drift and gives no way to answer "why is this wrong". The ledger makes every
-- change attributable and lets on-hand be recomputed from scratch during a
-- stock audit. inventory_batches.quantity_on_hand is the fast running total;
-- this table is the truth it must reconcile against.
-- ---------------------------------------------------------------------------
create table stock_movements (
  id            bigserial primary key,
  batch_id      uuid not null references inventory_batches(id) on delete restrict,
  quantity      int  not null check (quantity <> 0),   -- signed
  reason        stock_movement_reason not null,
  reference_type text,                                 -- 'order', 'return'
  reference_id  uuid,
  notes         text,
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index stock_movements_batch_idx on stock_movements (batch_id, created_at desc);
create index stock_movements_reference_idx
  on stock_movements (reference_type, reference_id);
