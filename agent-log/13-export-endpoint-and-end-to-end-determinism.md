# Step 13 — Markdown export endpoint + end-to-end determinism test

## Prompt used

See [/prompts/13-export-endpoint-and-end-to-end-determinism.txt](../prompts/13-export-endpoint-and-end-to-end-determinism.txt).

Summary: the user asked for two things — a final-export endpoint that emits either CSV or Markdown for "menu + grocery list," and an integration test that runs recipe creation → menu generation → grocery list → export, asserting determinism end-to-end.

## Context files provided

- The state of the scaffold at the end of step 12: CRUD-layer modules in [packages/supabase/src/module/](packages/supabase/src/module/), 12+ API route handlers in [apps/web/app/api/](apps/web/app/api/), constraint engine with factories under `./test-utils`, the integration fixture under [packages/supabase/src/module/__tests__/](packages/supabase/src/module/__tests__/).
- The architecture/database PRDs in [docs/PRD/](docs/PRD/) for inputs_hash + deterministic generation semantics.
- The cursor rules — `agentic-rules.md` for this log format, `global-rules.md` for RO-RO/one-export-per-file, `query-patterns.md` for the CRUD convention.

## Expected output

### A — Move the integration fixture to a shared location
The fixture lived in `packages/supabase/src/module/__tests__/_integration-helpers.ts` — only reachable by tests inside that package. The new end-to-end test lives in `apps/web/integration/`, so the fixture had to be cross-package.
- Moved to [packages/test-utils/src/integration/fixture.ts](packages/test-utils/src/integration/fixture.ts).
- Added an `./integration` sub-path export on the test-utils package and added the fixture to the main barrel.
- Existing supabase integration tests (`workspaces.integration.test.ts`, `members.integration.test.ts`, `recipes.integration.test.ts`) now import from `@weekly-food-planner/test-utils`.
- The original local helper was deleted.

### B — Pure markdown formatter
New file [apps/web/lib/api/menu-export.ts](apps/web/lib/api/menu-export.ts). Single public export `renderMenuExportMarkdown({ workspace, menu, groceryLists, recipes, ingredients, members })`. Pure function — takes pre-resolved name lookups so the formatter has no I/O, no Date.now(), no env reads. Deterministic ordering:
- **Slots**: by `dayOfWeek` (Mon→Sun via fixed DAY_ORDER), then `mealKey` alphabetical, then `targetMemberId` alphabetical.
- **Grocery items**: by ingredient name (localeCompare).
- **Grocery lists**: shared first, then per-member alphabetical.
Renders:
- A header with workspace name, week-start, generated-at, seed, and inputs hash.
- A `## Menu` table (Day / Meal / Recipe / Target).
- A `## Grocery list` section with one sub-section per list and `—` placeholders for null `scheduled_purchase_day`.

Falls back to `[unknown:id]` when a name lookup misses, so a stale FK doesn't crash rendering.

### C — Export loader (DB joins)
New file [apps/web/lib/api/menu-export-loader.ts](apps/web/lib/api/menu-export-loader.ts). `loadMenuExport({ supabase, workspaceId, weekStartDate? })` orchestrates four DB hits:
1. Workspace name + type.
2. `getActiveMenu` (existing CRUD module) for menu + slots.
3. `getActiveGroceryLists` (existing CRUD module) for grocery + items.
4. Three `WHERE id IN (...)` lookups against `recipes`, `ingredients`, and `workspace_members` to resolve names.

Returns a discriminated `{ ok: true, export } | { ok: false, reason: 'workspace_not_found' | 'no_active_menu' | 'db_error' }`. Reason-codes drive the route's status mapping.

### D — Export endpoint
New route [apps/web/app/api/workspaces/[id]/export/route.ts](apps/web/app/api/workspaces/[id]/export/route.ts):
- `GET /api/workspaces/[id]/export?format=markdown&week_start_date=...`
- 401 → unauthenticated, 403 → not a workspace member, 400 → unsupported `format`, 412 → no active menu, 404 → workspace not found, 500 → other DB errors.
- Returns `text/markdown; charset=utf-8` with `content-disposition: attachment; filename="menu-{weekStartDate}.md"` so browser fetches trigger a save dialog.
- `format=markdown` is the only supported value today; the gate is in place for `csv` to land as a follow-up.

**Why markdown not CSV** (the user said "CSV or Markdown"): a single document needs to carry both menu (day × meal × recipe — relational) and grocery (line items — columnar). Markdown handles both via tables in one file; a CSV equivalent would either need a zip of two files or use sentinel sections, both clumsier than a single MD doc. Picked the cleaner single-format MVP; CSV slot is reserved.

### E — Postman collection
Added an "Export menu + grocery (markdown)" request inside the existing "4. Menus & grocery" folder of [scripts/weekly-food-planner-bruno.json](scripts/weekly-food-planner-bruno.json). Test scripts assert 200 + `content-type` includes `text/markdown`.

### F — Tests

**10 new unit tests** in [apps/web/lib/api/__tests__/menu-export.test.ts](apps/web/lib/api/__tests__/menu-export.test.ts):
- header contains workspace/week/seed/hash
- menu rows sorted by day then mealKey
- grocery items sorted by ingredient name
- `—` rendered for null `scheduled_purchase_day`; capitalized day name when present
- byte-identical output on identical input (determinism)
- byte-identical output even when input arrays are reversed (sort-driven, not insertion-driven)
- `[unknown:id]` fallback when a recipe name is missing from the lookup
- `_(empty)_` marker when no grocery lists exist
- shared list rendered before per-member lists

**3 new end-to-end integration tests** in [apps/web/integration/end-to-end.integration.test.ts](apps/web/integration/end-to-end.integration.test.ts), gated by `INTEGRATION_ENABLED`:
- One-shot pipeline: seed ingredients → `createRecipe ×4` → `loadEngineSnapshot` → `generateMenu` → `persistGeneratedMenu` → `loadMenuExport` → `renderMenuExportMarkdown`. Asserts markdown has menu + grocery sections and the seeded ingredient name appears.
- **Determinism assertion**: runs the full pipeline twice with the same seed and asserts byte-identical markdown after stripping the `Generated:` line (the only wall-clock value in the document). Inputs hash, slot order, grocery item set must all match.
- **Anti-determinism check**: runs twice with seeds N and N+1 and asserts the outputs differ. Guards against accidentally caching across seeds.

`apps/web/vitest.config.ts` already globbed `integration/**/*.test.ts` from step 12, so the new file is picked up without further wiring.

## Observed issue

- **`grocery_items.list_id`, not `grocery_list_id`.** The Supabase nested-resource alias (`grocery_items (id, ingredient_id, ...)` from `grocery_lists`) goes through PostgREST and follows the FK relationship, not the FK column name — so the existing grocery module worked despite the column-name mismatch with the engine's `targetMemberId` convention. Worth noting for future code that reaches `grocery_items` directly: the FK column is `list_id`.
- **`generatedAt` is the one volatile field.** Everything else in the export (slots, grocery items, seed, inputs_hash) is engine-deterministic. The determinism assertion uses a small `stripVolatileLines` helper that drops the `- **Generated:** ...` line before comparison. Documented in the test so the volatile field's role is obvious.
- **CSV deferred, intentionally.** The endpoint validates `format` against a `Set` so adding CSV is a one-line change once we pick the file-zipping vs. sentinel-section question. Not building it now because (a) markdown covers the user-facing "export to print/share" case and (b) no current consumer needs columnar parse-back.
- **Ingredient seeding in the integration test bypasses the admin endpoint.** The test uses the service-role client to insert ingredients directly. The `/api/admin/seed-ingredients` endpoint exists but would require running the Next.js dev server; for an in-process Vitest test the direct insert keeps the test isolated and fast.
- **Test fixture reuse.** The `createIntegrationFixture` helper uses `auth.admin.createUser` + the `sys_create_workspace_on_signup` trigger. Three previously-skipped integration suites (workspaces/members/recipes) and the new end-to-end suite all now share the same fixture surface, so once `SUPABASE_TEST_URL` + `SUPABASE_TEST_SERVICE_KEY` are exported, four real-DB test files start working at once.
- **Engine pipeline runs in-process, not via HTTP.** The end-to-end test calls `generateMenu` and `persistGeneratedMenu` directly rather than hitting `POST /api/workspaces/[id]/menus`. The route handler is a thin wrapper over those same calls plus auth/role checks — testing the wrapped HTTP path would require a Next.js test harness that doesn't exist yet, so the integration test exercises the domain pipeline end-to-end and the Postman collection covers the HTTP surface. Documented as a follow-up.

## Follow-up fixes

- `pnpm turbo run typecheck test` → 8 tasks, all successful. **Test totals: 65 passing, 8 skipped.**
  - constraint-engine: 31 passing
  - supabase: 17 mocked passing, 5 integration skipped (workspaces 3, members 1, recipes 1)
  - apps/web: 17 mocked passing (10 menu-export + 7 menu-overlay), 3 integration skipped (end-to-end)
- All four packages typecheck clean. No cycles.
- Open work carried forward (none blocking further feature work):
  - CSV format for the export endpoint (Set-gated, drop-in slot).
  - HTTP-layer integration tests in `apps/web/integration/` — currently exercising the domain pipeline. Picking a Next.js test harness pattern (e.g., calling route handlers with a fake `NextRequest`) would let us assert on real HTTP responses too.
  - Real-DB integration runs require `SUPABASE_TEST_URL` + `SUPABASE_TEST_SERVICE_KEY`. The five suites that depend on it will skip cleanly until those env vars + `pnpm db:start` are set up.
  - Still-deferred items from step 12: engine soft-constraint scoring + local search, per-member grocery splits, freshness-aware purchase scheduling, generated Supabase TypeScript types, `.react.ts` companions in the supabase modules, PRD cross-reference path fixes after the `docs/PRD/` move.
