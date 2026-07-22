# Security

Every decision, and the reasoning behind it. Verified by `npm run check:security`
(52 assertions) and the RLS behavior suite in `npm run check:migrations`, plus
the runtime checks noted below.

## 1. Authentication — Supabase Auth is the identity provider

**No custom password hashing or session code exists in this codebase.**
Supabase Auth owns credentials (bcrypt at rest), email verification, recovery
links, token refresh, revocation, MFA, and future OAuth/phone providers. The
scrypt + HMAC-session implementation that guarded the early prototype was
removed in Step 2 — the fastest way to have no bugs in security-critical code
is to not own that code.

What the app still owns, because the vendor cannot:

- **Wrapper actions** (`features/auth/customer/actions.ts`,
  `features/auth/staff/actions.ts`): zod validation before any network call,
  per-IP rate budgets (§7), our redirects with an **open-redirect guard**
  (`safeNextPath` — only same-origin relative paths are honoured).
- **One failure message for every login failure mode** — *Email or password is
  incorrect.* Anything more specific is a user-enumeration oracle. Sign-up and
  reset-request respond identically whether or not the account exists
  (Supabase obfuscates existing-email sign-ups; we phrase around it).
- **The `/callback` code exchange** — one route for every emailed link
  (verify, recovery, future OAuth), keeping the dashboard redirect allow-list
  to a single entry.
- **Password-change hygiene** — after a reset, `signOut({ scope: 'others' })`
  ends every other session; if the reset was prompted by a compromise, the
  attacker's sessions die with it.

**Customer and staff authentication are logically separated.** Same identity
provider, different doors and different rules:

| | Customers | Staff |
|---|---|---|
| Entrance | `/login`, `/register` | `/admin/login` |
| Module | `features/auth/customer/` | `features/auth/staff/` |
| Authorization | Row ownership via RLS (`auth.uid()`) | Roles → permissions (user_roles) |
| After auth | `/account` | Staff-role check; **non-staff sessions are discarded on the spot** |

The two modules share only `features/auth/shared/` (who-is-this-request +
form atoms) — no role logic in customer code, no ownership logic in staff code.

**Guest checkout requires none of this.** The checkout path never imports an
auth module; an account is a convenience, never a gate.

---

## 2. Sessions — JWT + refresh token, managed by Supabase

`@supabase/ssr` stores the session in **httpOnly cookies** (§3). Middleware
refreshes expiring tokens on request; Server Components read the session but
never write it.

**Revocation still works** — the reason we originally preferred server-side
sessions is preserved: `getAuthUser()` calls `supabase.auth.getUser()`, which
**validates against the auth server on every request** rather than trusting
the JWT offline. A banned user, a revoked refresh token, or a
password-change-elsewhere takes effect on the next request. One round trip per
request, deduplicated with React `cache()`.

Deactivating a STAFF account additionally flips `profiles.is_active`, which
the staff guard checks on every request — admin ejection is immediate even
inside the JWT's validity window.

There is no `SESSION_SECRET`: nothing here signs cookies anymore.

---

## 3. Cookies

```
httpOnly  secure(prod)  sameSite=lax  path=/  maxAge
```

- **httpOnly** — JavaScript cannot read the cookie, so an XSS bug still cannot
  exfiltrate the session. The single most valuable flag here.
- **secure** — HTTPS only in production; never crosses plaintext.
- **sameSite=lax** — blocks the cookie riding along on cross-site POSTs, which
  is the CSRF attack shape. `strict` would break returning from an external
  payment gateway, so `lax` is the correct trade for a store that will integrate
  JazzCash.
- **maxAge** — the browser drops it even if a server record lingers.

---

## 4. Authorization

**Permissions, never role-name checks** (`src/features/auth/staff/permissions.ts`
— the single source of truth, mirrored into the database by `npm run seed:admin`).

Code asks `roleHasPermission(role, 'orders.refund')`. It never asks
`role === 'admin'`. That indirection stops `if (role === 'admin' || role ===
'manager')` spreading across the codebase, and makes adding a role a data change.

Four roles: `admin`, `manager`, `pharmacist`, `support`. Role keys come from
the `user_roles` table (expired grants filtered), resolved once per request by
the staff guard. **A staff account is an auth user holding ≥1 role; a customer
holds zero.** There is no customer role — customer authorization is row
ownership enforced by RLS (`0014_rls.sql`), not permissions.

*Verified negatives — these are what authorization is for:*

- support cannot manage products, change order status, or view reports
- manager cannot verify prescriptions
- pharmacist cannot manage settings or issue refunds
- **only admin and pharmacist may verify prescriptions** — clinical authority is
  not granted by seniority

**Defence in depth, four layers:**

1. **Middleware** (`src/middleware.ts`) — refreshes tokens and redirects
   signed-out visitors away from `/admin/*` and `/account/*`. A *cheap
   rejection layer, not a boundary*.
2. **Layout guard** (`src/app/admin/(panel)/layout.tsx`) — `requireUser()`
   resolves the auth user AND their staff roles; non-staff users never see the
   console shell. The staff login lives in the sibling `(login)` route group,
   outside this guard, so it cannot loop.
3. **Per-action guard** — every mutating admin Server Action calls
   `authorizeAction(permission)` independently.
4. **RLS** (`0014_rls.sql`) — even with a valid customer JWT, the database
   itself refuses cross-user reads and all writes to financial tables.
   Behavior-verified by `npm run check:migrations`.

Layer 3 is not redundant. **A Server Action is a POST endpoint that can be
invoked directly, without any page ever rendering.** Treating middleware or a
layout as the boundary is the classic Next.js mistake.

---

## 5. Input validation

Zod at every boundary, with one schema shared between the form and the action.
Client-side validation is UX; the server run is the security boundary, because a
Server Action cannot assume the client ran anything.

**The client never sends money.** Checkout submits item refs and quantities; the
server re-prices everything from the live catalog. *Verified: a payload carrying
`unitPricePaisa: 1` and `totalPaisa: 1` parses successfully with both fields
stripped, because the schema does not accept them.*

Coupons are re-validated server-side at checkout even though the client caches
the rule for instant recalculation.

---

## 6. SQL injection

**Not currently reachable** — the data layer is in-memory, and there is no SQL.
The rules for when Supabase lands:

- **Only parameterised queries.** The Supabase client parameterises by default;
  `.eq()`, `.in()`, `.match()` are all safe.
- **Never interpolate into `.rpc()` or raw SQL.** String-built SQL is the entire
  vulnerability class.
- **Enable Row Level Security on every table.** RLS is the layer that holds when
  application code has a bug — one forgotten `where user_id` becomes an empty
  result set instead of a breach. See `docs/DATABASE.md` §7.
- **`SECURITY DEFINER` on the permission helper**, or an RLS policy that queries
  `user_roles` recurses infinitely.

Validation already constrains inputs to enums, bounded strings, and integers
before they reach any query.

---

## 7. XSS

**React escapes by default.** The risk lives entirely in the exceptions.

**Fixed during this pass:** the product page injected JSON-LD via
`dangerouslySetInnerHTML` with only `JSON.stringify`. A product name containing
`</script>` would close the tag early and execute everything after it — and
product names are **admin-editable**, so this was reachable. Now `<`, `>`, and
`&` are escaped to `<`, `>`, `&`. *Verified: a hostile name cannot
break out, and the payload remains valid JSON.*

**Emails are escaped separately.** React does not render them, so
`src/lib/email/layout.ts` has its own `esc()` applied to every interpolated
value. *Verified: script tags, quotes, and ampersands all escape; ampersand is
escaped first to avoid double-encoding.*

**Content-Security-Policy** (`next.config.mjs`) — `default-src 'self'`,
`object-src 'none'`, `frame-ancestors 'none'`, `connect-src 'self'`. That last
one is what stops an injected script phoning home. `'unsafe-eval'` is
development-only; shipping it would hand any injected string a working `eval()`.

*CSP, nosniff, DENY, Referrer-Policy, and Permissions-Policy verified present on
a live response. `X-Powered-By` is suppressed.*

---

## 8. CSRF

**Next.js Server Actions compare the `Origin` header against `Host` and reject
mismatches** before the action body runs. A cross-site form POST cannot invoke
them at all. Combined with `SameSite=Lax`, this covers every mutation in the app.

A hand-rolled token would add ceremony without adding protection *here*. The
caveat that matters: **if any mutation is ever exposed as a plain route handler
instead of a Server Action, that endpoint needs its own token** — the framework
guarantee does not extend to it.

Logout is a form POST, not a link. A GET logout can be triggered by any
`<img src="/logout">` on a third-party page.

---

## 9. Rate limiting

Per-action budgets, not one global number (`src/lib/security/rate-limit.ts`):

| Action | Limit | Window | Threat |
|---|---|---|---|
| `login` | 5 | 15 min | Brute force |
| `placeOrder` | 10 | 1 hour | Order flooding |
| `coupon` | 20 | 10 min | Coupon-code enumeration |
| `trackOrder` | 20 | 10 min | Order-number enumeration |
| `contact` | 5 | 1 hour | Spam |
| `adminWrite` | 120 | 1 min | Compromised staff session |

*Verified: login allows exactly 5 then blocks with a retry-after; buckets are
per-identifier so one attacker cannot lock out everyone; each action has an
independent budget.*

**Per-account protection is Supabase Auth's job.** Its endpoints carry their
own rate limits per identity; our per-IP buckets (`login`, `register`,
`passwordReset`) are defence in depth that fails fast before the network call.
The two layers together cover both the botnet-spread-across-IPs shape and the
single-IP flood.

**Limitation:** our counters live in process memory. Correct for one instance,
weaker across a serverless fleet where each lambda keeps its own (Supabase
Auth's own limits still hold there). The `rate_limits` table
(`0013_rate_limits.sql`) is the durable backend; wiring it in is scheduled
with checkout hardening — only the implementation changes, not the call sites.

---

## 10. Other decisions

**Open-redirect guard.** `?next=` is honoured only for same-origin relative
paths, so `?next=https://evil.example` cannot bounce a freshly-authenticated user
to a phishing page.

**Order tracking needs two factors.** Order numbers are sequential, so the
tracking form requires the order number *and* the phone number used at checkout.
Wrong-phone and no-such-order return the identical message, so the form cannot
confirm which orders exist.

**Admin pages are `no-store` and never prerendered.** A shared proxy must not
serve one staff member's rendered customer list to another visitor, and a
build-time snapshot of a session-gated page is meaningless.

**Health data is compartmentalised.** The customer admin view deliberately shows
no prescriptions or lab reports; those are reachable only through the order they
belong to.

**Staff accounts are never seeded with defaults.** Staff bootstrap is an
explicit operator act: `npm run seed:admin` refuses to run without
`SEED_ADMIN_EMAIL` and a ≥12-character `SEED_ADMIN_PASSWORD`. There are no
demo staff accounts in the codebase.

---

## 11. Not done — required before production

1. ~~Persistence for commerce data~~ **Done** (Steps 4–8) — catalog, orders,
   inventory, lab, settings, CMS, notifications, imports, analytics all live
   in Postgres; the in-memory scaffold remains only as the no-env dev
   fallback and test fixture.
2. ~~Supabase Auth + RLS~~ **Done** — Supabase Auth is the identity provider
   (Step 2); RLS is deny-by-default with `auth.uid()` ownership policies
   (Step 1), behavior-verified in CI.
3. **Distributed rate limiting.** See §9 — `rate_limits` table exists, wiring
   scheduled with checkout hardening.
4. **Audit logging.** The schema has `audit_log`; nothing writes to it yet.
   Prescription and lab report access must be attributable.
5. **MFA for staff.** Supabase Auth supports TOTP; enable + enforce for
   role-holding accounts before real health data lands.
6. ~~Prescription storage wiring~~ **Done** (Step 7) — checkout uploads to the
   private bucket (guests included), pharmacist queue reviews via short-lived
   signed URLs, decisions are licence-attributed. Remaining refinement: write
   an `audit_log` row per file view.
7. **Dependency and secret scanning** in CI.
8. **`x-forwarded-for` trust.** Safe on Vercel, which strips client-supplied
   values. Behind a different proxy this must be re-verified — a spoofable
   header turns per-IP limiting into no limiting.
9. **Supabase Auth production config**: custom SMTP (Resend) for auth emails,
   redirect allow-list (`/callback`), email-confirmation ON, and its built-in
   rate limits reviewed in the dashboard. Config, not code — but go-live
   blocking.
