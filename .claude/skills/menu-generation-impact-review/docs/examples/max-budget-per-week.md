# Worked example — "Add a max-budget-per-week soft constraint"

Hypothetical feature: the user can supply a `maxBudget` (dollars or local currency, no FX) at menu generation time. The engine should bias selection away from recipe combinations that would exceed it, but never hard-fail a menu over budget. Budget is per menu, not per member.

This example shows what a good impact review looks like. Use it as the output template.

---

## Feature: add a per-menu max-budget soft constraint that biases recipe selection away from exceeding a user-supplied cost ceiling

### Summary

Adds `options.maxBudget?: number` to the engine input and a corresponding form field on the generate dialog. The engine's soft-constraint composite gains a budget-overrun penalty proportional to the projected grocery cost minus the ceiling. No hard-fail path — over-budget menus are still produced if no cheaper combination exists, with a UI warning. Cost data comes from a new `ingredients.cost_per_unit` column (no UI editing in this iteration; service-role seed only).

### Layers touched

- **[1] Engine contract** — add `options.maxBudget?: number` to [GenerateMenuInput](../../../../packages/constraint-engine/src/types.ts). Optional, plain number. JSON-round-trips trivially. Must enter the canonical form in [canonical.ts](../../../../packages/constraint-engine/src/canonical.ts) so it contributes to `inputs_hash` — otherwise two runs with the same recipes/members but different budgets would share a hash, breaking the determinism contract.
- **[2] Engine internals** — extend the soft-constraint composite in [assign.ts](../../../../packages/constraint-engine/src/assign.ts) with a `budgetOverrunPenalty(menu)` term. No new RNG draws — the penalty is deterministic given the menu state. Tie-break order unchanged. Add `result.budgetProjection: { total: number; overBy: number | null }` to `GenerateMenuResult` so the UI can render the warning without recomputing.
- **[3] Route handler dedup / participant filter** — no member-profile equivalent of "budget", so no silent dedup. No participant interaction. Add to the request Zod schema as `maxBudget: z.number().positive().optional()` and pass through to the engine. Pre-engine validation: reject negative or NaN before the engine sees it (422 `invalid_body`).
- **[4] Persistence** —
  - `menus.generation_options` JSONB gains `maxBudget` and `budgetProjection`. No migration; documented in [DATABASE_PRD §6.11.1](../../../../docs/PRD/DATABASE_PRD.md).
  - New column **on `ingredients`**: `cost_per_unit numeric NULL` plus a `cost_currency text NULL`. Migration: `tbl_alter_ingredients_add_cost_with_seed.sql`. Backfill with placeholder values (median of similar items by `unit`); null for ingredients the seed doesn't cover.
  - No new junction table, no RLS changes (ingredient catalog is already service-role-write, authenticated-read).
- **[5] Three modes** —
  - **Weekly**: engine sees `maxBudget`, applies the penalty.
  - **Custom**: engine isn't invoked, so `maxBudget` has no effect. **Decision**: hide the budget field on the custom-mode form; if the user submits one anyway, server-side schema accepts it and discards it (don't 422 — they may flip modes mid-form). Persist `null` so the menu view doesn't display "budget: $X" for a menu where it had no effect.
  - **Clone**: copies the source's `maxBudget` into the new draft's `generation_options`. The engine re-evaluates the penalty against the cloned slots (which may have come from a custom source — same handling as above). No special-case needed.
- **[6] Lifecycle** —
  - Draft creation: `maxBudget` flows into the new draft via `generation_options`.
  - Slot replacement / add-slot: re-runs the engine's hard-constraint filter, not the soft-constraint scorer. Budget projection in the menu view becomes stale after an override — recompute on read in [`apps/web/lib/api/menu-grocery.ts`](../../../../apps/web/lib/api/menu-grocery.ts) and surface in the response, but do NOT persist a derived value (the persisted snapshot reflects the engine's pristine output).
  - Accept: no change to `accepted_seed` computation; `maxBudget` is already inside `inputs_hash` via canonical form. Acceptance soft-deletes the previously-accepted menu; the previous menu's budget projection is now historical and stays in its `generation_options`.
  - Discard / clone: standard handling.
- **[7] Grocery recompute** — no change to `eaters / recipe.servings`. [`recomputeGroceryListsForMenu`](../../../../apps/web/lib/api/menu-grocery.ts) signature unchanged. But the function now also computes a `costProjection` derived from the recomputed lists × the new `ingredients.cost_per_unit`. Surfaces via the GET handlers, not persisted. Shop-for-subset filter rescales `costProjection` along with the shared bucket (`selectedCount / participantCount`). Markdown + CSV exports gain a "Projected cost: $X" line at the bottom of the grocery section.
- **[8] Failure modes** — no new structured error. Over-budget menus are produced; the UI warns. **Decision deferred**: a future enhancement could add `calorie_target_unreachable`-style hard-fail when the user wants a strict budget — not in this iteration.
- **[9] Regression suite** — every existing golden snapshot needs to regenerate because the input shape now includes `maxBudget: undefined`, which enters canonical form as an absent key. **Decision**: confirm `undefined` keys are dropped by `canonical.ts` (read [canonical.ts](../../../../packages/constraint-engine/src/canonical.ts) first; if it preserves them, the hash changes). If dropped, no drift; if preserved, regenerate in a separate commit. Add three new fixtures: (a) budget large enough to never trigger, (b) budget tight enough to shift selection, (c) budget unreachable — verify the engine still produces a menu and `budgetProjection.overBy > 0`.
- **[10] Integration tests** —
  - New `apps/web/integration/menus/budget-overlay.integration.test.ts` covering: happy path, missing cost data (null `cost_per_unit`) skipped gracefully, over-budget menu produces correctly, clone preserves `maxBudget`, shop-for filter rescales projection.
  - Update `apps/web/integration/end-to-end.integration.test.ts` to assert the new export line.
  - No RLS test needed (ingredient catalog already has the right policies).
- **[11] UI surface** —
  - Generate form (weekly mode): new "Max weekly budget" numeric input under the existing options. Hidden in custom mode.
  - Menu header: new "Budget: $X (projected $Y)" line when `generation_options.maxBudget` is set, with a warning chip if `overBy > 0`.
  - Draft review: same indicator; recomputes after each slot replacement.
  - Grocery view: footer line "Projected cost: $X" (rescaled by shop-for filter).
  - Export (markdown + CSV): footer line in both.
  - Shop-for picker: no new interaction beyond rescaling.
- **[12] PRD updates** —
  - [PRODUCT_PRD.md](../../../../docs/PRD/PRODUCT_PRD.md) §4 (menu generation inputs) — add `maxBudget` to the optional inputs list.
  - [PRODUCT_PRD.md](../../../../docs/PRD/PRODUCT_PRD.md) §4.2 — confirm overlay does NOT include budget (it's per-menu, not per-overlay; same level as `calorieTolerance`).
  - [PRODUCT_PRD.md](../../../../docs/PRD/PRODUCT_PRD.md) §7 — note projected-cost footer on grocery view.
  - [ARCHITECTURE_PRD.md](../../../../docs/PRD/ARCHITECTURE_PRD.md) §4.2 — extend the `GenerateMenuInput` type sketch.
  - [ARCHITECTURE_PRD.md](../../../../docs/PRD/ARCHITECTURE_PRD.md) §6 — confirm `maxBudget` enters canonical form and `inputs_hash`.
  - [DATABASE_PRD.md](../../../../docs/PRD/DATABASE_PRD.md) §6.6 — add `cost_per_unit` and `cost_currency` to the `ingredients` table sketch.
  - [DATABASE_PRD.md](../../../../docs/PRD/DATABASE_PRD.md) §6.11.1 — add `maxBudget` and `budgetProjection` to the `generation_options` example JSON.

### Gaps + risks

1. **No ingredient cost in the DB.** Without cost data, the budget penalty is meaningless. The migration must ship with a seed step that backfills `cost_per_unit` for every ingredient in the existing catalog — ideally with median values from a public dataset. Without that, the first run after deployment computes a $0 cost projection and the feature looks broken. **Resolution**: include backfill in the migration. Owner: `supabase-migration-author`.
2. **Currency normalization is out of scope.** `cost_currency` exists but is informational; no FX. Document the limitation in the PRD and the migration's comment block. **Resolution**: state explicitly that all costs are in a single currency; FX is post-MVP.
3. **Custom-mode UX ambiguity.** Hiding the budget field in custom mode is correct, but the user may flip from custom back to weekly mid-form and lose their entry. **Resolution**: preserve the value in Zustand draft state across mode flips; the form just hides/shows the field.
4. **Snapshot drift uncertainty.** Whether existing golden snapshots regenerate depends on `canonical.ts` behaviour for `undefined`. **Resolution**: read [canonical.ts](../../../../packages/constraint-engine/src/canonical.ts) before estimating the snapshot regeneration scope. If it preserves `undefined`, the regeneration commit is larger but still mechanical.
5. **Cost recompute on slot replacement.** The route handler that replaces a slot must trigger the GET handlers to recompute the projection; the persisted value reflects the engine's pristine output. **Resolution**: keep the recompute purely on-read; do not persist the post-override projection. The menu view's projection number is always fresh.
6. **Performance.** `cost_per_unit` lookup runs once per ingredient per menu — negligible at MVP scale, but the join belongs in [`recomputeGroceryListsForMenu`](../../../../apps/web/lib/api/menu-grocery.ts), not in a per-slot loop. **Resolution**: prefetch ingredient costs once in `recomputeGroceryListsForMenu` and pass them through.

### Backwards compatibility

- **Existing accepted menus**: `generation_options.maxBudget` is absent → menu view shows no budget line. Grocery view's projected-cost footer can still render if `cost_per_unit` is populated; if seeded backfill is incomplete, the footer reads "Projected cost: not available". Either is acceptable.
- **Existing golden snapshots**: regenerate in a separate commit IFF `canonical.ts` preserves `undefined` (TBD per gap #4). Otherwise no drift.
- **Existing API consumers**: [`scripts/verify-flow.mjs`](../../../../scripts/verify-flow.mjs) does not pass `maxBudget`; behaviour unchanged. The `constraint-menu-generator-life-cycle-test` skill's input spec does not yet support budget; extend the spec in a follow-up only if budget scenarios become valuable to test end-to-end.

### Tests to add or update

- **Engine unit tests** — three new tests in [`packages/constraint-engine/src/__tests__/`](../../../../packages/constraint-engine/src/__tests__/):
  - Budget large enough to be inactive → output identical to no-budget baseline.
  - Budget tight → selection shifts toward cheaper recipes, `budgetProjection.overBy === null`.
  - Budget unreachable → engine succeeds, `budgetProjection.overBy > 0`.
- **JSON round-trip property test** — confirm the new fields survive `JSON.parse(JSON.stringify(x))`.
- **Golden snapshots** — three new fixtures (see above). Existing snapshots regenerate per gap #4.
- **Integration test** — `apps/web/integration/menus/budget-overlay.integration.test.ts` (new). Include role-matrix coverage, missing cost data, clone preservation, shop-for rescaling.
- **E2E driver** — extend [`scripts/verify-flow.mjs`](../../../../scripts/verify-flow.mjs) only if the budget flow needs to be in the canonical verify pass. Otherwise add a focused `scripts/flow-budget.mjs`.

### PRD updates

(Same list as the §12 walk above. Reproduced here for the implementer's eye.)

- [PRODUCT_PRD.md](../../../../docs/PRD/PRODUCT_PRD.md) §4 — add `maxBudget` to optional inputs.
- [PRODUCT_PRD.md](../../../../docs/PRD/PRODUCT_PRD.md) §4.2 — confirm budget is not part of the overlay.
- [PRODUCT_PRD.md](../../../../docs/PRD/PRODUCT_PRD.md) §7 — projected-cost footer.
- [ARCHITECTURE_PRD.md](../../../../docs/PRD/ARCHITECTURE_PRD.md) §4.2 — extend `GenerateMenuInput`.
- [ARCHITECTURE_PRD.md](../../../../docs/PRD/ARCHITECTURE_PRD.md) §6 — `maxBudget` enters `inputs_hash`.
- [DATABASE_PRD.md](../../../../docs/PRD/DATABASE_PRD.md) §6.6 — `cost_per_unit`, `cost_currency` on `ingredients`.
- [DATABASE_PRD.md](../../../../docs/PRD/DATABASE_PRD.md) §6.11.1 — new fields in `generation_options` example.

### Proposed implementation order

1. **`supabase-migration-author`** — `tbl_alter_ingredients_add_cost_with_seed.sql`: add `cost_per_unit numeric NULL` + `cost_currency text NULL`, backfill seeded ingredients with median values. Regenerate types. Output: migration file + `pnpm run gen:types`.
2. **`constraint-engine-engineer`** — extend [`types.ts`](../../../../packages/constraint-engine/src/types.ts), [`canonical.ts`](../../../../packages/constraint-engine/src/canonical.ts), [`assign.ts`](../../../../packages/constraint-engine/src/assign.ts) with budget penalty + `budgetProjection` on the result. Add unit tests for the three behaviours. Output: engine diff + unit test file.
3. **`determinism-snapshot-curator`** — confirm `canonical.ts` drops `undefined`; either certify no drift or regenerate snapshots in a separate commit. Add three new fixtures. Output: snapshot regeneration commit (if needed) + new fixture files.
4. **`route-handler-engineer`** — extend the menu generation route's Zod schema, pass `maxBudget` to the engine, persist into `generation_options`. Update [`recomputeGroceryListsForMenu`](../../../../apps/web/lib/api/menu-grocery.ts) to compute the projection. Update markdown + CSV export renderers. Output: handler diff + Zod schema update.
5. **`ui-component-builder`** — add the budget input to the generate form, the budget-line indicator on the menu header, the projected-cost footer on the grocery view. Output: form + view component diffs.
6. **`vitest-integration-author`** — `apps/web/integration/menus/budget-overlay.integration.test.ts`. Output: integration test file.
7. **PRD updates** as listed. Owner: parent session.

### Out of scope (deferred)

- Currency conversion / FX.
- Hard-budget mode (engine fails with a structured error instead of producing an over-budget menu).
- UI for editing `cost_per_unit` on individual ingredients (only service-role seed in this iteration).
- Per-member budget (only per-menu in this iteration).
- Historical menu projection for accepted menus generated before the migration shipped (`generation_options.maxBudget` is absent there; no backfill).
