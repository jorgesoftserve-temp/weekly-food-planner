# Step 31 — Follow-ups: grocery recompute, clone picker, lint, inline recipe creation

## Prompt used

See [/prompts/31-followups-grocery-clone-lint-inline.txt](../prompts/31-followups-grocery-clone-lint-inline.txt).

Summary: closes the four follow-ups from [step 30](./30-menu-types-and-duration.md) plus one additional ("inline recipe creation for normal menus too").

1. Auto-fill the freshly-created inline recipe into the triggering slot, but **only** for 1-day menus where the user's intent is unambiguous.
2. Add a date picker to the history page's "Clone as draft" flow instead of defaulting to next Monday.
3. Recompute the grocery list on menu acceptance, and pivot the grocery page from "latest accepted menu" to "soonest upcoming accepted menu" with a selector when more than one upcoming menu exists.
4. Replace the broken `next lint` (Next 15 interactive prompt) with a proper ESLint flat config + the direct `eslint .` CLI.
5. Add the recipe preview + inline create flow to the **auto** mode of the generation dialog so users who haven't built their recipe pool yet can do so without leaving the modal.

## Context files provided

- Open follow-ups list at the end of [step 30](./30-menu-types-and-duration.md).
- The CustomMenuBuilder + GenerateMenuDialog + history page from step 30 — extended in place.
- [apps/web/app/(app)/recipes/_components/recipe-form.tsx](../apps/web/app/(app)/recipes/_components/recipe-form.tsx) — already accepts an `onClose` callback; this step extends the create-mode signature so the host can read the created recipe id.
- [packages/supabase/src/module/grocery.ts](../packages/supabase/src/module/grocery.ts) + [menus.ts](../packages/supabase/src/module/menus.ts) — both reworked to prefer "soonest upcoming" over "latest by week_start_date".
- [apps/web/lib/api/menu-accept.ts](../apps/web/lib/api/menu-accept.ts) — gets a new post-acceptance step.
- [apps/web/components/forms/ingredient-picker.tsx](../apps/web/components/forms/ingredient-picker.tsx) + [apps/web/postcss.config.mjs](../apps/web/postcss.config.mjs) — two pre-existing ESLint warnings; left in place since they're not part of this batch.

## Expected output

### 1. Auto-fill on 1-day menus

- [recipe-form.tsx](../apps/web/app/(app)/recipes/_components/recipe-form.tsx) — `RecipeFormProps['create']` widens the `onClose` signature to `(createdRecipeId?: string) => void`. After a successful create, `dismiss(created.id)` threads the id back to the host. The Cancel-button wiring becomes `onClick={() => dismiss()}` since `dismiss` now takes an optional arg.
- [custom-menu-builder.tsx](../apps/web/app/(app)/menu/_components/custom-menu-builder.tsx) — tracks the slot that triggered "New recipe" via `createTriggerSlotId`. `handleRecipeCreated`:
  - For `durationDays === 1`: if a trigger slot is known, set its `recipeId` to the new recipe; otherwise drop into the first empty slot.
  - For longer menus: no auto-fill — the user manually picks where the new recipe goes. The dialog footer copy mentions this explicitly.
- Each per-slot row gets a small `+` button next to the recipe Select that opens the create sheet pre-bound to that slot. The page-level "New recipe" header button still works for "I don't have a slot in mind yet" cases.

### 2. Clone target-week picker

- New [clone-target-dialog.tsx](../apps/web/app/(app)/menu/history/_components/clone-target-dialog.tsx) — small modal with a date input, source-menu summary, confirm/cancel.
- [history/page.tsx](../apps/web/app/(app)/menu/history/page.tsx) — the Clone button now opens the dialog instead of immediately calling clone with `nextMonday(today())`. The local `formatYmd` / `nextMonday` helpers move into the dialog where they belong.

### 3a. Grocery recompute on accept

- New [menu-grocery.ts](../apps/web/lib/api/menu-grocery.ts) — `recomputeGroceryListForMenu`:
  - Loads `menu_slots.recipe_id` for the menu (so duplicate recipes count twice).
  - Loads `recipe_ingredients` for those recipes.
  - Aggregates by `(ingredient_id, unit)` summing `quantity * occurrence_count`.
  - Locates the menu's shared `grocery_lists` row (creates one if missing — defensive for older rows), deletes its existing items, inserts the new aggregate.
  - Leaves `scheduled_purchase_day` NULL — freshness scheduling needs the engine's loader and isn't reproducible from DB rows alone. Documented inline and flagged as a follow-up.
- [menu-accept.ts](../apps/web/lib/api/menu-accept.ts) — calls `recomputeGroceryListForMenu` after `accepted_at` is set. A failure here returns 500 to the caller rather than rolling acceptance back — the menu is the source of truth, a stale grocery list is recoverable.

### 3b. Upcoming-menus grocery filter + selector

- [packages/supabase/src/module/menus.ts](../packages/supabase/src/module/menus.ts):
  - Local `todayYmd()` + `isMenuStillUpcoming()` helpers (year/month/day arithmetic via local Date, matching the engine's timezone-naive convention).
  - `getActiveMenu` (no `weekStartDate`) now pulls a batch of recent accepted menus, finds the **earliest upcoming** (last day >= today), and falls back to the most recent accepted past menu if no future menu exists.
  - New `listUpcomingAcceptedMenus` returns the full array of upcoming accepted menus in chronological order.
- [grocery.ts](../packages/supabase/src/module/grocery.ts) — `getActiveGroceryLists` mirrors the same logic: when no explicit `weekStartDate`, query menus with `(id, week_start_date, duration_days)`, decide upcoming-vs-past client-side. When `weekStartDate` is supplied (selector path), honour it exactly via `.maybeSingle()`.
- [menus.react.ts](../packages/supabase/src/module/menus.react.ts) — new `useUpcomingMenus` hook.
- [grocery/page.tsx](../apps/web/app/(app)/grocery/page.tsx) — adds a `<Select>` in the page header when `>1` upcoming menus exist; default value is whatever `getActiveGroceryLists` returned, and choosing another week re-runs the grocery query with `weekStartDate=<chosen>`.
- [use-menu-draft.ts](../apps/web/lib/hooks/use-menu-draft.ts) — `useAcceptMenuDraft` now also invalidates `menuKeys.upcoming` so the selector refreshes immediately after acceptance.

### 4. Lint fix

- Installed `eslint@^9 eslint-config-next@^15 @eslint/eslintrc` in `apps/web` as dev deps.
- New [apps/web/eslint.config.mjs](../apps/web/eslint.config.mjs) — flat-config wrapper using `FlatCompat` to bridge `next/core-web-vitals` (still legacy-style) into the new flat format. `.next/`, `node_modules/`, and `.turbo/` ignored.
- [apps/web/package.json](../apps/web/package.json) — `"lint": "eslint ."` (no more interactive prompt).
- Result: 0 errors, 2 pre-existing warnings (in [ingredient-picker.tsx](../apps/web/components/forms/ingredient-picker.tsx) and [postcss.config.mjs](../apps/web/postcss.config.mjs)) — neither introduced in this batch. The two new warnings I'd introduced (`recipes` non-memoized) were fixed in [recipe-preview-panel.tsx](../apps/web/app/(app)/menu/_components/recipe-preview-panel.tsx) and [custom-menu-builder.tsx](../apps/web/app/(app)/menu/_components/custom-menu-builder.tsx).

### 5. Inline recipe creation in auto mode

- New [recipe-preview-panel.tsx](../apps/web/app/(app)/menu/_components/recipe-preview-panel.tsx) — collapsible `<details>` panel with:
  - Header summary: "Recipes in this workspace (N)" + a "New recipe" button on the right.
  - Body: empty state when N=0, otherwise pills grouped by meal type (`breakfast / lunch / dinner / snack`) so the user can verify pool coverage before generating.
  - The "New recipe" button opens a Sheet hosting the existing `RecipeForm` in create mode; on creation `useCreateRecipe` invalidates the recipe list cache, so the panel re-renders with the new entry.
- [generate-menu-dialog.tsx](../apps/web/app/(app)/menu/_components/generate-menu-dialog.tsx) — `<RecipePreviewPanel>` mounted in auto mode between the dietary presets and the action buttons. Not shown in custom mode (the CustomMenuBuilder already exposes the same flow per slot).

### Verification

- `pnpm turbo run typecheck` — 5/5 green.
- `pnpm turbo run test` — constraint-engine 40 ✓, supabase 24 ✓ (5 integration skipped), web 33 ✓ (3 e2e integration skipped). One test (`grocery.test.ts > joins menu → grocery_lists`) needed updating to match the new query shape (array + `duration_days` field).
- `pnpm --filter @weekly-food-planner/web lint` — 0 errors, 2 pre-existing warnings (carry-overs, not from this batch).

## Observed issue

- **`RecipeForm.onClose` widening broke an unrelated `onClick={dismiss}` wiring.** Fixed by changing to `onClick={() => dismiss()}` on the Cancel button. TypeScript caught this immediately; minor footprint widening — Cancel never carries a recipe id anyway.
- **Auto-fill restricted to 1-day menus** matches the user's request literally. For multi-day menus the relationship "I clicked +Plus on this slot's row, so the new recipe goes here" is technically still unambiguous, but the user asked for the conservative version and I'm not going to over-fit the spec.
- **Custom-menu builder's per-slot `+` button** was the right ergonomic add. Without it, only a global "New recipe" button existed and the user had no way to express "make a new recipe to go in this slot."
- **`recomputeGroceryListForMenu` ignores per-member grocery lists.** Same scope cut as the original engine path — only the shared list is maintained. A future iteration that splits per-member shopping back out would need to recompute all `grocery_lists` rows for the menu, not just `target_member_id IS NULL`.
- **Quantity multiplication on repeated recipes** is now correct via the per-recipe occurrence map. The original engine path already had this via `aggregateGroceryLists`, but the recompute-on-accept path is brand new and had to redo it server-side.
- **Freshness scheduling (`scheduled_purchase_day`) is lost on recompute.** The engine computes it from member meal frequencies + ingredient freshness flags during generation. Reproducing that on accept requires re-loading the engine snapshot just to get the same logic. Out of scope for this pass; the recomputed shared list shows `—` in the "Day" column for now.
- **"Upcoming" filter uses local-time date math** to stay consistent with the engine's existing timezone-naive convention. Workspaces spanning timezones (currently out of MVP scope) would see "today" computed from server time, not the user's tz.
- **`isMenuStillUpcoming` is duplicated** in `menus.ts` and `grocery.ts`. Importing across modules would create a cycle (`menus → grocery` and vice versa for React Query keys). Worth pulling into a small `apps/web/lib/dates.ts` or `packages/supabase/src/date-utils.ts` in a future refactor.
- **`getActiveMenu` now fetches up to 20 candidates** to find the soonest upcoming. A workspace that accepts hundreds of menus over years would not be served correctly without pagination, but 20 covers >4 months of weekly + smaller menus — fine for MVP.
- **Grocery selector renders only when `>1` upcoming menu** exists. If exactly one upcoming menu exists the selector is hidden because there's nothing to switch between. Matches the user's intent ("see grocery lists for the accepted incoming menus") without cluttering single-menu workspaces.
- **`next lint` is gone** and the replacement uses Next's flat-config bridge (`FlatCompat`). When `eslint-config-next` ships a native flat config we can drop `@eslint/eslintrc` — flagged inline in [eslint.config.mjs](../apps/web/eslint.config.mjs).
- **Acceptance no longer fails silently if the grocery recompute fails.** It returns a 500 to the route handler; the menu *was* accepted (DB state intact), but the user sees an error toast and the grocery page may be stale until they regenerate or manually retry. Better than letting the menu be silently un-shoppable.

## Follow-up fixes

- **Per-member grocery list recompute on accept** — extend `recomputeGroceryListForMenu` to write `grocery_lists` rows per `target_member_id` distinct in the menu_slots, not just the shared list.
- **Freshness scheduling on recompute** — port the engine's `aggregateGroceryLists` freshness logic to the server-side recompute path, or load the engine snapshot lazily during accept and re-run aggregation.
- **History detail drill-down** — clicking a history row still does nothing. Adding read-only `MenuView` rendering of the historical state pairs naturally with the new clone flow.
- **Dedupe `isMenuStillUpcoming`** into a shared util once a third caller appears.
- **`eslint-config-next` native flat config** — when it ships, drop `@eslint/eslintrc` + `FlatCompat`. Trivial change to [eslint.config.mjs](../apps/web/eslint.config.mjs).
- **Two pre-existing lint warnings** (`ingredient-picker.tsx` and `postcss.config.mjs`) — left in place. Worth a cleanup PR in isolation.
- **Auto-fill in multi-day menus** — could still respect the triggering slot; the conservative scope here was deliberate per the user's wording, but the wiring (`createTriggerSlotId`) already exists if we want to widen later.
