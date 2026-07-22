-- 0007_prescriptions.sql
-- Prescription upload and pharmacist verification.

-- ---------------------------------------------------------------------------
-- prescriptions
--
-- A prescription is an asset owned by the customer, uploaded once and usable
-- across orders (repeat prescriptions are normal). It is therefore NOT a child
-- of orders -- order_items reference it, not the reverse.
--
-- file_path is a Supabase Storage key in a PRIVATE bucket, served via
-- short-lived signed URLs. Never a public URL: these are health records.
--
-- valid_until supports the expiry rule -- a prescription cannot be reused
-- indefinitely.
-- ---------------------------------------------------------------------------
create table prescriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,

  file_path     text not null,               -- private storage key
  file_mime     text not null,
  patient_name  text not null,
  doctor_name   text,
  doctor_registration_no text,
  issued_on     date,
  valid_until   date,

  status        prescription_status not null default 'pending_review',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint prescriptions_valid_after_issue
    check (valid_until is null or issued_on is null or valid_until >= issued_on)
);
-- Drives the pharmacist queue: oldest pending first.
create index prescriptions_review_queue_idx
  on prescriptions (created_at) where status = 'pending_review';
create index prescriptions_user_idx on prescriptions (user_id, created_at desc);
create trigger prescriptions_updated_at before update on prescriptions
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- prescription_reviews: the pharmacist's decision, as an append-only record.
--
-- A separate table rather than columns on prescriptions because a prescription
-- can be reviewed more than once (rejected, re-uploaded, escalated), and
-- because each decision must be permanently attributable to a licensed
-- pharmacist. Overwriting `reviewed_by` would destroy that history.
--
-- pharmacist_id references the LICENCE record, not just the user account -- see
-- the note in 0003.
-- ---------------------------------------------------------------------------
create table prescription_reviews (
  id              uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references prescriptions(id) on delete cascade,
  pharmacist_id   uuid not null references pharmacists(id) on delete restrict,
  decision        prescription_status not null,
  rejection_reason text,
  notes           text,
  reviewed_at     timestamptz not null default now(),

  constraint prescription_reviews_reason_on_reject
    check (decision <> 'rejected' or rejection_reason is not null),
  -- A pharmacist DECIDES approved/rejected. 'pending_review' and 'expired' are
  -- prescription lifecycle states, not decisions, and must not be recordable here.
  constraint prescription_reviews_decision_values
    check (decision in ('approved', 'rejected'))
);
create index prescription_reviews_prescription_idx
  on prescription_reviews (prescription_id, reviewed_at desc);
