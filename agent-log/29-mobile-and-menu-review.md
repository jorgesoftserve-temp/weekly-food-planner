# Step 29 — Mobile pass + draft/accept menu review

## Prompt used

See [/prompts/29-mobile-and-menu-review.txt](../prompts/29-mobile-and-menu-review.txt).

Summary: closes out the remaining two items from the [step 26](./26-enhancement-plan-six-items.md) plan — **#4 (Mobile pass)** and **#3 (Menu review)**. The user re-scoped #3 mid-planning from the originally proposed lock-then-regenerate model to a richer **draft/accept** workflow with a history view; the lock-then-regenerate plan is dropped, and `menu_slot_pins` (proposed but never built) is replaced by `menu_slots.is_overridden + original_recipe_id` plus `menus.accepted_at + accepted_seed`.

## Context files provided

- The [step 26 plan](./26-enhancement-plan-six-items.md) (now partially superseded for #3) and [step 27](./27-dashboard-and-auth-completion.md) / [step 28](./28-recipe-and-grocery-detail.md) deliveries to ground the execution order.
- All five PRDs — relevant rewrites in this step are confined to ARCHITECTURE_PRD §5/6.17, DATABASE_PRD §6.11/6.16, and PRODUCT_PRD §4.1. PRD edits are NOT done in this step — flagged as a follow-up so the spec catches up to the schema in its own pass.
- Existing menu surface: [packages/supabase/src/module/menus.ts](../packages/supabase/src/module/menus.ts), [apps/web/lib/api/menu-persistence.ts](../apps/web/lib/api/menu-persistence.ts), [apps/web/lib/api/menu-export-loader.ts](../apps/web/lib/api/menu-export-loader.ts), [apps/web/app/api/workspaces/[id]/menus/](../apps/web/app/api/workspaces/[id]/menus/), [apps/web/app/(app)/menu/](../apps/web/app/(app)/menu/).
- Engine hard-constraint surface: [packages/constraint-engine/src/filter.ts](../packages/constraint-engine/src/filter.ts) — reused as-is for the replace-slot endpoint.
- Shadcn sidebar primitive at [apps/web/components/ui/sidebar.tsx](../apps/web/components/ui/sidebar.tsx) — already wraps the `(app)/` shell in a SidebarProvider with a `useIsMobile` (768 px breakpoint) Sheet fallback, so no custom mobile drawer was needed.

## Expected output

### Mobile pass (#4)

- **Viewport export** in [apps/web/app/layout.tsx](../apps/web/app/layout.tsx). `width=device-width, initialScale=1, viewportFit=cover` — replaces Next's default meta tag with one that also respects iOS safe areas.
- **Sidebar drawer** — confirmed via inspection that shadcn's `SidebarProvider` (already in [apps/web/app/(app)/layout.tsx](../apps/web/app/(app)/layout.tsx)) routes the `<md:` rendering through `Sheet` automatically. The hamburger button is the existing `SidebarTrigger` in [apps/web/components/app-shell/app-header.tsx](../apps/web/components/app-shell/app-header.tsx). No code changes needed; the work was verifying the wiring.
- **Menu day-picker** in [apps/web/app/(app)/menu/_components/menu-view.tsx](../apps/web/app/(app)/menu/_components/menu-view.tsx) — at `<md:`, renders a horizontal day-tab strip + one day card at a time; at `md:+`, renders the existing 4-col grid. The previous [active-menu-view.tsx](../apps/web/app/(app)/menu/_components/) was replaced by this richer component and deleted.

### Menu review (#3) — draft / accept lifecycle

**Schema migrations:**

- [20260526000100_tbl_menus_add_draft_accept_columns.sql](../packages/supabase/supabase/migrations/20260526000100_tbl_menus_add_draft_accept_columns.sql) — adds `menus.accepted_at` + `menus.accepted_seed`. Backfills existing non-deleted menus as accepted (accepted_at = generated_at, accepted_seed = inputs_hash). Drops the old `uq_menus_workspace_week_active` and replaces with two partial unique indexes: one for accepted, one for drafts (so at most one of each per workspace+week).
- [20260526000101_tbl_menu_slots_add_override_columns.sql](../packages/supabase/supabase/migrations/20260526000101_tbl_menu_slots_add_override_columns.sql) — adds `menu_slots.is_overridden` + `menu_slots.original_recipe_id` to track per-slot user replacements during draft review.

**Data layer:**

- [packages/supabase/src/module/menus.ts](../packages/supabase/src/module/menus.ts) — `MenuRecord` grows `accepted_at` + `accepted_seed`; `MenuSlotRecord` grows `is_overridden` + `original_recipe_id`. `getActiveMenu` now filters `accepted_at IS NOT NULL`; new `getDraftMenu` filters the inverse. New `listAcceptedMenus` returns history with a derived `is_modified` flag.
- [packages/supabase/src/module/menus.react.ts](../packages/supabase/src/module/menus.react.ts) — three new hooks: `useDraftMenu`, `useMenuHistory`, alongside the existing `useActiveMenu`.
- [packages/supabase/src/module/grocery.ts](../packages/supabase/src/module/grocery.ts) — `getActiveGroceryLists` filters by `accepted_at IS NOT NULL` so the grocery list always tracks the accepted menu, never a draft.

**Server lifecycle:**

- [apps/web/lib/api/menu-persistence.ts](../apps/web/lib/api/menu-persistence.ts) — generation inserts a DRAFT (`accepted_at = NULL`). The previous "soft-delete the active menu" step is replaced by "soft-delete any outstanding draft for this week"; the accepted menu is untouched until acceptance happens.
- [apps/web/lib/api/menu-accept.ts](../apps/web/lib/api/menu-accept.ts) (new) — `acceptDraftMenu` validates the menu is still a draft, computes a SHA-256 `accepted_seed` over the canonical slot list (inputs_hash + sorted slot tuples), soft-deletes the previously accepted menu for the same week, sets accepted_at + accepted_seed. Exports `__test__.computeAcceptedSeed` for the unit test.

**API routes:**

- `PATCH` [/api/workspaces/[id]/menus/[menuId]/slots/[slotId]](../apps/web/app/api/workspaces/[id]/menus/[menuId]/slots/[slotId]/route.ts) — replace a draft slot's recipe. Re-runs the engine's `isRecipeValidForSlot` filter (allergies, dietary restrictions, ingredient exclusions, meal-type match); rejects with 422 + `constraint_violation` on failure. Preserves the engine's pick in `original_recipe_id` the first time a slot is overridden.
- `POST` [/api/workspaces/[id]/menus/[menuId]/accept](../apps/web/app/api/workspaces/[id]/menus/[menuId]/accept/route.ts) — wraps `acceptDraftMenu`.
- `DELETE` [/api/workspaces/[id]/menus/[menuId]](../apps/web/app/api/workspaces/[id]/menus/[menuId]/route.ts) — discards a draft (soft-delete); rejects accepted menus with 409.
- `GET` [/api/workspaces/[id]/menus/draft](../apps/web/app/api/workspaces/[id]/menus/draft/route.ts) — returns the current draft, if any.
- `GET` [/api/workspaces/[id]/menus/history](../apps/web/app/api/workspaces/[id]/menus/history/route.ts) — returns accepted menus newest first (default 26, max 100).

**UI:**

- [apps/web/app/(app)/menu/page.tsx](../apps/web/app/(app)/menu/page.tsx) — three-state surface: no menu → empty state + Generate; draft exists → amber review banner with Accept/Discard buttons + per-slot replace; accepted only → read-only view with Export. Mobile-aware via the new `MenuView`.
- [apps/web/app/(app)/menu/_components/menu-view.tsx](../apps/web/app/(app)/menu/_components/menu-view.tsx) (new) — both desktop grid + mobile day-picker; takes an `editable` flag + `onReplaceSlot` callback; shows a "Modified" badge on overridden slots.
- [apps/web/app/(app)/menu/_components/replace-slot-dialog.tsx](../apps/web/app/(app)/menu/_components/replace-slot-dialog.tsx) (new) — searchable list of candidate recipes filtered client-side to the slot's meal_type. Server re-validates hard constraints on submit.
- [apps/web/app/(app)/menu/history/page.tsx](../apps/web/app/(app)/menu/history/page.tsx) (new) — accepted menus list with engine seed + inputs hash + accepted seed + pristine/modified badge.
- [apps/web/lib/hooks/use-menu-draft.ts](../apps/web/lib/hooks/use-menu-draft.ts) (new) — `useReplaceMenuSlot`, `useAcceptMenuDraft`, `useDiscardMenuDraft`. All three invalidate the relevant menuKeys; accept also invalidates `menuKeys.active`, `menuKeys.history`, and `groceryKeys.active`.

**Tests:**

- [apps/web/lib/api/__tests__/menu-accept.test.ts](../apps/web/lib/api/__tests__/menu-accept.test.ts) (new, 5 cases) — `computeAcceptedSeed` is stable, order-independent, changes on recipe edit, changes on inputs_hash change, distinguishes per-member vs shared slots.
- [apps/web/integration/end-to-end.integration.test.ts](../apps/web/integration/end-to-end.integration.test.ts) — extended to call `acceptDraftMenu` between persist and export, since the export loader now filters by `accepted_at IS NOT NULL`. Existing assertions still hold (byte-identical across same seed, different across different seed). Still gated by `INTEGRATION_ENABLED` per the cursor rule split.

**Docs:**

- [README.md](../README.md) — UI section updated with the new auth pages, mobile sidebar drawer note, draft/accept menu flow, history page, recipe detail dialog, grocery ingredient dialog. API table grows five rows (draft, history, accept, discard, slot replace).

### Verification

- `pnpm turbo run typecheck` — green across all 5 workspaces.
- `pnpm turbo run test` — `constraint-engine` 36 ✓, `supabase` 24 ✓ (5 integration skipped without env), `web` 33 ✓ (3 e2e integration skipped without env). The new `menu-accept.test.ts` runs 5 tests in the web suite.
- `pnpm --filter @weekly-food-planner/web lint` still broken (`next lint` is interactive in Next 15); pre-existing, see [step 27](./27-dashboard-and-auth-completion.md) follow-up.

## Observed issue

- **User re-scoped #3 mid-planning.** My initial proposal (lock-then-regenerate with `menu_slot_pins`) was replaced by the user's draft/accept design (engine unchanged, drafts coexist with accepted, history view). I dropped `menu_slot_pins` entirely, kept the engine boundary frozen, and turned the slot-override concept into two columns on `menu_slots` plus an acceptance hash on `menus`. Net effect: smaller engine surface, larger lifecycle surface.
- **Existing end-to-end integration test broke** when `loadMenuExport` started filtering by `accepted_at IS NOT NULL`. Fixed by calling `acceptDraftMenu` inside `runPipeline` between persist and export — matches what the menu page does after the user clicks "Accept menu". The byte-identical determinism assertions still hold because acceptance doesn't change slot ordering.
- **Engine `SlotSpec.targetMemberId` is non-null** but DB `menu_slots.target_member_id` is nullable. For shared slots, the replace endpoint now falls back to validating against `snapshot.members[0]` and uses that member's id when constructing the `SlotSpec`. Documented inline. This is correct for individual workspaces; for true shared slots in group workspaces, a "validate against ALL members and take the intersection" pass would be safer — flagged below.
- **Slot override does NOT update the grocery list.** Replacing a recipe during draft review changes the menu, but the grocery_items table still reflects the engine's original output. Acceptance currently does not recompute the grocery list either. This is acceptable for MVP — flagged so a follow-up step can run `aggregateGroceryLists` on acceptance.
- **`accepted_seed` is NOT a regeneratable seed.** It's a stable identifier for the accepted state, not an input to the engine. A user can compare two accepted seeds to verify identity, but cannot recreate the menu by feeding `accepted_seed` back into generation. The engine seed (`menus.seed`) remains the only RNG seed; the accepted seed extends it with override info. Documented in the column comment + the menu-accept module header.
- **`generation_options` is read as `unknown` by the replace route**, then narrowed via a cast. Cleaner would be a typed reader, but `generation_options` is a JSON column and the overlay shape is well-known; the cast is internal. Flagged for a future tightening pass.
- **One outstanding draft per (workspace, week)** — enforced by the new `uq_menus_workspace_week_draft` partial unique index. Regenerating while a draft exists soft-deletes the old draft (per the existing `persistGeneratedMenu` pattern, just retargeted from "active" to "draft").
- **PRD docs were NOT updated in this step.** `ARCHITECTURE_PRD §5`, `DATABASE_PRD §6.11/§6.16/§6.17`, and `PRODUCT_PRD §4.1` still describe the old "replace-by-soft-delete on regeneration" semantics. A docs-sync follow-up needs to land before the next stage of work to avoid spec/code drift.
- **No UI for unpicking an override.** Once a slot is overridden, the dropdown only offers "Replace recipe". A future polish could add "Revert to engine's pick" (set `recipe_id = original_recipe_id`, `is_overridden = false`, clear `original_recipe_id`).
- **History page has no detail drill-down.** Each entry shows seeds + week + modified flag; tapping does nothing. A future iteration could open the historical menu in read-only mode via the existing `MenuView`.
- **Mobile sidebar wasn't custom-built.** Shadcn's primitive already handles the responsive Sheet fallback. Worth noting because the [step 26 plan](./26-enhancement-plan-six-items.md) implied this would be a code change; in practice it was a verification step.
- **Mobile audit at 375 px was not screenshot-verified** (no browser available in this environment). Layout choices documented in the file comments; visual confirmation is owed to a follow-up `verify` pass.

## Follow-up fixes

- **Update the PRDs** (ARCHITECTURE §5, DATABASE §6.11/6.16/6.17, PRODUCT §4.1) to describe the draft/accept lifecycle, the `accepted_at`/`accepted_seed` columns, and the `menu_slots.is_overridden`/`original_recipe_id` columns. Should land before the next major step that touches menus.
- **Recompute grocery list on slot override AND on acceptance.** Either materialize the grocery list lazily from `menu_slots` (cleanest) or re-run `aggregateGroceryLists` when acceptance fires. Open question: do we want to update the grocery list during draft review (so the user sees the impact of an override) or only at acceptance?
- **Slot override revert UX** — add an "Undo override" item to the slot dropdown when `is_overridden = true`. One-liner DB update.
- **History detail view** — clicking a history entry opens the snapshot in read-only `MenuView`. The data is already there; just needs a route + a read-only mount.
- **Multi-member shared-slot constraint validation** — when a slot has `target_member_id = NULL` (shared), the replace endpoint currently validates against the first member only. Switching to "intersection of all members' constraints" would be safer for group workspaces. Engine has the helper; just plumb it through.
- **Browser-based mobile audit** at 375×667 with screenshots for the menu, recipes, grocery, dashboard, and settings pages. Document any layout issues that need spot fixes.
- **Replace `next lint`** with the direct ESLint CLI — same follow-up carried from steps 27 + 28; blocks lint coverage in CI.
- **Shared `byId` util** — same carry-over follow-up; this step grew the surface that hand-rolls `Record<string, T>` index maps (members, recipes, ingredients in three places).
- **MenuView is the right place for the future "Member view" toggle** — segmented control + filter slots by `target_member_id`. Skipped here per scope cut.
