# Step 32 — Pending migrations + per-member & freshness-aware grocery recompute

## What I changed

### 1. Root-cause for "column menu_slots_1.is_overridden does not exist"

The four step-29 / step-30 migration files were committed to disk but had
never been applied to the running local Postgres instance:

- `20260526000100_tbl_menus_add_draft_accept_columns.sql`
- `20260526000101_tbl_menu_slots_add_override_columns.sql`
- `20260526000200_enum_create_menu_type.sql`
- `20260526000201_tbl_menus_add_type_duration_clone.sql`

`supabase migration list --local` showed them missing from the DB. The
client code (menu-view, menu history page, accept handler) was selecting
columns that did not exist in the schema PostgREST saw, which is what
produced the alias-form error `menu_slots_1.is_overridden` (PostgREST
aliases the embedded-resource table on every select).

Fix: applied them via `supabase migration up --local`, then notified
PostgREST to reload its schema cache (`NOTIFY pgrst, 'reload schema'`).

This wasn't a code bug — it was a "your local DB is older than your
migrations folder" drift. Worth flagging here so future-me / a teammate
checks `migration list --local` first when columns appear to vanish.

### 2. Per-member grocery lists on recompute

`apps/web/lib/api/menu-grocery.ts` was previously rebuilding only the
shared list. It now buckets per `target_member_id`:

- **Shared bucket** (always present): aggregates every slot regardless of
  `target_member_id`. This is the master list — what the household needs
  to buy overall.
- **Per-member bucket** (one per distinct non-null `target_member_id`):
  aggregates only the slots targeted at that member. Slots with
  `target_member_id IS NULL` (the custom-menu default) contribute only
  to the shared bucket.

The recompute now writes one `grocery_lists` row per bucket. The grocery
page already groups by `target_member_id` (`apps/web/app/(app)/grocery/page.tsx`
already renders "Shared" + "Per member: X" headings), so the UI picks
this up for free.

### 3. Freshness scheduling

`grocery_items.scheduled_purchase_day` is now populated based on the
ingredient's perishability + the slot's calendar position in the menu:

- If the ingredient is `is_perishable` OR `requires_fresh` OR
  `same_day_cook` (any of the three flags), `scheduled_purchase_day` =
  the earliest `day_of_week` in the menu's calendar order on which the
  ingredient is consumed.
- Otherwise: `NULL` (buy anytime).

"Calendar order" mirrors the engine's `enumerateMenuDays`: walk forward
from `menus.start_day_of_week` for `duration_days` days, wrapping past
Sunday → Monday. So a Fri-start, 4-day menu orders fri/sat/sun/mon.
Same-day-cook and requires-fresh ingredients land on their actual usage
day; merely-perishable ingredients also land on first-use so the user
front-loads when storage life is short. We could later shift purchase
earlier when the menu has buffer days `>= max_storage_days`, but that's a
soft scheduling improvement, not a correctness fix.

### 4. Quantity sanity guard

`grocery_items.quantity` has a `CHECK (quantity > 0)`. The recompute now
filters out aggregates that summed to zero before insert so a single
malformed `recipe_ingredients` row can't fail the whole transaction.

### 5. Back-compat alias

The function got a more accurate name —
`recomputeGroceryListsForMenu` (plural) — but I kept
`recomputeGroceryListForMenu` (singular) re-exported as an alias so
`apps/web/lib/api/menu-accept.ts` keeps compiling. Renaming the call site
is a follow-up rather than something to bundle into a bug fix.

## Verification

```
pnpm -r typecheck   → 4/4 packages green
pnpm -r test        → 97 passed, 8 skipped
pnpm -F web lint    → 0 errors, 2 pre-existing warnings unchanged
supabase migration list --local  → all 41 migrations applied
\d public.menu_slots → is_overridden + original_recipe_id present
```

## Files

- `apps/web/lib/api/menu-grocery.ts` — full rewrite. New aggregation
  pipeline (slots → recipe_ingredients → ingredients → per-bucket
  aggregate → per-bucket grocery_lists + grocery_items insert).
- `prompts/32-pending-migrations-and-grocery-recompute.txt`
- `agent-log/32-pending-migrations-and-grocery-recompute.md` (this file)

## Not touched on purpose

- The engine's `aggregateGroceryLists` in
  `packages/constraint-engine/src/grocery.ts` still emits shared-only +
  null scheduled days. Engine output is no longer the source of truth
  for accepted menus (recompute replaces it) but it IS still what the
  draft sees until acceptance, so the draft → accept transition can
  visibly change the list shape (esp. for menus with per-member slots).
  Future work: either have menu-persistence call the recompute helper at
  draft time, or teach the engine to do the same aggregation. The latter
  is more invasive because the engine works on snapshots, not DB rows.
- The recompute helper lives in `apps/web` rather than the engine
  package. It depends on Supabase row shapes, so promoting it to the
  engine would require taking either a `SupabaseClient` or pre-hydrated
  snapshots — both worse than the current placement.

## Follow-ups still open

- Unify draft + accept grocery paths (see above).
- Shift `scheduled_purchase_day` earlier when storage buffer allows,
  rather than always landing on first-use day.
- History row drill-down (read-only `MenuView`) — carried from step 31.
- Dedupe `isMenuStillUpcoming` across `menus.ts` and `grocery.ts` — also
  from step 31.
