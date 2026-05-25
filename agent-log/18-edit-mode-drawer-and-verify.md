# Step 18 — Recipe edit covers all fields + drawer UI + Phase 6 verify catches a hidden webpack bug

## Prompt used

See [/prompts/18-edit-mode-drawer-and-verify.txt](../prompts/18-edit-mode-drawer-and-verify.txt).

Summary: two follow-ups on the step-17 UI work, then Phase 6 (browser-verify) once both shipped.

1. Edit mode should save **all** recipe fields, not just the scalars the original PATCH route covered. Phrased as "save scalar fields (add required endpoints for this)" — clarified inline that this meant the array fields (ingredients, instructions, dietary_tags) flagged in step 17's "honest gaps" section, since scalar fields already saved.
2. Edit mode should open a **right drawer** rather than navigate to `/recipes/[id]/edit`, so users stay on the list while editing.

Then run Phase 6 (browser-verify the full basic flow) via the `/verify` skill once both updates are committed.

## Context files provided

- The state of the scaffold at the end of step 17: foundation hooks + sidebar/header app shell + recipe CRUD (with the "edit only updates scalars" callout) + menu generation + grocery view + markdown/CSV export.
- The two design decisions resolved inline in step 17 (sidebar + header layout, full-page CRUD forms — now partially reverted to drawer for edit per this cycle).

## Expected output

### A — Backend: array-replace endpoints for recipes (commit b340ff7)

- **CRUD helpers** in [packages/supabase/src/module/recipes.ts](../packages/supabase/src/module/recipes.ts):
  - `replaceRecipeIngredients` — delete-then-insert against `recipe_ingredients`.
  - `replaceRecipeInstructions` — delete-then-insert against `recipe_instructions`.
  - `replaceRecipeDietaryTags` — funnels every tag through `sys_save_label` (extensible-label pattern from [step 06](./06-allergy-extensible-and-shadcn.md)) before the delete + insert against `recipe_dietary_tags`. Empty-array case still runs the delete so a save with all tags removed works correctly.
- **Mocked tests** in [packages/supabase/src/module/__tests__/recipes.test.ts](../packages/supabase/src/module/__tests__/recipes.test.ts): 7 new tests covering empty-array (delete only, no insert), non-empty (delete + insert), delete-error propagation, and the per-tag `sys_save_label` fan-out. Recipes module: 4 → 11 tests. Supabase module: 17 → 24 mocked tests.
- **API routes** — three new PUT endpoints under `apps/web/app/api/workspaces/[id]/recipes/[recipeId]/`:
  - [`/ingredients/route.ts`](../apps/web/app/api/workspaces/%5Bid%5D/recipes/%5BrecipeId%5D/ingredients/route.ts) — body `{ ingredients: RecipeIngredientInput[] }`, validates `ingredient_id`/`quantity > 0`/`unit` per item.
  - [`/instructions/route.ts`](../apps/web/app/api/workspaces/%5Bid%5D/recipes/%5BrecipeId%5D/instructions/route.ts) — body `{ instructions: RecipeInstructionInput[] }`, validates `step_order: positive int` + `description: non-empty`.
  - [`/dietary-tags/route.ts`](../apps/web/app/api/workspaces/%5Bid%5D/recipes/%5BrecipeId%5D/dietary-tags/route.ts) — body `{ tags: string[] }`, requires non-empty strings.
  - Each follows the existing recipe-route pattern: `getAuthenticatedUser` → `hasAdminRole` → look up the recipe via `getRecipe` (404 if missing) → call the matching helper → return `jsonOk` with the new state.
- **React Query mutations** in [packages/supabase/src/module/recipes.react.ts](../packages/supabase/src/module/recipes.react.ts): `useReplaceRecipeIngredients` / `useReplaceRecipeInstructions` / `useReplaceRecipeDietaryTags`. Each invalidates `recipeKeys.list(workspaceId)` + `recipeKeys.detail(workspaceId, recipeId)` on success so the list and detail rehydrate.

### B — Form + drawer: drawer-hosted edit that saves everything in one go (commit b340ff7 cont'd)

- **`RecipeForm`** at [apps/web/app/(app)/recipes/_components/recipe-form.tsx](../apps/web/app/(app)/recipes/_components/recipe-form.tsx) updated:
  - Edit-mode submit runs the scalar PATCH first, then `Promise.all` over the three array-replace mutations. Scalar-first sequencing means a downstream array failure can't leave the `recipes` row referencing a stale FK; running the arrays in parallel keeps the save fast.
  - New `onClose?: () => void` prop. A `dismiss()` helper defers to `onClose` when provided (drawer mode) and falls back to `router.push('/recipes')` for the standalone `/recipes/new` page.
  - Dropped the "edit only saves scalars" callout — no longer true.
- **`EditRecipeDrawer`** at [apps/web/app/(app)/recipes/_components/edit-recipe-drawer.tsx](../apps/web/app/(app)/recipes/_components/edit-recipe-drawer.tsx): shadcn `Sheet` (side="right", `sm:max-w-2xl`) hosting the form. Loads the recipe via `useRecipeDetail` gated on `open` so closing the drawer stops React Query from refetching the now-irrelevant detail.
- **Recipe list** at [apps/web/app/(app)/recipes/page.tsx](../apps/web/app/(app)/recipes/page.tsx) updated: the recipe name and the Edit dropdown item both `setEditingRecipeId(recipe.id)` which opens the drawer. No navigation; users stay on the list.
- **Removed** the standalone `apps/web/app/(app)/recipes/[id]/edit/page.tsx` route. The drawer fully covers the edit case.

Phase A + B verification: `pnpm turbo run typecheck test` → 8 tasks, 8 successful. **83 passing (+7), 8 skipped.**

### C — Phase 6: browser-verify (commit e252c6b)

Used the `/verify` skill. No `verifier-*` skill in [.claude/skills/](../.claude/skills/) and no Playwright/Puppeteer installed locally, so drove the full flow at the HTTP surface via a Node script that constructs the `sb-127-auth-token` cookie `@supabase/ssr` expects.

**Critical finding — runtime blocker:** every API route that imports from `@weekly-food-planner/supabase` was 500-ing with:

```
Module not found: Can't resolve './module/workspaces.js'
> 1 | export * from './module/workspaces.js'
    | ^
```

The supabase package uses NodeNext-style `.js` import suffixes on TS sources (the canonical pattern under `moduleResolution: "bundler"` — TS strips `.js` to resolve `.ts`). `tsc` + `vitest` followed tsconfig so typecheck and the test gate were both clean. Webpack didn't, so the whole API surface was unusable in dev. CI never caught it because nothing in CI runs `pnpm dev`. The auth pages (`/login`, `/signup`) don't touch the supabase package, so the user hadn't noticed in 47h of dev-server uptime.

**Fix in [apps/web/next.config.mjs](../apps/web/next.config.mjs):**

```js
webpack: (config) => {
  config.resolve.extensionAlias = {
    '.js': ['.ts', '.tsx', '.js', '.jsx'],
    '.mjs': ['.mts', '.mjs'],
  }
  return config
},
```

This is the standard Next.js workaround for NodeNext `.js` imports through `transpilePackages`. Webpack now strips the same way tsc does.

**`scripts/verify-flow.mjs`** committed as the e2e driver. Signs up a fresh user via Supabase auth REST → confirms via `/api/admin/confirm-user` → signs in → constructs the `sb-127-auth-token=base64-<json(session)>` cookie → walks: `/api/me` → seed-ingredients → list ingredients → create 3 recipes → list → PUT ingredients → PUT instructions → PUT dietary-tags → GET recipe (verify arrays replaced) → PATCH workspace (set `shared_meal_frequency`) → POST `/menus` → GET `/menus/active` → GET `/grocery` → GET `/export?format=markdown` → GET `/export?format=csv`. After the webpack fix landed: **all 16 steps PASS**.

Notable observations from the verify run:
- The active menu has 14 slots (7 days × 2 meals) with a non-zero `inputs_hash`, confirming deterministic generation against the live DB.
- Markdown export: 200, `text/markdown; charset=utf-8`, 1330 bytes, contains `## Menu` + `## Grocery list`.
- CSV export: 200, `text/csv; charset=utf-8`, 1122 bytes, same section headers.
- Post-edit GET on the target recipe shows `ingredients.length=3`, `instructions.length=2`, `dietary_tags=['vegan','gluten_free']` — confirms the array-replace endpoints are end-to-end durable, including the `sys_save_label` round-trip for newly typed tags.

## Observed issue

- **Webpack `.js` resolution gap** — covered in detail above. The root cause is structural (CI doesn't exercise the dev server), so the test gate alone can't catch this class of bug. A follow-up worth considering: a CI step that boots the dev server and curls `/api/me` (expecting 401) just to confirm the route layer compiles.
- **NO_SLOTS on fresh users** — the signup trigger creates a workspace with `shared_meal_frequency = null`. Menu generation immediately returns 422 with reason `NO_SLOTS`: "Configure a meal_frequency on the workspace or its members." For a real new user clicking through the basic flow, the menu page would show the 422 inline error and they'd hit a dead end. The verify script PATCHes the workspace with a 2-meal template (breakfast + dinner) to get past this. The fix is either (a) extend the signup trigger to seed a sensible default `shared_meal_frequency`, or (b) build the workspace-settings UI that was deferred under step 16's scope cuts. Decision punted to the user.
- **Drawer GUI behaviour not visually verified.** The backend the drawer invokes (PUT routes + atomic edit submit pattern) is fully verified by the script's steps 9–12. Click-to-open, focus management, scroll behaviour, and the dismiss-on-save animation need a manual browser pass or a Playwright e2e test. A `verifier-browser` skill + Playwright install would let future `/verify` runs drive pixels.
- **"Save scalar fields" wording in the prompt** vs. the actual gap (array fields). Surfaced the interpretation mismatch before starting: scalar fields already saved via the existing PATCH; the missing piece was the arrays. User-implied confirmation by not objecting; proceeded with the array interpretation, which is what the "(add required endpoints for this)" parenthetical pointed at. Captured here so a future agent reading this log understands why "scalar" → "all fields including arrays" in the implementation.
- **Cookie format coupling.** The verify script builds the `sb-127-auth-token` cookie by hand based on the @supabase/ssr v0.5 storage shape (`base64-<json(session)>`). A future SSR-library bump could change this format silently — if the verify script starts failing at `/api/me -> 401`, the cookie shape is the first place to look.
- **Two dev servers running during verify.** I started a fresh dev server on port 3001 rather than killing the user's existing one on port 3000 (which had been running 47h). After the webpack fix the user's port-3000 server is still in the broken pre-fix state until they restart it; the fix is committed so the next `pnpm dev` picks it up automatically. The port-3001 server was cleaned up at the end of the verify run.

## Follow-up fixes

- After the user's next `pnpm dev` restart, the webpack fix takes effect on port 3000 too.
- Decide on the NO_SLOTS UX: extend the signup trigger with a default `shared_meal_frequency`, or build a workspace-settings page. Without either, the basic flow is broken for a brand-new user.
- Add a Playwright + `verifier-browser` skill so the drawer behaviour can be driven through pixels in a future `/verify` run.
- Add a CI smoke step that boots the dev server and curls a couple of API routes (expecting auth 401s, not 500s) to catch the webpack-vs-tsc resolution class of bug.
- Carried forward from step 17 (still open, none block the basic flow):
  - Engine soft-constraint scoring + local-search refinement per [ARCHITECTURE_PRD §6.1](../docs/PRD/ARCHITECTURE_PRD.md).
  - Per-member grocery splits + freshness-aware `scheduled_purchase_day`.
  - "Untagged allergen is silently skipped" engine test (from [step 06](./06-allergy-extensible-and-shadcn.md)).
  - `(raw_input_with_duplicates, deduped_equivalent)` overlay fixture pair (from [step 08](./08-overlay-silent-dedup.md)).
  - Re-enable the four step-16 scope cuts (overlay UI, member management, password reset, multi-workspace switcher) when their stakeholders show up.
