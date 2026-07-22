-- 0010_lab_bookings.sql
-- Fulfilment for the diagnostic lines of an order.

-- ---------------------------------------------------------------------------
-- collection_slots: bookable capacity.
--
-- Home collection is capacity-constrained -- a lab can send N phlebotomists to
-- a city on a given morning. Modelling slots as rows lets the database enforce
-- that capacity with a constraint instead of the application racing on it.
-- ---------------------------------------------------------------------------
create table collection_slots (
  id            uuid primary key default gen_random_uuid(),
  lab_id        uuid not null references labs(id) on delete cascade,
  city          text not null,
  slot_date     date not null,
  starts_at     time not null,
  ends_at       time not null,
  capacity      int not null check (capacity > 0),
  booked_count  int not null default 0 check (booked_count >= 0),
  is_active     boolean not null default true,

  constraint collection_slots_not_overbooked check (booked_count <= capacity),
  constraint collection_slots_time_order check (ends_at > starts_at),
  unique (lab_id, city, slot_date, starts_at)
);
-- Availability lookup: "open slots for this lab in this city from today".
create index collection_slots_availability_idx
  on collection_slots (lab_id, city, slot_date)
  where is_active and booked_count < capacity;

-- ---------------------------------------------------------------------------
-- lab_bookings
--
-- Groups the diagnostic lines of one order into a single visit: one patient,
-- one address, one time slot. An order with 4 tests from the same lab is ONE
-- booking, not four -- the phlebotomist makes one trip and draws one sample.
--
-- patient_* is captured separately from the ordering user because people book
-- tests for parents and children. Age and sex are clinically required to
-- interpret reference ranges, so they are not optional decoration.
-- ---------------------------------------------------------------------------
create sequence booking_number_seq start 100000;

create table lab_bookings (
  id              uuid primary key default gen_random_uuid(),
  booking_number  text not null unique default ('LB-' || nextval('booking_number_seq')),
  order_id        uuid not null references orders(id) on delete cascade,
  lab_id          uuid not null references labs(id) on delete restrict,

  -- Patient (may differ from the account holder)
  patient_name    text not null,
  patient_age     int check (patient_age between 0 and 130),
  patient_gender  text check (patient_gender in ('male','female','other')),
  patient_phone   text not null,

  collection_mode collection_mode not null,
  slot_id         uuid references collection_slots(id) on delete set null,
  scheduled_at    timestamptz not null,
  collection_address jsonb,                 -- snapshot; required for home mode

  status          lab_booking_status not null default 'scheduled',
  phlebotomist_name text,
  sample_collected_at timestamptz,
  report_ready_at timestamptz,

  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint lab_bookings_home_needs_address
    check (collection_mode <> 'home' or collection_address is not null)
);
create index lab_bookings_order_idx  on lab_bookings (order_id);
create index lab_bookings_lab_idx    on lab_bookings (lab_id, scheduled_at);
create index lab_bookings_status_idx on lab_bookings (status, scheduled_at);
-- Daily collection worklist.
create index lab_bookings_schedule_idx on lab_bookings (scheduled_at)
  where status in ('scheduled','sample_pending');
create trigger lab_bookings_updated_at before update on lab_bookings
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- lab_booking_items: which order lines this visit covers.
--
-- Links back to order_items rather than duplicating test data, so money stays
-- in exactly one place (the order) while operations read the worklist here.
-- A package expands into its member tests at booking time, which is why
-- test_id is stored: the lab needs the individual tests to run, even when the
-- customer bought a bundle.
-- ---------------------------------------------------------------------------
create table lab_booking_items (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references lab_bookings(id) on delete cascade,
  order_item_id uuid not null references order_items(id) on delete cascade,
  test_id       uuid not null references lab_tests(id) on delete restrict,
  test_name     text not null,              -- snapshot
  status        lab_booking_status not null default 'scheduled',
  unique (booking_id, order_item_id, test_id)
);
create index lab_booking_items_booking_idx on lab_booking_items (booking_id);

-- ---------------------------------------------------------------------------
-- lab_reports: the deliverable.
--
-- file_path points at a PRIVATE storage bucket -- a lab report is health data
-- and must be served through short-lived signed URLs, never a public URL.
-- Every download should write an audit_log row.
--
-- results jsonb holds structured values (analyte, value, unit, flag) so the app
-- can render trends over time; the PDF remains the legal artifact.
-- ---------------------------------------------------------------------------
create table lab_reports (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references lab_bookings(id) on delete cascade,
  file_path   text not null,
  file_mime   text not null default 'application/pdf',
  results     jsonb not null default '{}',
  released_at timestamptz not null default now(),
  released_by uuid references profiles(id) on delete set null
);
create index lab_reports_booking_idx on lab_reports (booking_id, released_at desc);
