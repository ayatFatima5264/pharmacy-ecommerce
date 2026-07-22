# Sehat Store — Documentation Index

Read in this order. Blueprint docs (this round) are the pre-code contract for what gets built next; foundation docs were written earlier and remain authoritative for their areas.

## Blueprint (plan → review → code)

1. [BLUEPRINT.md](BLUEPRINT.md) — master architecture: stack, folders, routes, DB modules, all flows (auth, admin, customer, checkout, lab, email, shipping, payment), scalability, **weakness review §15**
2. [SITEMAP.md](SITEMAP.md) — every page, navigation map, UX improvements
3. [CMS.md](CMS.md) — admin-editable content (banners, sections, pages, policies, FAQs)
4. [IMPORT-PRODUCTS.md](IMPORT-PRODUCTS.md) — Excel product import engine
5. [IMPORT-LAB-TESTS.md](IMPORT-LAB-TESTS.md) — Excel lab-test import engine
6. [INVENTORY.md](INVENTORY.md) — stock ledger, alerts, adjustments, warehouse path
7. [EMAIL.md](EMAIL.md) — template registry, outbox pattern, all transactional emails
8. [ANALYTICS.md](ANALYTICS.md) — dashboard rollups, metric definitions, BI path
9. [SETTINGS.md](SETTINGS.md) — typed settings registry, store status, business hours
10. [NOTIFICATIONS.md](NOTIFICATIONS.md) — event routing, channels, SMS/WhatsApp future

## Foundation (pre-existing)

- [ARCHITECTURE.md](ARCHITECTURE.md) — stack rationale, constraints (DRAP, batch traceability, health data)
- [DATABASE.md](DATABASE.md) — schema philosophy for migrations 0001–0012
- [SECURITY.md](SECURITY.md) — auth mechanics, rate limits, pre-production gaps
- [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) / [UI-SPEC.md](UI-SPEC.md) — visual language and page specs

## Identity decision (final)

**Supabase Auth is the identity provider** — live since Step 2. `profiles` 1:1
with `auth.users`; RLS keyed on `auth.uid()`; all custom scrypt/session code
removed. Customer auth (`/login`, `/register`, `/forgot-password`,
`/reset-password`, `/callback`, `/account`) and staff auth (`/admin/login`)
are logically separated modules (`features/auth/{customer,staff,shared}/`).
Staff bootstrap: `npm run seed:admin`. Guest checkout requires no account.

## Go-live blockers (from BLUEPRINT.md §15)

- ✅ RLS on every table (`0014_rls.sql`, Step 1) — deny-by-default baseline + `auth.uid()` policies, behavior-verified (W3)
- ✅ Sessions: Supabase Auth (nothing to build); rate limits in Postgres (`0013_rate_limits.sql`) (W2)
- Supabase wiring replaces the in-memory `src/lib/data` scaffold, module by module (W1). As of Step 6, **every admin page and every commerce flow reads/writes the database when configured**: catalog, cart, checkout (with account linkage + coupon ledger + store-status gate), tracking, slots, dashboard, orders, products, inventory, lab tests/bookings, customers, coupons, shipping, reports, settings, CMS pages, plus customer order history under `/account/orders` (read through the user-bound client — RLS enforces ownership). Still scaffold-served: lab CONTENT pages on the storefront (test/package detail copy — flips with the lab import phase). The scaffold remains the no-database fallback and the seed/content-overlay source; it deletes when the no-env fallback is retired.

## Migrations

Applied set (live on the Supabase project): `0001`–`0012` domain schema (audited & corrected in Step 1) · `0013` rate limits · `0014` RLS · `0015` storage buckets + policies · `0016` email outbox · `0017` commerce core · `0018` admin ops · `0019` settings · `0020` CMS pages · `0021` notifications · `0022` Rx flow (`place_order` v2: prescription attach + notification emission) · `0023` imports.
Planned: `0024` analytics.
Apply with `npm run db:migrate` (direct connection, no CLI login; CLI-ledger compatible).
Verify anytime with `npm run check:migrations` (in-process Postgres + auth shim, no Docker needed) — includes 10 behavior tests of the checkout transaction (FEFO, oversell rollback, slot capacity, coupon budget, idempotency, outbox claim).

## Live-project bootstrap (once the Supabase project exists)

```
npx supabase link --project-ref <ref>   # once
npx supabase db push                    # apply migrations
npm run seed:admin                      # RBAC matrix + first admin
npm run seed:catalog                    # demo catalog, stock, labs, slots, shipping
npm run check:db                        # verify connectivity + schema
```
