# Architecture

Healthcare E-commerce Platform — Pakistan.
Next.js 15 (App Router) · TypeScript · Tailwind · shadcn/ui · Supabase (Postgres, Auth, Storage) · Resend · Vercel.

This document explains **why each folder exists**. No feature code has been written yet.

---

## 1. Guiding constraints

Three constraints drive nearly every decision below. They are not generic e-commerce concerns.

**Regulatory.** Selling medicine in Pakistan (DRAP) means the catalog is not homogeneous. An OTC
analgesic, a prescription-only antibiotic, and a blood-pressure monitor are three different
regulatory objects sharing one `products` table. Prescription items cannot be checked out without a
verified prescription, and that verification is a human pharmacist decision, not a flag.

**Traceability.** Medicine cannot ship without a known batch number and expiry date. Inventory is
therefore `product → batches → quantity`, never a single `stock_count` column. Recalls and expiry
sweeps depend on this, and retrofitting it later rewrites checkout, fulfilment, and reporting.

**Sensitivity.** Prescription images are health data. Authorization is enforced in the database via
Row Level Security, not only in application code. Every architectural choice that would weaken RLS
was rejected — see §5.

---

## 2. Top-level layout

```
src/
  app/          Routing only — thin route handlers, layouts, loading/error boundaries
  features/     Business logic, grouped by domain
  components/   Cross-feature presentational components
  lib/          Framework/vendor adapters and pure utilities
  config/       Static configuration and constants
  hooks/        Cross-feature client-side React hooks
  types/        Ambient and generated types
  styles/       Global CSS and Tailwind layer definitions
supabase/
  migrations/   Versioned SQL — the schema's source of truth
  seed/         Reference and development data
docs/           This document and its successors
```

The central split is **`app/` vs `features/`**. `app/` answers *"what URL is this?"* — routing,
layout nesting, streaming boundaries, metadata. `features/` answers *"what does the business do?"*
Route files stay thin: they compose feature modules and own only routing concerns.

This matters because URLs change for marketing and SEO reasons far more often than business rules
change. Keeping logic out of `app/` means a URL restructure is a move operation, not a refactor.
The common alternative — colocating everything inside route folders — couples the two and makes
logic hard to reuse across routes (product data is needed by the PDP, search, cart, admin, and
order confirmation alike).

---

## 3. Routing structure — `src/app/`

Route groups `(name)` organize routes and attach distinct layouts **without appearing in the URL**.
Four groups exist because the platform has four genuinely different shells, each with a different
audience, navigation, and auth posture.

```
app/
  (marketing)/      Home, about, contact, FAQ, legal pages
  (shop)/           products, categories, search, cart, checkout
  (auth)/           login, register, forgot-password, callback
  (account)/        profile, orders, prescriptions, addresses
  (admin)/          dashboard, products, categories, inventory,
                    orders, prescriptions, customers, settings
  api/
    webhooks/       Payment gateway callbacks
    health/         Uptime probe
```

**`(marketing)`** — fully static, aggressively cached, no personalization. Separated so it never
pays the cost of the dynamic shell (cart state, auth session) and can be statically rendered.

**`(shop)`** — the storefront. Public and crawlable; `products` and `categories` are the SEO
surface and are statically generated with incremental revalidation. `cart` and `checkout` sit here
rather than in `(account)` deliberately: **guest checkout must work.** Cash on delivery is dominant
in Pakistan and forcing account creation before a COD order is a direct conversion loss. Cart and
checkout are behind the shop shell, not the auth wall.

**`(auth)`** — a bare, distraction-free shell with no nav or cart. `callback` handles the Supabase
OAuth/PKCE code exchange and is a route handler, not a page.

**`(account)`** — the authenticated customer area. Its layout owns the session check, so every
route beneath it inherits protection from one place rather than repeating a guard per page.

**`(admin)`** — the staff console. Physically separate because it differs in every dimension:
different layout, different navigation, different data density, and above all a different
authorization model (see §7). It is `noindex` and excluded from the public sitemap.

**`api/` is deliberately near-empty.** Data fetching happens in Server Components and mutations in
Server Actions, both of which are type-safe and skip a network hop. Route handlers exist only where
an *external* caller needs an HTTP endpoint — payment webhooks and uptime checks. Adding CRUD
endpoints here would duplicate the Server Action layer and create a second, weaker security
perimeter to maintain.

Each route segment also owns its `loading.tsx` and `error.tsx`, which is how the stated
loading-state and error-handling requirements are met structurally rather than ad hoc.

---

## 4. Feature architecture — `src/features/`

Nine domain modules, each with the same internal shape:

```
features/<domain>/
  components/   UI specific to this domain
  queries/      Read paths — server-only data access
  actions/      Write paths — Server Actions ("use server")
  schemas/      Zod schemas — validation and inferred types
```

```
catalog        Products, categories, brands, search, filtering
cart           Cart state, line items, totals
checkout       Address selection, delivery, order placement
orders         Order lifecycle, history, status transitions
prescriptions  Upload, pharmacist review queue, verification state
inventory      Batches, expiry, stock movements, reservations
auth           Session, sign-in/up, role resolution
account        Profile and address book
payments       COD reconciliation, gateway adapters, webhooks
```

**Why `queries/` and `actions/` are separate.** They have different security postures. A Server
Action is a POST endpoint the browser can invoke directly — it is a public entry point and must
authenticate, authorize, and validate on every call. A query is server-internal and composes into
RSC render. Merging them into one `services/` folder blurs which functions are reachable from the
network, which is exactly the distinction that must stay obvious during review.

**Why `schemas/` is its own folder.** One Zod schema per operation is the single source of truth for
both client-side form validation and server-side re-validation, with the TypeScript type inferred
from it. Client validation is UX; server validation is security. Defining both from one schema means
they cannot drift.

`prescriptions` and `inventory` are first-class modules rather than sub-concerns of `catalog` or
`orders` because both are regulatory requirements with their own state machines and their own
audiences (pharmacist, stock controller). Burying them would make the compliance surface invisible.

If the Rx workflow is deferred out of V1, `features/prescriptions/` simply stays empty and the
`requires_prescription` gate is a no-op — the seam exists without the cost.

---

## 5. Data access — why Supabase client, not Prisma

**Recommendation: Supabase client with generated types.**

Row Level Security is the primary defense for prescription images and order data. Prisma connects
over a pooled Postgres connection as a privileged role and **bypasses RLS entirely**, which would
mean reimplementing every access rule in application code and losing database-level enforcement. For
health data that is a meaningful downgrade: one forgotten `where userId` in one query becomes a
data breach rather than an empty result set.

Prisma's migration ergonomics and query builder are genuinely better. They are not better enough to
give up defense in depth here. Migrations are therefore plain SQL in `supabase/migrations/`, which
is also the only way to version RLS policies, triggers, and constraints — things Prisma's schema
language cannot express.

`src/lib/supabase/` holds the three distinct clients this requires, and keeping them in one folder
makes it obvious which one a given file is using:

- **browser** — anon key, client components, RLS-constrained
- **server** — cookie-bound, per-request, Server Components and Actions, RLS-constrained
- **admin** — service role, **bypasses RLS**, `server-only`, for pharmacist/admin operations and
  webhooks that legitimately act outside a user session

The admin client is the one dangerous object in the codebase. Isolating it in a single, obviously
named file means every use of it is greppable and reviewable.

---

## 6. Database architecture — `supabase/migrations/`

Migrations are numbered SQL files, applied in order, never edited after being applied. Planned
schema, grouped by concern:

**Identity**
`profiles` (1:1 with `auth.users`) · `user_roles` · `addresses`

Roles live in a **separate `user_roles` table, never a column on `profiles`.** A user can update
their own profile; if `role` were a profile column, a user could escalate themselves to admin with
one request. `user_roles` is writable only by service role.

**Catalog**
`categories` (self-referencing tree) · `brands` · `products` · `product_variants` ·
`product_images`

Variants exist because pack size is a real purchasable unit — 10 tablets and 100 tablets are
different SKUs with different prices and stock, not one product with an attribute. Pricing, stock,
and barcode therefore live on the variant, not the product.

`products` carries the regulatory fields: `requires_prescription`, `is_controlled`, generic name,
strength, dosage form, and DRAP registration number.

**Inventory**
`inventory_batches` (batch number, expiry date, quantity) · `stock_movements`

`stock_movements` is an append-only ledger. Current stock is derived from it rather than stored as a
mutable counter, which makes discrepancies auditable and makes concurrent order placement safe
under transaction isolation instead of racing on an `UPDATE ... SET stock = stock - 1`.

**Commerce**
`carts` · `cart_items` · `orders` · `order_items` · `order_status_history` · `payments` ·
`shipments` · `coupons`

`order_items` **snapshots** name, price, and batch at time of purchase. Orders are financial and
regulatory records; they must not change when a product is renamed or repriced. This is why
`order_items` duplicates data rather than joining to `products` — denormalization is correct here.

The order state machine must include COD-specific states (`delivery_failed`, `cash_collected`,
`reconciled`) that a card-only flow would not need.

**Regulatory**
`prescriptions` · `prescription_items` · `prescription_reviews` · `audit_log`

`audit_log` records who viewed or acted on prescription data. Access to health records must be
attributable.

**Two cross-cutting rules.**

*Money is stored as integers in paisa.* Never floating point. `19.99` is not representable in binary
floating point and rounding drift in a financial ledger is unacceptable.

*Timestamps are `timestamptz`, always UTC*, formatted to Asia/Karachi at the presentation layer only.

---

## 7. Authentication & authorization architecture

**Authentication** is Supabase Auth. Sessions are cookie-based, refreshed in `middleware.ts` at the
project root so both Server Components and Server Actions see a valid session.

**Authorization is layered, and each layer is independently sufficient for its own scope:**

1. **Middleware** — coarse routing. Redirects unauthenticated users away from `(account)` and
   `(admin)`. This is UX and cheap rejection, *not* a security boundary — middleware runs on the
   edge and must never be the only check.
2. **Layout guards** — `(account)` and `(admin)` layouts resolve the session and role server-side.
3. **Server Action guards** — every action re-authenticates and re-authorizes. Actions are public
   POST endpoints; they cannot trust that a layout ran.
4. **RLS** — the database enforces the rule regardless of what the application does. A customer can
   read only their own orders, addresses, and prescriptions. This is the layer that holds when
   application code has a bug.

Role checks inside RLS policies use a `SECURITY DEFINER` helper function rather than a subquery
against `user_roles`, because a policy that queries a table which itself has RLS causes infinite
recursion.

**Roles:** `customer`, `pharmacist`, `admin`. Pharmacist is a distinct role, not a lesser admin — it
grants access to the prescription review queue specifically and nothing else. Verifying a
prescription is a licensed professional act and the permission model should reflect that, both for
compliance and for the audit trail.

**Storage:** prescription images go in a **private** bucket with RLS policies, served through signed,
short-lived URLs. Product images go in a public bucket. Putting both in one bucket is the single
easiest way to leak health data.

---

## 8. Component architecture — `src/components/`

Components live here only if they are used across **more than one feature**. Anything used by one
domain belongs in that feature's `components/`. This rule is what stops `components/` from decaying
into a 200-file dumping ground.

```
components/
  ui/       shadcn/ui primitives — Button, Input, Dialog, …
  layout/   Header, Footer, Nav, Sidebar, shell scaffolding
  shared/   Composed cross-feature pieces — EmptyState, Pagination, PriceDisplay
  forms/    Form primitives wired to react-hook-form + Zod
```

**`ui/`** is owned by the shadcn CLI. It is deliberately vendored rather than imported from a
package so it can be modified — accessibility fixes, RTL/Urdu support, brand tokens — but it should
be treated as a primitive layer and kept free of business logic.

**`shared/`** is the answer to the stated empty-state and loading-state requirements: one
`EmptyState` and one skeleton vocabulary used everywhere, rather than each feature inventing its
own.

**`forms/`** exists because every form in the app follows the same contract — react-hook-form bound
to a Zod schema from a feature's `schemas/`, submitting to a Server Action, rendering field errors
consistently. Centralizing that wiring is what makes validation and error display uniform.

**Default to Server Components.** `"use client"` is added only where interactivity genuinely
requires it, and pushed as far down the tree as possible so an interactive leaf does not force its
whole page into the client bundle. This is the main lever on the stated performance requirement.

---

## 9. Supporting folders

**`lib/`** — adapters to the outside world and pure utilities. `supabase/` (§5), `email/` (Resend
client and React Email templates), `errors/` (typed error classes and a normalized action result
shape, so every Server Action returns success/failure in one form the UI can render), `seo/`
(metadata, JSON-LD, sitemap helpers), `utils/` (formatting — currency in PKR, dates in
Asia/Karachi, `cn`).

**`config/`** — values referenced in many places that are not secrets: site metadata, nav
structure, order status enums, pagination sizes, delivery zones. Also the **single validated entry
point for environment variables**, parsed with Zod at startup so a missing key fails the build
loudly rather than surfacing as `undefined` in production.

**`hooks/`** — client hooks used across features. Feature-specific hooks stay in their feature.

**`types/`** — generated Supabase database types (regenerated from migrations, never hand-edited)
plus shared ambient types. Domain types are inferred from Zod schemas in features, not duplicated
here.

**`styles/`** — global CSS, Tailwind layers, design tokens. Tokens live in CSS variables so
theming and the shadcn palette share one source.

---

## 10. Assumptions to confirm

The structure above is scope-independent, but these still need your decision before schema work:

1. **Rx in V1?** Determines whether `features/prescriptions/` and its tables are built now or left
   as a designed-but-empty seam.
2. **Payments.** Structure assumes COD plus at least one local wallet. Stripe is not viable for
   Pakistani merchant accounts; the realistic set is COD, JazzCash, Easypaisa, PayFast, Safepay.
3. **Urdu / RTL.** Not currently in the tree. Adding i18n later means touching every route segment
   (`app/[locale]/…`), so it is much cheaper to decide now than after.

---

## 11. Next step

The tree is folders only — no `package.json`, `tsconfig.json`, or Next.js config yet. Those should
be generated by `create-next-app` and the shadcn CLI rather than hand-written, so their contents
match the exact toolchain versions. That scaffold is the next action, once §10 is settled.
