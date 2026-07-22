-- 0016_email_outbox.sql
-- Transactional email outbox (blueprint W5, docs/EMAIL.md).
--
-- Business transactions INSERT here inside their own transaction (see
-- place_order in 0017); a cron drain renders and sends. A crash after COMMIT
-- can therefore never lose an email, and a rollback never sends one.
--
-- V1 simplification, on purpose: one table serves as queue AND log (terminal
-- rows keep provider_message_id / sent_at). A separate email_log plus an
-- admin-editable template registry arrive with the CMS phase -- the renderers
-- live in code (src/lib/email/) until then.

create table email_outbox (
  id                  uuid primary key default gen_random_uuid(),
  template_key        text not null,           -- resolved by code registry (lib/email/outbox.ts)
  recipient           citext not null,
  -- Full render input, snapshotted at enqueue: the drain never re-queries
  -- business tables, so a later catalog edit cannot alter a sent invoice.
  payload             jsonb not null default '{}',
  -- e.g. 'order_confirmation:HC-100001' -- status-flapping or replays can
  -- never queue the same email twice.
  dedupe_key          text unique,
  status              text not null default 'pending'
                        check (status in ('pending', 'sent', 'dead')),
  attempts            int not null default 0 check (attempts >= 0),
  next_attempt_at     timestamptz not null default now(),
  last_error          text,
  provider_message_id text,
  sent_at             timestamptz,
  created_at          timestamptz not null default now()
);

-- The drain's scan: pending rows whose time has come.
create index email_outbox_drain_idx
  on email_outbox (next_attempt_at) where status = 'pending';

alter table email_outbox enable row level security;  -- no policies: service-role only

-- ---------------------------------------------------------------------------
-- claim_email_outbox: crash-safe batch claim.
--
-- No 'claimed' status: claiming just pushes next_attempt_at into the future
-- (a visibility timeout that doubles as retry backoff: 1m, 4m, 16m, ~1h, ~4h).
-- If the drain dies mid-send, the row simply becomes claimable again later --
-- no stuck-in-claimed janitor needed. The drain marks rows 'sent' or 'dead'
-- (after MAX_ATTEMPTS) via plain updates.
--
-- FOR UPDATE SKIP LOCKED lets overlapping drain runs share the queue without
-- double-claiming a row.
-- ---------------------------------------------------------------------------
create or replace function claim_email_outbox(p_limit int default 20)
returns setof email_outbox
language sql
as $$
  update email_outbox e
    set attempts = e.attempts + 1,
        next_attempt_at = now() + (interval '1 minute') * power(4, least(e.attempts, 4))
  where e.id in (
    select id from email_outbox
    where status = 'pending' and next_attempt_at <= now()
    order by created_at asc
    limit p_limit
    for update skip locked
  )
  returning e.*;
$$;

revoke execute on function claim_email_outbox(int) from public;
