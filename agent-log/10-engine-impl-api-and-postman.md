# Step 10 — Constraint-engine implementation, full API surface (no UI), Postman collection, local runbook

## Prompt used

See [/prompts/10-phases-5-7-api-and-postman.txt](../prompts/10-phases-5-7-api-and-postman.txt).

Summary: the user wanted phases 5–7 finished, the whole app usable via API only (no UI dependency), a Postman collection to drive the testing, and explicit commands to bring the local DB + API loop up. I worked through four sub-phases in sequence, verifying each with typecheck / tests.

## Context files provided

- All five PRDs in `docs/PRD/` (post-step-09 state).
- All three cursor rules (`agentic-rules`, `global-rules`, `query-patterns`).
- The post-step-09 scaffold: foundation + engine skeleton + DB migrations + Next.js shell + auth flow.

## Expected output

### Phase 5 — test-utils
Folded into engine tests as inline factories — saved a per-package toolchain setup. `packages/test-utils` stays as a placeholder for the integration suite that'll arrive with the UI work.

### Phase 6 — constraint-engine implementation
- `src/slots.ts` — per-member slot generation; falls back to workspace `sharedMealFrequency` when a member has none. Deterministic day → mealKey → memberId sort.
- `src/filter.ts` — hard-constraint filtering: meal_type match, dietary tag union with overlay, ingredient-exclusion check, allergen string-match via `ingredient_allergens`.
- `src/assign.ts` — greedy walk with RNG-driven candidate selection. Surfaces `no_valid_recipe` with structured `affected_member_id` + `affected_meal` when a slot's candidate set is empty.
- `src/grocery.ts` — aggregation across all assigned recipes into a single shared list (per-member splits deferred).
- `src/generate.ts` — orchestrator replacing the step-02 placeholder; computes `inputs_hash` via `sha256OfInput`.
- `src/index.ts` — barrel updated.
- New tests: `slots.test.ts` (4), `filter.test.ts` (6), `generate.test.ts` (7). **Total engine: 31 tests passing across 7 files.**

### Phase 7 — API surface
Helpers under `apps/web/lib/api/`:
- `responses.ts` — JSON helpers (jsonOk, jsonError, unauthorized/forbidden/notFound/badRequest/serverError).
- `auth-helpers.ts` — `getAuthenticatedUser`, `getWorkspaceRole`, `hasAdminRole`.
- `admin-key.ts` — `x-admin-key` shared-secret check for `/api/admin/*`.
- `menu-loader.ts` — loads workspace + members + recipes + ingredients into the engine snapshot shape.
- `menu-overlay.ts` — silent dedup of overlay vs. member profiles (per PRODUCT_PRD §4.2).
- `menu-persistence.ts` — replace-on-regenerate transaction: soft-delete prior menu → insert new menu/slots/grocery/items + `generation_runs` audit row.

Route handlers under `apps/web/app/api/`:
- `me/route.ts` — current user + their workspaces.
- `ingredients/route.ts` — read the global catalog.
- `labels/search/route.ts` — debounced autocomplete over `enum_metadata`.
- `workspaces/[id]/route.ts` — GET (with members) + PATCH (name + shared_meal_frequency).
- `workspaces/[id]/recipes/route.ts` — list + create.
- `workspaces/[id]/recipes/[recipeId]/route.ts` — get + update + soft-delete.
- `workspaces/[id]/menus/route.ts` — POST generate (pre-checks + dedup + engine + persist).
- `workspaces/[id]/menus/active/route.ts` — GET the active menu (with slots).
- `workspaces/[id]/grocery/route.ts` — GET aggregated grocery for the active menu.
- `admin/seed-ingredients/route.ts` — idempotent upsert of ~30 ingredients + allergen tags (service-role; `x-admin-key` gated).
- `admin/seed-recipes/route.ts` — six starter recipes per workspace (service-role gated).
- `admin/confirm-user/route.ts` — local-dev only; flips `email_confirmed_at` so Postman can skip the verification email.

Env: `ADMIN_API_KEY` added to `apps/web/.env.example` for the admin gate.

### Phase 8 — Postman + runbook
- `postman/weekly-food-planner.postman_collection.json` — five folders (Setup, Workspace & catalog, Recipes, Menus & grocery, Labels), ~16 requests. Test scripts auto-populate `access_token`, `workspace_id`, `oats_ingredient_id`, `recipe_id`, `menu_id` as the user walks the folders top-to-bottom.
- `docs/LOCAL_DEV.md` — prerequisites, the install/start/configure/run sequence, Postman variables to fill in, the request-by-request flow, useful URLs (app, Studio, Inbucket, API), and reset commands.

## Observed issue

- **Engine MVP is greedy-only.** Soft-constraint scoring (variety, calorie balance, cuisine diversity, ingredient reuse) and local-search swap-pass refinement per ARCHITECTURE_PRD §6.1 are stubbed — the greedy uses the RNG to break ties between valid candidates. Hooks (`assignGreedy` signature, RNG injection, JSON-serializable boundary) are in place to swap in a stronger algorithm without API churn.
- **Per-member grocery splits deferred.** Everything lands on `shared`; the constraint-divergence case in PRODUCT_PRD §7 is detected at slot assignment time but not yet propagated to the grocery aggregator.
- **Freshness scheduling is null.** `scheduled_purchase_day` is always set to `null`; the engine has the data (`ingredient_allergens`-style join would be the same shape) but the algorithm is a follow-up.
- **No generated Supabase types yet.** `menu-loader.ts` uses local row-type interfaces and casts. Comment notes the cleanup path: run `pnpm db:gen:types` once the local stack is up and replace the manual types.
- **`sys_save_label` won't work from service-role.** It requires `auth.uid()` and raises otherwise. `seed-recipes` originally called it but had to drop the calls — the seed values are all official enum_metadata rows already, so no save is needed. Documented in the route file.
- **API has no integration tests yet.** Postman flow is the only end-to-end check. CI gates currently cover typecheck + engine unit tests.
- **`config.toml`'s `auth.email.enable_confirmations = true`** matches PRODUCT_PRD but slows down API testing. Addressed via the `/api/admin/confirm-user` endpoint rather than flipping the global setting.
- **Strict TS config friction** (mainly `noUncheckedIndexedAccess` + Supabase's untyped query responses) required explicit row-type casts in route handlers. Verbose but type-safe; will collapse to one-line generics once `db:gen:types` is integrated.

## Follow-up fixes

- All four sub-phases typecheck clean; the engine tests stayed at 31/31 across the implementation.
- Closing message handed the user exact local-run commands (corepack/npm → pnpm install → `pnpm db:start` → `db:status` → fill `.env.local` → `pnpm dev` → import Postman → run folders in order).
- Open future-work list captured in the closing message and reflected here in the gap notes above.
