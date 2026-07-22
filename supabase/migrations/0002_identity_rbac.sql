-- 0002_identity_rbac.sql
-- Customers, staff, and the role/permission model.

-- ---------------------------------------------------------------------------
-- profiles: 1:1 extension of auth.users.
--
-- DECISION (revised after Step 1 review): Supabase Auth is the identity
-- provider. It owns credentials, password hashing, email verification, reset
-- flows, MFA, and OAuth providers; we never write to auth.users. profiles
-- holds application-level identity, auto-created by the handle_new_user()
-- trigger below, and `profiles.id = auth.uid()` is the key every RLS policy
-- pivots on (0014).
--
-- email is DENORMALIZED here from auth.users, kept in sync by the same
-- trigger: admin lists and order lookups filter by email constantly, and the
-- auth schema is not part of the app's query surface.
--
-- NOTE: there is deliberately NO `role` column here. A user can update their own
-- profile; a role column would be a one-request privilege escalation. Roles live
-- in user_roles, which users cannot write.
-- ---------------------------------------------------------------------------
create table profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  email          citext not null unique,
  full_name      text,
  phone          text,                       -- E.164, e.g. +923001234567
  date_of_birth  date,                       -- clinically relevant for lab tests
  gender         text check (gender in ('male','female','other')),
  avatar_url     text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index profiles_phone_key on profiles (phone) where phone is not null;
create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- handle_new_user: auto-provision (and re-sync) a profile for every auth user.
--
-- SECURITY DEFINER because it fires as the auth admin role during signup,
-- which has no direct grant on public.profiles. ON CONFLICT UPDATE makes the
-- same function serve both the insert trigger and the email-change trigger.
--
-- Guarded: on bare Postgres (CI verification) a stub auth schema is provided
-- by the checker; on any environment without auth.users the triggers are
-- skipped and profile creation is the application's responsibility.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'auth' and table_name = 'users'
  ) then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
    create trigger on_auth_user_email_updated
      after update of email on auth.users
      for each row execute function public.handle_new_user();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- addresses: delivery and sample-collection addresses
--
-- Shared by orders (shipping) and lab_bookings (home collection) -- the same
-- physical address serves both, so it is one table, not two.
--
-- Orders SNAPSHOT the address at purchase time (see 0007) rather than
-- referencing this row, so that editing a saved address never rewrites history.
-- ---------------------------------------------------------------------------
create table addresses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  label         text,                        -- 'Home', 'Office'
  recipient_name text not null,
  phone         text not null,
  line1         text not null,
  line2         text,
  area          text,                        -- neighbourhood; drives delivery zone
  city          text not null,
  province      text not null,
  postal_code   text,
  is_default    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index addresses_user_id_idx on addresses (user_id);
-- At most one default per user, enforced by the database rather than app code.
create unique index addresses_one_default_per_user
  on addresses (user_id) where is_default;
create trigger addresses_updated_at before update on addresses
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- RBAC: roles / permissions / role_permissions / user_roles
--
-- Permissions are granted to ROLES, and roles are assigned to USERS. Checking
-- "can this user do X" never hardcodes a role name -- it asks whether the user
-- holds the permission. This means a new role (e.g. 'inventory_clerk') is a data
-- change, not a code change.
--
-- is_system marks roles/permissions the application depends on by name; the
-- admin UI must not allow deleting them.
-- ---------------------------------------------------------------------------
create table roles (
  id          serial primary key,
  key         citext not null unique,        -- 'admin', 'pharmacist', 'customer'
  name        text not null,
  description text,
  is_system   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table permissions (
  id          serial primary key,
  key         citext not null unique,        -- 'orders.refund', 'rx.verify'
  resource    text not null,                 -- 'orders'
  action      text not null,                 -- 'refund'
  description text,
  unique (resource, action)
);

create table role_permissions (
  role_id       int not null references roles(id) on delete cascade,
  permission_id int not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);
create index role_permissions_permission_idx on role_permissions (permission_id);

-- user_roles carries an optional pharmacy scope. A branch manager is
-- 'pharmacy_manager' AT pharmacy X, not globally. NULL pharmacy_id = global scope.
create table user_roles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  role_id      int  not null references roles(id) on delete restrict,
  pharmacy_id  uuid,                          -- FK added in 0003 (pharmacies)
  granted_by   uuid references profiles(id) on delete set null,
  granted_at   timestamptz not null default now(),
  expires_at   timestamptz                    -- supports temporary elevation
);
-- A user holds a given role once per scope. COALESCE gives NULL scope a stable
-- key, since NULL <> NULL would otherwise permit duplicates.
create unique index user_roles_unique_scope
  on user_roles (user_id, role_id, coalesce(pharmacy_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index user_roles_user_idx on user_roles (user_id);

-- ---------------------------------------------------------------------------
-- Authorization helper.
--
-- SECURITY DEFINER is required: RLS policies on other tables call this, and if
-- it ran as the caller it would re-trigger RLS on user_roles and recurse
-- infinitely. STABLE lets the planner cache it within a statement.
-- ---------------------------------------------------------------------------
create or replace function has_permission(p_user uuid, p_permission citext)
returns boolean
language sql
stable
security definer
-- pg_temp is pinned LAST: without it, a caller with TEMP privilege could
-- shadow user_roles with a temp table inside this SECURITY DEFINER function.
-- `extensions` covers hosted Supabase projects where citext lives there.
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1
    from user_roles ur
    join role_permissions rp on rp.role_id = ur.role_id
    join permissions p       on p.id = rp.permission_id
    where ur.user_id = p_user
      and p.key = p_permission
      and (ur.expires_at is null or ur.expires_at > now())
  );
$$;

-- One-argument overload for RLS policies: "does the CURRENT user hold this
-- permission". auth.uid() is null for anon, so it returns false there.
create or replace function has_permission(p_permission citext)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select has_permission(auth.uid(), p_permission);
$$;

-- SECURITY DEFINER functions are callable by PUBLIC unless revoked.
-- `authenticated` keeps EXECUTE because RLS policies evaluate these under the
-- caller's role (staff policies in 0014 and beyond).
revoke execute on function has_permission(uuid, citext) from public;
revoke execute on function has_permission(citext) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function has_permission(uuid, citext) to authenticated;
    grant execute on function has_permission(citext) to authenticated;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- audit_log: attributable access to sensitive records.
--
-- Prescription and lab report access must be traceable to a person. Append-only;
-- no update or delete grants are ever issued on this table.
-- ---------------------------------------------------------------------------
create table audit_log (
  id          bigserial primary key,
  actor_id    uuid references profiles(id) on delete set null,
  action      text not null,                 -- 'prescription.viewed'
  entity_type text not null,
  entity_id   uuid,
  metadata    jsonb not null default '{}',
  ip_address  inet,
  created_at  timestamptz not null default now()
);
create index audit_log_entity_idx on audit_log (entity_type, entity_id, created_at desc);
create index audit_log_actor_idx  on audit_log (actor_id, created_at desc);
