-- 0003_pharmacies.sql
-- Physical pharmacy locations. Stock and fulfilment are per-pharmacy.

-- ---------------------------------------------------------------------------
-- pharmacies
--
-- A first-class entity rather than a config constant, because inventory is
-- physically located somewhere. Even a single-branch launch benefits: adding a
-- second branch (or third-party sellers) later becomes data entry instead of a
-- schema migration through every stock and order query.
--
-- drap_license_no is the DRAP pharmacy licence. license_expiry exists so the
-- admin panel can warn before a branch becomes unable to legally dispense.
-- ---------------------------------------------------------------------------
create table pharmacies (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            citext not null unique,
  drap_license_no text not null unique,
  license_expiry  date not null,
  phone           text not null,
  email           citext,

  -- Denormalized address: a pharmacy address is operational data, not a user
  -- address, and is never reused across users -- a join to `addresses` would buy
  -- nothing and complicate every fulfilment query.
  line1           text not null,
  line2           text,
  area            text,
  city            text not null,
  province        text not null,
  latitude        numeric(9,6),
  longitude       numeric(9,6),

  is_active       boolean not null default true,
  accepts_online_orders boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index pharmacies_city_idx on pharmacies (city) where is_active;
create trigger pharmacies_updated_at before update on pharmacies
  for each row execute function set_updated_at();

-- Deferred FK from 0002 -- user_roles can now be scoped to a pharmacy.
alter table user_roles
  add constraint user_roles_pharmacy_fk
  foreign key (pharmacy_id) references pharmacies(id) on delete cascade;

-- ---------------------------------------------------------------------------
-- pharmacists: professional registration, separate from the RBAC role.
--
-- The 'pharmacist' ROLE grants application access. This table records the
-- licensed professional's registration. They are different concerns: a locum
-- may hold a licence without an account, and verifying a prescription must be
-- attributable to a licence number for compliance, not just to a login.
-- ---------------------------------------------------------------------------
create table pharmacists (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid unique references profiles(id) on delete set null,
  pharmacy_id       uuid not null references pharmacies(id) on delete restrict,
  full_name         text not null,
  registration_no   text not null unique,     -- Pharmacy Council registration
  registration_expiry date not null,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index pharmacists_pharmacy_idx on pharmacists (pharmacy_id) where is_active;
create trigger pharmacists_updated_at before update on pharmacists
  for each row execute function set_updated_at();
