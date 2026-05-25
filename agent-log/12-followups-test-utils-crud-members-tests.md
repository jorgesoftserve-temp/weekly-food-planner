# Step 12 — Close the four follow-ups from step 10/11: test-utils, CRUD modules, member endpoints, tests

## Prompt used

See [/prompts/12-followups-from-step-10-and-11.txt](../prompts/12-followups-from-step-10-and-11.txt).

Summary: the user lifted the four open items from the agent-log/10 + 11 punch list (no member endpoints, no API tests, empty `packages/test-utils`, no CRUD-layer modules) and asked to work through them. One clarifying answer mid-turn: integration tests should be "both — real DB for happy path, mocked for edge cases."

## Context files provided

- `.cursor/rules/query-patterns.md` (the `xxx.ts` CRUD + `xxx.react.ts` hooks convention with both static and function query-key forms).
- `.cursor/rules/global-rules.md` (RO-RO named-object params, one-export-per-file, 60/40 integration-vs-unit split, three Supabase clients).
- `.cursor/rules/agentic-rules.md` (this log format).
- The state of the scaffold at the end of step 11: 12 API route handlers, engine with 31 tests, no `packages/supabase/src`, empty `packages/test-utils`.

## Expected output

### A — `packages/test-utils` factory package + supabase mock
- Package wired with `main`/`types`/`exports`, sub-path exports for `./factories` and `./supabase`.
- Factories actually **live in `packages/constraint-engine/src/test-utils/`** (workspace, member, ingredient, recipe, recipe-ingredient, generate-menu-input) — exposed via engine's `./test-utils` sub-path export. `packages/test-utils` re-exports them. **Why this split** is in the "Observed issue" section below.
- `packages/test-utils/src/supabase/mock.ts` — a Proxy-based chainable that records each call and resolves to a configured `{ data, error }`. Supports per-table results and a `resultBySteps` callback for tests that need to inspect what was called.
- Engine tests refactored to use the local factories — 31/31 still passing.

### B — CRUD-layer modules in `packages/supabase/src/module/`
- New: `tsconfig.json`, `vitest.config.ts`, expanded `package.json` (now ships TS source + has `typecheck` / `test` / `test:integration` scripts and depends on `@supabase/supabase-js`).
- `src/types/db.ts` — local row-shaped interfaces mirroring DATABASE_PRD enums. Marked as a placeholder for `supabase gen types typescript` output.
- One module per resource: `workspaces.ts`, `members.ts`, `recipes.ts`, `ingredients.ts`, `labels.ts`, `menus.ts`, `grocery.ts`, plus `auth.ts` for `getWorkspaceRole`/`hasAdminRole`.
- Each module exports both `xxxQueryKeys` (static for server-component prefetch) and `xxxKeys` (function-form for client `useQuery`) per query-patterns.md.
- Convention adopted: each function takes named-object params, returns data (or `null` for `.maybeSingle`-style misses), and **throws** on `error` — matches the React-Query queryFn contract.
- `.react.ts` companion files **deferred** — no UI consumers yet; building them now would be dead weight per CLAUDE/global-rules "don't design for hypothetical future requirements."

### C — Refactor existing route handlers to call CRUD modules
- 8 routes updated to consume `@weekly-food-planner/supabase`: `/api/me`, `/api/ingredients`, `/api/labels/search`, `/api/workspaces/[id]`, `/api/workspaces/[id]/recipes`, `/api/workspaces/[id]/recipes/[recipeId]`, `/api/workspaces/[id]/menus/active`, `/api/workspaces/[id]/grocery`.
- `apps/web/lib/api/auth-helpers.ts` now re-exports `getWorkspaceRole` + `hasAdminRole` from the supabase package while keeping the apps/web-specific `getAuthenticatedUser` (which wraps `supabaseServerClient` + `cookies()`).
- Added `apps/web/lib/api/route-helpers.ts` with `runWithErrorHandler({ fn })` so each route's try/catch boilerplate collapses to a single call.
- `/api/me` now returns workspaces the user is a *member* of (via `workspace_members`) rather than only those they *own* (`owner_id` query). Side-fix: the previous behavior was buggy for non-creator members.

### D — Member CRUD endpoints
- `apps/web/app/api/workspaces/[id]/members/route.ts` — `GET` (list), `POST` (create with optional initial dietary_restrictions / allergies / ingredient_dislikes).
- `apps/web/app/api/workspaces/[id]/members/[memberId]/route.ts` — `GET`, `PATCH` (admin OR self; role promotion still admin-only), `DELETE` (soft; blocks the creator).
- Three sub-resource PUT routes for whole-set replacement: `.../dietary-restrictions`, `.../allergies`, `.../ingredient-dislikes`. The first two auto-`sys_save_label` every value so user-typed extensions land in `enum_metadata`.
- `MemberRecord` in the supabase module now includes `user_id` so the route handler can enforce the "self or admin" guard in code, not just at the RLS layer.

### E — Postman collection — added "6. Members" folder
- 8 new requests covering the full member CRUD flow + sub-resource PUTs. Test scripts populate the new `member_id` collection variable (list-creator first, then create-recipient pattern).
- Discovered the collection lives at `scripts/weekly-food-planner-bruno.json`, not `postman/...` as agent-log/10 claimed — flagged below.

### F — Tests
- **Mocked unit tests (17 total across 4 supabase-module files + 7 in apps/web):**
  - `apps/web/lib/api/__tests__/menu-overlay.test.ts` — 7 tests covering silent dedup (drops dietary/allergy values already on members; passes through `ingredientExclusions`; returns `undefined` when everything filters out).
  - `packages/supabase/src/module/__tests__/labels.test.ts` — 5 tests: empty query skips `ilike`, non-empty query wraps in `%term%`, rpc/db errors throw.
  - `packages/supabase/src/module/__tests__/members.test.ts` — 5 tests: empty `setMemberX` arrays skip insert; `updateMember({})` rejects up front.
  - `packages/supabase/src/module/__tests__/recipes.test.ts` — 4 tests: `createRecipe` calls `sys_save_label` once per cuisine + once per dietary_tag; insert errors surface.
  - `packages/supabase/src/module/__tests__/grocery.test.ts` — 3 tests: null when no menu; throws on db error; joins menus → grocery_lists.
- **Real-DB integration tests (5 tests, skip cleanly when env unset):**
  - `_integration-helpers.ts` — `createIntegrationFixture` creates a service-role client, provisions a user via `auth.admin.createUser`, lets the `sys_create_workspace_on_signup` trigger create the workspace, returns `{ supabase, userId, workspaceId, cleanup }`.
  - `workspaces.integration.test.ts` — trigger creates one workspace + one creator; `listWorkspacesForUser` finds it; `updateWorkspace` persists.
  - `members.integration.test.ts` — full create → list → get → update → set dietary → set allergies → soft-delete cycle.
  - `recipes.integration.test.ts` — same full lifecycle for recipes including `sys_save_label` round-trip.
  - Gated by `SUPABASE_TEST_URL` + `SUPABASE_TEST_SERVICE_KEY`; without them the suites run with `describe.skipIf(...)` and `test:integration` script forces `RUN_INTEGRATION=1` for visibility.
- `apps/web` got its first vitest config — alias `@` → repo root, includes both `lib/**/*.test.ts` and `integration/**/*.test.ts` so future HTTP-layer tests have a home.

**Final test counts: engine 31 + supabase 17 + apps/web 7 = 55 passing; 5 integration tests skipped.** All four packages typecheck clean. `pnpm turbo run typecheck test` is green end-to-end.

## Observed issue

- **`packages/test-utils` ↔ `constraint-engine` cycle.** First cut put factories in `packages/test-utils` with `engine` as a dep and `test-utils` as engine's dev-dep — pnpm tolerated this with a warning but `pnpm turbo run typecheck test` rejected it ("cyclic dependency detected"). Resolved by moving the factory implementations into `packages/constraint-engine/src/test-utils/`, exposing them via a `./test-utils` sub-path export, and having `packages/test-utils` re-export from `@weekly-food-planner/constraint-engine/test-utils`. Engine tests now relative-import from `'../test-utils/index.js'` so engine has zero deps on `test-utils`. One-way edge, clean turbo graph. The cost: engine ships a few extra files in its package source (acceptable — they are tree-shakeable).
- **Engine production purity.** The engine main barrel deliberately does *not* re-export factories. Consumers reach them through `@weekly-food-planner/constraint-engine/test-utils`. Anyone importing the engine for `generateMenu` only gets production types.
- **Postman collection path mismatch.** agent-log/10 claimed `postman/weekly-food-planner.postman_collection.json` was created; the actual file is `scripts/weekly-food-planner-bruno.json`. Treated as a documentation bug in the prior log — kept the existing path and added the Members folder there. Worth noting for future agents reading log/10.
- **CRUD layer chose throw-on-error.** The query-patterns.md example shows `queryFn: () => getTeams({ supabase })` — implies React Query's "throw to signal failure" contract. Took that as canonical. Route handlers wrap each call in `runWithErrorHandler` to convert thrown errors to `500 server_error`. Distinct return shape `null` (vs. a thrown error) is reserved for "row not found" via `.maybeSingle()`.
- **Self-edit semantics.** The DB RLS allows a member to edit their own row (`user_id = auth.uid()`) OR an admin/creator to edit any row. Route handlers now mirror this at the application layer with a `target.user_id === user.id` check, so unauthorized PATCHes return `403` immediately instead of going to the DB and getting back "0 rows updated" with no error.
- **`MemberRecord` schema bump.** Adding `user_id` to the select was load-bearing for the self-edit check. Future Supabase-generated types should pick this up automatically once `pnpm db:gen:types` runs.
- **Proxy-based supabase mock.** Built as `createSupabaseMock({ user, rpc, from })` returning a `Proxy` whose every method records a `ChainStep` and resolves to the configured result when `then`'d. Works for the chained builder API without needing per-test wiring of `select/eq/order/maybeSingle/...`. Two extension points: `result` (static) and `resultBySteps(steps)` (callback for tests that need to assert on the chain).
- **Two integration-test prerequisites that weren't obvious:** the `sys_create_workspace_on_signup` trigger has to fire for the fixture to find a workspace, AND the service-role client has to be allowed to drive the trigger. Both are true in the existing migrations — tests will skip cleanly until someone exports the env vars and runs `pnpm db:start`.

## Follow-up fixes

- All chunks land green: `pnpm turbo run typecheck test` → 8 tasks, 8 successful. Engine 31/31, supabase 17/17 mocked (5 integration skipped), apps/web 7/7.
- Open work carried forward (none of these block resuming feature work):
  - Run `pnpm db:start` + export `SUPABASE_TEST_URL` and `SUPABASE_TEST_SERVICE_KEY` to actually exercise the integration suite once locally.
  - Generate Supabase TypeScript types via `pnpm db:gen:types`; the `packages/supabase/src/types/db.ts` placeholder + the manual row casts in `menu-loader.ts`, `menu-persistence.ts`, and each CRUD module can then collapse to one-line generics.
  - Build the `.react.ts` companions in `packages/supabase/src/module/` once the UI lands and there's an actual consumer for `useQuery({ queryKey: recipeKeys.list(workspaceId), ... })`.
  - Engine soft-constraint scoring + local-search refinement per ARCHITECTURE_PRD §6.1 (still greedy-only).
  - Per-member grocery splits + freshness-aware `scheduled_purchase_day` scheduling.
  - HTTP-layer integration tests in `apps/web/integration/` once a Next.js test-harness pattern is picked (e.g., `next/test` or invoking route handlers directly with a fake request). The hook is in place — `apps/web/vitest.config.ts` already globs `integration/**/*.test.ts`.
  - Fix the cross-doc `../.cursor/rules/agentic-rules.md` references in PRDs (still off-by-one after the `docs/PRD/` move).
  - Update agent-log/10's reference to the Postman path from `postman/...` to `scripts/weekly-food-planner-bruno.json`.
