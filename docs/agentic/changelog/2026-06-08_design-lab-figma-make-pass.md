# 2026-06-08 — Design-lab Figma-Make review pass + agent guardrail

## What changed
Reviewed an external **Figma Make AI** design spec against the codebase and folded the *valuable* parts
into the `/design-lab` mocks (mocking phase only — no live-app or schema change). Added two rules to the
`design-system-architect` agent so future external specs are translated, not pasted.

### design-lab mocks (`apps/web/app/(design)/design-lab/`)
- **Real food imagery** via a new `_components/mock-image.tsx` (`<img loading="lazy">` + `onError`
  fallback, so the lab still works offline). Wired into recipe cards (4:3), recipe-detail hero (16:9),
  menu-slot thumbnails, and dashboard week-preview tiles. The fallback icon is **derived
  deterministically** (`recipe-icon.ts`, no AI): explicit override → name keyword → cuisine → tag →
  meal timeframe → generic plate. AI-based inference deferred to v3.0.
- **Members mock screen** (`_components/members-mock.tsx`) — was missing from the lab's screen set.
- **Grocery** regrouped into Todoist-style category cards; completed checks use the moss/success token.
- **Status palette** demoed via **scoped** `--success` (moss) / `--warning` (tuscan) tokens in
  `design-lab.css` (+ `.bg-*-tint` / `.text-*` utilities) — Draft/Modified/Accepted affordances.
  Token-based, **not** promoted into `globals.css`.
- **Viewport toggle** (iPhone 430 / iPad 834 / Mac 1440 / Fit): `SCREENS` extracted to
  `_components/screens.tsx`; new chrome-less `frame/page.tsx` rendered inside a real-width, scale-to-fit
  `<iframe>` so Tailwind `sm:/md:/lg:` breakpoints evaluate against the device width.

### Pre-review follow-ups
- Slimmer sidebar (`w-48`, tighter padding) for more content room.
- Recipe **detail** view ingredients are now **read-only** (display, not a checklist).
- New **Cook mode** (`recipe-cook-mock.tsx`) — checkable ingredients **and** instructions, opened from
  the menu. Flagged as a proposed PRODUCT_PRD addition (read view vs cook view); presentation-only.
- New **global Search**, two-tier: a simplified **topbar instant search** (`topbar-search.tsx`,
  cf. Figma — keyword → grouped inline results across modules + "See all results") that hands off to
  the **advanced query-builder screen** (`search-mock.tsx`, cf. Airbnb — module picker + per-module
  filters + keyword). New functionality, mock only.

### Agent (`.claude/agents/design-system-architect.md`)
- **Rule 9 — translate external design specs, never paste them.** Rejected from the Make spec: inline
  `bg-[#hex]`, `@import url()` fonts, `@media (prefers-color-scheme)` dark mode, hand-rolled `useState`
  toggle. Our stack: tokens / `next/font` / `next-themes` class-based.
- **Rule 10 — lab-scoped before global.** New tokens stay in `design-lab.css` until the direction is
  approved; promotion to `globals.css` is the Phase-3 step.

## Why
The Make spec had good product instincts (imagery, Members, grouped grocery) but was written for a
generic CRA project and would have regressed our tokens-only + `next-themes` conventions. Capturing the
distinction as agent rules stops the next external spec from re-introducing the same drift.

## Out of scope (deferred to Phase 3 / production)
Image-upload data model + URL persistence, `next/image` remote config, promoting `--success`/`--warning`
into `globals.css`, bottom-tab mobile nav, and any change to the live `(app)` screens.
