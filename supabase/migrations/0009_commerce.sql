-- 0009_commerce.sql
-- Carts and orders. Orders are the single financial umbrella over BOTH
-- pharmacy items and diagnostic bookings.

-- ---------------------------------------------------------------------------
-- carts
--
-- user_id nullable + session_id: guest carts must work. Cash on delivery is
-- dominant in Pakistan and forcing signup before browsing costs conversions.
-- On login, the session cart is merged into the user cart.
-- ---------------------------------------------------------------------------
create table carts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references profiles(id) on delete cascade,
  -- Anonymous CART token from a long-lived guest cookie -- deliberately NOT an
  -- FK to sessions (0013): auth sessions expire in hours, guest carts persist
  -- for weeks. Swept by the abandoned-cart job, not by session expiry.
  session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint carts_owner check (user_id is not null or session_id is not null)
);
create unique index carts_user_key    on carts (user_id)    where user_id is not null;
create unique index carts_session_key on carts (session_id) where user_id is null and session_id is not null;
-- Supports the abandoned-cart sweep.
create index carts_stale_idx on carts (updated_at);
create trigger carts_updated_at before update on carts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- cart_items
--
-- Same disjoint-subtype shape as order_items: a line is a product variant, a
-- lab test, or a health package -- exactly one.
--
-- Note there is NO price column. Cart prices are read live from the catalog so
-- a cart left open for a week does not honour a stale price. Price is frozen
-- only at checkout, into order_items.
-- ---------------------------------------------------------------------------
create table cart_items (
  id         uuid primary key default gen_random_uuid(),
  cart_id    uuid not null references carts(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete cascade,
  test_id    uuid references lab_tests(id) on delete cascade,
  package_id uuid references health_packages(id) on delete cascade,
  lab_id     uuid references labs(id) on delete set null,   -- chosen lab for test/package
  quantity   int not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),

  constraint cart_items_exactly_one check (
    (variant_id is not null)::int +
    (test_id    is not null)::int +
    (package_id is not null)::int = 1
  )
);
create index cart_items_cart_idx on cart_items (cart_id);
-- One row per distinct item per cart; adding again increments quantity.
create unique index cart_items_unique_line on cart_items (
  cart_id,
  coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(test_id,    '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(package_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

-- ---------------------------------------------------------------------------
-- orders
--
-- One order can contain medicines AND lab tests. It owns the money; fulfilment
-- is delegated to shipments (0011) and lab_bookings (0010). Splitting orders by
-- type would mean two payments, two coupon applications, and two invoices for
-- what the customer experiences as one purchase.
--
-- Address is SNAPSHOTTED as jsonb, not an FK to addresses. Editing a saved
-- address must never rewrite where a past order was delivered.
--
-- All totals are stored, not computed on read. An order is a financial record:
-- it must still show the same numbers years later even if tax rates, shipping
-- rates, or prices have all changed. This is intentional denormalization and
-- the standard exception to "never store derived values".
-- ---------------------------------------------------------------------------
create sequence order_number_seq start 100000;

create table orders (
  id             uuid primary key default gen_random_uuid(),
  order_number   text not null unique default ('HC-' || nextval('order_number_seq')),

  -- Nullable for guest checkout; contact captured explicitly.
  user_id        uuid references profiles(id) on delete set null,
  guest_email    citext,
  guest_phone    text,

  pharmacy_id    uuid references pharmacies(id) on delete restrict,  -- fulfilling branch
  status         order_status not null default 'pending_payment',

  -- Money (all bigint paisa)
  subtotal_paisa       bigint not null check (subtotal_paisa >= 0),
  discount_paisa       bigint not null default 0 check (discount_paisa >= 0),
  shipping_paisa       bigint not null default 0 check (shipping_paisa >= 0),
  tax_paisa            bigint not null default 0 check (tax_paisa >= 0),
  total_paisa          bigint not null check (total_paisa >= 0),
  currency             char(3) not null default 'PKR',

  coupon_id            uuid references coupons(id) on delete set null,

  shipping_address     jsonb,                -- null for lab-only orders
  billing_address      jsonb,
  shipping_city        text,                 -- flattened for zone reporting

  -- True if ANY line requires a prescription. Denormalized so checkout and the
  -- fulfilment queue can filter without joining through order_items → products.
  requires_prescription boolean not null default false,

  customer_notes       text,
  internal_notes       text,                 -- staff-only

  placed_at            timestamptz not null default now(),
  delivered_at         timestamptz,
  cancelled_at         timestamptz,
  updated_at           timestamptz not null default now(),

  -- COD market reality: phone is the primary contact channel. A guest order
  -- with only a phone number is contactable; requiring email would be wrong.
  constraint orders_contactable
    check (user_id is not null or guest_email is not null or guest_phone is not null),
  constraint orders_total_balances
    check (total_paisa = subtotal_paisa - discount_paisa + shipping_paisa + tax_paisa)
);
create index orders_user_idx     on orders (user_id, placed_at desc);
create index orders_status_idx   on orders (status, placed_at desc);
create index orders_pharmacy_idx on orders (pharmacy_id, status);
create index orders_guest_email_idx on orders (guest_email) where guest_email is not null;
-- Pharmacist/fulfilment queue: orders blocked on prescription verification.
create index orders_awaiting_rx_idx on orders (placed_at) where status = 'awaiting_rx';
create trigger orders_updated_at before update on orders
  for each row execute function set_updated_at();

-- Deferred FK from 0008.
alter table coupon_redemptions
  add constraint coupon_redemptions_order_fk
  foreign key (order_id) references orders(id) on delete cascade;

-- ---------------------------------------------------------------------------
-- order_items
--
-- Disjoint subtypes again: variant | test | package, exactly one.
--
-- Every descriptive field is SNAPSHOTTED (item_name, pack_size, unit price).
-- The FK is retained for analytics ("how many times was this SKU sold"), but
-- display and invoicing read the snapshot. Renaming or repricing a product must
-- never alter a historical invoice -- that would be a legal problem, not just a
-- reporting one.
--
-- Subtype FKs are ON DELETE RESTRICT, not SET NULL: SET NULL would zero the
-- exactly-one CHECK and fail anyway, with a misleading error -- and nulling the
-- FK would destroy the analytics link this comment promises. Catalog rows with
-- sales history are deactivated (is_active), never deleted.
--
-- prescription_id links the verified prescription that authorised this specific
-- line, which is the record a DRAP inspection asks for.
-- ---------------------------------------------------------------------------
create table order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,

  variant_id      uuid references product_variants(id) on delete restrict,
  test_id         uuid references lab_tests(id) on delete restrict,
  package_id      uuid references health_packages(id) on delete restrict,
  lab_id          uuid references labs(id) on delete restrict,

  -- Snapshot
  item_name       text not null,
  item_sku        text,
  pack_size       text,
  unit_price_paisa bigint not null check (unit_price_paisa >= 0),
  quantity        int not null check (quantity > 0),
  discount_paisa  bigint not null default 0 check (discount_paisa >= 0),
  tax_paisa       bigint not null default 0 check (tax_paisa >= 0),
  line_total_paisa bigint not null check (line_total_paisa >= 0),

  requires_prescription boolean not null default false,
  prescription_id uuid references prescriptions(id) on delete set null,

  created_at      timestamptz not null default now(),

  constraint order_items_exactly_one check (
    (variant_id is not null)::int +
    (test_id    is not null)::int +
    (package_id is not null)::int = 1
  ),
  constraint order_items_line_total
    check (line_total_paisa = (unit_price_paisa * quantity) - discount_paisa + tax_paisa)
);
create index order_items_order_idx   on order_items (order_id);
create index order_items_variant_idx on order_items (variant_id);
create index order_items_test_idx    on order_items (test_id);
create index order_items_package_idx on order_items (package_id);

-- ---------------------------------------------------------------------------
-- order_item_batches: which physical batch fulfilled which line.
--
-- A line of 3 packs may draw from two batches with different expiry dates, so
-- this is a join table, not a batch_id column on order_items. This is the table
-- a recall query runs against: "who received batch X".
-- ---------------------------------------------------------------------------
create table order_item_batches (
  order_item_id uuid not null references order_items(id) on delete cascade,
  batch_id      uuid not null references inventory_batches(id) on delete restrict,
  quantity      int  not null check (quantity > 0),
  primary key (order_item_id, batch_id)
);
create index order_item_batches_batch_idx on order_item_batches (batch_id);

-- ---------------------------------------------------------------------------
-- order_status_history: append-only transition log.
--
-- Answers "when did this ship" and "who cancelled it" without trusting a single
-- mutable status column. Customer-facing tracking timelines read from here.
-- ---------------------------------------------------------------------------
create table order_status_history (
  id          bigserial primary key,
  order_id    uuid not null references orders(id) on delete cascade,
  from_status order_status,                 -- null on creation
  to_status   order_status not null,
  reason      text,
  changed_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index order_status_history_order_idx
  on order_status_history (order_id, created_at desc);
