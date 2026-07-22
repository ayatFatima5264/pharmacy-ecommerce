-- 0018_admin_ops.sql
-- Small operational helpers for the admin console (Step 5).

-- Frees one unit of slot capacity when a booking is cancelled. Guarded in the
-- WHERE clause so concurrent releases can never drive booked_count negative;
-- releasing an already-empty slot is a silent no-op.
create or replace function release_slot(p_slot_id uuid) returns void
language sql
as $$
  update collection_slots
    set booked_count = booked_count - 1
    where id = p_slot_id and booked_count > 0;
$$;

revoke execute on function release_slot(uuid) from public;
