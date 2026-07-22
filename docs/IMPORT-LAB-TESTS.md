# Lab Test Import Blueprint — Excel Bulk Import

Same engine as `IMPORT-PRODUCTS.md` (`imports` / `import_rows`, staged → validate → preview → chunked commit → report), with `type = 'lab_tests'`. Only the template, resolution rules, and targets differ — the pipeline, reports, idempotency, and permissions are shared code (`features/imports/`).

---

## 1. Excel template (`sehat-labtests-template.xlsx`)

**Sheet 1 — Tests** (one row per test):

| Column | Required | Rules |
|---|---|---|
| `test_code` | ✅ | Unique key for upsert (e.g. `CBC001`); uppercased. If the source has no codes, the template's Instructions sheet explains codes are minted `SEHAT-<slug>` on first import and included in the final report for future files |
| `test_name` | ✅ | ≤200 chars |
| `category` | ✅ | e.g. `Blood Tests`, `Hormones`; auto-created with warning |
| `price` | ✅ | PKR → paisa; > 0 |
| `sale_price` | — | < price |
| `preparation` | — | e.g. "10–12 hours fasting required"; shown at booking + in emails |
| `report_time` | ✅ | Free text normalized: `24 hours`, `2-3 days` |
| `home_collection` | ✅ | `yes/no` |
| `sample_type` | — | e.g. Blood, Urine |
| `is_active` | — | default yes |

**Sheet 2 — Packages** (optional):

| Column | Required | Rules |
|---|---|---|
| `package_code` | ✅ | Upsert key |
| `package_name` | ✅ | |
| `included_tests` | ✅ | Pipe-separated `test_code`s — resolved against catalog **plus Sheet 1 of this file** |
| `price` | ✅ | Package price; report warns if ≥ sum of member test prices (no savings) |
| `sale_price`, `description`, `home_collection`, `is_active` | — | as above |

Packages commit **after** tests within the same import, so a file can introduce a test and a package containing it together. A package referencing an unknown code errors that package row only.

## 2. Validation & duplicate rules

- `test_code` match → **update** (diff shown, only present columns touched — same semantics as products §5)
- New code but **same normalized name + category** as an existing test → **error**, not warning: near-duplicate lab tests corrupt booking history and analytics. Report says "matches existing TEST-123 — use its code to update, or rename"
- Duplicate code within the file → later row errored
- `home_collection = no` on a test inside any home-collection package → warning (package becomes walk-in-only)
- Price sanity: warning when an update changes price by >50% (typo guard)

## 3. Targets

Commits write `lab_tests` (+ `lab_test_pricing`), `health_packages`, `health_package_tests` (replace membership set on package update). Category taxonomy for tests reuses the shared categories tree under a `lab` root.

## 4. Reports & operations

Identical surface to products: preview with counts and per-row messages, filterable row table, downloadable Excel error report (original columns + `_status`/`_messages`), import history, `audit_log` entries, one-active-import lock, 90-day file retention.

**Update safety specific to labs:** deactivating a test that has future bookings is allowed (stops new bookings) and listed in the final report with the count of affected upcoming bookings so ops can act; existing bookings keep their snapshotted name/price.
