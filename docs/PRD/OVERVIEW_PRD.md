# Recipe Manager & Constraint-Based Weekly Menu Planner

# 1. Project Overview

### Project Name
Weekly Food Planner

## Vision
Build a web app that helps individuals and households organize recipes, generate reproducible weekly meal plans, and create grocery lists.
The core innovation focus of the project is a deterministic constraint-based menu generation engine that considers age groups and food restrictions.

# 2. Problem statement
Meal planning for households is difficult because:
- Different members have different dietary restrictions
- Meal repetition becomes common
- Grocery shopping becomes inefficient
- Fresh ingredients spoil quickly
- Calorie balancing is hard to maintain
- Existing planners rarely support deterministic and testable generation
- Family-friendly menus are hard to do without multiple lists due to family likes/dislike lists and age-approved meals

---

# 3. Goals

## Primary Goals
- Provide recipe management
- Support individual and group meal planning
- Generate weekly menus automatically
- Respect dietary and ingredient constraints
- Produce reproducible outputs
- Generate organized grocery lists

---

# 4. Target users

## Individual Users
Single users who want:
- Weekly meal organization
- Recipe storage
- Grocery list generation
- Dietary tracking

---

## Families & Households
Groups with:
- Shared meals
- Multiple dietary restrictions
- Different calorie needs
- Child/adult meal routines

---

# 5. Core features

## Authentication
- User registration
- Email verification
- Login/Logout
- Password reset
- Group ownership

---

## Group Management
- Household creation
- Member management
- Member roles (creator, admin, member)
- Dietary profiles
- Calorie goals
- Meal frequency routines

---

## Recipe Management
- Recipe CRUD
- Ingredient tracking
- Dietary tagging
- Recipe images
- Shared and member-specific meals

---

## Menu Generation
- 7-day planning
- Constraint validation
- Deterministic generation
- Shared and member-specific meals

---

## Menu & grocery viewing
- In-app menu view (week / day)
- Per-member menu view — filter the weekly grid to one member's slots **(v2.0)**
- In-app grocery list view (shared + per-member)
- Consolidated all-members grocery view — single household list unioning shared + every per-member list **(v2.0)**
- PDF-ready layout (PDF export itself is post-MVP)

---

## Grocery list generation
- Aggregated ingredients
- Freshness-aware grouping
- Shared grocery list
- Member-specific grocery items

---

## Week execution & pantry **(v2.0)**

Post-accept lifecycle: shop → cook → leftovers → pantry-aware next week.

- **Inventory** — workspace-level pantry tracking of ingredients by source (manual, purchase, leftover); optional per-item expiration; partial-spoilage decrement.
- **Shopping confirmation** — review the grocery list per accepted menu (optionally grouped by food group); mark each item acquired/partial/skipped; completeness threshold (≥90% complete, 30–90% incomplete, <30% barely-shopped); finalize spills purchased-but-unused into inventory.
- **Cook-status** — per-slot planned/cooked/skipped record; structurally invisible to `accepted_seed` and the engine.
- **Leftovers** — leftover entries in inventory; each leftover has its own independently editable expiration, defaulted from the ingredient's `max_storage_days` else the workspace `leftover_max_days` fallback.
- **Food groups** — classification for ingredients (seed column + Claude-API fallback, server-only); drives shopping-session grouping.

---

# 6. MVP Scope

## Included in MVP for 26/06/2026
- Authentication with email verification
- Group support with roles (creator, admin, member)
- Recipe CRUD with images
- Weekly menu generation
- Constraint engine
- Grocery list generation
- Deterministic output
- In-app menu and grocery views (PDF-ready layout)
- Automated tests (Vitest)
- Dockerized local setup

---

## Excluded from MVP for 26/06/2026
- PDF export of menus and grocery lists (planned for next MVP)
- AI recipe generation
- Nutrition APIs
- Real-time collaboration
- Budget optimization
- Shopping integrations
- Inventory tracking
- Calendar synchronization

---

## v2.0 — Execution & Pantry (post-MVP, planned)

Items 0–5, 7, 8, 9, 10 from the [v2 epic](../../.claude/plans/v2.md). Buildable plan in [`.claude/plans/v2.0.md`](../../.claude/plans/v2.0.md).

| Item | Feature |
|---|---|
| 0 | Food groups (seed + Claude-API classify, server-only) |
| 1 | Inventory tracking (manual/purchase/leftover; optional per-item expiration) |
| 2 | Shopping confirmation + completeness (30/90 thresholds, food-group grouping) |
| 3 | Incomplete-shopping alerts (derived, no table) |
| 4 | Cook-status per slot (`planned`/`cooked`/`skipped`; separate table; invisible to `accepted_seed`) |
| 5, 7 | Leftovers + per-leftover expiry defaulting (each row's own `expiration_date`) |
| 8 | Consolidated all-members grocery view (pure read-side aggregation) |
| 9 | Menu-level ingredient substitution (grocery reflects it; seed unchanged) |
| 10 | Per-member menu switcher |

**v2.1 follow-on** — smarter generation (inclusive preferences + per-generation overlay relax, multi-timeframe recipes), addons + on-the-fly cook mode, bulk recipe-create primitive. See [`.claude/plans/v2.1.md`](../../.claude/plans/v2.1.md).

---

# 7. Core principles

## Deterministic Generation
Same inputs + same seed = same output.

---

## Constraint Safety
Hard dietary restrictions must never be violated.

---

## Modularity
Business logic must remain isolated and testable.

---

# 8. Acceptance criteria

The project is accepted when:
- Users can manage recipes
- Groups and members can be configured
- Menus respect dietary constraints
- Menus are reproducible
- Grocery lists aggregate correctly
- Tests pass in CI
- Project runs through docker compose

---

# 9. Post-MVP roadmap

> The 26-Jun-2026 MVP boundary (§6) is unchanged. The items below are **planned**, not shipped; each
> release is specified in its own plan under [`.claude/plans/`](../../.claude/plans/) and PRD'd
> section-by-section as it is built. This list is the release line, not feature detail.

**Committed release line**
- **v2 — Execution & Pantry + platform readiness** ([v2 epic](../../.claude/plans/v2.md)):
  - **v2.0** — inventory/pantry, shopping confirmation + completeness, cook-status, leftovers, menu-level
    ingredient substitution, all-members/per-member views, food groups.
  - **v2.1** — smarter generation (inclusive preferences + per-generation overrides, multi-timeframe
    recipes), addons + on-the-fly cook mode, and the **bulk recipe-create primitive**.
  - **v2.2** — Extras (manual / non-food grocery lines).
  - **v2.3** — **demo-lab + Bruno tooling**: a production-gated, mock walkthrough harness to demo the whole
    product to prospects (with the version it represents shown on top), plus a kept-current API test
    collection and a one-call dev-onboarding seed.
  - **v2.4** — **Hosting & Deployment** (managed Supabase + Vercel + CI + an agentic release pipeline) so
    v2 + v3 ship deployable for beta.
- **v3 — AI menu & recipe import + i18n** ([v3](../../.claude/plans/v3.md)): hand the app a nutritionist's
  list / weekly plan (ES or EN, via a fillable template or pasted text); it reviews the workspace, dedups,
  and generates a menu + the backing recipes (AI suggests, the human confirms; the engine stays
  deterministic). Includes full ES/EN app localization.
- **v4 — Community recipes** ([v4 epic](../../.claude/plans/v4.md)): share → import-duplicate → reviews/voting
  → discovery page; copy-semantics, never shared-mutable.
- **v5 — Native mobile app** ([v5](../../.claude/plans/v5.md)): a phased Expo client on shared code
  (deferred — the responsive web already serves mobile/tablet for beta).
- **v6 — Deeper/ambient AI** ([v6](../../.claude/plans/v6.md)): voice capture, receipt/OCR import, leftover
  suggestions, an ambient assistant — gated on net-new tooling.

**Still future (not yet scheduled)**
- PDF export of menus and grocery lists (next MVP).
- Shopping expenses tracking / budget optimization.
- Calendar synchronization.
