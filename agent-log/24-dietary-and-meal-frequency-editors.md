# Step 24 — Settings page: dietary preferences + meal schedule editors

## Prompt used

See [/prompts/24-dietary-and-meal-frequency-editors.txt](../prompts/24-dietary-and-meal-frequency-editors.txt).

Summary: continuation of the deferred work from [step 23](./23-ingredient-creation-and-settings.md). Adds two new cards to the existing `/settings` page so users can edit their dietary constraints (restrictions + allergies on the creator member) and meal schedule (workspace `shared_meal_frequency`) — closes the remaining off-screen reliance from [scripts/demo-stage.mjs](../scripts/demo-stage.mjs) for those two fields. Single commit.

## Context files provided

- [apps/web/app/(app)/settings/page.tsx](../apps/web/app/(app)/settings/page.tsx) + [settings-form.tsx](../apps/web/app/(app)/settings/_components/settings-form.tsx) — existing profile + password page from [step 23](./23-ingredient-creation-and-settings.md), which we extend.
- [packages/supabase/src/module/workspaces.ts](../packages/supabase/src/module/workspaces.ts) — `MealFrequencyEntry`, `getWorkspaceWithMembers`, `updateWorkspace`, plus the existing `useWorkspaceWithMembers` and `useUpdateWorkspace` hooks in the `.react.ts` companion.
- [packages/supabase/src/module/members.ts](../packages/supabase/src/module/members.ts) — `listMembers` and `MemberRecord` (with the dietary/allergy/dislike joins). No `members.react.ts` exists; the new card calls `listMembers` via `useQuery` directly.
- [apps/web/components/forms/multi-label-combobox.tsx](../apps/web/components/forms/multi-label-combobox.tsx) — reused unchanged for the restrictions + allergies inputs (it already has the inline create row from [step 17](./17-ui-basic-flow.md)).
- The three PUT endpoints under `/api/workspaces/[id]/members/[memberId]/`: `dietary-restrictions`, `allergies`, `ingredient-dislikes`.

## Expected output

Two new client components on `/settings`, slotted in below the existing Profile + Password cards.

### `DietaryPreferencesCard`

[apps/web/app/(app)/settings/_components/dietary-preferences-card.tsx](../apps/web/app/(app)/settings/_components/dietary-preferences-card.tsx).

- Resolves the creator member by `user_id` match against `useAuthUser` (the workspace-with-members shape doesn't carry `user_id`, so it calls `listMembers` via inline `useQuery`).
- Two `MultiLabelCombobox` fields: dietary restrictions (`enumType: 'dietary_restriction'`) + allergies (`enumType: 'food_allergy'`). The combobox already handles "type something not in the list → create" — meets the user's "add to enum at bottom" ask from [step 23](./23-ingredient-creation-and-settings.md) in passing.
- On Save: two parallel `PUT` calls (`{ values: string[] }` body, same shape `verify-flow.mjs` uses). Server-side, `sys_save_label` persists any newly-typed entries to `enum_metadata` so they appear as suggestions next time.

### `MealScheduleCard`

[apps/web/app/(app)/settings/_components/meal-schedule-card.tsx](../apps/web/app/(app)/settings/_components/meal-schedule-card.tsx).

- Reads the current `shared_meal_frequency` via `useWorkspaceWithMembers`. Seeds the local rows once on first load — subsequent refetches don't clobber draft edits.
- Each row: title + meal type (`Select` from `breakfast | lunch | dinner | snack`) + hour (number 0-23) + remove button. "Add meal slot" appends a new row.
- `key` is derived automatically from the title (slugified, with collision suffixing) so the user doesn't need to know about it.
- On Save: validates hours, drops blank rows, calls `useUpdateWorkspace.mutateAsync({ shared_meal_frequency: entries })`. The existing hook invalidates the workspace + workspaces-list cache on success.

Both cards mounted in [settings/page.tsx](../apps/web/app/(app)/settings/page.tsx). All 8 turbo tasks (typecheck + test) green.

## Observed issue

- **`MealFrequencyEntry` not re-exported through `@weekly-food-planner/supabase/react`.** Same drift caught in [step 23](./23-ingredient-creation-and-settings.md) with `IngredientRecord` — the `.react` barrel surfaces hooks only. Fixed by importing the type from the main barrel and the hook from `.react`. Repeating pattern; a one-line change in `react.ts` to re-export the supporting types would prevent future re-emergence.
- **No hook companion for the member CRUD module** (`packages/supabase/src/module/members.ts` has no `members.react.ts`). The dietary card calls `listMembers` via a direct `useQuery` inline. For consistency with the other modules' `.react.ts` companions, a `useMembers` hook would slot cleanly in. Skipped in this pass to keep the diff small.
- **Ingredient dislikes deferred from this card.** The user's "dietary constraints info" wording covers three fields server-side (`dietary_restrictions`, `allergies`, `ingredient_dislikes`). The first two are free-text label arrays — easy fit for `MultiLabelCombobox`. Dislikes are FK-keyed to the ingredients table, which would require a multi-ingredient picker that doesn't exist yet. Left as a follow-up rather than half-implementing.
- **Member role/age/calorie target also unexposed.** Editing those plus the per-member `meal_frequency` overrides would naturally live on a `/members` page (the deferred member-management UI from [step 16](./16-ui-outline-and-scope-decisions.md)). Out of scope for this pass.
- **Draft state doesn't reset on refetch.** The meal schedule card has a `seeded` boolean that gates the initial form fill. If the user navigates away and back without saving, they see stale state. Acceptable for the MVP; flagged inline.

## Follow-up fixes

- **Multi-ingredient picker for `ingredient_dislikes`** — small component that composes `IngredientPicker` for the "add" path and renders selected items as removable chips. Should slot into the same card.
- **`useMembers` hook** in `packages/supabase/src/module/members.react.ts` — eliminates the inline `useQuery` here and unblocks reuse from the future `/members` page.
- **Member-management UI** (still deferred from [step 16](./16-ui-outline-and-scope-decisions.md)) — would let users edit non-creator members' constraints, not just their own. Group workspaces remain unreachable through the UI until this lands.
- **`scripts/demo-stage.mjs` can shrink** — the meal-frequency and dietary-restriction setup it does off-screen is now UI-driven, so the demo script could rewrite Beat 2 to do those clicks on camera. Still needs the email-confirm step until that's UI-driven.
- **Toast feedback after MultiLabelCombobox's auto-create.** When a user types a new restriction/allergy and hits Save, the new label persists to `enum_metadata` but the UI doesn't acknowledge that beyond the existing "preferences saved" toast. Minor polish.
