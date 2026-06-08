# 2026-05-29 — Menu MCP server (custom, in-repo)

Adds a fourth MCP server — a custom in-repo runtime at [`apps/menu-mcp-server/`](../../../apps/menu-mcp-server/) that exposes the constraint engine and workspace-state inspection as first-class tools. Closes the "would benefit from a dedicated MCP" follow-up from [`2026-05-26_mcp-servers.md`](./2026-05-26_mcp-servers.md), and extends the menu-generation surface (steps 2 and 3 below) so agents can preview without persisting and inspect eligibility per-member.

## What changed

### New: [`apps/menu-mcp-server/`](../../../apps/menu-mcp-server/) — custom MCP runtime

| File | Purpose |
|---|---|
| [`package.json`](../../../apps/menu-mcp-server/package.json) | `@weekly-food-planner/menu-mcp-server`. Deps: `@modelcontextprotocol/sdk@^1`, `@weekly-food-planner/constraint-engine` (workspace), `zod@^4`. DevDeps: `tsx`, `typescript`, `vitest`. |
| [`tsconfig.json`](../../../apps/menu-mcp-server/tsconfig.json) | Extends repo base; outDir `./dist`, rootDir `./src`. |
| [`src/index.ts`](../../../apps/menu-mcp-server/src/index.ts) | `McpServer` (SDK 1.29) + `StdioServerTransport` bootstrap. Registers `ping` plus the seven tools below. |
| [`src/http-client.ts`](../../../apps/menu-mcp-server/src/http-client.ts) | Bearer-JWT-authenticated `fetch` wrapper. Reads `MENU_MCP_BASE_URL` (default `http://127.0.0.1:3000`) and `MENU_MCP_USER_JWT`. Throws `MenuMcpHttpError` on non-2xx. |
| [`src/schemas.ts`](../../../apps/menu-mcp-server/src/schemas.ts) | Zod input schemas. Permissive `.passthrough()` on the engine input — deep validation delegated to the engine. |
| [`src/tools/shared.ts`](../../../apps/menu-mcp-server/src/tools/shared.ts) | `ToolCallResult` envelope + `textResult()` helper. Every tool returns a single JSON-stringified text block. |
| [`src/tools/engine-*.ts`](../../../apps/menu-mcp-server/src/tools/) | Three engine.* tools: `engine_generate_menu`, `engine_compute_inputs_hash`, `engine_validate_input`. Pure — no DB, no network. |
| [`src/tools/workspace-*.ts`](../../../apps/menu-mcp-server/src/tools/) | Four workspace.* tools: `workspace_preview_menu`, `workspace_member_constraints`, `workspace_recipe_usability`, `workspace_recent_menus`. HTTP-backed via the http-client. |
| [`src/__tests__/`](../../../apps/menu-mcp-server/src/__tests__/) | 21 unit tests across 4 files. Handlers exported as pure functions; tests call them directly with mocked `httpRequest`. |
| [`README.md`](../../../apps/menu-mcp-server/README.md) | Architecture diagram, env vars, run commands, tool surface table. |

### New routes on [`apps/web/`](../../../apps/web/) backing the workspace.* tools

| Route | Method | Purpose |
|---|---|---|
| [`/api/workspaces/[id]/menus/preview`](../../../apps/web/app/api/workspaces/[id]/menus/preview/route.ts) | POST | Mirrors POST `/menus` (weekly) but returns the engine result WITHOUT persisting. `workspace_preview_menu` is the primary client. |
| [`/api/workspaces/[id]/recipes/[recipeId]/usability`](../../../apps/web/app/api/workspaces/[id]/recipes/[recipeId]/usability/route.ts) | GET | Per-recipe-per-member eligibility — returns the engine's structured `EligibilityBlocker[]` (meal_type_mismatch, missing_dietary_tag, excluded_ingredient, allergen_present). `workspace_recipe_usability` wraps it. |
| [`/api/workspaces/[id]/members/[memberId]/constraints`](../../../apps/web/app/api/workspaces/[id]/members/[memberId]/constraints/route.ts) | GET | One joined view of member profile + meal frequency cascade + dietary restrictions + allergies + ingredient dislikes. `workspace_member_constraints` wraps it. |

### New shared helper

- [`apps/web/lib/api/menu-input-builder.ts`](../../../apps/web/lib/api/menu-input-builder.ts) — `buildWeeklyEngineInput()`. Extracted from the inline weekly-mode block of `POST /menus` so both the persisting path and the new preview path call the same dedup + filter + frequency-cascade code. Eliminates drift risk between the two paths. Covered by 12 unit tests in [`menu-input-builder.test.ts`](../../../apps/web/lib/api/__tests__/menu-input-builder.test.ts).

### Engine extension (delegated to [`constraint-engine-engineer`](../../../.claude/agents/constraint-engine-engineer.md))

- [`packages/constraint-engine/src/filter.ts`](../../../packages/constraint-engine/src/filter.ts) — added `describeRecipeEligibility({ recipe, ctx, forMealType? })` returning structured `{ eligible, blockedBy: EligibilityBlocker[] }`. Reuses the same predicates `isRecipeValidForSlot` already uses but walks every check (no short-circuit) so callers see the full reason list. +71 lines. 8 new tests in [`filter.test.ts`](../../../packages/constraint-engine/src/__tests__/filter.test.ts). Golden snapshots untouched — the function is not called by `generateMenu`.
- [`packages/constraint-engine/src/index.ts`](../../../packages/constraint-engine/src/index.ts) — re-exports `describeRecipeEligibility`, `EligibilityBlocker`, `RecipeEligibilityResult`.

### `.mcp.json`, root docs

- [`.mcp.json`](../../../.mcp.json) — adds a fourth `menu` server invoked via `node --import tsx/esm ./apps/menu-mcp-server/src/index.ts`, with `MENU_MCP_BASE_URL` + `MENU_MCP_USER_JWT` plumbed through env.
- [`CLAUDE.md`](../../../CLAUDE.md), [`README.md`](../../../README.md), [`docs/agentic/architecture.md`](../architecture.md) — MCP server tables grow from three to four; the existing rationale paragraph now also points to this entry.
- [`docs/agentic/changelog/README.md`](./README.md) — indexes this entry.

### Constraint regression suite

- [`apps/web/integration/menu-constraint-regression.integration.test.ts`](../../../apps/web/integration/menu-constraint-regression.integration.test.ts) — three end-to-end tests:
  1. **allergen_present**: adding peanut allergy drops peanut-containing recipe; vegan fallback still picked.
  2. **missing_dietary_tag**: adding vegan restriction drops non-vegan recipe; vegan dinners still picked.
  3. **excluded_ingredient**: setting `ingredientExclusions: [mushroomId]` drops the mushroom recipe; non-mushroom vegan dinner still picked.

Gated on `INTEGRATION_ENABLED=1`. Uses [`createIntegrationFixture`](../../../packages/test-utils/src/integration/fixture.ts) and the lib helpers (`loadEngineSnapshot` + `generateMenu`) directly — same DB-driven pattern as [`mvp15-followups.integration.test.ts`](../../../apps/web/integration/mvp15-followups.integration.test.ts).

### Per the agentic rules

- Raw prompt persisted at [`prompts/38-menu-mcp-server.txt`](../../../prompts/38-menu-mcp-server.txt).
- Session log at [`agent-log/38-menu-mcp-server.md`](../../../agent-log/38-menu-mcp-server.md) — nine-step landing plan with prompt used / context files / expected output / observed issues / follow-up fixes per the [`.cursor/rules/agentic-rules.md`](../../../.cursor/rules/agentic-rules.md) structure.

## Why

The three baseline MCP servers (supabase, shadcn, vitest) gave agents broad introspection but nothing menu-specific. Two patterns showed up repeatedly across recent sessions:

1. **"What if I added this constraint" loops** — agents had to write a new menu through `POST /menus`, then mutate state, generate again, and clean up the resulting rows. Heavy. `workspace_preview_menu` collapses this to one tool call that runs the same engine path without writing.
2. **"Why is this recipe blocked for this member" inspection** — answering required either reading code or running multi-step SQL through the supabase MCP. `workspace_recipe_usability` and `workspace_member_constraints` wrap the engine's own predicate logic so the answer matches what the menu generator would actually see.

The engine half (`engine_*` tools) carries no DB or network and works in any environment — useful for offline determinism checks, hash-roundtrip verification, and pre-flight validation before a workspace_* call.

### Why not just use the supabase MCP for the workspace half?

Three reasons:

1. **The supabase MCP returns raw rows.** The menu generator's view is a *join* — member dietary restrictions UNION the overlay, recipe ingredients × ingredient allergens, etc. Asking the agent to assemble that join over multiple SQL calls is what the menu MCP exists to avoid.
2. **Engine logic lives in TypeScript, not SQL.** `describeRecipeEligibility` is the same predicate the assignment algorithm uses. Re-deriving it in SQL would invite drift the first time the engine adds a new check.
3. **Auth bounding.** The supabase MCP runs `--read-only` but can still introspect any RLS-readable table. The menu MCP authenticates as a real user, so RLS still scopes what's visible. Same blast-radius posture, narrower surface.

### Why a custom in-repo server instead of a published one?

The tools wrap project-specific code paths (`buildWeeklyEngineInput`, `describeRecipeEligibility`, route handlers under `/api/workspaces/[id]/`). Publishing a generic MCP would either inline these or fork them — both worse than keeping the source in-repo where it co-evolves with the routes and the engine.

### Why long-lived `MENU_MCP_USER_JWT` instead of a refresh-token flow?

Simpler v1. Supabase user JWTs default to 1h expiry; for dev use we bump the dev user's expiry on the local Supabase project. Refresh-token flow is a documented follow-up — flagged in [`agent-log/38-menu-mcp-server.md`](../../../agent-log/38-menu-mcp-server.md). Same trade-off the official `supabase-remote` MCP makes today with `SUPABASE_ACCESS_TOKEN`.

### Why `node --import tsx/esm` instead of compiled JS?

The constraint-engine package's `package.json` `"main"` points at TS source (`./src/index.ts`) so apps/web can import it directly via Next.js bundler resolution. A compiled MCP server would need the engine to also expose a `dist` entry through conditional `exports` — a bigger change touching the engine's `package.json`. `tsx/esm` lets the MCP import the engine's TS source directly. Cold start cost ~500ms vs ~150ms for compiled JS; acceptable for a once-per-session MCP boot. Optimisation deferred.

## Tool surface (today, version 0.1.0)

| Tool | Kind | Input | Returns |
|---|---|---|---|
| `ping` | utility | `{}` | `{ ok, pong, workspaceToolsConfigured }` |
| `engine_generate_menu` | engine (pure) | `{ input: GenerateMenuInput, seed?: number }` | `GenerateMenuResult` |
| `engine_compute_inputs_hash` | engine (pure) | `{ input }` | `{ inputsHash }` |
| `engine_validate_input` | engine (pure) | `{ input }` | `{ ok, slotCount, slotsIgnoringNowCount, memberCount, recipeCount, ingredientCount, issues[] }` |
| `workspace_preview_menu` | workspace (HTTP) | `{ workspaceId, weekStartDate, seed?, durationDays?, options?, participantMemberIds? }` | preview payload (`ok`, `mode:'preview'`, `inputsHash`, `menu`, `groceryLists`, ...) |
| `workspace_member_constraints` | workspace (HTTP) | `{ workspaceId, memberId }` | `{ ok, memberId, name, role, ageCategory, dailyCalorieTarget, mealFrequency, mealFrequencySource, dietaryRestrictions[], allergies[], ingredientDislikes[] }` |
| `workspace_recipe_usability` | workspace (HTTP) | `{ workspaceId, recipeId, memberId, mealType? }` | `{ ok, recipeId, memberId, mealType, forMealType, eligible, blockedBy[] }` |
| `workspace_recent_menus` | workspace (HTTP) | `{ workspaceId, limit? }` | `{ entries: [...] }` |

Tool names are snake_case (not dotted) for broader MCP client compatibility; the host adds the `mcp__menu__` prefix when exposing to agents.

## Cross-references

- [`docs/agentic/architecture.md`](../architecture.md) — MCP layer #5 grows to four servers.
- [`apps/menu-mcp-server/README.md`](../../../apps/menu-mcp-server/README.md) — env vars, run commands, `.mcp.json` snippet.
- [`agent-log/38-menu-mcp-server.md`](../../../agent-log/38-menu-mcp-server.md) — per-step prompt / context / observed / follow-up structure.

## Forward-looking notes

### Validation pass (next session)

The `tools/__tests__/` unit suite passes 21/21, but the server has not been booted end-to-end against `/mcp` in a real Claude Code session yet. Validate:

```sh
# In the shell that launches Claude Code:
export MENU_MCP_USER_JWT=<mint via Supabase dashboard or CLI>

# Then launch Claude and run:
/mcp                                         # confirm "menu" connected
mcp__menu__ping                              # confirm ok + workspaceToolsConfigured: true
mcp__menu__engine_validate_input { ... }     # token-light engine call
mcp__menu__workspace_recent_menus { ... }    # token-light workspace call
```

If `workspace_*` tools 401, the JWT is expired — re-mint. If the server fails to boot, check that `tsx` resolved through pnpm install (the `tsx/esm` import requires `tsx` in this workspace's `node_modules`).

### Deferred

- **`workspace_assert_constraint`** — was in the original plan as a bridge tool that takes `{ menuId }` or `{ input, result }` and asserts a kind of constraint. Punted: ambiguous menuId-vs-inline shape needed real usage data to settle, and the agent can inspect engine results directly without it.
- **Compiled-JS build** to drop cold-start from ~500ms to ~150ms. Either bundle (esbuild) or add `exports.default → ./dist/index.js` to the engine package and switch the menu MCP to `tsc`. Defer until cold start becomes a friction point.
- **Refresh-token JWT flow** instead of a long-lived dev token. Defer until the long-lived approach causes a real friction point.
- **Two regression scenarios not yet covered**: `meal_type_mismatch` (engine snapshots cover it) and `no_repeat_within_n_days` (soft-only, not enforced).
- **Per-agent contract updates** — wait for the validation pass before instructing `constraint-engine-engineer`, `route-handler-engineer`, and `vitest-integration-author` to prefer the `menu` MCP over their existing tool paths.

### Open candidate

- **Playwright MCP** — still deferred (no E2E coverage yet).
