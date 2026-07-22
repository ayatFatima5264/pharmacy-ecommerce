# Design System

Premium healthcare commerce. White background, blue primary, green success,
rounded cards, mobile-first.

Every value below is final and directly implementable as CSS variables +
Tailwind theme. Contrast ratios are computed, not estimated.

---

## 1. Design principles

**Trust over delight.** People buying medicine are frequently anxious and often
buying for someone else. Legibility beats cleverness; explicitness beats
elegance. No decorative element may compete with a safety-critical one.

**Apple for the shell, Amazon for the decision.** Marketing, navigation, and
empty states get restraint and whitespace. Product pages, cart, and checkout get
density — price, stock, delivery estimate, and the buy action all visible without
scrolling. Minimalism that hides buying information reads as evasive.

**One primary action per view.** Blue is scarce on purpose. If three things on a
screen are blue, none of them is the answer to "what do I do next".

**Mobile is the real product.** Pakistan is mobile-dominant on mid/low-end
Android over variable 4G. The desktop layout is the adaptation, not the origin.

---

## 2. Color

### 2.1 Primary — Blue

Blue carries brand, links, and the single primary action.

| Token | Hex | Use | Contrast on white |
|---|---|---|---|
| `--blue-50`  | `#EFF5FF` | Tinted surfaces, selected rows | — |
| `--blue-100` | `#DBE8FE` | Focus halo, subtle borders | — |
| `--blue-500` | `#2B7FFF` | Decorative, gradients | 3.1:1 |
| `--blue-600` | `#0057D9` | **Primary buttons, links** | **6.24:1** ✅ AA |
| `--blue-700` | `#0046AE` | Hover / pressed | 8.6:1 ✅ AAA |
| `--blue-900` | `#062C6B` | Headings on tinted panels | — |

`--blue-600` is the workhorse. It passes AA for normal text on white, which
means links do not need to be bold or underlined-only to be accessible.

### 2.2 Success — Green

**Reserved for success and verified states only.** Never prices, never "in
stock", never a generic CTA.

| Token | Hex | Use | Contrast on white |
|---|---|---|---|
| `--green-50`  | `#ECFDF5` | Success banner background | — |
| `--green-600` | `#0E9F6E` | Icons, badge fills, progress | 3.38:1 — UI only |
| `--green-700` | `#047857` | **Success text** | **5.48:1** ✅ AA |

Two greens exist because `--green-600` fails AA for body text at 3.38:1. Using
one green for both fills and text is the most common accessibility failure in
"green = good" systems. Fill with 600, write with 700.

### 2.3 Prescription — Amber

Prescription-required is **not an error**, so it must not be red. It is a
condition of purchase, and it gets its own reserved color so it is never
confused with either a warning or a success.

| Token | Hex | Use | Contrast on white |
|---|---|---|---|
| `--amber-50`  | `#FFFBEB` | Rx notice background | — |
| `--amber-600` | `#D97706` | Rx badge fill, icon | 3.3:1 — UI only |
| `--amber-700` | `#B45309` | **Rx text** | **4.9:1** ✅ AA |

### 2.4 Danger — Red

| Token | Hex | Use | Contrast on white |
|---|---|---|---|
| `--red-50`  | `#FEF2F2` | Error banner background | — |
| `--red-600` | `#DC2626` | **Error text, destructive action** | **4.83:1** ✅ AA |
| `--red-700` | `#B91C1C` | Hover on destructive | 6.5:1 ✅ AA |

### 2.5 Neutrals

| Token | Hex | Use |
|---|---|---|
| `--white`      | `#FFFFFF` | Page background, card surface |
| `--gray-50`    | `#F8FAFC` | Section bands, input fill |
| `--gray-100`   | `#F1F5F9` | Skeletons, dividers on tint |
| `--gray-200`   | `#E2E8F0` | **Card + input borders** |
| `--gray-400`   | `#94A3B8` | Placeholder, disabled text |
| `--gray-500`   | `#64748B` | Secondary text — 4.76:1 ✅ AA |
| `--gray-700`   | `#334155` | Body text — 10.9:1 ✅ AAA |
| `--gray-900`   | `#0F172A` | Headings — 17.9:1 ✅ AAA |

`--gray-500` is the lightest permitted text color. Anything lighter is
decoration, not information — this is the rule that keeps "minimal" from
becoming "unreadable", which is the usual failure mode of premium-minimal
healthcare sites.

### 2.6 Color usage rules

1. Page background is **always white**. Section separation uses `--gray-50`
   bands and borders, never gray page backgrounds.
2. **One `--blue-600` filled button per viewport.** Secondary actions are
   outline or ghost.
3. Green = success/verified only. **Price is `--gray-900`, not green.**
4. Never encode meaning in color alone — every colored state pairs with an icon
   or text label. Required for colorblind users and for WCAG 1.4.1.
5. Discount prices use `--red-600` for the *badge*, `--gray-400`
   strikethrough for the old price. The new price stays `--gray-900`.

---

## 3. Typography

**Inter Variable**, self-hosted (`next/font/local`), with system fallback.
Self-hosted because a Google Fonts round-trip on 3G costs ~300ms of LCP.

```
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

Tabular numerals (`font-variant-numeric: tabular-nums`) are **mandatory** on all
prices, quantities, order totals, and lab values, so digits align in columns and
totals do not shift while updating.

### Scale

| Token | Size / Line height | Weight | Use |
|---|---|---|---|
| `display` | 48 / 52 (mobile 34 / 40) | 700, `-0.02em` | Home hero only |
| `h1` | 34 / 40 (mobile 27 / 34) | 700, `-0.02em` | Page title |
| `h2` | 24 / 32 | 650, `-0.01em` | Section heading |
| `h3` | 19 / 28 | 600 | Card title, PDP name |
| `body` | 16 / 26 | 400 | Default — never below 16px |
| `body-sm` | 14 / 22 | 400 | Secondary, metadata |
| `caption` | 12.5 / 18 | 500 | Badges, labels, legal |
| `price` | 21 / 28 | 700, tabular | Price display |
| `price-lg` | 30 / 36 | 700, tabular | PDP price |

**Body text never goes below 16px.** Also prevents iOS Safari's zoom-on-focus
for inputs. Negative letter-spacing on large text is what gives headings the
Apple-like optical tightness; body text keeps normal tracking for legibility.

---

## 4. Spacing, radius, elevation

**4px base grid.** `1 2 3 4 6 8 12 16 20 24` → `4 8 12 16 24 32 48 64 80 96`px.

### Radius — "rounded cards", specified

| Token | Value | Applies to |
|---|---|---|
| `--r-sm` | 8px | Inputs, badges, small buttons |
| `--r-md` | 12px | **Buttons, cards** |
| `--r-lg` | 16px | Modals, bottom sheets, hero panels |
| `--r-xl` | 24px | Marketing feature blocks |
| `--r-full` | 9999px | Pills, avatars, category chips |

Radius scales with element size. A 12px radius on a 400px-wide card looks tight;
an 16px radius on a 32px badge looks like a pill. Consistency is proportional,
not literal.

### Elevation

Premium surfaces are defined by **borders, not shadows**. Heavy shadows are the
fastest way to look dated.

| Token | Value | Use |
|---|---|---|
| `--e-0` | `1px solid var(--gray-200)` | **Default card — border only** |
| `--e-1` | `0 1px 2px rgb(15 23 42 / .06)` | Hover lift on interactive cards |
| `--e-2` | `0 4px 12px rgb(15 23 42 / .08)` | Dropdowns, popovers |
| `--e-3` | `0 12px 32px rgb(15 23 42 / .12)` | Modals, sheets |

Shadow color is `--gray-900` at low alpha, never pure black — neutral-tinted
shadows read as clean, black shadows read as muddy.

---

## 5. Layout

| Breakpoint | Width | Grid |
|---|---|---|
| Mobile | < 640 | 1 col, 16px gutter |
| `sm` | ≥ 640 | 2 col products |
| `md` | ≥ 768 | 3 col products |
| `lg` | ≥ 1024 | 4 col, sidebar appears |
| `xl` | ≥ 1280 | max container **1280px**, 5 col |

Container: `max-width: 1280px`, padding `16px` mobile → `24px` md → `32px` lg.

**Touch targets ≥ 44×44px** everywhere. Non-negotiable on a mobile-dominant
platform, and a WCAG 2.5.8 requirement.

---

## 6. Core components

### Button

| Variant | Fill | Text | Border |
|---|---|---|---|
| Primary | `--blue-600` | white | none |
| Secondary | white | `--blue-600` | 1px `--blue-600` |
| Ghost | transparent | `--gray-700` | none |
| Destructive | `--red-600` | white | none |

Heights: `sm` 36px · `md` 44px · `lg` 52px. Radius `--r-md`. Weight 600.
Full-width on mobile for primary actions.

**Every async button has a loading state** — spinner replaces the label, width
is preserved so the layout does not jump, and the button is `aria-busy` and
disabled. This is the single most important anti-double-submit control in
checkout.

### Input

44px tall (`lg` 52px), `--r-sm`, `1px --gray-200`, white fill.
Focus: `2px --blue-600` border + `3px --blue-100` ring, **never**
`outline: none` without a replacement.
Error: `--red-600` border, message below with an icon — color alone is not the
error signal.
Labels are always visible above the field. Placeholder-as-label fails
accessibility and disappears exactly when the user needs it.

### Product card

```
┌─────────────────────────┐  border 1px gray-200, radius 12px
│  ┌───────────────────┐  │  image 1:1, gray-50 fill, lazy
│  │      image        │  │  ← Rx badge overlays top-left when required
│  └───────────────────┘  │
│  BRAND          12.5px  │  gray-500, uppercase, tracking .04em
│  Product Name           │  h3, 2-line clamp
│  Strength · Pack        │  body-sm, gray-500
│  Rs 450   R̶s̶ ̶5̶0̶0̶  −10%  │  price gray-900 tabular · old gray-400 · badge red
│  ● In stock             │  green-700 + dot  /  gray-500 if out
│  [   Add to cart    ]   │  secondary; full-width, 44px
└─────────────────────────┘
```

Fixed image aspect ratio and 2-line title clamp keep card heights equal, which
prevents grid reflow — the main cause of CLS on listing pages.

### Rx badge

```
🔒 Rx REQUIRED     amber-600 fill @ 10%, amber-700 text, icon, r-full, 12.5px
```

Appears on the card, the PDP, every cart line, and every checkout line. **A
prescription requirement is never disclosed for the first time at checkout** —
that is the single worst UX failure available in this domain, and it is also the
most common one.

### Feedback surfaces

| State | Pattern |
|---|---|
| Loading | Skeleton blocks in `--gray-100`, matching final layout dimensions. Never a centered spinner for page content — spinners give no layout hint and feel slower. |
| Empty | Line icon, one-line heading, one-line explanation, one primary action. Never a bare "No results". |
| Error | `--red-50` panel, `--red-600` icon + text, plain-language cause, and a retry action. |
| Success | `--green-50` panel, `--green-700` text, checkmark icon. |

---

## 7. Accessibility

Target: **WCAG 2.1 AA**.

- All text ≥ 4.5:1; UI and graphics ≥ 3:1. Every token above is measured.
- Visible focus on every interactive element — 2px blue ring, never removed.
- Full keyboard operability; logical tab order; focus trapped in modals and
  restored on close.
- Semantic landmarks (`header`/`nav`/`main`/`footer`), one `h1` per page,
  no skipped heading levels.
- All images have `alt`; decorative images `alt=""`.
- Live regions (`aria-live="polite"`) announce cart updates and form errors.
- "Skip to content" as the first tabbable element.
- Respect `prefers-reduced-motion` — transitions drop to opacity-only.
- Form errors are announced, tied via `aria-describedby`, and focus moves to the
  first invalid field on submit.

---

## 8. Motion

Fast and nearly invisible. Motion confirms causality; it is not entertainment.

| Purpose | Duration | Easing |
|---|---|---|
| Hover / focus | 120ms | `ease-out` |
| Dropdown, tooltip | 160ms | `cubic-bezier(.2,0,0,1)` |
| Modal, sheet | 240ms | `cubic-bezier(.2,0,0,1)` |
| Page transition | 200ms | opacity only |

Nothing exceeds 300ms. Animate only `transform` and `opacity` — animating
`width`, `height`, or `top` forces layout on every frame and drops frames on the
mid-range Android hardware most of this audience uses.

---

## 9. Performance budget

Measured on **mid-range Android over 4G**, not desktop fibre.

| Metric | Target |
|---|---|
| LCP | < 2.5s |
| CLS | < 0.1 |
| INP | < 200ms |
| JS on first load | < 120KB gzipped |
| Product image | < 40KB (AVIF/WebP via `next/image`) |

Enforced structurally: Server Components by default, `"use client"` only at
interactive leaves, self-hosted variable font, fixed media aspect ratios to
prevent CLS, and route-level code splitting. The design system is deliberately
small — one font family, one weight axis, borders instead of shadow stacks.
