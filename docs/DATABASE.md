# Database Design

PostgreSQL 15 (Supabase). 12 migrations, ~40 tables. Every table is explained
inline in its migration; this document covers the decisions that span tables.

| # | Migration | Module |
|---|---|---|
| 0001 | foundation | extensions, enums, triggers |
| 0002 | identity_rbac | Customers, Admin Users, Roles, Permissions |
| 0003 | pharmacies | Pharmacy |
| 0004 | catalog | Products, Categories, Brands |
| 0005 | inventory | batch/expiry stock |
| 0006 | diagnostics | Lab Tests, Health Packages |
| 0007 | prescriptions | Rx upload + verification |
| 0008 | coupons | Coupons |
| 0009 | commerce | Orders, Order Items |
| 0010 | lab_bookings | Lab Bookings |
| 0011 | shipping | Shipping |
| 0012 | payments | Payments |

---

## 1. The three decisions that shape everything

### 1.1 One order, two fulfilment paths

A customer buying paracetamol and booking a CBC in one session must produce
**one payment, one coupon application, one invoice**. So `orders` is the
financial umbrella over both domains, and fulfilment is delegated:

```
                    orders  (money: subtotal, discount, tax, total)
                      │
                      ├── order_items ──┬── product_variant   → shipments
                      │                 ├── lab_test          → lab_bookings
                      │                 └── health_package    → lab_bookings
                      ├── payments / refunds / cod_collections
                      └── order_status_history
```

The rejected alternative was separate `orders` and `lab_bookings` root tables.
That splits the ledger in two: coupons must be applied twice, revenue reporting
must UNION, and a mixed cart needs two checkouts. Physical and diagnostic items
have genuinely different *fulfilment* lifecycles — but identical *financial*
ones, and the financial side is what an order is.

### 1.2 Disjoint subtypes, not polymorphic FKs

`order_items`, `cart_items`, and `coupon_scopes` each reference one of several
entity types. The shortcut is `(item_type text, item_id uuid)`. I rejected it:
Postgres cannot enforce a foreign key on a polymorphic column, so nothing stops
a row pointing at a deleted lab test, and every read needs a CASE join.

Instead each table has one nullable FK per type plus a CHECK that exactly one is
set:

```sql
constraint order_items_exactly_one check (
  (variant_id is not null)::int +
  (test_id    is not null)::int +
  (package_id is not null)::int = 1
)
```

Real foreign keys, real cascade behaviour, real integrity. The cost is a few
mostly-null columns, which is cheap — Postgres stores NULLs in a bitmap, not as
padded space.

### 1.3 Stock is (pharmacy, variant, batch)

Not an integer on the variant. Batch number and expiry are legally required to
dispense medicine and are the only way a recall is actionable — see
`order_item_batches`, which answers "who received batch X" directly.

`inventory_batches` is indexed for **FEFO** (First-Expired-First-Out), not FIFO:

```sql
create index inventory_batches_allocation_idx
  on inventory_batches (variant_id, pharmacy_id, expiry_date)
  where quantity_on_hand > quantity_reserved;
```

Perishable goods must ship soonest-expiry-first, or stock expires on the shelf.

---

## 2. Normalization, and the three deliberate exceptions

The schema is **3NF** throughout, with exactly three denormalizations. Each is
listed here so a future reader knows they are intentional rather than sloppy.

| Denormalized | Where | Why |
|---|---|---|
| Order line snapshots | `order_items.item_name`, `unit_price_paisa`, `pack_size` | An order is a financial and regulatory record. Renaming or repricing a product must never alter a historical invoice. The FK is kept for analytics; display reads the snapshot. |
| Address snapshots | `orders.shipping_address` (jsonb), `lab_bookings.collection_address` | Editing a saved address must not rewrite where a past order was delivered. |
| Running counters | `coupons.usage_count`, `collection_slots.booked_count`, `inventory_batches.quantity_on_hand` | Each has an authoritative ledger behind it (`coupon_redemptions`, `lab_bookings`, `stock_movements`). The counter exists so hot-path validity checks are single-row reads instead of `COUNT(*)` over a growing table. The ledger is the truth; the counter must reconcile. |

Snapshotting is not a normalization failure — it is temporal correctness. The
price on an invoice is a *different fact* from the price in the catalog, and
they happen to have been equal once.

Two things are notably **not** denormalized: money totals are stored on `orders`
but constrained to balance —

```sql
constraint orders_total_balances
  check (total_paisa = subtotal_paisa - discount_paisa + shipping_paisa + tax_paisa)
```

— so a bug in checkout arithmetic fails the INSERT rather than silently
producing a wrong invoice. The same pattern guards `order_items.line_total_paisa`.

---

## 3. Money

**Every monetary column is `bigint`, in paisa.** Never `float`, never `numeric`
with decimals for storage.

`19.99` has no exact binary floating-point representation. Accumulated rounding
drift across a ledger produces invoices that do not reconcile, and in a system
handling COD remittance variance that is unrecoverable. Integer minor units is
the standard fix; formatting to `Rs 1,250.00` happens in the presentation layer.

Every money column also carries `check (x >= 0)`. Negative amounts are expressed
as separate refund rows, not as sign flips, so the ledger stays directional.

---

## 4. Authorization model

`roles` × `permissions` × `role_permissions` × `user_roles`.

Application code **never checks a role name**. It asks `has_permission(user,
'orders.refund')`. Adding an `inventory_clerk` role becomes a data change rather
than a code change — this is the difference between a system that survives its
second year and one that accretes `if (role === 'admin' || role === 'manager')`
across 200 files.

Three properties worth flagging:

**No `role` column on `profiles`.** Users can update their own profile. A role
column there is a one-request privilege escalation. Roles live in `user_roles`,
which users cannot write.

**Roles are scoped.** `user_roles.pharmacy_id` means "manager *at branch X*", not
globally. NULL means global. This is what makes multi-branch work without a
second permission system.

**`has_permission()` is `SECURITY DEFINER`.** RLS policies on other tables call
it; if it ran as the caller it would re-trigger RLS on `user_roles` and recurse
infinitely. This is the single most common way an RLS rollout breaks.

`pharmacists` is separate from the `pharmacist` role: the role grants app access,
the table records professional registration. A prescription approval must be
attributable to a **licence number**, not just a login — that is what an
inspection asks for.

---

## 5. Index strategy

Indexes were chosen from the actual query paths, not sprinkled on FKs by habit.
Every index costs write throughput, so each is justified.

**Partial indexes for worklists.** Most operational queues are a small slice of a
large table. Indexing only that slice keeps the index tiny and hot:

```sql
create index prescriptions_review_queue_idx
  on prescriptions (created_at) where status = 'pending_review';

create index orders_awaiting_rx_idx
  on orders (placed_at) where status = 'awaiting_rx';

create index cod_collections_unreconciled_idx
  on cod_collections (collected_at) where not is_reconciled;
```

A pharmacist queue index covers hundreds of rows, not millions of historical
prescriptions.

**Partial UNIQUE for business rules.** These enforce invariants the application
would otherwise race on:

```sql
create unique index addresses_one_default_per_user on addresses (user_id) where is_default;
create unique index product_categories_one_primary on product_categories (product_id) where is_primary;
```

**Trigram GIN for search.** `pg_trgm` on `products.name`, `products.generic_name`,
and `lab_tests.name`. Customers search trade names ("panadol"), pharmacists
search generics ("paracetamol"), and both misspell — trigram handles fuzzy
matching that `LIKE` cannot.

**Composite order matters.** `orders (user_id, placed_at desc)` serves "my orders,
newest first" from the index alone. Reversed, it would sort every read.

**Idempotency by index.** `payments (method, gateway_reference)` unique is the
webhook guard: gateways retry deliveries, and a duplicate must conflict rather
than double-credit an order.

Deliberately **not** indexed: `products.description`, all `jsonb` display
columns, and low-cardinality booleans on their own. They are never filter
predicates.

---

## 6. Future-proofing

Choices made now that cost nothing but keep options open:

- **`pharmacies` as an entity** — multi-branch and third-party sellers become
  data entry, not a migration through every stock query.
- **`lab_test_pricing` per (lab, test)** — a second lab partner is rows, not a
  duplicated test catalog.
- **`product_variants` split from `products`** — new pack sizes never duplicate
  catalog rows.
- **Permission-based authz** — new roles are data.
- **`shipping_rates` as rows, not formulas** — courier tariffs are stepped and
  change often; pricing must be editable without a deploy.
- **Lookup tables over enums** where admins add values. Enums are used only for
  states that application code branches on, because adding an enum value
  requires a migration.
- **jsonb for display-only clinical content** (`clinical_info`,
  `reference_ranges`, `results`) — the shape genuinely varies per item and it is
  never filtered on. jsonb is *not* used anywhere a value is queried or
  constrained.
- **`citext` for codes and slugs** — users type `save20`, not `SAVE20`.

---

## 7. What is not built yet

**Row Level Security: LANDED in Step 1** (`0014_rls.sql`), revised for
**Supabase Auth as the identity provider**. `profiles.id` references
`auth.users(id)` and is auto-provisioned by the `handle_new_user()` trigger;
policies pivot on `auth.uid()`. The model, verified behaviorally by
`npm run check:migrations`:

- **Deny-by-default baseline**: RLS enabled on every table; broad
  anon/authenticated grants revoked. Tables with no policies (RBAC, audit,
  inventory, coupons, COD reconciliation) are service-role-only.
- **Public catalog**: anon + authenticated read active rows only (products,
  categories, brands, labs, tests, packages, slots, shipping rates).
- **Customer-owned data**: `auth.uid()`-keyed policies — read/update own
  profile (email/id excluded from the column grant), CRUD own addresses and
  cart, upload/read own prescriptions, **read-only** order history, payments,
  bookings, and released lab reports (via `owns_order`/`owns_booking`
  SECURITY DEFINER helpers).
- **No client write path on financial tables**: orders, payments, bookings,
  stock have SELECT-only policies — placing/cancelling/paying are server-side
  service-role transactions. A valid JWT cannot forge an order row.
- `prescriptions` and `lab_reports` **files** live in private Storage buckets
  (`0015_storage.sql`) with owner-folder policies
  (`<auth.uid()>/...` paths); staff access via service role + `audit_log`.
- Staff RLS is intentionally deferred: staff access is service-role +
  `has_permission()` in the app layer; the one-arg `has_permission(citext)`
  overload exists so staff policies can be layered on later without
  restructuring.

**Also pending:** seed data for `roles`/`permissions`, a `reserve_stock()`
function to make batch allocation atomic under concurrency (Step 3, orders),
and generated TypeScript types (`npm run db:types` once a project is linked).

**Still needs your decision** (from `ARCHITECTURE.md` §10): whether Rx ships in
V1, which payment gateway, and Urdu/RTL. The schema supports all three either
way — none of them change the tables above.
