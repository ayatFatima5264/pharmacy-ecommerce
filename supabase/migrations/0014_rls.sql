-- 0014_rls.sql
-- Row Level Security. Deny-by-default baseline, then explicit policies.
--
-- SECURITY MODEL (revised: Supabase Auth is the identity provider):
--
--   anon           public catalog reads only. Everything else invisible.
--   authenticated  catalog reads + OWN rows (auth.uid() = profiles.id) on
--                  customer data. RLS is the enforcement, not a convention.
--   service_role   bypasses RLS. Used ONLY from server code for admin/staff
--                  operations (guarded by authorizeAction/has_permission),
--                  guest checkout (no auth.uid() exists), webhooks, and cron.
--
-- Three durable rules:
--   1. Every table has RLS ENABLED, including ones with no policies at all
--      (deny-by-default). New tables MUST enable RLS in their own migration.
--   2. Customer write paths that move money or stock (orders, payments,
--      bookings) have NO insert/update policies on purpose -- they only exist
--      as server-side transactions through the service role. A client with a
--      valid JWT still cannot forge an order row.
--   3. Staff access is service-role + app-layer permission checks today. The
--      has_permission(citext) overload (0002) exists so staff RLS policies can
--      be added incrementally later without restructuring.

-- ---------------------------------------------------------------------------
-- 1. Baseline: RLS on every table; strip default broad grants.
-- ---------------------------------------------------------------------------
do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables    in schema public from anon;
    revoke all on all sequences in schema public from anon;
    revoke all on all functions in schema public from anon;
    alter default privileges in schema public revoke all on tables    from anon;
    alter default privileges in schema public revoke all on sequences from anon;
    alter default privileges in schema public revoke all on functions from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on all tables    in schema public from authenticated;
    revoke all on all sequences in schema public from authenticated;
    revoke all on all functions in schema public from authenticated;
    alter default privileges in schema public revoke all on tables    from authenticated;
    alter default privileges in schema public revoke all on sequences from authenticated;
    alter default privileges in schema public revoke all on functions from authenticated;
  end if;
end $$;

-- Re-grant EXECUTE on the functions policies depend on (the blanket revoke
-- above just removed the grants 0002 issued).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function has_permission(uuid, citext) to authenticated;
    grant execute on function has_permission(citext) to authenticated;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Ownership helpers.
--
-- SECURITY DEFINER so a policy on a CHILD table (order_items) can check the
-- PARENT (orders) without re-entering the parent's own RLS -- cleaner plans
-- and no policy recursion. STABLE lets the planner cache per statement.
-- ---------------------------------------------------------------------------
create or replace function owns_order(p_order_id uuid)
returns boolean
language sql stable security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1 from orders o
    where o.id = p_order_id and o.user_id = auth.uid()
  );
$$;

create or replace function owns_booking(p_booking_id uuid)
returns boolean
language sql stable security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1 from lab_bookings b
    join orders o on o.id = b.order_id
    where b.id = p_booking_id and o.user_id = auth.uid()
  );
$$;

create or replace function owns_cart(p_cart_id uuid)
returns boolean
language sql stable security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1 from carts c
    where c.id = p_cart_id and c.user_id = auth.uid()
  );
$$;

do $$
begin
  revoke execute on function owns_order(uuid)   from public;
  revoke execute on function owns_booking(uuid) from public;
  revoke execute on function owns_cart(uuid)    from public;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function owns_order(uuid)   to authenticated;
    grant execute on function owns_booking(uuid) to authenticated;
    grant execute on function owns_cart(uuid)    to authenticated;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Public catalog: readable by everyone, active rows only.
--    Grants are wrapped for bare-Postgres verification (roles absent there).
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant select on
      brands, categories, products, product_categories, product_variants,
      product_images, pharmacies, labs, lab_tests, lab_test_pricing,
      health_packages, health_package_tests, collection_slots,
      shipping_zones, shipping_zone_areas, shipping_methods, shipping_rates
    to anon, authenticated;
  end if;
end $$;

create policy brands_public_read     on brands     for select using (is_active);
create policy categories_public_read on categories for select using (is_active);
create policy products_public_read   on products   for select using (is_active);
create policy product_categories_public_read on product_categories for select using (true);
create policy product_variants_public_read   on product_variants   for select using (is_active);
create policy product_images_public_read     on product_images     for select using (true);
create policy pharmacies_public_read on pharmacies for select using (is_active);
create policy labs_public_read       on labs       for select using (is_active);
create policy lab_test_pricing_public_read on lab_test_pricing for select using (is_available);
create policy lab_tests_public_read  on lab_tests  for select using (is_active);
create policy health_packages_public_read on health_packages for select using (is_active);
create policy health_package_tests_public_read on health_package_tests for select using (true);
create policy collection_slots_public_read on collection_slots for select using (is_active);
create policy shipping_zones_public_read   on shipping_zones   for select using (is_active);
create policy shipping_zone_areas_public_read on shipping_zone_areas for select using (true);
create policy shipping_methods_public_read on shipping_methods for select using (is_active);
create policy shipping_rates_public_read   on shipping_rates   for select using (is_active);

-- Deliberately NOT publicly readable: coupons (the namespace is a secret;
-- validation is a server action), inventory_batches (competitive data),
-- everything financial, and all RBAC/audit tables.

-- ---------------------------------------------------------------------------
-- 4. Customer-owned data: auth.uid() = the row's owner.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select, update (full_name, phone, date_of_birth, gender, avatar_url)
      on profiles to authenticated;
    grant select, insert, update, delete on addresses  to authenticated;
    grant select, insert                 on prescriptions to authenticated;
    grant select, insert, update, delete on carts      to authenticated;
    grant select, insert, update, delete on cart_items to authenticated;
    grant select on orders, order_items, order_status_history, shipments,
                    shipment_items, payments, refunds, lab_bookings,
                    lab_booking_items, lab_reports, coupon_redemptions
      to authenticated;
  end if;
end $$;

-- profiles: read/update self. INSERT stays trigger-only (handle_new_user);
-- email/id/is_active are not in the UPDATE column grant, so a user cannot
-- rewrite their identity or reactivate a disabled account.
create policy profiles_read_own   on profiles for select using (id = auth.uid());
create policy profiles_update_own on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

create policy addresses_own on addresses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- prescriptions: upload and view own. No update/delete -- a reviewed health
-- record is evidence; corrections happen by uploading a new one.
create policy prescriptions_read_own   on prescriptions for select
  using (user_id = auth.uid());
create policy prescriptions_insert_own on prescriptions for insert
  with check (user_id = auth.uid() and status = 'pending_review');

-- carts: own cart only. Guest carts (user_id null, session_id token) are
-- served exclusively through the service role -- anon has no grant here.
create policy carts_own on carts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cart_items_own on cart_items for all
  using (owns_cart(cart_id)) with check (owns_cart(cart_id));

-- Order history: READ ONLY through RLS. Placing, cancelling, and paying are
-- server-side transactions (service role) -- see durable rule 2 above.
create policy orders_read_own on orders for select using (user_id = auth.uid());
create policy order_items_read_own on order_items for select using (owns_order(order_id));
create policy order_status_history_read_own on order_status_history for select using (owns_order(order_id));
create policy shipments_read_own on shipments for select using (owns_order(order_id));
create policy shipment_items_read_own on shipment_items for select
  using (exists (select 1 from shipments s
                 where s.id = shipment_id and owns_order(s.order_id)));
create policy payments_read_own on payments for select using (owns_order(order_id));
create policy refunds_read_own  on refunds  for select using (owns_order(order_id));
create policy coupon_redemptions_read_own on coupon_redemptions for select
  using (user_id = auth.uid());

-- Lab bookings and reports: read own, via the order umbrella.
create policy lab_bookings_read_own on lab_bookings for select using (owns_order(order_id));
create policy lab_booking_items_read_own on lab_booking_items for select
  using (owns_booking(booking_id));
create policy lab_reports_read_own on lab_reports for select
  using (owns_booking(booking_id) and released_at is not null);

-- Everything else -- RBAC tables, audit_log, inventory, stock movements,
-- pharmacists, coupons, cod_collections, rate_limits -- has RLS enabled and
-- ZERO policies: service-role only, by design.
