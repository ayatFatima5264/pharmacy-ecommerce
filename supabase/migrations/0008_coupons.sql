-- 0008_coupons.sql
-- Discount codes. Defined before orders because orders reference them.

-- ---------------------------------------------------------------------------
-- coupons
--
-- max_discount_paisa caps percentage coupons ("20% off, up to Rs 500") --
-- without it, a percentage coupon on a large order is an unbounded liability.
--
-- usage_count is a denormalized counter maintained alongside
-- coupon_redemptions. The ledger is the truth; the counter exists so the
-- checkout validity check is a single-row read rather than a COUNT(*) over a
-- growing table on every cart update.
-- ---------------------------------------------------------------------------
create table coupons (
  id                  uuid primary key default gen_random_uuid(),
  code                citext not null unique,     -- citext: users type 'save20'
  description         text,

  discount_type       discount_type not null,
  -- Split by type instead of one ambiguous discount_value: a fixed amount IS
  -- money and must follow the bigint-paisa convention; a percentage is not.
  discount_percent      numeric(5,2) check (discount_percent > 0 and discount_percent <= 100),
  discount_amount_paisa bigint check (discount_amount_paisa > 0),
  max_discount_paisa  bigint check (max_discount_paisa >= 0),
  min_order_paisa     bigint not null default 0 check (min_order_paisa >= 0),

  usage_limit         int check (usage_limit > 0),      -- null = unlimited
  usage_limit_per_user int check (usage_limit_per_user > 0),
  usage_count         int not null default 0,

  starts_at           timestamptz not null default now(),
  expires_at          timestamptz,
  is_active           boolean not null default true,

  -- true  = applies to everything except listed scopes (exclusions)
  -- false = applies ONLY to listed scopes (inclusions)
  is_exclusion_list   boolean not null default true,

  created_by          uuid references profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint coupons_window check (expires_at is null or expires_at > starts_at),
  -- The value column required by each type must be present, and only that one.
  constraint coupons_value_matches_type check (
    (discount_type = 'percentage'    and discount_percent is not null and discount_amount_paisa is null) or
    (discount_type = 'fixed_amount'  and discount_amount_paisa is not null and discount_percent is null) or
    (discount_type = 'free_shipping' and discount_percent is null and discount_amount_paisa is null)
  ),
  -- max_discount caps PERCENTAGE coupons; it is meaningless on the other types.
  constraint coupons_cap_only_for_percentage
    check (discount_type = 'percentage' or max_discount_paisa is null),
  constraint coupons_usage_count_positive check (usage_count >= 0)
);
create index coupons_active_idx on coupons (code) where is_active;
create trigger coupons_updated_at before update on coupons
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- coupon_scopes: restrict a coupon to (or from) products, categories, brands,
-- lab tests, or packages.
--
-- Disjoint-subtype pattern: five nullable FKs with a CHECK that exactly one is
-- set. A generic (scope_type text, scope_id uuid) pair would be shorter but
-- would carry no referential integrity -- nothing would stop a scope row
-- pointing at a deleted category.
-- ---------------------------------------------------------------------------
create table coupon_scopes (
  id          uuid primary key default gen_random_uuid(),
  coupon_id   uuid not null references coupons(id) on delete cascade,
  product_id  uuid references products(id) on delete cascade,
  category_id uuid references categories(id) on delete cascade,
  brand_id    uuid references brands(id) on delete cascade,
  test_id     uuid references lab_tests(id) on delete cascade,
  package_id  uuid references health_packages(id) on delete cascade,

  constraint coupon_scopes_exactly_one check (
    (product_id  is not null)::int +
    (category_id is not null)::int +
    (brand_id    is not null)::int +
    (test_id     is not null)::int +
    (package_id  is not null)::int = 1
  )
);
create index coupon_scopes_coupon_idx on coupon_scopes (coupon_id);

-- ---------------------------------------------------------------------------
-- coupon_redemptions: the ledger behind usage_count.
-- Enforces per-user limits and gives finance a discount-cost report.
-- order_id FK is added in 0009, once orders exists.
-- ---------------------------------------------------------------------------
create table coupon_redemptions (
  id             uuid primary key default gen_random_uuid(),
  coupon_id      uuid not null references coupons(id) on delete restrict,
  user_id        uuid references profiles(id) on delete set null,
  order_id       uuid not null,
  discount_paisa bigint not null check (discount_paisa >= 0),
  redeemed_at    timestamptz not null default now()
);
create index coupon_redemptions_coupon_user_idx
  on coupon_redemptions (coupon_id, user_id);
-- One coupon cannot be applied twice to the same order.
create unique index coupon_redemptions_unique_per_order
  on coupon_redemptions (coupon_id, order_id);
