# Step 33 — Members CRUD UI (MVP 1.5 Phase 1)

## What I changed

Phase 1 of the MVP 1.5 plan (members CRUD + per-member menus + per-menu
meal-frequency override + servings-aware grocery scaling). DB, module, routes,
and tests for members already existed — only the UI was missing, plus the
member edit forms had no Zod validation and no React Query mutation hooks. This
step closes that gap.

### 1. Zod schemas + route validation

`apps/web/lib/api/members.ts` (new) — request-body schemas for every member
route, plus a `formatZodError` helper that the routes' `badRequest()` calls
consume. Schemas:

- `createMemberBodySchema` — name (trimmed, min 1), role (admin|member, not
  creator), age_category, optional daily_calorie_target (positive int or null),
  optional meal_frequency (unique-keyed array of `MealFrequencyEntry`),
  optional UUID user_id, optional dietary/allergy/dislike arrays.
- `updateMemberBodySchema` — partial of the create schema, plus a refinement
  that requires at least one field. Rejects role=creator.
- `valuesBodySchema` — `{ values: string[] }`, each non-empty after trim.
- `ingredientIdsBodySchema` — `{ ingredient_ids: UUID[] }`.

Wired into the five member route handlers:

- `apps/web/app/api/workspaces/[id]/members/route.ts` (POST)
- `apps/web/app/api/workspaces/[id]/members/[memberId]/route.ts` (PATCH)
- `.../dietary-restrictions/route.ts` (PUT)
- `.../allergies/route.ts` (PUT)
- `.../ingredient-dislikes/route.ts` (PUT)

Previously these used ad-hoc `if (!body || !body.name)` checks; now any
malformed body returns a 400 with a path-prefixed error message.

While there I noticed `setMemberDietaryRestrictions` and `setMemberAllergies`
in `packages/supabase/src/module/members.ts` did NOT call `sys_save_label`
before insert — the label save was happening externally in the route handler
only. `recipes.ts`'s `replaceRecipeDietaryTags` handles `sys_save_label`
internally for consistency. I aligned the two: the members setters now call
`sys_save_label` themselves, and the duplicate loop was dropped from the
dietary-restrictions and allergies routes. This also means the new React Query
mutation hooks (which call the module directly, not the API) get label-save
for free without re-implementing it client-side.

### 2. React Query mutation hooks

`packages/supabase/src/module/members.react.ts` (new) — `useMembersList`,
`useMemberDetail`, `useCreateMember`, `useUpdateMember`, `useSoftDeleteMember`,
`useSetMemberDietaryRestrictions`, `useSetMemberAllergies`,
`useSetMemberIngredientDislikes`. Every mutation invalidates both
`memberKeys.list(workspaceId)` and `workspaceKeys.detail(workspaceId)` so the
dashboard members-card refetches alongside the dedicated /members page.
Exported from the existing `@weekly-food-planner/supabase/react` barrel.

### 3. /members page + dialog flow

- `apps/web/app/(app)/members/page.tsx` — table view, mirrors the
  /recipes page structure (table + row actions, no separate /new route — the
  Add CTA opens the create drawer in place).
- `_components/member-form.tsx` — the actual form. Sections: profile (name,
  role, age_category, daily_calorie_target), meal schedule
  (`Inherit from workspace` toggle vs custom editor), dietary profile
  (`MultiLabelCombobox` for restrictions + allergies), ingredient dislikes
  (`IngredientPicker` rows). Create mode submits one `useCreateMember` call
  that cascades into junction inserts server-side; edit mode runs the scalar
  update first, then the three junction `set*` mutations in parallel.
- `_components/member-form-dialog.tsx` — Sheet that hosts the form. Edit mode
  fetches via `useMemberDetail` gated on `open` so closing stops refetching.
- `_components/delete-member-dialog.tsx` — soft-delete confirmation. The
  creator member is protected at the route layer; UI hides Remove for them.

### 4. Reusable meal-frequency editor

`apps/web/components/forms/meal-frequency-fields.tsx` — controlled component
that renders editable rows for a `MealFrequencyEntry[]` array (key, title,
mealType, defaultHour). Parent owns the value. Lives in `components/forms`
because Phase 2 (per-menu frequency override) will reuse it in the
generate-menu dialog without copy-paste.

### 5. Dashboard + nav wiring

- `dashboard/_components/members-card.tsx` — the "Coming soon" disabled button
  is gone. Replaced with a "Manage" link to /members and an "Add member" CTA
  (admin/creator only) that also routes to /members.
- `components/app-shell/app-sidebar.tsx` — /members added between
  /dashboard and /recipes with the Users icon.

### 6. Tests

`apps/web/lib/api/__tests__/members.test.ts` (new) — 16 tests covering every
Zod schema: minimal valid bodies, name trimming, role=creator rejection, age
category whitelist, meal-frequency unique-key invariant, defaultHour bounds,
null vs positive daily_calorie_target, empty patch rejection, value/array
trimming, UUID validation, and `formatZodError` output.

Existing members unit + integration tests still pass — `sys_save_label` is
called via the mock's default rpc handler (returns `{ data: null, error: null }`
when no override is configured), and `values: []` short-circuits before the
loop runs.

## Verification

```
pnpm -r typecheck   → 4/4 packages green
pnpm -r test        → 113 passed, 8 skipped (was 97 + 8 — added 16 tests)
pnpm -F web lint    → 0 errors, 2 pre-existing warnings unchanged
```

## Files

New:
- `apps/web/lib/api/members.ts`
- `apps/web/lib/api/__tests__/members.test.ts`
- `packages/supabase/src/module/members.react.ts`
- `apps/web/components/forms/meal-frequency-fields.tsx`
- `apps/web/app/(app)/members/page.tsx`
- `apps/web/app/(app)/members/_components/member-form.tsx`
- `apps/web/app/(app)/members/_components/member-form-dialog.tsx`
- `apps/web/app/(app)/members/_components/delete-member-dialog.tsx`
- `prompts/33-members-crud-ui.txt`
- `agent-log/33-members-crud-ui.md` (this file)

Edited:
- `apps/web/app/api/workspaces/[id]/members/route.ts`
- `apps/web/app/api/workspaces/[id]/members/[memberId]/route.ts`
- `apps/web/app/api/workspaces/[id]/members/[memberId]/dietary-restrictions/route.ts`
- `apps/web/app/api/workspaces/[id]/members/[memberId]/allergies/route.ts`
- `apps/web/app/api/workspaces/[id]/members/[memberId]/ingredient-dislikes/route.ts`
- `packages/supabase/src/module/members.ts` — `sys_save_label` now called
  inside the dietary/allergy setters (matches `replaceRecipeDietaryTags`).
- `packages/supabase/src/react.ts` — re-export the new members.react.js barrel.
- `apps/web/app/(app)/dashboard/_components/members-card.tsx`
- `apps/web/components/app-shell/app-sidebar.tsx`

## Not touched on purpose

- The PRDs aren't edited yet — Phase 1 is purely UI-completion of an existing
  feature that PRODUCT_PRD §2.1/2.2 + DATABASE_PRD §6.2 already describe. PRD
  edits land with Phase 2 (frequency override + menu participants),
  Phase 4 (servings scaling), and Phase 5 (shop-for-subset) — those change
  the data model and engine contract and need doc updates.
- No new shadcn primitive added. The form's "Customize" toggle uses an
  existing `Button` variant swap instead of a Switch, since `@radix-ui/react-switch`
  isn't in the dep list and it's not worth pulling for one toggle.
- Default per-age_category `meal_frequency` (mentioned as a planned migration
  in DATABASE_PRD §7) still isn't shipped. The form ships its own sensible
  default (3 meals/day, 7/12/19) inline. A migration that seeds defaults per
  age category can land later without breaking this form.

## Follow-ups still open from MVP 1.5

- Phase 2: per-member meal-frequency override + menu participants table.
- Phase 3: add-slot operation on an existing draft.
- Phase 4: servings-aware grocery scaling (engine + recompute).
- Phase 5: shop-for-subset filter on the grocery view.
- Migration: ship default `meal_frequency` per `age_category` so newly
  created members start with sensible defaults without the form filling them in.
- Carried from earlier steps: history row drill-down (step 31), draft↔accept
  grocery path unification (step 32), dedupe `isMenuStillUpcoming`.
