-- 0006_diagnostics.sql
-- Diagnostic catalog: labs, lab tests, health packages.
-- Bookings (the fulfilment side) are in 0010, after orders exist.

-- ---------------------------------------------------------------------------
-- labs: partner diagnostic laboratories (Chughtai, Shaukat Khanum, Excel...)
--
-- Separate from `pharmacies` even though both are facilities. They are
-- different businesses with different licences, different staff, and different
-- fulfilment models -- merging them into a generic `facilities` table would put
-- a `type` column on every query and leave half the columns null on every row.
-- ---------------------------------------------------------------------------
create table labs (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          citext not null unique,
  license_no    text unique,
  logo_url      text,
  phone         text not null,
  email         citext,
  city          text not null,
  is_active     boolean not null default true,
  offers_home_collection boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger labs_updated_at before update on labs
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- lab_tests: an individual diagnostic test.
--
-- price_paisa lives here rather than on a variant table because a lab test has
-- no pack sizes -- one test, one price per lab. (If the same test is offered by
-- several labs at different prices, that is lab_test_pricing below.)
--
-- Clinical fields matter to the customer before booking:
--   fasting_required / fasting_hours  -- they must plan around it
--   sample_type                        -- blood, urine, swab
--   turnaround_hours                   -- when the report arrives
-- ---------------------------------------------------------------------------
create table lab_tests (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              citext not null unique,
  short_code        citext unique,           -- 'CBC', 'HBA1C'
  description       text,
  category_id       uuid references categories(id) on delete set null,

  sample_type       text not null,
  fasting_required  boolean not null default false,
  fasting_hours     int,
  turnaround_hours  int not null default 24,
  preparation_notes text,

  -- Reference ranges vary by age and sex; a JSONB document is the right shape
  -- for display-only clinical content that is never filtered on.
  reference_ranges  jsonb not null default '{}',

  meta_title        text,
  meta_description  text,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint lab_tests_fasting_hours_present
    check (not fasting_required or fasting_hours is not null)
);
create index lab_tests_category_idx on lab_tests (category_id) where is_active;
create index lab_tests_name_trgm on lab_tests using gin (name gin_trgm_ops);
create trigger lab_tests_updated_at before update on lab_tests
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- lab_test_pricing: per-lab price for a test.
--
-- The same CBC costs different amounts at different labs. Price is therefore a
-- property of the (lab, test) pair, not of the test -- this is the normalization
-- that lets you add a second lab partner without duplicating the test catalog.
-- ---------------------------------------------------------------------------
create table lab_test_pricing (
  id          uuid primary key default gen_random_uuid(),
  lab_id      uuid not null references labs(id) on delete cascade,
  test_id     uuid not null references lab_tests(id) on delete cascade,
  price_paisa bigint not null check (price_paisa >= 0),
  home_collection_fee_paisa bigint not null default 0 check (home_collection_fee_paisa >= 0),
  is_available boolean not null default true,
  updated_at  timestamptz not null default now(),
  unique (lab_id, test_id)
);
create index lab_test_pricing_test_idx on lab_test_pricing (test_id) where is_available;
create trigger lab_test_pricing_updated_at before update on lab_test_pricing
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- health_packages: a curated bundle of tests sold as one unit
-- ("Full Body Checkup", "Diabetes Screening").
--
-- A package is priced independently of its contents -- that discount IS the
-- product. So price_paisa is stored, not summed from members.
-- ---------------------------------------------------------------------------
create table health_packages (
  id            uuid primary key default gen_random_uuid(),
  lab_id        uuid references labs(id) on delete restrict,
  name          text not null,
  slug          citext not null unique,
  description   text,
  image_url     text,

  price_paisa            bigint not null check (price_paisa >= 0),
  compare_at_price_paisa bigint check (compare_at_price_paisa >= 0),

  -- Targeting, for "packages for you" listings.
  suitable_for_gender text check (suitable_for_gender in ('male','female','any')) default 'any',
  min_age       int,
  max_age       int,

  fasting_required boolean not null default false,
  turnaround_hours int not null default 48,

  meta_title    text,
  meta_description text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint health_packages_age_range check (min_age is null or max_age is null or min_age <= max_age)
);
create index health_packages_lab_idx on health_packages (lab_id) where is_active;
create trigger health_packages_updated_at before update on health_packages
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- health_package_tests: M:N bundle membership.
-- Lets the PDP list "includes 62 tests" and lets the lab build the worklist.
-- ---------------------------------------------------------------------------
create table health_package_tests (
  package_id uuid not null references health_packages(id) on delete cascade,
  test_id    uuid not null references lab_tests(id) on delete restrict,
  primary key (package_id, test_id)
);
create index health_package_tests_test_idx on health_package_tests (test_id);
