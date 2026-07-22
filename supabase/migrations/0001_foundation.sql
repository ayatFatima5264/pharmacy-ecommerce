-- 0001_foundation.sql
-- Extensions, shared enums, and common triggers.

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "citext";     -- case-insensitive email/slug
create extension if not exists "pg_trgm";    -- fuzzy product/test search

-- ---------------------------------------------------------------------------
-- Enums
--
-- Enums are used for values that are part of application logic (branched on in
-- code). Values that are business data an admin might add -- categories, cities,
-- payment gateways -- are lookup TABLES instead, because adding an enum value
-- requires a migration.
-- ---------------------------------------------------------------------------

create type order_status as enum (
  'pending_payment',      -- awaiting online payment
  'awaiting_rx',          -- blocked: prescription not yet verified
  'confirmed',
  'processing',
  'partially_shipped',    -- physical lines shipped, lab lines still pending
  'shipped',
  'delivered',
  'delivery_failed',      -- COD-specific: courier could not deliver
  'cancelled',
  'refunded'
);

create type payment_status as enum (
  'pending', 'authorized', 'paid', 'failed', 'refunded', 'partially_refunded'
);

create type payment_method as enum (
  'cod', 'jazzcash', 'easypaisa', 'card', 'bank_transfer'
);

-- Refunds have their own lifecycle. Reusing payment_status here would allow
-- nonsense states ('authorized', 'partially_refunded') on a refund row.
create type refund_status as enum ('pending', 'processed', 'failed');

create type shipment_status as enum (
  'pending', 'packed', 'dispatched', 'in_transit', 'delivered', 'returned', 'lost'
);

create type prescription_status as enum (
  'pending_review', 'approved', 'rejected', 'expired'
);

create type lab_booking_status as enum (
  'scheduled',
  'sample_pending',
  'sample_collected',
  'in_lab',
  'report_ready',
  'cancelled',
  'no_show'          -- patient unavailable at collection slot
);

create type collection_mode as enum ('home', 'lab_visit');

create type discount_type as enum ('percentage', 'fixed_amount', 'free_shipping');

create type stock_movement_reason as enum (
  'purchase', 'sale', 'return', 'damage', 'expiry', 'adjustment', 'transfer'
);

-- ---------------------------------------------------------------------------
-- Shared trigger: maintain updated_at
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
