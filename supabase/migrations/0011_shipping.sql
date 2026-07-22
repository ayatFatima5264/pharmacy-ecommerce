-- 0011_shipping.sql
-- Delivery zones, rates, and physical shipments.

-- ---------------------------------------------------------------------------
-- shipping_zones: geographic groupings that share a rate card.
-- Rates are per zone, not per city, so adding a city is one row rather than a
-- new price list.
-- ---------------------------------------------------------------------------
create table shipping_zones (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                -- 'Karachi Metro', 'Punjab Upcountry'
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- A city (optionally an area within it) belongs to one zone.
create table shipping_zone_areas (
  id       uuid primary key default gen_random_uuid(),
  zone_id  uuid not null references shipping_zones(id) on delete cascade,
  city     text not null,
  area     text,                            -- null = whole city
  -- NULLS NOT DISTINCT: plain UNIQUE treats NULLs as distinct, which would let
  -- the same whole city ('Karachi', NULL) join two zones -- exactly what this
  -- constraint exists to prevent. Zone resolution must be deterministic.
  unique nulls not distinct (city, area)
);
create index shipping_zone_areas_zone_idx on shipping_zone_areas (zone_id);
create index shipping_zone_areas_lookup_idx on shipping_zone_areas (city, area);

-- ---------------------------------------------------------------------------
-- shipping_methods: courier/service offerings (TCS Overnight, Leopards Standard).
-- supports_cod matters: not every courier handles cash collection, and COD is
-- the dominant payment method here.
-- ---------------------------------------------------------------------------
create table shipping_methods (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  carrier       text not null,
  min_days      int not null default 1,
  max_days      int not null default 3,
  supports_cod  boolean not null default true,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),

  constraint shipping_methods_day_range check (max_days >= min_days)
);

-- ---------------------------------------------------------------------------
-- shipping_rates: price for (zone, method), optionally banded by order weight.
--
-- Weight bands are rows rather than a formula because courier tariffs in
-- Pakistan are stepped, not linear, and change often -- pricing must be
-- editable by an admin without a deploy.
--
-- free_above_paisa implements "free delivery over Rs 2000" at the rate level.
-- ---------------------------------------------------------------------------
create table shipping_rates (
  id                uuid primary key default gen_random_uuid(),
  zone_id           uuid not null references shipping_zones(id) on delete cascade,
  method_id         uuid not null references shipping_methods(id) on delete cascade,
  min_weight_grams  int not null default 0,
  max_weight_grams  int,                    -- null = no upper bound
  rate_paisa        bigint not null check (rate_paisa >= 0),
  free_above_paisa  bigint check (free_above_paisa >= 0),
  is_active         boolean not null default true,

  constraint shipping_rates_weight_band
    check (max_weight_grams is null or max_weight_grams > min_weight_grams)
);
create index shipping_rates_lookup_idx
  on shipping_rates (zone_id, method_id, min_weight_grams) where is_active;

-- ---------------------------------------------------------------------------
-- shipments: a physical parcel.
--
-- Separate from orders because one order can ship in several parcels (an item
-- out of stock at the local branch ships later from another), and because a
-- lab-only order has no shipment at all. Putting tracking_number on orders
-- would break both cases.
-- ---------------------------------------------------------------------------
create table shipments (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  pharmacy_id     uuid not null references pharmacies(id) on delete restrict,
  method_id       uuid references shipping_methods(id) on delete set null,

  tracking_number text,
  status          shipment_status not null default 'pending',
  weight_grams    int,

  dispatched_at   timestamptz,
  delivered_at    timestamptz,
  failure_reason  text,                     -- COD refusals, address not found
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index shipments_order_idx  on shipments (order_id);
create index shipments_status_idx on shipments (status, created_at desc);
create index shipments_tracking_idx on shipments (tracking_number)
  where tracking_number is not null;
create trigger shipments_updated_at before update on shipments
  for each row execute function set_updated_at();

-- Which lines went in which parcel. Quantity, because a line can split.
create table shipment_items (
  shipment_id   uuid not null references shipments(id) on delete cascade,
  order_item_id uuid not null references order_items(id) on delete cascade,
  quantity      int not null check (quantity > 0),
  primary key (shipment_id, order_item_id)
);
create index shipment_items_order_item_idx on shipment_items (order_item_id);
