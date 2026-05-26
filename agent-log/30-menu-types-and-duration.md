# Step 30 — Menu types, variable duration, clone-from-history

## Prompt used

See [/prompts/30-menu-types-and-duration.txt](../prompts/30-menu-types-and-duration.txt).

Summary: closes out the menu-area roadmap with three previously unsupported flows: **generate a deterministic menu shorter than 7 days starting any calendar day**, **build a non-deterministic custom menu with arbitrary slot structure including multiple-of-same-meal-type**, and **clone an accepted menu from history as a new draft**. Pre-set dietary/allergy presets are now first-class on the generate dialog. PRD docs (`DATABASE`, `PRODUCT`, `ARCHITECTURE`) are updated in the same step to stop drift — they had been carrying step-29 follow-up debt.

## Context files provided

- The [step 29 plan](./29-mobile-and-menu-review.md) (draft/accept lifecycle) — that work's `accepted_at + accepted_seed + is_overridden` columns are unchanged here.
- All five PRDs — both as the contract the existing code follows and as the doc surface that needs to catch up.
- The engine boundary surface: [packages/constraint-engine/src/types.ts](../packages/constraint-engine/src/types.ts), [packages/constraint-engine/src/slots.ts](../packages/constraint-engine/src/slots.ts), [packages/constraint-engine/src/canonical.ts](../packages/constraint-engine/src/canonical.ts). `canonicalJson` already sorts arbitrary input recursively, so adding `durationDays` to `GenerateMenuInput` automatically flows into `inputs_hash` without canonicalization changes.
- The post-step-29 menu data layer: [packages/supabase/src/module/menus.ts](../packages/supabase/src/module/menus.ts), [apps/web/lib/api/menu-persistence.ts](../apps/web/lib/api/menu-persistence.ts), [apps/web/app/api/workspaces/[id]/menus/route.ts](../apps/web/app/api/workspaces/[id]/menus/route.ts) — extended in place rather than rewritten.
- The existing dialog + history pages from step 29 — both refactored substantially in this step.
- [apps/web/app/(app)/recipes/_components/recipe-form.tsx](../apps/web/app/(app)/recipes/_components/recipe-form.tsx) — already supports `mode='create' + onClose` so it can be embedded in the custom builder's Sheet for inline recipe creation without changes.

## Expected output

### Schema

- [20260526000200_enum_create_menu_type.sql](../packages/supabase/supabase/migrations/20260526000200_enum_create_menu_type.sql) — new `menu_type` enum with values `weekly`, `custom`.
- [20260526000201_tbl_menus_add_type_duration_clone.sql](../packages/supabase/supabase/migrations/20260526000201_tbl_menus_add_type_duration_clone.sql):
  - Adds `menus.menu_type` (default `weekly`), `menus.duration_days` (1..7, default 7), `menus.start_day_of_week` (default `monday`), `menus.cloned_from_menu_id` (nullable FK).
  - Drops NOT NULL on `menus.seed` and `menus.inputs_hash` so `custom` menus can carry NULL there.
  - Backfills existing rows to `weekly / 7 / monday`.

### Engine

- [`GenerateMenuInput.durationDays?: number`](../packages/constraint-engine/src/types.ts) — optional, defaults to 7. Part of the canonical input, so it participates in `inputs_hash`.
- [`enumerateMenuDays`](../packages/constraint-engine/src/slots.ts) (new, exported) — derives the start day-of-week from `weekStartDate` and walks N consecutive days, wrapping past Sunday. `buildSlots` uses it; the previous fixed Monday→Sunday list is gone.
- Slot ordering switched from `DAY_ORDER` (Monday-relative) to `dayIndex` (calendar order) so a menu starting Friday produces fri/sat/sun, not mon→sun with friday at index 4.
- `slotStart` now takes `dayIndex` directly rather than computing it from `DAY_ORDER`, fixing the past-filter for non-Monday starts.
- 4 new tests in [slots.test.ts](../packages/constraint-engine/src/__tests__/slots.test.ts): durationDays honoured, non-Monday start computed, week-end wrap (fri→sat→sun→mon), clamp to [1,7].

### Data layer

- [`MenuRecord`](../packages/supabase/src/module/menus.ts) grows `menu_type`, `duration_days`, `start_day_of_week`, `cloned_from_menu_id`; `seed` + `inputs_hash` become `T | null`.
- `MenuHistoryEntry` mirrors the new fields plus `menu_type` and `duration_days` for the history UI.
- New module [apps/web/lib/api/menu-build.ts](../apps/web/lib/api/menu-build.ts):
  - `persistCustomMenu` — validates each slot's recipe + meal_type, replaces outstanding draft, inserts `menus` row with `menu_type='custom'` and NULL seed/hash, inserts user-supplied slots, creates an empty grocery list.
  - `cloneMenuAsDraft` — copies a historical accepted menu's slots into a new draft, inheriting source's seed/hash/options/menu_type/duration_days; records `cloned_from_menu_id`.

### API

[POST /menus](../apps/web/app/api/workspaces/[id]/menus/route.ts) now dispatches on `body.mode`:

- `weekly` (default) — existing engine pipeline plus `durationDays` (clamped to 1..7) threaded into `GenerateMenuInput`.
- `custom` — calls `persistCustomMenu`; rejects empty slot arrays at 400.
- `clone` — calls `cloneMenuAsDraft`; rejects non-accepted source menus at 422 `source_not_accepted`.

`menu-persistence` updated to set the new columns (`menu_type='weekly'`, `duration_days`, `start_day_of_week`) and to soft-delete only the prior **draft** for the week, not the accepted menu (the step-29 invariant). `grocery.ts.getActiveGroceryLists` already filtered `accepted_at IS NOT NULL` from step 29.

### UI

- [GenerateMenuDialog](../apps/web/app/(app)/menu/_components/generate-menu-dialog.tsx) rewritten:
  - Mode tabs: **Auto** / **Custom**.
  - Start date + duration (1..7) controls.
  - Collapsible "Dietary & allergy presets" section using `MultiLabelCombobox` for both `dietary_restriction` and `food_allergy` enums.
  - In Custom mode, embeds the new [CustomMenuBuilder](../apps/web/app/(app)/menu/_components/custom-menu-builder.tsx).
- [CustomMenuBuilder](../apps/web/app/(app)/menu/_components/custom-menu-builder.tsx) (new):
  - Linear slot list: Day select (constrained to the menu's days), Meal type select, Recipe select (filtered to the slot's meal type).
  - "Add meal" appends a new row; "New recipe" opens a Sheet with the existing `RecipeForm` in create mode (reuse, no duplication). Created recipes invalidate the recipe list cache via the form's existing mutation and are immediately selectable in the picker.
  - `mealKey` auto-assigned per `(day, meal_type, occurrence)` so two breakfasts on Monday persist as `breakfast` + `breakfast_2` and satisfy the menu_slots unique constraint.
- [useCustomMenu](../apps/web/lib/hooks/use-custom-menu.ts) (new) — posts `mode='custom'` with the slot array; invalidates draft cache.
- [useCloneMenu](../apps/web/lib/hooks/use-clone-menu.ts) (new) — posts `mode='clone'` with `cloneFromMenuId` and a target week; invalidates draft cache.
- [Menu history page](../apps/web/app/(app)/menu/history/page.tsx) extended:
  - Each row gets a "Clone as draft" button targeting the next Monday after today.
  - Shows menu_type + duration_days on each row.
  - Tolerates NULL `seed` and `inputs_hash` so custom menus render cleanly.
- [MenuView](../apps/web/app/(app)/menu/_components/menu-view.tsx) updated to show menu_type + duration_days in the header band and to tolerate NULL seed/hash.

### Docs

- **DATABASE_PRD** — §5.1 adds `menu_type` to the system-enums table; §6.11 fully rewrites the `menus` table doc (new columns, partial unique indexes split into accepted + draft, new §6.11.2 explaining menu types); §6.12 documents `is_overridden` + `original_recipe_id`; §6.17 replaces "Menu regeneration" with the draft/accept lifecycle and adds clone-from-history.
- **PRODUCT_PRD** — §4 reframed around two paths (weekly + custom) and the draft/accept lifecycle; new §4.1.1 (duration + start day) and §4.1.2 (custom menus); generator inputs section updated.
- **ARCHITECTURE_PRD** — §5 expanded into §5.1 weekly, §5.2 custom, §5.3 clone, §5.4 accept + slot replace; §6 determinism note updated to acknowledge `accepted_seed` and the non-deterministic `custom` mode; §9 API surface updated with the new endpoints.
- **README** — API table entry for `POST /menus` rewritten to describe the three modes.

### Tests

- `pnpm turbo run typecheck` — 5/5 green.
- `pnpm turbo run test` — constraint-engine 40 ✓ (added 4 new slot tests), supabase 24 ✓ (5 integration skipped without env), web 33 ✓ (3 e2e integration skipped without env). No new failures.

## Observed issue

- **`MultiLabelCombobox` prop is `value` not `values`.** Initial dialog rewrite used `values=` and tripped IDE diagnostics + type errors. Fixed both occurrences. The component shape was easy to spot — I'd just read it minutes earlier — but I had a brain skip naming it `values` because the data type is `string[]`. Worth pinning the pattern: shadcn-style components consistently use singular `value` even for multi-select arrays.
- **`seed` and `inputs_hash` going nullable** rippled into the export renderer, the history page, the menu view header, and the export loader. Caught all four in a single typecheck round-trip. The export markdown / CSV now show `—` when those fields are NULL (custom menus). Determinism downstream is unaffected: the existing e2e integration test still asserts byte-identical output for the same seed because it only exercises the `weekly` path.
- **Slot enumeration's day-order change** is a small but real semantic shift. Previously `slots[0]` was always Monday's first slot for full-week menus. Now `slots[0]` is the first day's first slot, which equals Monday for Monday-start menus but is Friday for Friday-start menus. The existing slots test (`'returns slots in deterministic day-first then mealKey-alphabetical order'`) still passes because the base input has weekStartDate=2026-06-01 (a Monday), and the new tests cover the non-Monday cases. Worth noting because anyone reading the engine output downstream needs to know the order is now calendar-order, not enum-order.
- **Custom menus' `menu_slots` use `UNIQUE NULLS NOT DISTINCT (menu_id, day_of_week, meal_key, target_member_id)`.** Already in the schema from step 29 (or before). For "2 breakfasts on Monday" the builder now generates `meal_key = breakfast` and `meal_key = breakfast_2`, keeping the constraint happy. The auto-derivation lives in [custom-menu-builder.tsx](../apps/web/app/(app)/menu/_components/custom-menu-builder.tsx)'s `reassignMealKeys` — re-runs on every state change so insert/delete/edit always produces a consistent set.
- **Custom menus skip server-side allergy/dietary validation.** The user is opting into a manual plan and may want to override every constraint (e.g. a one-off "treat" meal). The dietary/allergy presets are still recorded on `generation_options` for audit, but they're not enforced during slot validation in custom mode. The PRD now documents this explicitly. A follow-up could add an opt-in "validate against constraints" toggle for custom mode.
- **Clone mode targets a fixed "next Monday"** as the destination week from the history page. There's no date picker on the clone button. The user can still regenerate the cloned draft via the dialog to change the start date; for the MVP that's enough. A target-week picker in the clone button's flow is a small follow-up.
- **`SlotSpec.targetMemberId` is non-null** but custom slots are always shared (`target_member_id = null` in the DB). The persistence path doesn't construct `SlotSpec` for custom menus because the engine isn't involved, so no real conflict — but if a future iteration teaches the engine to accept custom slots as anchors, the type will need widening. Same hazard noted in step 29 follow-ups.
- **`generation_options` snapshots dietary/allergy presets even for custom menus.** Helpful for audit. The history view doesn't currently surface this — a future polish could.
- **Inline "New recipe" Sheet doesn't auto-select the new recipe** for the slot the user was on when they clicked. Slightly clunky — user has to manually pick the newly-created recipe in the slot dropdown after the sheet closes. Auto-select would require threading the slot id into the create flow + a callback on creation; deferred.
- **No "Edit recipe" while building a custom menu.** If the user spots a typo in an existing recipe, they have to leave the dialog. Consistent with the existing recipes-page edit drawer pattern; flagged as a follow-up if it comes up.

## Follow-up fixes

- **Auto-select newly-created recipe** in the slot the user was editing when they opened the new-recipe Sheet. Small UX win; requires a callback signature change on `RecipeForm` (`onClose(createdRecipeId?: string)`).
- **Clone-target week picker** — let the user pick the destination week when cloning, instead of defaulting to next Monday.
- **Grocery list recomputation on slot override + on acceptance** — still open from step 29. Now also applies to custom menus: their grocery_lists row is inserted empty at creation, so the grocery page is empty until grocery aggregation is wired into the accept path.
- **Custom menu "validate against constraints" toggle** — opt-in flag that runs the same hard-constraint filter the weekly path uses, for users who want manual control + safety nets.
- **History detail drill-down** — clicking a history entry opens the snapshot in read-only `MenuView`. Already noted in step 29; even more useful now that history rows can come from custom menus too.
- **Sort/filter the history page** — by week, by menu_type, by pristine vs. modified. Single-component change once history grows enough to need it.
- **Undo override on a slot** — replace dropdown gains a "Revert to engine pick" item when `is_overridden = true`. Trivial DB update; deferred from step 29.
- **`next lint` still broken** — same Next 15 interactive-prompt issue carried from steps 27, 28, 29. Blocks lint coverage in CI; would be solved by switching to direct `eslint .` invocation in `apps/web/package.json`.
