# Step 35 — Add a slot to a draft + shop-for-subset filter (MVP 1.5 Phases 3 + 5)

## What I changed

Two independent deliverables bundled in one step because they're each small
and have no shared surface. Phase 4 (servings-aware grocery scaling) is
intentionally skipped — Phase 5 ships as a faithful relative filter on the
current raw quantities, and the math composes correctly when Phase 4 lands.

## Phase 3 — Add a slot to a draft

### Route + helper

`apps/web/app/api/workspaces/[id]/menus/[menuId]/slots/route.ts` (new) —
POST handler that:

- Authorises caller as creator/admin (matches the existing slot PATCH).
- Loads the menu with its `menu_slots` + `menu_participants` join. 404s when
  not in workspace or soft-deleted. 409s when already accepted.
- Validates `target_member_id` (when non-null) is a participant — 422 if
  not. Keeps Phase 2's participant boundary intact even on this new
  mutation surface.
- Validates the recipe belongs to the workspace and its `meal_type`
  matches. 422 on meal-type mismatch.
- For **weekly** menus runs the engine's `isRecipeValidForSlot` filter
  against the resolved member (target or first participant for shared
  slots) and the persisted overlay. 422 on constraint violation.
- For **custom** menus skips the engine check — matches the existing
  custom-menu "user owns the constraint set" stance.
- Auto-derives a unique `meal_key` in the same (day, target_member_id)
  bucket via the new `pickMealKey` helper. The DB constraint is `NULLS NOT
  DISTINCT`, so null/non-null `target_member_id` buckets are kept separate.
- Inserts the slot with `is_overridden=false` and `original_recipe_id=null`
  (user-added from scratch, not an override of an engine pick).

`apps/web/lib/api/menu-slot-key.ts` (new) — `pickMealKey({ mealType,
existingKeys })`. Returns `{meal_type}` for the first occurrence,
`{meal_type}_2`, `_3`, … up to 7. Throws (route surfaces as 422
`too_many_meals`) when all 7 slots are taken. Extracted out of the route
so it's directly unit-testable.

### Hook + UI

`useAddMenuSlot` added to `apps/web/lib/hooks/use-menu-draft.ts` — POSTs
to the new route, invalidates the draft query on success.

`apps/web/app/(app)/menu/_components/add-slot-dialog.tsx` (new) — modal
hosting meal-type select, target dropdown (Shared + each menu
participant), recipe search filtered to the meal_type. Submitting picks a
candidate and calls `useAddMenuSlot`.

`menu-view.tsx` changes:

- `groupByDay` rewritten to take `start_day_of_week` + `duration_days` so
  it emits a bucket for every day the menu covers, including days the
  engine left empty for the menu's participants. Without this, the "Add
  meal" button would only render on days that already had a slot.
- New `onAddSlot?: (day: string) => void` prop. When set, each day card
  (mobile single-card + desktop grid) renders a "+ Add meal" ghost button.

`apps/web/app/(app)/menu/page.tsx` — wires the new dialog. Open state is
the clicked day; closing clears it.

### Phase 3 tests

`apps/web/lib/api/__tests__/menu-slot-key.test.ts` (new) — 5 tests on
`pickMealKey`: empty bucket → meal_type; unrelated-only bucket → meal_type;
second occurrence → `_2`; skip taken `_N`s; throw when all 7 taken.

The route handler itself doesn't get a dedicated mock test in this step —
the helper is unit-tested and the route's branches are all small guards
that mirror the existing slot PATCH route's pattern. Integration coverage
will come with the next pass over the `apps/web/integration/` lane.

## Phase 5 — Shop-for-subset filter

### Filter helper

`apps/web/lib/grocery-filter.ts` (new) — `applyShopForFilter({ lists,
participantIds, selectedIds })`. Returns the filtered + scaled lists.

- `selectedIds === null` or equals the full participant set → pass-through
  (still coerces string quantities to numbers so the page consumes one
  shape).
- Otherwise:
  - Shared bucket (target_member_id IS NULL): each quantity multiplied by
    `selectedCount / participantCount`.
  - Per-member bucket: included only if its target is in `selectedIds`;
    quantities untouched (a per-member slot already cooks for 1 eater).
  - Falls back to ratio = 1 when `participantIds` is empty, so legacy
    grocery rows for a menu that somehow has no participants don't blow up
    on divide-by-zero.

### UI

`apps/web/app/(app)/grocery/_components/shop-for-picker.tsx` (new) —
multi-select chips of menu participants. Empty selection collapses back
to "whole household" (`null`) — we never let the user opt nobody in.
Banner explains the scaling ratio + the export caveat.

`apps/web/app/(app)/grocery/page.tsx`:

- URL-synced state via `?shop_for=uuid,uuid` (comma-separated). Uses
  `useRouter().replace(...)` so the filter is shareable and refresh-safe.
- Loads `participantIds` from the active menu's `menu_participants`
  (Phase 2). Falls back to `workspace_members` until the active menu
  query resolves so the picker is still visible during initial load.
- The page's `sortedLists` now operates on `applyShopForFilter`'s output
  (`scaledItems` shape). The "(N) items" header, ingredient detail
  dialog, freshness pills, etc. all keep working unchanged because the
  scaled shape preserves ingredient_id / unit / scheduled_purchase_day.

### Phase 5 tests

`apps/web/lib/__tests__/grocery-filter.test.ts` (new) — 8 tests:

- pass-through when `selectedIds` is null or equals the full set;
- halves shared quantities when shopping for half the participants;
- per-member buckets dropped for non-selected members;
- per-member quantities untouched (eaters = 1);
- string quantities coerced to numbers in the unfiltered path;
- divide-by-zero avoided when participantIds is empty;
- `scheduled_purchase_day` preserved through scaling.

## PRD updates

- **PRODUCT_PRD.md** §4.0.1 — new "Add a slot to an existing draft"
  section covering rules + meal_key auto-derivation; §7.1 — new
  "Shop-for-subset filter" section covering the read-side rescale +
  per-member filter, URL persistence, and the export caveat.
- **ARCHITECTURE_PRD.md** §5.4 — new POST `/menus/[menuId]/slots`
  endpoint documented alongside the existing slot PATCH; §9 — endpoint
  added to the listing; §10.1 — shop-for picker on the grocery page,
  presentation-only transform.

## Verification

```
pnpm -r typecheck                            → 4/4 packages green
pnpm -r test                                 → 132 passed, 8 skipped
                                               (was 119; added 5 menu-slot-key
                                               + 8 grocery-filter)
pnpm -F web lint                             → 0 errors, 2 pre-existing warnings
```

## Files

New:
- `apps/web/app/api/workspaces/[id]/menus/[menuId]/slots/route.ts`
- `apps/web/lib/api/menu-slot-key.ts`
- `apps/web/lib/api/__tests__/menu-slot-key.test.ts`
- `apps/web/lib/grocery-filter.ts`
- `apps/web/lib/__tests__/grocery-filter.test.ts`
- `apps/web/app/(app)/menu/_components/add-slot-dialog.tsx`
- `apps/web/app/(app)/grocery/_components/shop-for-picker.tsx`
- `prompts/35-add-slot-and-shop-for-subset.txt`
- `agent-log/35-add-slot-and-shop-for-subset.md` (this file)

Edited:
- `apps/web/lib/hooks/use-menu-draft.ts`
- `apps/web/app/(app)/menu/_components/menu-view.tsx`
- `apps/web/app/(app)/menu/page.tsx`
- `apps/web/app/(app)/grocery/page.tsx`
- `docs/PRD/PRODUCT_PRD.md`
- `docs/PRD/ARCHITECTURE_PRD.md`

## Not touched on purpose

- **Phase 4 (servings-aware scaling)** is deferred per user direction.
  Phase 5 here is built on top of whatever raw quantities the current
  recompute produces. The scaling formula is multiplicative
  (`selectedCount / participantCount`) so it composes correctly with
  Phase 4's `(eaters / recipe.servings)` baseline once that lands.
- **Filtered exports** — the markdown / CSV export buttons still
  download the unfiltered list. Plumbing the filter through the
  server-side export route is a follow-up; the on-screen banner calls
  out the gap so users aren't surprised.
- **Add-slot route integration tests** — extracted the pure
  `pickMealKey` helper into its own module and unit-tested it. Full
  end-to-end coverage of the route lives with the next pass over the
  `apps/web/integration/` lane (gated on `SUPABASE_TEST_URL`).
- **Slot delete / retarget** — out of MVP 1.5 scope per the original
  plan decisions (user only picked "Add a new slot" from the slot-ops
  options).

## Follow-ups still open from MVP 1.5

- Phase 4: servings-aware grocery scaling (engine + recompute) — uses
  `COUNT(menu_participants)` as the head-count denominator.
- Filtered export — pass `shop_for_member_ids` through to the markdown
  / CSV export route so downloads reflect the picker.
- Integration test pass: add-slot end-to-end, shop-for-subset
  end-to-end.
- Migration: default `meal_frequency` per `age_category` (carried from
  Phase 1).
- Carried from earlier steps: history row drill-down, draft↔accept
  grocery unification, dedupe `isMenuStillUpcoming`.
