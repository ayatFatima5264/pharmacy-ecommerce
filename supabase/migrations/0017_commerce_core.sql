-- 0016_commerce_core.sql
-- The transactional heart of checkout: stock reservation, atomic order
-- placement, and cancellation restore. These are Postgres functions because
-- supabase-js has no client-side transactions -- and the one thing checkout
-- must be is atomic. One RPC call = one transaction = an order either fully
-- exists (order, items, batches, stock, booking, payment, history, email)
-- or not at all.
--
-- DIVISION OF LABOUR with the application layer (kept deliberately simple):
--   * TypeScript re-prices the cart from the catalog and validates input.
--     Its pricing engine is trusted server code with its own test suite.
--   * These functions own CONCURRENCY and ATOMICITY: row-locked FEFO stock
--     picks, guarded slot capacity, idempotency, all-or-nothing inserts.
--     They re-verify what races can break (stock, slots, coupon budget) --
--     they do not re-verify arithmetic (the orders CHECK constraints do).
--
-- All functions are called through the SERVICE ROLE only: no SECURITY
-- DEFINER, and EXECUTE is revoked from PUBLIC below (0014 already strips
-- anon/authenticated).

-- Idempotency anchor: a double-click, a retry, or a flaky connection
-- resubmitting the same checkout must return the ORIGINAL order.
alter table orders add column idempotency_key text unique;

-- ---------------------------------------------------------------------------
-- reserve_stock: FEFO pick for one order line, under row locks.
--
-- Decrements quantity_on_hand immediately (a placed COD order IS a sale).
-- quantity_reserved stays for the future gateway flow, where stock is held
-- during `awaiting_payment` and released on TTL (blueprint W7) -- adding that
-- changes this function only, not its callers.
--
-- FEFO (First-Expired-First-Out), not FIFO: perishable goods must leave in
-- expiry order. Expired batches are excluded here and written off separately.
-- ---------------------------------------------------------------------------
create or replace function reserve_stock(
  p_order_id uuid,
  p_order_item_id uuid,
  p_pharmacy_id uuid,
  p_variant_id uuid,
  p_quantity int
) returns void
language plpgsql
as $$
declare
  v_remaining int := p_quantity;
  v_batch record;
  v_take int;
begin
  if p_quantity <= 0 then
    raise exception 'reserve_stock: quantity must be positive, got %', p_quantity;
  end if;

  -- FOR UPDATE serializes concurrent checkouts on the same batches: two
  -- customers racing for the last pack resolve to one winner and one clean
  -- insufficient_stock error -- never oversell.
  for v_batch in
    select id, quantity_on_hand - quantity_reserved as available
    from inventory_batches
    where variant_id = p_variant_id
      and pharmacy_id = p_pharmacy_id
      and expiry_date > current_date
      and quantity_on_hand - quantity_reserved > 0
    order by expiry_date asc, id asc
    for update
  loop
    exit when v_remaining = 0;
    v_take := least(v_batch.available, v_remaining);

    update inventory_batches
      set quantity_on_hand = quantity_on_hand - v_take
      where id = v_batch.id;

    insert into stock_movements (batch_id, quantity, reason, reference_type, reference_id)
      values (v_batch.id, -v_take, 'sale', 'order', p_order_id);

    -- The recall-traceability record: which physical batch filled this line.
    insert into order_item_batches (order_item_id, batch_id, quantity)
      values (p_order_item_id, v_batch.id, v_take);

    v_remaining := v_remaining - v_take;
  end loop;

  if v_remaining > 0 then
    raise exception 'insufficient_stock'
      using detail = format('variant=%s short_by=%s', p_variant_id, v_remaining),
            errcode = 'P0001';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- release_order_stock: compensating restore on cancellation. IDEMPOTENT --
-- re-running a cancellation must not double-restore (blueprint W4).
-- Returns units restored (0 on the no-op repeat call).
-- ---------------------------------------------------------------------------
create or replace function release_order_stock(p_order_id uuid) returns int
language plpgsql
as $$
declare
  v_row record;
  v_restored int := 0;
begin
  -- Serialize concurrent releases of the same order.
  perform 1 from orders where id = p_order_id for update;
  if not found then
    raise exception 'release_order_stock: unknown order %', p_order_id;
  end if;

  -- The idempotency guard: a restore already ledgered means we are done.
  if exists (
    select 1 from stock_movements
    where reference_type = 'order' and reference_id = p_order_id and reason = 'return'
  ) then
    return 0;
  end if;

  for v_row in
    select oib.batch_id, oib.quantity
    from order_item_batches oib
    join order_items oi on oi.id = oib.order_item_id
    where oi.order_id = p_order_id
  loop
    update inventory_batches
      set quantity_on_hand = quantity_on_hand + v_row.quantity
      where id = v_row.batch_id;
    insert into stock_movements (batch_id, quantity, reason, reference_type, reference_id)
      values (v_row.batch_id, v_row.quantity, 'return', 'order', p_order_id);
    v_restored := v_restored + v_row.quantity;
  end loop;

  return v_restored;
end;
$$;

-- ---------------------------------------------------------------------------
-- place_order: the atomic checkout transaction.
--
-- Payload (built by the server-side checkout action from ALREADY-RE-PRICED
-- data -- nothing here ever came straight from a browser):
-- {
--   idempotency_key: text,
--   user_id: uuid|null, pharmacy_id: uuid|null (required with product items),
--   contact: { email|null, phone },
--   address: { ...snapshot... } | null,   city: text,
--   payment_method: 'cod'|'jazzcash'|'easypaisa'|'card'|'bank_transfer',
--   notes: text|null,
--   totals: { subtotal, discount, shipping, tax, total }  (paisa),
--   coupon: { id: uuid|null, code, discount_paisa } | null,
--   items: [{ kind:'product'|'test'|'package', variant_id?, test_id?,
--             package_id?, lab_id?, name, sku?, pack_size?, unit_price_paisa,
--             quantity, requires_prescription }],
--   booking: { lab_id, slot_id, scheduled_at, patient_name, patient_age,
--              patient_gender, patient_phone, collection_mode,
--              collection_address|null,
--              tests: [{ test_id, test_name, item_index }] } | null,
--   email: { template_key, recipient, dedupe_key, payload } | null
-- }
--
-- Returns { order_id, order_number, booking_id?, booking_number?, existing }.
-- Any failure raises -> the entire transaction rolls back.
-- ---------------------------------------------------------------------------
create or replace function place_order(p jsonb) returns jsonb
language plpgsql
as $$
declare
  v_existing record;
  v_order_id uuid;
  v_order_number text;
  v_status order_status;
  v_requires_rx boolean;
  v_pharmacy_id uuid := nullif(p->>'pharmacy_id', '')::uuid;
  v_item jsonb;
  v_item_id uuid;
  v_item_ids uuid[] := '{}';
  v_kind text;
  v_qty int;
  v_booking_id uuid;
  v_booking_number text;
  v_slot_id uuid;
  v_test jsonb;
  v_coupon jsonb := case when jsonb_typeof(p->'coupon') = 'object' then p->'coupon' else null end;
  v_booking jsonb := case when jsonb_typeof(p->'booking') = 'object' then p->'booking' else null end;
  v_email jsonb := case when jsonb_typeof(p->'email') = 'object' then p->'email' else null end;
begin
  if coalesce(p->>'idempotency_key', '') = '' then
    raise exception 'place_order: idempotency_key is required';
  end if;

  -- Idempotent replay: return the original order, touch nothing.
  select id, order_number into v_existing
    from orders where idempotency_key = p->>'idempotency_key';
  if found then
    return jsonb_build_object(
      'order_id', v_existing.id,
      'order_number', v_existing.order_number,
      'existing', true
    );
  end if;

  v_requires_rx := exists (
    select 1 from jsonb_array_elements(p->'items') i
    where coalesce((i->>'requires_prescription')::boolean, false)
  );

  -- Initial status is decided HERE, in one place: a prescription order is
  -- blocked on pharmacist review (W14); a bank transfer waits on funds; only
  -- a straightforwardly payable order starts life confirmed.
  v_status := case
    when v_requires_rx then 'awaiting_rx'::order_status
    when p->>'payment_method' = 'bank_transfer' then 'pending_payment'::order_status
    else 'confirmed'::order_status
  end;

  insert into orders (
    user_id, guest_email, guest_phone, pharmacy_id, status,
    subtotal_paisa, discount_paisa, shipping_paisa, tax_paisa, total_paisa,
    coupon_id, shipping_address, shipping_city, requires_prescription,
    customer_notes, idempotency_key
  ) values (
    nullif(p->>'user_id', '')::uuid,
    nullif(p->'contact'->>'email', ''),
    nullif(p->'contact'->>'phone', ''),
    v_pharmacy_id,
    v_status,
    (p->'totals'->>'subtotal')::bigint,
    coalesce((p->'totals'->>'discount')::bigint, 0),
    coalesce((p->'totals'->>'shipping')::bigint, 0),
    coalesce((p->'totals'->>'tax')::bigint, 0),
    (p->'totals'->>'total')::bigint,
    nullif(v_coupon->>'id', '')::uuid,
    p->'address',
    p->>'city',
    v_requires_rx,
    nullif(p->>'notes', ''),
    p->>'idempotency_key'
  ) returning id, order_number into v_order_id, v_order_number;

  -- Order lines, in payload order so booking.tests can reference item_index.
  for v_item in select * from jsonb_array_elements(p->'items')
  loop
    v_kind := v_item->>'kind';
    v_qty := (v_item->>'quantity')::int;

    insert into order_items (
      order_id, variant_id, test_id, package_id, lab_id,
      item_name, item_sku, pack_size, unit_price_paisa, quantity,
      discount_paisa, tax_paisa, line_total_paisa,
      requires_prescription
    ) values (
      v_order_id,
      case when v_kind = 'product' then (v_item->>'variant_id')::uuid end,
      case when v_kind = 'test'    then (v_item->>'test_id')::uuid end,
      case when v_kind = 'package' then (v_item->>'package_id')::uuid end,
      nullif(v_item->>'lab_id', '')::uuid,
      v_item->>'name',
      nullif(v_item->>'sku', ''),
      nullif(v_item->>'pack_size', ''),
      (v_item->>'unit_price_paisa')::bigint,
      v_qty,
      0, 0,  -- discount/tax are ORDER-level in V1; lines snapshot gross price
      (v_item->>'unit_price_paisa')::bigint * v_qty,
      coalesce((v_item->>'requires_prescription')::boolean, false)
    ) returning id into v_item_id;

    v_item_ids := array_append(v_item_ids, v_item_id);

    if v_kind = 'product' then
      if v_pharmacy_id is null then
        raise exception 'place_order: pharmacy_id is required for product items';
      end if;
      perform reserve_stock(
        v_order_id, v_item_id, v_pharmacy_id, (v_item->>'variant_id')::uuid, v_qty
      );
    end if;
  end loop;

  if coalesce(array_length(v_item_ids, 1), 0) = 0 then
    raise exception 'place_order: order has no items';
  end if;

  -- Lab booking: guarded slot claim + the phlebotomist's worklist.
  if v_booking is not null then
    v_slot_id := nullif(v_booking->>'slot_id', '')::uuid;

    if v_slot_id is not null then
      -- The capacity guard IS the WHERE clause: a full slot matches no row.
      update collection_slots
        set booked_count = booked_count + 1
        where id = v_slot_id and is_active and booked_count < capacity;
      if not found then
        raise exception 'slot_unavailable'
          using detail = format('slot=%s', v_slot_id), errcode = 'P0001';
      end if;
    end if;

    insert into lab_bookings (
      order_id, lab_id, patient_name, patient_age, patient_gender,
      patient_phone, collection_mode, slot_id, scheduled_at, collection_address
    ) values (
      v_order_id,
      (v_booking->>'lab_id')::uuid,
      v_booking->>'patient_name',
      (v_booking->>'patient_age')::int,
      v_booking->>'patient_gender',
      v_booking->>'patient_phone',
      (v_booking->>'collection_mode')::collection_mode,
      v_slot_id,
      (v_booking->>'scheduled_at')::timestamptz,
      v_booking->'collection_address'
    ) returning id, booking_number into v_booking_id, v_booking_number;

    for v_test in select * from jsonb_array_elements(v_booking->'tests')
    loop
      insert into lab_booking_items (booking_id, order_item_id, test_id, test_name)
        values (
          v_booking_id,
          v_item_ids[(v_test->>'item_index')::int + 1],
          (v_test->>'test_id')::uuid,
          v_test->>'test_name'
        );
    end loop;
  end if;

  -- Coupon: ledger + guarded counter. A coupon whose budget ran out between
  -- validation and here fails the whole order rather than over-redeeming.
  if v_coupon is not null and nullif(v_coupon->>'id', '') is not null then
    update coupons
      set usage_count = usage_count + 1
      where id = (v_coupon->>'id')::uuid
        and (usage_limit is null or usage_count < usage_limit);
    if not found then
      raise exception 'coupon_exhausted'
        using detail = format('coupon=%s', v_coupon->>'code'), errcode = 'P0001';
    end if;
    insert into coupon_redemptions (coupon_id, user_id, order_id, discount_paisa)
      values (
        (v_coupon->>'id')::uuid,
        nullif(p->>'user_id', '')::uuid,
        v_order_id,
        coalesce((v_coupon->>'discount_paisa')::bigint, 0)
      );
  end if;

  -- Payment attempt row (COD included: its lifecycle ends at cash remittance).
  insert into payments (order_id, method, status, amount_paisa)
    values (
      v_order_id,
      (p->>'payment_method')::payment_method,
      'pending',
      (p->'totals'->>'total')::bigint
    );

  -- Append-only status trail; null -> initial status marks creation.
  insert into order_status_history (order_id, from_status, to_status)
    values (v_order_id, null, v_status);

  -- Confirmation email rides the SAME transaction (outbox pattern, W5): an
  -- order cannot exist without its email being durably queued. The order
  -- number is only known here, so it is injected into the render payload and
  -- into the dedupe key by this function, not by the caller.
  if v_email is not null then
    insert into email_outbox (template_key, recipient, payload, dedupe_key)
      values (
        v_email->>'template_key',
        v_email->>'recipient',
        jsonb_set(
          coalesce(v_email->'payload', '{}'::jsonb),
          '{orderNumber}',
          to_jsonb(v_order_number)
        ),
        (v_email->>'template_key') || ':' || v_order_number
      )
      on conflict (dedupe_key) do nothing;
  end if;

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'booking_id', v_booking_id,
    'booking_number', v_booking_number,
    'existing', false
  );
end;
$$;

-- Service-role only (PUBLIC gets EXECUTE by default on new functions; 0014's
-- default-privilege revokes cover anon/authenticated but not PUBLIC).
revoke execute on function reserve_stock(uuid, uuid, uuid, uuid, int) from public;
revoke execute on function release_order_stock(uuid) from public;
revoke execute on function place_order(jsonb) from public;
