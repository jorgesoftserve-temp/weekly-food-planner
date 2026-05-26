# Step 36 — Servings-aware grocery scaling (MVP 1.5 Phase 4)

## What I changed

Closes the deferred Phase 4 from the MVP 1.5 plan. Cook-once scaling
applied at both ends of the grocery pipeline (engine draft output + server
recompute on acceptance), so the on-screen quantities and the
exported quantities both reflect "buy enough to feed the people eating".

### 1. Engine — `aggregateGroceryLists` (packages/constraint-engine/src/grocery.ts)

Rewritten with two changes:

- **Servings scaling**: each ingredient contribution is multiplied by
  `(1 / recipe.servings)`. The engine emits per-member slots only (every
  `SlotSpec.targetMemberId` is set, slots.ts §"MVP simplification"), so
  each slot represents exactly one eater. Summing across slots naturally
  produces the household total.
- **Per-member buckets populated**: previously the engine returned
  `perMember: {}` (empty) as an MVP simplification. Now every per-member
  slot contributes to both `shared` and `perMember[memberId]`. Per-member
  buckets receive only that member's own allocation; the shared bucket is
  the sum.

Guard: `recipe.servings <= 0` falls back to 1 (raw quantities), so a bad
DB row produces "do no harm" output rather than NaN.

The engine API didn't gain a new field — the originally-planned
`WorkspaceSnapshot.participantCount` isn't necessary because every engine
assignment is per-member with 1 eater; participantCount is implicit in
slot count × per-eater quantity. Less surface, same math.

### 2. Server recompute — `apps/web/lib/api/menu-grocery.ts`

Same formula, but the server has to handle the **custom-mode shared
slot** path (`target_member_id IS NULL`) which the engine never emits.

Two new loads:

- `recipes.servings` for every recipe used in the menu's slots. Cached in
  a `Map<recipeId, servings>` with the same `<= 0 → 1` guard as the engine.
- `COUNT(menu_participants)` for the menu, via a `head: true` count query
  so we don't pull rows we don't need. Falls back to 1 when the count is
  null or zero, again to keep math sane on legacy data.

Per-slot scaling explicit by bucket:

```
eatersForShared = target_member_id ? 1 : participantCount
shared   += qty * eatersForShared / servings
perMember += qty * 1 / servings     (only when target_member_id is set)
```

For an engine-produced menu where every slot is per-member, this reduces
to "divide each contribution by servings" and sums to the household total
— same as the engine. For a custom menu with a NULL-target slot, the
slot's whole-recipe contribution (per-eater × participantCount) lands in
the shared bucket and the per-member buckets stay empty for that slot.

### 3. Tests

`packages/constraint-engine/src/__tests__/grocery.test.ts` (new) — 6
tests on the engine's aggregator:

- Single per-member slot: `ri.quantity / servings`.
- Multiple per-member slots sum into the shared bucket.
- Per-member buckets carry each member's own allocation; shared equals
  the sum.
- `servings = 0` fallback to factor 1.
- Empty assignments → empty shared, empty perMember.
- JSON round-trip preserves the result (engine boundary contract from
  ARCHITECTURE_PRD §4.2).

`packages/constraint-engine/src/__tests__/generate.test.ts` — updated the
existing "aggregates grocery items across all assigned recipes" test.
The expected total dropped from 10.5 to 5.25 because the default fixture
recipe has `servings = 2` and contributions are now halved. Test
description, expected value, and an inline explanation comment all
refreshed.

The server recompute path is exercised by the e2e integration suite
(`apps/web/integration/end-to-end.integration.test.ts`) and remains gated
on `SUPABASE_TEST_URL`. No new unit tests for `recomputeGroceryListsForMenu`
in this step — its branches are all SQL queries with deterministic shapes
and the math is already covered by the engine tests (same formula) plus
the e2e flow.

### 4. PRD updates

- **PRODUCT_PRD.md** §7 (top of "Grocery List Generation") — new
  "Servings-aware scaling" subsection explaining the cook-once model,
  the per-bucket eaters, and how the picker (§7.1) composes on top.
- **ARCHITECTURE_PRD.md** §7 — formula stated explicitly with the engine
  vs. server-recompute split, and a cross-link back to PRODUCT_PRD §7.

## Verification

```
pnpm -r typecheck                  → 4/4 packages green
pnpm -r test                       → 138 passed, 8 skipped (was 132; added 6
                                     engine scaling tests, updated 1 existing)
pnpm -F web lint                   → 0 errors, 2 pre-existing warnings
```

## Files

New:
- `packages/constraint-engine/src/__tests__/grocery.test.ts`
- `prompts/36-servings-aware-grocery-scaling.txt`
- `agent-log/36-servings-aware-grocery-scaling.md` (this file)

Edited:
- `packages/constraint-engine/src/grocery.ts`
- `packages/constraint-engine/src/__tests__/generate.test.ts`
- `apps/web/lib/api/menu-grocery.ts`
- `docs/PRD/PRODUCT_PRD.md`
- `docs/PRD/ARCHITECTURE_PRD.md`

## How Phase 4 + Phase 5 compose

Phase 5's `applyShopForFilter` math (Phase 5, agent-log/35) is:

```
shared_filtered = shared_persisted × selectedCount / participantCount
```

With Phase 4 in place, `shared_persisted` is now the absolute household
total (not raw recipe quantities), so:

```
shared_filtered = (Σ over slots: qty × eaters_total / servings)
                  × selectedCount / participantCount
                = Σ over slots: qty × selectedCount / servings  (when every slot is per-member)
```

i.e. "halve the household amount when shopping for half the family" gives
the right absolute quantity, not a proportional view of raw recipe
numbers. The Phase 5 banner still calls out that exports honour the full
unfiltered list — that's unchanged.

## Not touched on purpose

- **WorkspaceSnapshot.participantCount** — not added. The earlier plan
  called for it on the engine boundary, but the engine's "every slot is
  per-member" simplification means it's implicit. Less API surface, same
  math. The server recompute loads the count directly from
  `menu_participants` because it has to handle custom-mode NULL-target
  slots.
- **Re-export with filter** (Phase 5 follow-up) still unfiltered. Plumbing
  `shop_for_member_ids` through the markdown / CSV export route remains
  the documented next step. Phase 4 doesn't change the export shape
  either; both end up writing whatever the persisted `grocery_items`
  contains.
- **Determinism golden snapshots** — none exist as a top-level fixture
  file yet, so there was nothing to regenerate. The existing
  `generate.test.ts` is the closest thing; updating its expected total
  was the only required adjustment.

## Follow-ups still open after MVP 1.5

- Filtered exports (markdown / CSV honour `shop_for_member_ids`).
- Default `meal_frequency` per `age_category` migration (carried from
  Phase 1).
- Carried from earlier steps: history row drill-down, draft↔accept
  grocery unification (now smaller since both ends scale identically),
  dedupe `isMenuStillUpcoming`, integration test pass for add-slot and
  shop-for-subset.
