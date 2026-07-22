-- 0004_catalog.sql
-- Brands, categories, products, variants, images.

-- ---------------------------------------------------------------------------
-- brands: manufacturers (GSK, Abbott, Getz Pharma...)
-- ---------------------------------------------------------------------------
create table brands (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        citext not null unique,
  logo_url    text,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger brands_updated_at before update on brands
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- categories: self-referencing tree (Medicines > Antibiotics > Penicillins)
--
-- Adjacency list rather than nested set: category trees here are shallow and
-- edited by admins. Adjacency makes writes trivial; nested set optimizes deep
-- reads at the cost of rewriting siblings on every insert. Wrong trade for us.
--
-- The self-FK is `on delete restrict`: deleting a parent must not silently
-- orphan or cascade away an entire subtree of products.
-- ---------------------------------------------------------------------------
create table categories (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid references categories(id) on delete restrict,
  name        text not null,
  slug        citext not null unique,
  description text,
  image_url   text,
  position    int not null default 0,       -- manual sort within a parent
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index categories_parent_idx on categories (parent_id, position);
create trigger categories_updated_at before update on categories
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- products: the sellable concept, NOT the sellable unit.
--
-- "Panadol Extra" is a product. "Panadol Extra, strip of 10" is a variant.
-- Price and stock therefore live on the variant (0004 below), never here --
-- that separation is what makes pack sizes work without duplicating catalog rows.
--
-- Regulatory columns:
--   requires_prescription  gates checkout (see 0007)
--   is_controlled          narcotics/psychotropics; stricter handling + audit
--   drap_registration_no   DRAP registration for the registered drug
--   generic_name           enables "show me alternatives" and is what clinicians
--                          actually search by
-- ---------------------------------------------------------------------------
create table products (
  id             uuid primary key default gen_random_uuid(),
  brand_id       uuid references brands(id) on delete restrict,

  name           text not null,
  slug           citext not null unique,
  generic_name   text,
  description    text,
  short_description text,

  -- Clinical / regulatory
  requires_prescription boolean not null default false,
  is_controlled         boolean not null default false,
  drap_registration_no  text,
  dosage_form           text,                -- tablet, syrup, injection
  strength              text,                -- '500mg'
  route_of_administration text,              -- oral, topical
  storage_instructions  text,                -- 'Store below 25°C'

  -- Structured clinical content. JSONB rather than columns because the shape
  -- differs per product type (a glucometer has no contraindications) and this
  -- content is displayed, never queried on.
  clinical_info  jsonb not null default '{}',

  -- SEO
  meta_title       text,
  meta_description text,

  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Controlled drugs are prescription-only by definition. Enforced here so no
-- code path can create an unsafe combination.
alter table products add constraint products_controlled_requires_rx
  check (not is_controlled or requires_prescription);

create index products_brand_idx on products (brand_id);
create index products_rx_idx    on products (requires_prescription) where is_active;
-- Trigram indexes power fuzzy search over both trade and generic name;
-- customers search "panadol", pharmacists search "paracetamol".
create index products_name_trgm    on products using gin (name gin_trgm_ops);
create index products_generic_trgm on products using gin (generic_name gin_trgm_ops);
create trigger products_updated_at before update on products
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- product_categories: M:N.
--
-- A product legitimately belongs in several places ("Vitamin D" is under both
-- Supplements and Bone Health). A single category_id column would force
-- duplicate product rows, which then drift apart.
-- ---------------------------------------------------------------------------
create table product_categories (
  product_id  uuid not null references products(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  is_primary  boolean not null default false,   -- drives breadcrumb + canonical URL
  primary key (product_id, category_id)
);
create index product_categories_category_idx on product_categories (category_id);
create unique index product_categories_one_primary
  on product_categories (product_id) where is_primary;

-- ---------------------------------------------------------------------------
-- product_variants: the actual SKU. This is what carries price and stock.
--
-- ALL MONEY IS BIGINT PAISA. Never numeric-with-decimals, never float.
-- Floating point cannot represent 19.99 exactly; rounding drift in a financial
-- ledger is unacceptable. Integer minor units is the standard fix.
--
-- compare_at_price_paisa is the struck-through "was" price, nullable when not
-- on sale.
-- ---------------------------------------------------------------------------
create table product_variants (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references products(id) on delete cascade,

  sku            citext not null unique,
  barcode        text,
  pack_size      text not null,              -- 'Strip of 10', '120ml bottle'
  units_per_pack int,                        -- 10 -- enables per-unit price display

  price_paisa            bigint not null check (price_paisa >= 0),
  compare_at_price_paisa bigint check (compare_at_price_paisa >= 0),
  cost_paisa             bigint check (cost_paisa >= 0),   -- margin reporting; staff-only
  tax_rate               numeric(5,2) not null default 0,  -- percent

  weight_grams   int,                        -- required for courier rating
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index product_variants_product_idx on product_variants (product_id) where is_active;
create index product_variants_barcode_idx on product_variants (barcode) where barcode is not null;
create trigger product_variants_updated_at before update on product_variants
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- product_images
--
-- variant_id nullable: most images belong to the product, but pack-specific
-- shots belong to one variant. One table handles both.
-- ---------------------------------------------------------------------------
create table product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete cascade,
  url        text not null,
  alt_text   text,                           -- required for accessibility
  position   int not null default 0,
  created_at timestamptz not null default now()
);
create index product_images_product_idx on product_images (product_id, position);
