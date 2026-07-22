-- 0022_rx_flow.sql
-- Prescription workflow (blueprint W14) + in-app notification emission.
--
-- 1. Guests can upload prescriptions: user_id becomes nullable. A guest's
--    prescription is reachable only through the order that references it
--    (service role); account holders keep the RLS ownership policies.
-- 2. place_order v2: attaches an optional prescription to the order's Rx
--    lines, and emits staff notifications (order placed / booking placed /
--    prescription review needed) INSIDE the checkout transaction.

alter table prescriptions alter column user_id drop not null;

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
  v_prescription_id uuid := nullif(p->>'prescription_id', '')::uuid;
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

  for v_item in select * from jsonb_array_elements(p->'items')
  loop
    v_kind := v_item->>'kind';
    v_qty := (v_item->>'quantity')::int;

    insert into order_items (
      order_id, variant_id, test_id, package_id, lab_id,
      item_name, item_sku, pack_size, unit_price_paisa, quantity,
      discount_paisa, tax_paisa, line_total_paisa,
      requires_prescription, prescription_id
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
      0, 0,
      (v_item->>'unit_price_paisa')::bigint * v_qty,
      coalesce((v_item->>'requires_prescription')::boolean, false),
      -- The uploaded prescription authorises exactly the Rx lines (W14).
      case when coalesce((v_item->>'requires_prescription')::boolean, false)
           then v_prescription_id end
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

  if v_booking is not null then
    v_slot_id := nullif(v_booking->>'slot_id', '')::uuid;

    if v_slot_id is not null then
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

  insert into payments (order_id, method, status, amount_paisa)
    values (
      v_order_id,
      (p->>'payment_method')::payment_method,
      'pending',
      (p->'totals'->>'total')::bigint
    );

  insert into order_status_history (order_id, from_status, to_status)
    values (v_order_id, null, v_status);

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

  -- Staff notifications ride the SAME transaction: an order cannot exist
  -- without its bell entry, and a rolled-back order never rings.
  insert into notifications (type, title, body, link_url, dedupe_key)
    values (
      'order.placed',
      'New order ' || v_order_number,
      'Rs ' || round(((p->'totals'->>'total')::bigint) / 100.0) ||
        case when v_requires_rx then ' · prescription required' else '' end,
      '/admin/orders/' || v_order_number,
      'order.placed:' || v_order_number
    )
    on conflict (dedupe_key) do nothing;

  if v_booking_id is not null then
    insert into notifications (type, title, body, link_url, dedupe_key)
      values (
        'booking.placed',
        'New lab booking ' || v_booking_number,
        v_booking->>'patient_name' || ' · ' || (v_booking->>'collection_mode'),
        '/admin/lab-bookings',
        'booking.placed:' || v_booking_number
      )
      on conflict (dedupe_key) do nothing;
  end if;

  if v_requires_rx then
    insert into notifications (type, title, body, link_url, dedupe_key)
      values (
        'rx.review',
        'Prescription review needed — ' || v_order_number,
        case when v_prescription_id is not null
             then 'Prescription uploaded at checkout.'
             else 'No file uploaded — contact the customer.' end,
        '/admin/prescriptions',
        'rx.review:' || v_order_number
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

revoke execute on function place_order(jsonb) from public;
