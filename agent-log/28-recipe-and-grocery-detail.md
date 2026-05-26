# Step 28 — Recipe list + grocery list detail surfaces

## Prompt used

See [/prompts/28-recipe-and-grocery-detail.txt](../prompts/28-recipe-and-grocery-detail.txt).

Summary: continuation of the [step 26](./26-enhancement-plan-six-items.md) six-item plan. Ships items **#2 (Recipe list improvements)** and **#5 (Grocery list improvements)** — both read-only surface work, no schema, no engine, no API changes. Picks up after [step 27](./27-dashboard-and-auth-completion.md) (Dashboard + Auth) per the recommended execution order.

## Context files provided

- Plan from [step 26](./26-enhancement-plan-six-items.md) defining acceptance for #2 and #5, including the decision to use a read-only detail modal + per-column View buttons (decision Q3) instead of expanding the existing EditRecipeDrawer.
- [apps/web/app/(app)/recipes/page.tsx](../apps/web/app/(app)/recipes/page.tsx) and [edit-recipe-drawer.tsx](../apps/web/app/(app)/recipes/_components/edit-recipe-drawer.tsx) — the existing list + edit surface. The new dialog reuses `useRecipeDetail` rather than refetching.
- [packages/supabase/src/module/recipes.ts](../packages/supabase/src/module/recipes.ts) — `RecipeRecord` already carries `recipe_ingredients`, `recipe_instructions`, `recipe_dietary_tags`, so the list query has every count needed for the View buttons without any new fetch.
- [packages/supabase/src/module/ingredients.ts](../packages/supabase/src/module/ingredients.ts) — `IngredientRecord` carries `is_perishable`, `max_storage_days`, `requires_fresh`, `same_day_cook`, and `ingredient_allergens`; the new ingredient-detail dialog renders all five.
- [apps/web/app/(app)/grocery/page.tsx](../apps/web/app/(app)/grocery/page.tsx) — extended in place; the existing `useActiveGroceryLists` + `useIngredients` + `useWorkspaceWithMembers` triple gets a fourth query for the active menu (already used on the menu page) to power the "used this week" section.
- [apps/web/lib/hooks/export-menu.ts](../apps/web/lib/hooks/export-menu.ts) and [apps/web/app/api/workspaces/[id]/export/route.ts](../apps/web/app/api/workspaces/[id]/export/route.ts) — the export endpoint already bundles menu + grocery list together, so the new grocery-page Export button reuses `downloadMenuExport` unchanged.
- [apps/web/components/ui/dialog.tsx](../apps/web/components/ui/dialog.tsx) — shadcn Dialog primitive; no Tabs primitive available, so the recipe detail dialog ships a manual radio-style tab strip.

## Expected output

### Recipe list (#2) — three new columns + read-only dialog

[apps/web/app/(app)/recipes/_components/recipe-detail-dialog.tsx](../apps/web/app/(app)/recipes/_components/recipe-detail-dialog.tsx) (new):

- Read-only view, three sections — **Dietary** (tag pills), **Ingredients** (qty/unit table with names resolved through `useIngredients`), **Instructions** (ordered list, sorted by `step_order`, with optional duration + notes per step).
- Header band shows meal type, difficulty, servings, calories/serving + description.
- A manual tab strip switches between the three sections; `initialSection` from the caller selects which tab is active on open, and a `useEffect` re-syncs when the dialog reopens with a different target.
- Empty per-section state ("No dietary tags on this recipe", etc.) so the dialog still feels intentional for sparse recipes.
- Skeleton fallback while `useRecipeDetail` loads.

[apps/web/app/(app)/recipes/page.tsx](../apps/web/app/(app)/recipes/page.tsx):

- Added three new columns hidden below the `lg:` breakpoint — `Dietary`, `Ingredients`, `Instructions`. Each cell is a compact `Button variant="ghost" size="sm"` with the section icon (`Salad` / `Utensils` / `ListChecks`) + count label (`3 tags` / `7 items` / `5 steps`), disabled when the count is zero. Clicking opens the detail dialog targeted at that section.
- Mobile path (`<lg:`) routes through the existing row dropdown: added a "View details" entry (defaulting to the Dietary tab) above Edit, plus a `DropdownMenuSeparator` before Delete. The row-name click still opens EditRecipeDrawer as before — no regression.
- Single `detailTarget` state holds `{ recipeId, section }`; closing the dialog clears it.

### Grocery list (#5) — export + ingredient detail dialog

[apps/web/app/(app)/grocery/_components/ingredient-detail-dialog.tsx](../apps/web/app/(app)/grocery/_components/ingredient-detail-dialog.tsx) (new):

- Three sections — **Freshness** (badges per flag, with copy: perishable + storage days, requires-fresh, same-day-cook, pantry-stable fallback), **Allergens** (chips from `ingredient_allergens`), **Used this week** (recipes from the active menu that contain this ingredient).
- "Used this week" is computed from `useRecipesList` filtered by a `Set<recipe_id>` derived from the active menu's `menu_slots`. Same data the grocery page already has — no new server call.
- Empty-state copy per section (e.g. "No allergens tagged on this ingredient.").

[apps/web/app/(app)/grocery/page.tsx](../apps/web/app/(app)/grocery/page.tsx):

- New Export dropdown in the `PageHeader` actions slot (Markdown / CSV), shown only when a grocery list exists. Reuses `downloadMenuExport` — the underlying `/api/workspaces/:id/export` endpoint already includes the grocery list in both formats.
- Ingredient cell becomes a clickable button (`hover:underline`) that opens `IngredientDetailDialog`. Inline freshness/allergen icons next to the name (`Sparkles` for requires-fresh, `Refrigerator` for perishable, `AlertTriangle` for allergens), each wrapped in a shadcn `Tooltip` with the matching description.
- Switched the per-row ingredient name lookup from `ingredientNamesById: Record<string, string>` to a full `ingredientsById: Record<string, IngredientRecord>` so the row can read freshness/allergen flags without a second pass.
- Added `useActiveMenu` to the page so the dialog's "used this week" section has the recipe-id set without a separate hook.
- Wrapped the lists block in `<TooltipProvider>` (shadcn requirement) and the table in an `overflow-x-auto` container so 375px viewports don't blow out.

`pnpm turbo run typecheck` green across all 5 workspaces.

## Observed issue

- **Initial typecheck failure on `ingredientsById` map signature.** First pass typed the map as `Record<string, (typeof ingredientsQuery.data)[number]>`. Under `noUncheckedIndexedAccess` + `useQuery`'s `data: T | undefined`, that resolved to `IngredientRecord[] | undefined` and the `[number]` index produced a type error. Fixed by importing `IngredientRecord` directly. Same hazard that bit step 23 / 24; reinforces the [step 27](./27-dashboard-and-auth-completion.md) follow-up about a shared util for safe-map building.
- **`pnpm --filter @weekly-food-planner/web lint` is still broken** — same Next 15 `next lint` interactive-prompt issue called out in [step 27](./27-dashboard-and-auth-completion.md). Carries over.
- **No shadcn `Tabs` component in the repo.** Built a manual radio-style tab strip in `recipe-detail-dialog.tsx` to avoid pulling in another shadcn primitive for two surfaces. If a third tab surface lands (Menu review, member detail), it's worth running `npx shadcn@latest add tabs`.
- **Manual tab is not a full Radix Tabs.** Keyboard arrow navigation between tabs isn't wired up; tab/shift-tab still works because each control is a regular `<button>`. Acceptable for an internal navigation control inside a modal; flagged so the shadcn Tabs migration is on the radar.
- **`useRecipeDetail` + `useIngredients` both fire on open.** The dialog gates both queries on `open && !!recipeId`, so closed dialogs don't trigger requests. Ingredients are cached globally by React Query (`ingredientKeys.list`), so multiple openings share state — no redundant fetches in practice.
- **"Used this week" tolerates the dialog being opened before the active-menu query resolves.** It returns an empty array until the query lands, then the dialog re-renders with the populated list. Same pattern the rest of the grocery page uses.
- **Export from the grocery page emits a `menu-<date>.md/csv` file** because the backend renders the joint menu+grocery bundle. That's the existing behaviour for the menu page export; documented here so it's clear the grocery export isn't a separate document.
- **`recipe-detail-dialog.tsx` does not gate on workspace role.** Read-only viewing is permitted for every workspace member by PRD §3, and `useRecipeDetail` runs under RLS; no extra check needed at the component layer.
- **Allergen rendering uses `text-destructive`** to flag user attention. Conscious — these are user-tagged labels, not safety-critical UI, and the rest of the app uses the same colour for destructive context.

## Follow-up fixes

- **Add `shadcn Tabs`** when a third tab surface arrives (Menu review per-member view is the likely trigger). Replace the manual strip in `recipe-detail-dialog.tsx` for keyboard parity.
- **Shared `byId` / `ingredientsById` util** in [apps/web/lib](../apps/web/lib/) — three pages now compute the same map (recipes detail dialog, grocery page, ingredient detail dialog). Factoring out a small `indexBy(items, 'id')` helper would also remove the `noUncheckedIndexedAccess` hazard at the type level.
- **Per-recipe ingredient detail link.** The recipe-detail dialog shows ingredient names but not their freshness/allergen flags; a future iteration could make each ingredient row clickable, opening the `IngredientDetailDialog` from the grocery page. Needs the dialog to live in a shared component slot rather than under `(app)/grocery/_components/`.
- **Grocery export as a standalone document.** If users want a grocery-only export (without the menu bundle), the export endpoint needs a `kind=grocery` query param and the renderers need a grocery-only mode. Out of scope for this pass — the current export already includes both.
- **Ingredient images on the dialog.** `ingredients.image_url` exists in the schema but is unused in the UI. The detail dialog could surface it; deferred until the catalog has images worth showing.
- **Mobile pass (#4) is still queued.** This step kept the grocery table responsive via `overflow-x-auto` and hid the new recipe columns under `lg:`, but a full mobile audit at 375px (sheet drawer for sidebar, viewport export, menu day-picker) is the next item.
- **Menu review (#3) is the last queued enhancement.** The `menu_slot_pins` schema + engine change for lock-then-regenerate is the biggest of the six and needs its own plan + log entry before code lands.
