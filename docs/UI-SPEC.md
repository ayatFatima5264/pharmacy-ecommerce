# UI Specification

Every page, designed before coding. Tokens from `DESIGN-SYSTEM.md`.

Wireframes are mobile-first; the desktop variation is noted where it differs
meaningfully. `▓` = image, `[ ]` = button, `( )` = input.

---

## Global shell

### Header — desktop

```
┌──────────────────────────────────────────────────────────────────────┐
│  🚚 Free delivery over Rs 2,000  ·  Licensed pharmacy  ·  Help  │ 32px, gray-50
├──────────────────────────────────────────────────────────────────────┤
│  ⬤ LOGO   ( 🔍 Search medicines, tests, brands…    )   👤 Account  🛒 3 │
│                                                              64px      │
├──────────────────────────────────────────────────────────────────────┤
│  Medicines ▾   Lab Tests   Health Packages   Devices   Offers  │ 48px  │
└──────────────────────────────────────────────────────────────────────┘
```

The trust bar is the topmost element and states the licence. In a market with
significant counterfeit-medicine concern, legitimacy is the first thing a new
visitor needs, before any product.

Search is centered and dominant — Amazon's lesson: in a catalog of thousands of
SKUs with unfamiliar names, search *is* the navigation.

### Header — mobile (56px, sticky)

```
┌─────────────────────────────────┐
│ ☰   ⬤ LOGO           🔍   🛒 3 │
└─────────────────────────────────┘
```

Search expands to full-screen overlay on tap. The cart badge is `--blue-600`
with a white count, and is an `aria-live` region so additions are announced.

### Bottom navigation — mobile only (fixed, 56px)

```
┌─────────────────────────────────┐
│  🏠     🔬      📋      👤      │
│ Home  Tests  Orders  Account    │
└─────────────────────────────────┘
```

Thumb-reachable primary navigation. Hidden on checkout to remove exits from the
funnel.

### Footer

Four columns desktop, accordion mobile: Shop · Services · Company · Support.
Below: DRAP licence number, registered pharmacist name, payment method marks
(COD, JazzCash, Easypaisa), social. The licence and named pharmacist are
credibility anchors, not legal boilerplate — they belong where people look for
reassurance before a first purchase.

---

## 1. Home — `/`

```
┌─────────────────────────────────────────┐
│                                         │
│   Healthcare, delivered.                │  display, gray-900
│   Genuine medicines and lab tests        │  body, gray-500
│   at your door in 90 minutes.            │
│                                         │
│   ( 🔍 Search medicines or tests    )   │  52px, r-md
│                                         │
│   [ Upload prescription ]  [ Book test ]│  primary + secondary
│                                         │
│   ✓ DRAP licensed  ✓ Genuine  ✓ COD     │  green-700 checks
└─────────────────────────────────────────┘   white bg, 96px vertical padding
```

Apple-style hero: one sentence, generous space, no carousel. **Rotating
carousels are deliberately excluded** — they measurably hurt LCP, cause CLS, and
are ignored by users. The hero's job is the search field and the two entry
actions.

Sections below, each `--gray-50` / white alternating bands:

| Section | Content |
|---|---|
| Shop by category | 8 circular icon chips, horizontal scroll on mobile |
| Upload prescription | Full-width blue-50 panel, illustration + 3-step explainer + CTA |
| Popular lab tests | 4 test cards with price and fasting requirement |
| Health packages | 3 package cards, "62 tests included", compare-at price |
| Trending products | 5-col product grid |
| Why us | 4 icon + text: licensed, genuine, pharmacist-verified, COD |

Every section is server-rendered and statically cached. Only the cart badge and
search are client components.

---

## 2. Product listing — `/products`, `/categories/[slug]`, `/search`

```
Desktop: 280px filter sidebar (sticky) + 4-col grid
Mobile:  [ ⚙ Filters ] [ Sort ▾ ] sticky bar → filters open as bottom sheet
```

```
┌────────────┬────────────────────────────────────────┐
│ FILTERS    │ Antibiotics            142 products    │
│            │                        [ Sort: Relevance ▾ ]
│ Category   │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│  ☐ …       │ │ card │ │ card │ │ card │ │ card │   │
│ Price      │ └──────┘ └──────┘ └──────┘ └──────┘   │
│  ─●───●─   │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│ Brand      │ │ card │ │ card │ │ card │ │ card │   │
│  ☐ …       │ └──────┘ └──────┘ └──────┘ └──────┘   │
│ ☐ In stock │                                        │
│ ☐ No Rx    │        [ Load more ]                   │
└────────────┴────────────────────────────────────────┘
```

**"No prescription needed" is a first-class filter.** It is one of the most
common real intents — someone who cannot get to a doctor today wants to know
immediately what they can actually buy.

Filters are URL state (`?brand=…&price=…`), which makes filtered views
shareable, back-button-correct, and server-renderable. Pagination is
"Load more" + a real paginated URL underneath, so crawlers see every page.

Loading: 12 skeleton cards at exact final dimensions.
Empty: "No products match these filters" + list of active filters as removable
chips + "Clear all".

---

## 3. Product detail — `/products/[slug]`

The densest page in the app. Everything needed to decide is above the fold.

```
Mobile                              Desktop: 55/45 two-column, sticky right rail
┌─────────────────────────────────┐
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   │  1:1 gallery, pinch-zoom
│  ● ○ ○ ○                        │
├─────────────────────────────────┤
│  GETZ PHARMA                    │  caption, gray-500
│  Panadol Extra 500mg            │  h1
│  Paracetamol + Caffeine         │  body-sm gray-500 ← generic name
│                                 │
│  🔒 Rx REQUIRED                 │  amber badge, when applicable
│                                 │
│  Rs 450  R̶s̶ ̶5̶0̶0̶  [−10%]        │  price-lg tabular
│  Rs 45 per tablet               │  caption gray-500 ← unit price
│                                 │
│  Pack size                      │
│  [Strip of 10] [Box of 100]     │  segmented, selected = blue-600 outline
│                                 │
│  ● In stock · Delivery by Tue   │  green-700
│                                 │
│  [ −  1  + ]  [ Add to cart  ]  │  stepper + primary, 52px
│                                 │
│  🚚 Free over Rs 2,000          │  trust strip, gray-500
│  ↩ 7-day return on sealed items │
├─────────────────────────────────┤
│  ▸ Description                  │  accordions, first open
│  ▸ Composition & dosage         │
│  ▸ Side effects & warnings      │
│  ▸ Storage                      │
├─────────────────────────────────┤
│  Similar generics               │  ← same molecule, cheaper options
│  Frequently bought together     │
└─────────────────────────────────┘
```

Mobile: a **sticky bottom bar** appears once the buy button scrolls out of view —
price on the left, "Add to cart" on the right. On a long PDP the buy action must
never be more than a thumb away.

Two details specific to pharmacy:

**Generic name is displayed directly under the trade name.** Many customers
arrive with a doctor's note listing a molecule, not a brand.

**"Similar generics" is a deliberate feature**, not a cross-sell. Showing a
cheaper equivalent of the same molecule builds exactly the trust that converts
first-time buyers into repeat ones, and it is the kind of thing a pharmacy is
supposed to do.

When `requires_prescription`, the CTA reads **"Add to cart — prescription
required"** and an amber panel explains the upload step *before* adding. The
requirement is never a surprise later.

---

## 4. Prescription upload — `/prescriptions/upload`

```
┌─────────────────────────────────┐
│  Upload your prescription       │  h1
│  A licensed pharmacist reviews  │  body, gray-500
│  it within 30 minutes.          │
│                                 │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │  dashed gray-200, r-lg
│  │        📄  ⬆               │ │
│  │  Tap to upload or take     │ │
│  │  a photo                   │ │
│  │  JPG, PNG or PDF · max 10MB│ │  caption
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
│                                 │
│  Patient name  ( ............ ) │
│  Doctor name   ( ............ ) │
│  Issued on     ( ..../..../.. ) │
│                                 │
│  [ Submit for review ]          │
│                                 │
│  🔒 Your prescription is        │  gray-500 + lock
│     private and encrypted.      │
└─────────────────────────────────┘
```

Camera capture is offered first on mobile (`capture="environment"`) — nearly
every prescription is a paper slip photographed on the spot.

Uploaded files preview immediately with a client-side thumbnail so the customer
can confirm legibility before submitting. A blurry prescription is the most
common cause of rejection, and catching it here saves a 30-minute round trip.

The privacy line is explicit. Asking someone to upload a medical document
without saying what happens to it suppresses completion.

**Status page** after submit — timeline: Uploaded → Under review → Approved.
Pending state shows an estimated review time, not a bare spinner.

---

## 5. Cart — `/cart`

```
┌─────────────────────────────────────────────┐
│  Cart (3 items)                             │
├─────────────────────────────────────────────┤
│  ┌────┐ Panadol Extra 500mg           ✕     │
│  │ ▓▓ │ Strip of 10                         │
│  └────┘ 🔒 Rx required · ⚠ Not yet uploaded │  amber
│         [− 2 +]              Rs 900         │
├─────────────────────────────────────────────┤
│  ┌────┐ Complete Blood Count (CBC)    ✕     │
│  │ 🔬 │ Chughtai Lab · Home collection      │
│  └────┘ Fasting not required   Rs 1,200     │
├─────────────────────────────────────────────┤
│  ( Coupon code        ) [ Apply ]           │
├─────────────────────────────────────────────┤
│  Subtotal                        Rs 2,100   │  tabular, right-aligned
│  Discount (SAVE10)              − Rs 210    │  green-700
│  Delivery                            Free   │  green-700
│  ─────────────────────────────────────────  │
│  Total                           Rs 1,890   │  h3, tabular
│                                             │
│  [ Proceed to checkout ]                    │  primary, full-width
└─────────────────────────────────────────────┘
```

Medicines and lab tests coexist in one cart with distinct line treatments —
tests show lab, collection mode, and fasting requirement instead of quantity.
This is the visual consequence of the one-order-two-fulfilments schema decision.

Any Rx item without an approved prescription shows an **amber inline warning
with an "Upload now" link**. The blocker is surfaced here, one screen before
checkout, where it is still cheap to resolve.

Desktop: two-column with the summary sticky on the right.
Empty: pill icon, "Your cart is empty", "Browse medicines" primary + "Book a
lab test" secondary.

---

## 6. Checkout — `/checkout`

Single page, three collapsible sections. **Not a multi-step wizard** — each
navigation step loses users, and on unreliable mobile connections a wizard risks
losing state entirely.

```
┌─────────────────────────────────────────────┐
│  ⬤ LOGO                        🔒 Secure    │  stripped header: no nav, no search
├─────────────────────────────────────────────┤
│  1  DELIVERY ADDRESS                    ✓   │
│     ┌───────────────────────────────────┐   │
│     │ ◉ Home — House 12, Block B, DHA   │   │  selected: blue-600 border, blue-50
│     │   Karachi · +92 300 1234567       │   │
│     └───────────────────────────────────┘   │
│     ○ + Add new address                     │
├─────────────────────────────────────────────┤
│  2  DELIVERY METHOD                     ✓   │
│     ◉ Standard · Tue 23 Jul · Free          │
│     ○ Express · Today by 9pm · Rs 199       │
├─────────────────────────────────────────────┤
│  3  LAB COLLECTION SLOT                 ✓   │  only when cart has tests
│     Mon 22  [Tue 23]  Wed 24                │  date pills
│     ○ 7–9 AM   ◉ 9–11 AM   ○ 11–1 PM        │  full slots disabled + "Full"
├─────────────────────────────────────────────┤
│  4  PAYMENT                                 │
│     ◉ 💵 Cash on delivery      [Recommended]│  ← first, and default
│     ○ 📱 JazzCash                           │
│     ○ 📱 Easypaisa                          │
├─────────────────────────────────────────────┤
│  Order summary                    ▾         │  collapsed mobile, open desktop
│  Total                       Rs 1,890       │
│                                             │
│  [ Place order ]                            │  52px primary, full-width
│  By placing this order you agree to Terms.  │  caption
└─────────────────────────────────────────────┘
```

**COD is listed first and pre-selected.** It is the dominant payment method in
Pakistan; burying it below card options adds friction for the majority to
accommodate a minority.

**Guest checkout is fully supported** — email and phone only, with an optional
"save my details" checkbox. Forcing account creation before a COD order is a
direct conversion loss.

The lab-collection section appears only when the cart contains diagnostic items,
and full slots render disabled with a "Full" label rather than being hidden, so
availability is legible.

Validation is inline on blur, never only on submit. On submit failure, focus
moves to the first invalid field and the error is announced. The place-order
button enters a loading state and disables — the primary double-charge guard on
flaky connections.

---

## 7. Order confirmation — `/orders/[number]/confirmation`

```
        ✓                       green-600 circle, 64px
   Order confirmed              h1
   Order #HC-100234             gray-500, tabular

   ┌───────────────────────────────┐
   │ 🚚 Arriving Tue 23 Jul        │  blue-50 panel
   │    House 12, Block B, DHA     │
   ├───────────────────────────────┤
   │ 🔬 Sample collection          │
   │    Tue 23 Jul, 9–11 AM        │
   └───────────────────────────────┘

   [ Track order ]  [ Continue shopping ]
```

Both fulfilment paths are confirmed separately, because one order can have two
different arrival promises. A confirmation email goes out via Resend.

---

## 8. Lab tests & health packages

**Listing** `/lab-tests` — same grid as products, card shows: test name, short
code (CBC), sample type, fasting requirement, turnaround time, lab name, price.
Filters: category, fasting/non-fasting, lab, price, turnaround.

**Test detail** `/lab-tests/[slug]`:

```
│  Complete Blood Count (CBC)     │  h1
│  Blood sample · Report in 24h   │  body-sm gray-500
│  ⚠ Fasting not required         │
│  Rs 1,200                       │  price-lg
│  Lab: [Chughtai ▾]              │  ← lab selector changes price live
│  ◉ Home collection (+Rs 200)    │
│  ○ Visit lab                    │
│  [ Book test ]                  │
│  ▸ What it measures             │
│  ▸ Who should take it           │
│  ▸ Preparation                  │
│  ▸ Included parameters (24)     │
```

The lab selector is a live price control, which is the visible surface of the
`lab_test_pricing` table — the same test from different labs at different prices.

**Health package detail** adds an included-tests accordion with a count, and a
savings badge computed against the sum of individual test prices. That saving is
the product; it must be explicit.

---

## 9. Auth — `/login`, `/register`, `/forgot-password`

Centered card, max 420px, no header nav, logo above.

```
│         ⬤ LOGO              │
│   Welcome back              │  h1
│   Phone or email            │
│   ( ....................... )│
│   Password        [Forgot?] │
│   ( ....................... )│
│   [ Sign in ]               │
│   ─────── or ───────        │
│   [ Continue with Google ]  │
│   New here? Create account  │
```

**Phone-first**, because phone is the primary identity in Pakistan and OTP is
more reliable than email delivery locally. Password strength shows as a meter
with text, never color alone.

---

## 10. Account — `/account/*`

Desktop: 240px left nav. Mobile: list → detail drill-down.

| Page | Content |
|---|---|
| Profile | Name, phone, DOB, gender. DOB/gender flagged as improving lab-report accuracy — otherwise people skip them. |
| Orders | Card list: number, date, status pill, thumbnails, total, [Track] / [Reorder]. **Reorder is prominent** — repeat medicine purchase is the core loyalty loop. |
| Order detail | Vertical status timeline, per-item list, both fulfilment tracks, payment summary, invoice download. |
| Prescriptions | Grid of thumbnails with status pills (pending amber / approved green / rejected red + reason). |
| Lab reports | Downloadable PDFs + a trend chart for repeated analytes over time. |
| Addresses | Cards with default badge, edit/delete, add. |

Status pills always pair color with a text label.

---

## 11. Admin — `/admin/*`

Different visual register: denser, `--gray-50` page background (the one
exception to the white rule), 13px base, compact 40px table rows, persistent
240px sidebar. Staff use this for hours — density is a kindness here, where on
the storefront it would be noise.

| Page | Layout |
|---|---|
| Dashboard | 4 KPI cards (revenue, orders, pending Rx, low stock) + revenue chart + recent orders + **expiring-soon batches** |
| Products | Table: image, name, SKU, brand, price, stock, status. Bulk actions, CSV import. |
| Product editor | Two-column: form left, live preview right. Tabs: General, Variants, Inventory, Media, SEO. |
| Orders | Filterable table, status chips, bulk print labels, detail drawer. |
| **Rx verification** | Split view: prescription image with zoom on the left, order items with approve/reject on the right. Reject requires a reason. Optimized for speed — a pharmacist may clear a hundred of these a day. |
| Inventory | Batch table with expiry countdown. **Rows expiring < 90 days highlighted amber, expired red.** |
| Lab bookings | Calendar + day worklist grouped by collection slot. |
| Customers | Table + detail: order history, lifetime value, prescriptions. |
| Roles & permissions | Role list + a permission matrix of checkboxes, mapping directly to `role_permissions`. |

The Rx verification screen is the most operationally important page in the admin
panel, because it sits on the critical path of every prescription order. It gets
keyboard shortcuts (A approve, R reject, J/K next/previous) and auto-advances to
the next item in the queue.

---

## 12. System pages

| Page | Treatment |
|---|---|
| 404 | Illustration, "Page not found", search field, "Back to home" |
| 500 | Plain-language apology, retry, support phone number |
| Offline | Cached shell + "You're offline" banner |
| Maintenance | Logo, message, expected return time |

---

## 13. Build order

Design is complete; implementation should proceed in dependency order:

1. Tokens → `globals.css` + Tailwind theme
2. shadcn/ui primitives, restyled to tokens
3. Shell — header, footer, mobile nav
4. Product card, price display, Rx badge, status pill, empty/loading/error states
5. Catalog pages → PDP → cart → checkout
6. Auth → account
7. Lab tests → packages → booking
8. Admin

Each step is usable before the next begins, so there is no phase where the app
is half-broken.
