-- 0021_notifications.sql
-- In-app notifications, lean V1 (docs/NOTIFICATIONS.md): the staff bell.
--
-- recipient_user_id NULL = staff broadcast (shown to every console user).
-- V1 keeps ONE read state per row — fine for a small team; per-user read
-- receipts become a join table when the team grows. Customer in-app
-- notifications reuse this table later (recipient set); customers currently
-- hear by email.

create table notifications (
  id                 uuid primary key default gen_random_uuid(),
  recipient_user_id  uuid references profiles(id) on delete cascade,
  type               text not null,     -- 'order.placed', 'booking.placed', 'rx.review', ...
  title              text not null,
  body               text,
  link_url           text,
  dedupe_key         text unique,       -- noise guard for repeatable events
  read_at            timestamptz,
  created_at         timestamptz not null default now()
);
-- The bell's two queries: unread count, latest first.
create index notifications_unread_idx on notifications (created_at desc) where read_at is null;
create index notifications_recipient_idx on notifications (recipient_user_id, created_at desc);

alter table notifications enable row level security;  -- service-role only in V1
