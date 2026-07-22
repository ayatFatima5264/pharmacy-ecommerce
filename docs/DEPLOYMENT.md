# Deployment Guide — Sehat Store on Vercel

> **DEPLOYED**: production runs at **https://ar-medical-store.vercel.app**
> (Vercel project `ar-medical-store`, GitHub `ayatFatima5264/pharmacy-ecommerce`).
> Notes from the live rollout:
> - **Hobby plan allows only daily crons** — the outbox drain therefore runs
>   inline after checkout and admin actions (immediate emails), with the daily
>   cron as the straggler sweep. On Pro, restore `* * * * *` in `vercel.json`.
> - Vercel **Deployment Protection (SSO)** was on by team default and made the
>   whole site private — it is disabled for this project (Settings →
>   Deployment Protection) and must stay off for a public storefront.
> - `.env` values are added via CLI with byte-exact stdin — PowerShell pipes
>   append CRLF, which Vercel rejects for `CRON_SECRET` and would corrupt keys.

The repo is deploy-ready: `vercel.json` carries the cron schedules, security
headers live in `next.config.mjs`, and every runtime dependency is an
environment variable. This is the operator's runbook.

## 1. One-time setup

### 1.1 Vercel project
1. Push this repository to GitHub (`git remote add origin … && git push -u origin master`).
2. In Vercel: **Add New → Project → import the repo**. Framework auto-detects
   Next.js; no build settings need changing.
3. Do NOT deploy yet — set the environment variables first.

### 1.2 Environment variables (Vercel → Settings → Environment Variables)

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | same as `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key | browser-safe by design |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key | **server-only; never expose** |
| `NEXT_PUBLIC_SITE_URL` | `https://<your-domain>` | drives auth redirects + email links |
| `RESEND_API_KEY` | from resend.com | without it, emails queue but never send |
| `EMAIL_FROM` | `Sehat Store <orders@your-domain>` | domain must be verified in Resend |
| `CRON_SECRET` | `openssl rand -hex 24` | Vercel sends it as the cron Bearer token automatically |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | — | **not needed on Vercel** (local seeding only) |
| `SUPABASE_DB_PASSWORD` | — | **never put on Vercel** (local migration runner only) |

> `.env` values containing `#` or spaces must be quoted — `#` starts a comment.

### 1.3 Supabase production configuration (dashboard)
1. **Auth → URL Configuration**: set Site URL to `https://<your-domain>`; add
   `https://<your-domain>/callback` to Redirect URLs. Without this, signup
   confirmations and password resets bounce.
2. **Auth → Email**: enable **custom SMTP** with the Resend SMTP credentials
   (host `smtp.resend.com`, user `resend`, password = API key) so auth emails
   (verify/reset) match the store's domain. Keep confirmations ON.
3. **Auth → Rate limits**: review defaults; they sit in front of our per-IP
   action limits.
4. Database backups: verify the daily backup is enabled (default on paid
   tiers; note the retention on free tier).

### 1.4 Resend
1. Verify the sending domain (DNS records shown in the Resend dashboard).
2. Set `EMAIL_FROM` to an address on that domain.

## 2. Deploy & verify

1. Trigger the first deploy (push or “Deploy”).
2. **Smoke the live site** (5 minutes):
   - Home page renders products from the database.
   - `/policies/privacy` renders (CMS).
   - Register → confirmation email arrives → `/account`.
   - Place a COD order → confirmation email arrives → order visible in `/admin/orders`.
   - `/admin/login` → dashboard shows the order.
3. **Cron verification** (Vercel → Project → Cron Jobs shows both):
   - `/api/cron/outbox` every minute — check logs for `{claimed: …}` responses;
     manual test: `curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/outbox`
   - `/api/cron/analytics` daily 19:15 UTC (= 00:15 PKT) — manual test the same
     way; expect `{rebuiltDays: 35}`.
   - Both return 401 without the token and 503 if unconfigured — that is the guard working.
4. **Headers spot check**: `curl -I https://<domain>` — expect `strict-transport-security`,
   `content-security-policy`, `x-frame-options: DENY`, no `x-powered-by`.

## 3. Migrations in production

`supabase/migrations` is append-only. To apply new migrations, run **locally**
(the runner uses `SUPABASE_DB_PASSWORD`, which never leaves your machine):

```
npm run db:migrate
```

The runner records versions in the Supabase CLI's own ledger, so `supabase db push`
remains interchangeable.

## 4. Operational notes

- **Scale ceilings, by design** (revisit when traffic demands):
  in-memory per-IP rate limits are per-instance (Supabase Auth's own limits still
  hold globally; `rate_limits` table is the drop-in upgrade) · imports capped at
  2000 rows/5 MB · admin order queries window the latest 500.
- **Region**: Supabase is in `ap-southeast-1` (Singapore). Optionally pin Vercel
  functions to `sin1` to keep server↔DB latency low
  (`vercel.json`: `"regions": ["sin1"]`).
- **Statics**: catalog pages are ISR (1h); policy pages 5m; admin/account/checkout
  are dynamic by design.
- **Incident basics**: `settings.store.status` pauses ordering without a deploy;
  the outbox retries email for ~5.5h before dead-lettering; `release_order_stock`
  is idempotent if a cancellation needs re-running.
