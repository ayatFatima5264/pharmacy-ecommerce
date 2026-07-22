-- 0020_cms.sql
-- CMS, lean V1 (docs/CMS.md): admin-editable content pages (policies, etc.).
--
-- Body is PLAIN TEXT rendered through React (escaped by construction — no
-- HTML storage, no XSS surface). Paragraphs split on blank lines at render.
-- Every save snapshots the previous version (W12: a bad publish is
-- revertible; the rollback UI arrives with the full CMS phase, the data is
-- already here). Banners/sections/media follow in the CMS phase proper.

create table cms_pages (
  id           uuid primary key default gen_random_uuid(),
  slug         citext not null unique,        -- 'privacy', 'terms', 'shipping', 'returns'
  title        text not null,
  body         text not null,
  is_published boolean not null default true,
  updated_by   uuid references profiles(id) on delete set null,
  updated_at   timestamptz not null default now()
);

create table cms_page_versions (
  id       bigserial primary key,
  page_id  uuid not null references cms_pages(id) on delete cascade,
  title    text not null,
  body     text not null,
  saved_by uuid references profiles(id) on delete set null,
  saved_at timestamptz not null default now()
);
create index cms_page_versions_page_idx on cms_page_versions (page_id, saved_at desc);

alter table cms_pages enable row level security;
alter table cms_page_versions enable row level security;

-- Published pages are public content.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant select on cms_pages to anon, authenticated;
  end if;
end $$;
create policy cms_pages_public_read on cms_pages for select using (is_published);
