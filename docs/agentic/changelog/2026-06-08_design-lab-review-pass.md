# 2026-06-08 — Design-lab review-feedback pass (prototype nav, per-member accent, brand rosie)

## What changed
Folded a batch of review feedback into the `/design-lab` mocks (mocking phase only — the one
exception that touches the live token file is the brand-hue tweak, explicitly requested). The lab is
now a **clickable prototype**, the menu reflects the real per-meal model, and per-member accent shows
up where you switch members.

### Brand color (the one live change)
- **Strawberry rosied `#fb4b4e` → `#fb4b66` (359° → 351°).** Updated in `globals.css` (hero gradient
  stop + `strawberry` per-user accent, light + dark) **and** the design-lab mirror. `--primary` /
  `--ring` / `--sidebar-primary` **left at 359°** (the AA-tuned fill) and `--secondary` unchanged —
  per the product call "change strawberry, keep primary." Docs: `color-palette.md` §4.3 (new),
  `user-accent-colors.md` strawberry row.

### design-lab mocks (`apps/web/app/(design)/design-lab/`)
- **Clickable prototype** — new `_components/lab-nav.tsx` context. Sidebar items, the avatar (→
  Profile), recipe cards (→ detail), "Generate" (→ wizard), a menu slot (→ Cook mode), search results
  + "See all results" (→ Search), form Save/Cancel (→ list) all navigate. Works inline (Fit) and
  inside each device-frame iframe (`frame/page.tsx` now owns local screen state).
- **Per-member accent** — `mock-data.ts` gains `AccentKey` + `ACCENT_SOLID` + `memberAccentStyle` /
  `memberDotStyle` / `memberRingStyle`; each `MockMember` carries an `accent`. Used **only** on
  member-tied surfaces (dashboard + menu + generate selectors, member role badges, dots) so switching
  members reads visually without flooding the UI.
- **Topbar search** — results render **only after typing** (empty = a hint); under `sm` it collapses
  to a search *icon* that opens a **full-width top sheet** (the mobile fix), not a shrunken pill.
- **Dashboard** — member selector + relabel ("Ana's week"); pool-size stat replaced with actionable
  **"Meals cooked today" (2 / 3)**.
- **Weekly menu** — rebuilt as a **day-row × meal-column grid** (every meal of every day visible) +
  member selector.
- **Generate menu** — **Auto-generate** *and* **Build manually** tabs (hand-pick each day × meal
  slot), matching the live two-path system.
- **Recipe detail** — **Edit** + **Cook** buttons. **New-recipe form** — added an **Instructions**
  section (repeatable step textareas). **Cook mode** — fully interactive; checking every instruction
  reveals an enabled **"Mark as cooked"** → back to menu.
- **Grocery** — per-line **free-text note** on a half-width bottom row + **Replace** affordance
  (⚠ proposed; live grocery items are structured-only today).
- **Members** — accent ring + dot + accent-tinted role badge; allergies shown with the warning token.
- **Profile** — now mirrors the live settings surface: read-only email, **change-password** fields,
  distinct **Dietary restrictions vs Allergies**, and a **Meal schedule** card.

## Why
The mocks read like Figma frames, not a flow — so navigation + the real per-meal menu shape were the
biggest review gaps. Per-member accent answers "whose menu is this?" at a glance. The brand rosie is a
one-line, git-reversible token move the user signed off on; keeping `--primary` at 359° avoids a
re-contrast pass on every CTA.

## Out of scope (still deferred)
Image-upload data model, `next/image` remote config, promoting `--success`/`--warning` + cozy tokens
into `globals.css`, bottom-tab mobile nav, and the **grocery note/substitution + Cook-mode** data-model
decisions (both need PRD/schema sign-off before they leave the lab).
