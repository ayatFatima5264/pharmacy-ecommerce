-- 0025_product_reviews.sql
-- Product reviews & ratings (V1.1).
--
-- Every review is anchored to a DELIVERED order: the (order_id, product_id)
-- pair is the review's identity, which is what makes "one review per product
-- per order" a constraint instead of a convention, and what makes the
-- "Verified Buyer" badge truthful — a row cannot exist without a purchase.
--
-- Moderation: reviews land as 'pending' and only 'approved' rows are publicly
-- readable (RLS below). Editing an approved review sends it back through the
-- queue — the storefront never shows text a moderator has not seen.
--
-- WRITE PATH: service-role only, on purpose (durable rule 2 in 0014). The
-- eligibility check — order belongs to the customer, is delivered, and
-- contains the product — spans orders → order_items → product_variants, so it
-- lives in the Server Action (features/reviews/actions.ts) where it can also
-- rate-limit and snapshot the reviewer's name. No insert/update policies
-- means a valid JWT still cannot forge a review row from the client.

create type review_status as enum ('pending', 'approved', 'rejected', 'hidden');

create table product_reviews (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references products(id) on delete cascade,
  order_id        uuid not null references orders(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,

  rating          smallint not null check (rating between 1 and 5),
  body            text not null default '' check (char_length(body) <= 2000),

  -- Snapshot, same convention as order_items.item_name: profiles rows are not
  -- publicly readable (0014), so the display name is captured at write time.
  reviewer_name   text not null,

  -- Always true today (a review cannot exist without a delivered order), but
  -- stored so imported/legacy reviews could ever be marked otherwise.
  is_verified     boolean not null default true,

  status          review_status not null default 'pending',
  moderated_by    uuid references profiles(id) on delete set null,
  moderated_at    timestamptz,
  moderation_note text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- One review per product per order.
  unique (order_id, product_id)
);

create index product_reviews_product_status_idx on product_reviews (product_id, status);
create index product_reviews_status_idx on product_reviews (status);
create index product_reviews_user_idx on product_reviews (user_id);

create trigger product_reviews_updated_at before update on product_reviews
  for each row execute function set_updated_at();

-- Review photos, schema-prepared for a later phase. No upload path exists yet;
-- when it does, files land in Storage and rows here point at them. Cascade
-- delete keeps orphan images impossible.
create table product_review_images (
  id           uuid primary key default gen_random_uuid(),
  review_id    uuid not null references product_reviews(id) on delete cascade,
  storage_path text not null,
  alt_text     text,
  position     smallint not null default 0,
  created_at   timestamptz not null default now()
);

create index product_review_images_review_idx on product_review_images (review_id);

-- ---------------------------------------------------------------------------
-- RLS (durable rule 1: every new table enables RLS in its own migration).
-- ---------------------------------------------------------------------------
alter table product_reviews enable row level security;
alter table product_review_images enable row level security;   -- service-role only until uploads ship

-- Public read of APPROVED reviews; customers additionally see their own rows
-- in any status (so "pending approval" renders on their order page).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant select on product_reviews to anon, authenticated;
  end if;
end $$;

create policy product_reviews_public_read on product_reviews
  for select using (status = 'approved');

create policy product_reviews_read_own on product_reviews
  for select using (user_id = auth.uid());
