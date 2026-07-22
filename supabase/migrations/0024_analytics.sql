-- 0024_analytics.sql
-- Analytics rollups (docs/ANALYTICS.md, blueprint W9): dashboards read
-- pre-computed daily aggregates, never raw OLTP scans.
--
-- Rollups are RECOMPUTED, not incremented: rollup_analytics(days) rebuilds
-- the window idempotently, so late mutations (a refund landing days later, a
-- bug fix) heal on the next run. Days bucket in Asia/Karachi — the business
-- day, not the UTC day.
--
-- Refresh paths: nightly cron (/api/cron/analytics, rebuilds 35 days) plus a
-- self-healing read (today's row recomputes when >10 min stale).

create table analytics_daily (
  day                    date primary key,
  orders_count           int not null default 0,   -- placed, excl. cancelled
  booked_value_paisa     bigint not null default 0,
  delivered_count        int not null default 0,
  delivered_value_paisa  bigint not null default 0, -- recognized revenue (COD = on delivery)
  cancelled_count        int not null default 0,
  bookings_count         int not null default 0,
  new_customers          int not null default 0,
  updated_at             timestamptz not null default now()
);

create table analytics_product_daily (
  day           date not null,
  item_name     text not null,                     -- the sale-time snapshot key
  units         int not null default 0,
  revenue_paisa bigint not null default 0,
  primary key (day, item_name)
);

alter table analytics_daily enable row level security;          -- service-role only
alter table analytics_product_daily enable row level security;

create or replace function rollup_analytics(p_days int default 7) returns int
language plpgsql
as $$
declare
  v_today date := (now() at time zone 'Asia/Karachi')::date;
  v_start date;
begin
  if p_days < 1 or p_days > 400 then
    raise exception 'rollup_analytics: p_days must be between 1 and 400';
  end if;
  v_start := v_today - (p_days - 1);

  delete from analytics_daily where day >= v_start;
  insert into analytics_daily (
    day, orders_count, booked_value_paisa, delivered_count,
    delivered_value_paisa, cancelled_count, bookings_count, new_customers
  )
  select
    d.day::date,
    count(o.id) filter (where o.status <> 'cancelled'),
    coalesce(sum(o.total_paisa) filter (where o.status <> 'cancelled'), 0),
    count(o.id) filter (where o.status = 'delivered'),
    coalesce(sum(o.total_paisa) filter (where o.status = 'delivered'), 0),
    count(o.id) filter (where o.status = 'cancelled'),
    (select count(*) from lab_bookings b
      where (b.created_at at time zone 'Asia/Karachi')::date = d.day::date),
    (select count(*) from profiles p
      where (p.created_at at time zone 'Asia/Karachi')::date = d.day::date)
  from generate_series(v_start::timestamp, v_today::timestamp, interval '1 day') as d(day)
  left join orders o on (o.placed_at at time zone 'Asia/Karachi')::date = d.day::date
  group by d.day;

  delete from analytics_product_daily where day >= v_start;
  insert into analytics_product_daily (day, item_name, units, revenue_paisa)
  select
    (o.placed_at at time zone 'Asia/Karachi')::date,
    oi.item_name,
    sum(oi.quantity),
    sum(oi.line_total_paisa)
  from order_items oi
  join orders o on o.id = oi.order_id
  where o.status <> 'cancelled'
    and oi.variant_id is not null
    and (o.placed_at at time zone 'Asia/Karachi')::date >= v_start
  group by 1, 2;

  return p_days;
end;
$$;

revoke execute on function rollup_analytics(int) from public;
