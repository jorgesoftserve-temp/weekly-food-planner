---
name: constraint-menu-generator-life-cycle-test
description: Given a list of recipes and dietary constraints, emit a full life-cycle integration test for the weekly-food-planner pipeline — user registration with constraints → recipe creation → menu generation → markdown + CSV export. Produces both a Vitest *.integration.test.ts (engine + DB layer, gated on SUPABASE_TEST_URL/KEY) and a Node ESM HTTP driver mirroring scripts/verify-flow.mjs (end-to-end through the Next.js API). Invoke when the user asks for a flow test, a regression scenario for a specific allergy/restriction/cuisine combination, or before/after coverage for a constraint-engine change. Do NOT use this skill for unit tests of a single helper, for API-route smoke tests with no menu generation, or for UI/browser flows — those have their own homes.
---

# constraint-menu-generator-life-cycle-test

Generate a deterministic, runnable life-cycle integration test for the weekly-food-planner stack from a small declarative spec. The spec describes **the recipes that exist in the workspace** and **the dietary constraints applied to members + the menu overlay**; the skill emits both layers of test:

1. **Vitest `*.integration.test.ts`** in `packages/supabase/src/module/__tests__/` — uses `createIntegrationFixture` to spin up a real user + workspace, persists members/recipes via package helpers, calls `generateMenu` directly, asserts on slot count + dietary compliance + deterministic `inputsHash`, then renders markdown + CSV via `renderMenuExportMarkdown` / `renderMenuExportCsv` and asserts on the section headers. Gated on `INTEGRATION_ENABLED` so it skips cleanly in CI when env vars aren't set.
2. **Node ESM HTTP driver** in `scripts/flow-<scenario>.mjs` — mirrors `scripts/verify-flow.mjs`: signs up via Supabase auth REST, confirms via `/api/admin/confirm-user`, walks the full API surface (`/api/me` → seed-ingredients → ingredient catalog → `PUT` member allergies/dietary-restrictions/ingredient-dislikes → create recipes → `PATCH` workspace `shared_meal_frequency` → `POST /menus` → `GET /menus/active` → `GET /grocery` → `GET /export?format=markdown` → `GET /export?format=csv`). Exercises the full stack including auth cookies and webpack resolution.

Both artifacts are produced from the same input spec so the engine layer and the HTTP layer can't drift.

---

## Input spec

The user supplies (or the skill asks for, one round of clarification only):

```yaml
scenario: short-kebab-case  # used in filenames + the test describe block
weekStartDate: YYYY-MM-DD   # optional; defaults to "next Monday" computed at run time

members:
  - name: string
    role: creator | admin | member
    ageCategory: infant | toddler | child | teen | adult | senior
    dailyCalorieTarget?: number
    dietaryRestrictions: string[]   # e.g. ['vegetarian', 'gluten_free']
    allergies: string[]              # e.g. ['peanut', 'shellfish']
    ingredientDislikes: string[]     # ingredient slugs/names; resolved against the seeded catalog

mealFrequency:                       # workspace-level shared_meal_frequency
  - { key, title, mealType, defaultHour }

recipes:                             # ≥ 1 per mealType referenced in mealFrequency
  - name: string
    mealType: breakfast | lunch | dinner | snack
    difficulty: easy | medium | hard
    servings: number
    cuisine?: string
    ingredients:
      - { name, quantity, unit }     # name resolved against catalog (oats|milk|tomato|...)
    instructions?:
      - { stepOrder, description }
    dietaryTags?: string[]

overlay?:                            # optional per-generation overlay
  ingredientExclusions?: string[]
  additionalDietaryRestrictions?: string[]
  additionalAllergies?: string[]
  preferredCuisines?: string[]

expectations:                        # what the test should assert
  slotCount?: number                 # default = days × len(mealFrequency)
  excludedRecipeNames?: string[]     # recipes the constraints should rule out
  includedRecipeNames?: string[]     # recipes that MUST appear at least once
  groceryShouldContain?: string[]    # ingredient names that must end up in the shared list
  groceryShouldNotContain?: string[] # ingredients that should be excluded (e.g. allergen-only)
  exportMarkdownContains?: string[]  # additional substrings beyond '## Menu' / '## Grocery list'
  exportCsvContains?: string[]
```

If the user just hands over recipes and constraints without this structure, ask **once** for: (a) the scenario slug, (b) which constraints belong on members vs. on the overlay, (c) the meal frequency, then proceed. Don't loop on missing fields.

---

## Authoritative repo references

These are the files the emitted tests MUST stay consistent with. Read them before generating; if their shape has changed since this skill was written, follow the live file, not the snippet here.

| Reference | What to copy |
|---|---|
| `scripts/verify-flow.mjs` | The mjs driver template. Cookie construction (`sb-127-auth-token=base64-<json(session)>`), step ordering, and the `app(method, path, body)` helper. |
| `packages/test-utils/src/integration/fixture.ts` | `createIntegrationFixture` contract — returns `{ supabase, userId, workspaceId, cleanup }`. The signup trigger creates the workspace; don't try to create one yourself. |
| `packages/supabase/src/module/__tests__/recipes.integration.test.ts` | The `describe.skipIf(!INTEGRATION_ENABLED)` shape, `beforeAll`/`afterAll` cleanup, and the package-function-direct calling style. |
| `packages/supabase/src/module/__tests__/members.integration.test.ts` | How to set per-member dietary restrictions + allergies via `setMemberDietaryRestrictions` / `setMemberAllergies`. |
| `packages/constraint-engine/src/index.ts` | What `generateMenu` returns and the types it expects (`GenerateMenuInput`, `GenerateMenuResult`). |
| `apps/web/lib/api/menu-export.ts` | `renderMenuExportMarkdown` and `renderMenuExportCsv` — the same renderers the API routes use, so the test asserts on the real export output. |
| `apps/web/app/api/workspaces/[id]/menus/route.ts` | The `loadEngineSnapshot` → `computeEffectiveOverlay` → `generateMenu` → `persistGeneratedMenu` pipeline. The Vitest test should call these (not reinvent the data marshalling). |
| `docs/PRD/ARCHITECTURE_PRD.md` §5–6 | The canonical engine pipeline order. If the spec asks for a soft-constraint scenario not yet implemented, fail loud with a TODO referencing the PRD section, don't fabricate behavior. |

---

## Steps

1. **Read the spec.** If it's underspecified per the input schema above, ask one batched clarification question. Otherwise proceed.

2. **Resolve ingredient names against the catalog.** The seed catalog (`/api/admin/seed-ingredients`) is the ground truth for ingredient IDs at runtime — but at code-generation time you don't know those IDs. Emit lookups inline (`ingredients.find((i) => /oat/i.test(i.name))`) the way `verify-flow.mjs` does. Don't hardcode UUIDs.

3. **Generate the Vitest file** at `packages/supabase/src/module/__tests__/<scenario>.integration.test.ts`:
   - `describe.skipIf(!INTEGRATION_ENABLED)('<scenario> (integration)', ...)`
   - `beforeAll` → `createIntegrationFixture()` → store as `fixture`
   - `afterAll` → `fixture?.cleanup()`
   - One `it` block per top-level assertion in `expectations`, OR one `it` for the full life-cycle if the spec is small. Prefer **one combined `it`** when the steps share state (the menu generation result feeds the export assertions) — the integration tests in this repo follow that pattern.
   - Set `shared_meal_frequency` on the workspace via `updateWorkspace` before generating (the signup trigger leaves it null — this is the NO_SLOTS gap documented in agent-log/18).
   - Add members with `createMember`, then set restrictions/allergies via `setMemberDietaryRestrictions` / `setMemberAllergies`.
   - Create recipes via `createRecipe` + the three array-replace helpers (`replaceRecipeIngredients`, `replaceRecipeInstructions`, `replaceRecipeDietaryTags`) from `packages/supabase/src/module/recipes.ts`.
   - Build the `GenerateMenuInput` by calling `loadEngineSnapshot` from `apps/web/lib/api/menu-loader` (NOT by hand-rolling the snapshot — the snapshot shape is engine-internal and changes).
   - Call `generateMenu(...)` and assert `result.ok === true`, slot count, deterministic `inputsHash` (64-char hex), and the included/excluded recipe-name expectations.
   - Render exports via `renderMenuExportMarkdown(menu, groceryLists, ...)` and `renderMenuExportCsv(...)`. Assert on `## Menu`, `## Grocery list`, and any extra substrings in `expectations.exportMarkdownContains` / `exportCsvContains`.

4. **Generate the mjs driver** at `scripts/flow-<scenario>.mjs`:
   - Copy `scripts/verify-flow.mjs` as a starting template — don't rewrite from scratch. Keep the cookie helpers (`projectRefFor`, `sessionCookieValue`) verbatim.
   - Replace the inlined recipe array with the spec's recipes.
   - Insert `PUT /api/workspaces/[id]/members/[memberId]/allergies` (etc.) calls for each member's constraints, BEFORE the `POST /menus` call.
   - Insert `PATCH /api/workspaces/[id]` to set `shared_meal_frequency` from the spec.
   - Replace `weekStartDate` computation with the spec's value if provided.
   - Add overlay options to the `POST /menus` body if `spec.overlay` is set.
   - End with both markdown and CSV `GET /export` checks, asserting on each `exportMarkdownContains` / `exportCsvContains` substring.
   - Keep the `[verify] FAIL:` exit-1 pattern — don't introduce a new logger.

5. **Verify the emitted files compile and parse** — but DO NOT run them. The Vitest test will skip without `SUPABASE_TEST_URL`/`SUPABASE_TEST_SERVICE_KEY`; the mjs driver needs `pnpm dev` + `pnpm db:start` to be running. Both are out of scope for the skill itself. Run `pnpm -w typecheck` (or the smallest equivalent that exercises the emitted file's package) to catch import-path mistakes and type drift.

6. **Report**, in this order: (a) the two file paths, (b) the slot count + which constraints they cover, (c) how to run each — `INTEGRATION_ENABLED=1 SUPABASE_TEST_URL=... SUPABASE_TEST_SERVICE_KEY=... pnpm --filter @weekly-food-planner/supabase test -- <scenario>` for the Vitest test, and `pnpm db:start && pnpm dev` + `node scripts/flow-<scenario>.mjs` for the driver. Do not promise either passes — the skill emits, the user runs.

---

## Non-negotiables

- **Determinism.** Every `generateMenu` call MUST pass an explicit `seed` (not the default randomized one). Same spec must emit the same test text byte-for-byte across runs.
- **Cleanup.** The Vitest test's `afterAll` MUST call `fixture.cleanup()`. The signup trigger leaves orphan workspaces if you skip it; integration suites already share a Supabase instance.
- **Cookie format coupling.** Don't refactor the `sb-<ref>-auth-token` cookie shape. It's coupled to `@supabase/ssr` v0.5 (`base64-<json(session)>`) and a library bump is the only valid reason to touch it. Flag any change in the report.
- **No hardcoded UUIDs.** Ingredient IDs are runtime values from the seed; reference them by name match.
- **Don't bypass the API for HTTP-layer assertions.** The mjs driver hits routes, period. If you're tempted to import a package function to "shortcut" a step, that step belongs in the Vitest test instead.
- **Carry the NO_SLOTS workaround.** Until the signup trigger or workspace-settings UI lands a default `shared_meal_frequency` (open item in agent-log/18), every emitted test MUST set it explicitly before generation. Otherwise the menu call returns 422 with `reasonCode: NO_SLOTS` and the test fails for environment reasons, not behavior reasons.

---

## What to flag in the report

- The interpretation choices you made when the spec was ambiguous (e.g. "you said `gluten_free`; I put it on member-1's `dietaryRestrictions` since that's where the engine expects per-person hard constraints — overlay would have applied it to the whole household").
- Any expectation that the constraint engine doesn't yet enforce (e.g. soft-constraint scoring per ARCHITECTURE_PRD §6.1 is still on the open list — emit a `.todo` test instead of `.skip` if asked for one of these).
- Whether the spec's recipe set has enough breadth to actually satisfy the meal-frequency × repetition-limit budget. If not, the engine will return `no_valid_recipe` — say so up-front rather than letting the test fail at runtime.
