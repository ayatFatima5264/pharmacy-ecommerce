-- 0013_rate_limits.sql
-- Fixed-window rate-limit counters, moved from process memory into Postgres.
-- On a serverless fleet each instance has its own memory, so an in-memory
-- limiter enforces nothing (docs/BLUEPRINT.md review item W2).
--
-- NOTE: there is no sessions table. Supabase Auth owns sessions (JWTs +
-- refresh tokens in the auth schema) -- an earlier draft carried a custom
-- sessions table, removed when Supabase Auth was adopted as the identity
-- provider. These counters cover what Supabase Auth's own rate limiting does
-- not: OUR server actions (placeOrder, coupon validation, order tracking,
-- contact form, admin writes).
--
-- Keyed the same way as the in-memory implementation (`action:identifier`,
-- e.g. 'placeOrder:203.0.113.7'). Consumed with a single atomic upsert:
--   insert .. on conflict (key) do update
--     set count = case when rate_limits.reset_at < now() then 1
--                      else rate_limits.count + 1 end,
--         reset_at = case when rate_limits.reset_at < now() then excluded.reset_at
--                         else rate_limits.reset_at end
--   returning count, reset_at
-- One round trip, correct under concurrency. Postgres is good enough for these
-- volumes; Redis remains the drop-in upgrade if limits ever become hot.

create table rate_limits (
  key       text primary key,
  count     int not null default 1 check (count >= 0),
  reset_at  timestamptz not null
);
-- Sweep: delete where reset_at < now() - grace.
create index rate_limits_sweep_idx on rate_limits (reset_at);
