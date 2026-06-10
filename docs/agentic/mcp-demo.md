# MCP servers — demo structure & system impact

A walk-through of **every MCP server wired into this repo**, what each one does, a small
runnable demo for each, and **how it impacts the system**. Source of truth for the wiring is
[`.mcp.json`](../../.mcp.json); the terse index lives in [`CLAUDE.md`](../../CLAUDE.md) and the
rationale in [`mcp-servers.md`](./mcp-servers.md).

> All six servers speak **stdio JSON-RPC** and are auto-discovered by Claude Code on session
> start. Run `/mcp` in a session to confirm connection. Five are third-party `npx` packages; one
> (`menu`) is custom and lives in this repo at [`apps/menu-mcp-server/`](../../apps/menu-mcp-server/).

## At a glance

| Server | Custom? | Auth | Mutates? | Primary impact on the system |
|---|---|---|---|---|
| `supabase-local` | third-party | none (local DB) | read (SQL) | Inspect the **local** dev DB without leaving the agent loop |
| `supabase-remote` | third-party | env vars | **read-only** | Introspect the **hosted** project (schema/RLS/advisors) |
| `shadcn` | third-party | none | no | Browse the component registry before hand-rolling UI |
| `playwright` | third-party | none (needs dev server) | drives browser | Drive/screenshot the running app; responsive checks |
| `figma` | third-party | `FIGMA_API_KEY` | no | Pull design frames for reference (dormant w/o token) |
| `menu` | **custom** | `MENU_MCP_USER_JWT` (workspace tools) | no (engine pure; HTTP via RLS) | Run the **deterministic engine** + workspace previews as tools |

The single most important system-impact fact: **no MCP server mutates the database.** Schema
changes always flow through the migration ritual (`supabase-migration-author` + a committed
migration), so the git history stays the audit log. `supabase-remote` is pinned `--read-only`,
and the custom `menu` server holds **no service-role key** — its workspace tools impersonate a
real member via a user JWT, so RLS bounds the blast radius.

---

## 1. `supabase-local` — ad-hoc SQL on the local dev DB

- **Package**: `@modelcontextprotocol/server-postgres`, pointed at `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.
- **Needs**: the local stack running — `pnpm --filter @weekly-food-planner/supabase db:start` (Docker).
- **Tool**: `query` (read SQL).

**Demo**

```text
# session prerequisite
pnpm --filter @weekly-food-planner/supabase db:start

# in a Claude Code session, /mcp shows supabase-local: connected
# then ask the agent to run, via the supabase-local `query` tool:
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1;
SELECT count(*) FROM ingredients;             -- e.g. confirm the 30-item seed landed
```

**System impact** — lets `vitest-integration-author` debug fixture state and
`route-handler-engineer` reproduce an RLS denial against real rows, instead of guessing from
the schema. Read-only by use; it is the *local* counterpart to `supabase-remote`.

---

## 2. `supabase-remote` — hosted-project introspection (read-only)

- **Package**: `@supabase/mcp-server-supabase@latest --read-only --project-ref=${SUPABASE_PROJECT_REF}`.
- **Auth**: `SUPABASE_PROJECT_REF` + `SUPABASE_ACCESS_TOKEN` env vars. Inert until a hosted
  project exists (the repo is local-only today — see [v3.md](../../.claude/plans/v3.md) D0).
- **Representative tools**: `list_tables`, `list_extensions`, `list_migrations`, `get_advisors`,
  `get_logs`, `execute_sql` (read-only), `generate_typescript_types`.

**Demo**

```text
export SUPABASE_PROJECT_REF=xxxx
export SUPABASE_ACCESS_TOKEN=sbp_xxxx

# /mcp → supabase-remote: connected, then ask the agent to:
#  - list_tables           → confirm the hosted schema matches local migrations
#  - get_advisors          → surface missing-index / RLS security advisories
#  - list_migrations       → verify `supabase db push` applied the full set
```

**System impact** — the introspection surface for the **hosted** deployment. `--read-only` is
enforced; any schema change still goes through `supabase-migration-author`. This is the server
v3's hosted-deploy phase finally activates.

---

## 3. `shadcn` — component registry browse

- **Package**: `shadcn@latest mcp` (built into the CLI the repo already uses).
- **Auth**: none.
- **Representative tools**: `list_items_in_registries`, `search_items_in_registries`,
  `view_items_in_registries`, `get_item_examples_from_registries`, `get_add_command_for_items`.

**Demo**

```text
# /mcp → shadcn: connected, then ask the agent to:
#  - search_items_in_registries "combobox"      → find the primitive
#  - view_items_in_registries  "combobox"       → read its source before composing
#  - get_add_command_for_items "combobox"       → returns: npx shadcn@latest add combobox
cd apps/web && npx shadcn@latest add combobox    # the canonical install path (CLI, not hand-rolled)
```

**System impact** — enforces non-negotiable #6 ("shadcn via CLI only"). `ui-component-builder`
checks the registry here before hand-rolling a primitive, keeping
[`apps/web/components/ui/`](../../apps/web/components/ui/) canonical.

---

## 4. `playwright` — drive & screenshot the running app

- **Package**: `@playwright/mcp@latest --isolated`.
- **Needs**: `pnpm dev` running at `http://127.0.0.1:3000`.
- **Representative tools**: `browser_navigate`, `browser_snapshot`, `browser_take_screenshot`,
  `browser_click`, `browser_type`, `browser_fill_form`, `browser_resize`, `browser_console_messages`.

**Demo**

```text
pnpm dev                                  # http://127.0.0.1:3000

# /mcp → playwright: connected, then ask the agent to:
#  - browser_navigate   http://127.0.0.1:3000/menu
#  - browser_resize     390x844            → mobile breakpoint check
#  - browser_snapshot                      → accessibility tree for ux/a11y review
#  - browser_take_screenshot               → visual diff of the draft/accept flow
```

**System impact** — the only server that *acts on* (not just reads) the system, by driving a
real browser. It is the substrate for `ux-reviewer` and `accessibility-auditor` pre-PR passes.
Wired and available; no agent exercises it in CI yet.

---

## 5. `figma` — design-frame reference (dormant)

- **Package**: `figma-developer-mcp --figma-api-key=${FIGMA_API_KEY} --stdio`.
- **Auth**: `FIGMA_API_KEY` (inert without it).
- **Tools**: `get_figma_data`, `download_figma_images`.

**Demo**

```text
export FIGMA_API_KEY=figd_xxxx

# /mcp → figma: connected, then ask the agent to:
#  - get_figma_data       <fileKey> <nodeId>   → pull a frame's layout/tokens for reference
#  - download_figma_images <fileKey> <nodeId>  → export assets for the design-system pass
```

**System impact** — feeds `design-system-architect` real frame data when a token is present.
Currently dormant; documented so the path is ready when design hands off Figma source.

---

## 6. `menu` — the custom engine + workspace server

The in-repo server at [`apps/menu-mcp-server/`](../../apps/menu-mcp-server/). Two tool halves:
**pure engine tools** (no auth, deterministic, in-process) and **workspace HTTP tools** (require
`MENU_MCP_USER_JWT`, call the Next.js API so RLS applies). Launched via
`pnpm --filter @weekly-food-planner/menu-mcp-server --silent start`.

| Tool | Half | What it does |
|---|---|---|
| `ping` | util | Liveness + whether `MENU_MCP_USER_JWT` is set |
| `engine_generate_menu` | engine | Runs `generateMenu` on a full `GenerateMenuInput` → `{ ok, menu, groceryLists, inputsHash }` or `{ ok:false, error }` |
| `engine_compute_inputs_hash` | engine | Canonical sha256 of the input — dedup/reproducibility check |
| `engine_validate_input` | engine | Pre-flight: members/recipes non-empty, slot count > 0, past-date probe |
| `workspace_preview_menu` | HTTP | `POST /menus/preview` — generate without persisting (what-if loops) |
| `workspace_member_constraints` | HTTP | `GET /members/:id/constraints` — the join the engine sees |
| `workspace_recipe_usability` | HTTP | `GET /recipes/:id/usability` — `{ eligible, blockedBy[] }` |
| `workspace_recent_menus` | HTTP | `GET /menus/history` — recent accepted menus for near-repeat checks |

**Demo (engine half — no auth, fully reproducible)**

```text
# /mcp → menu: connected. ping returns workspaceToolsConfigured:false without a JWT.
# Ask the agent to call engine_generate_menu with a hand-built or preview-sourced input:
engine_validate_input   { input }      → { ok:true, slotCount:14, ... }
engine_generate_menu    { input, seed:42 }   → deterministic { ok:true, menu, inputsHash }
engine_generate_menu    { input, seed:42 }   → byte-identical output (determinism proof)
engine_compute_inputs_hash { input }    → same inputsHash as the generate call
```

**Demo (workspace half — requires a user JWT)**

```text
export MENU_MCP_USER_JWT=<supabase user JWT with admin role on a dev workspace>
export MENU_MCP_BASE_URL=http://127.0.0.1:3000      # default

# Ask the agent to call:
workspace_member_constraints { workspaceId, memberId }   → joined constraint picture
workspace_recipe_usability   { workspaceId, recipeId, memberId } → why a recipe is/ isn't eligible
workspace_preview_menu       { workspaceId, weekStartDate, seed } → no-persist preview
```

**System impact** — gives agents (`constraint-engine-engineer`, `route-handler-engineer`,
`vitest-integration-author`) a first-class handle on the **deterministic core** without
round-tripping through the UI. The engine half is the substrate the
[`mcp-context-bridge`](../../packages/mcp-context-bridge/) protocol experiment drives its
verify→refine loop against.

---

## Executed walkthrough — the offline context-bridge demo

The per-server demos above need external state (DB / dev server / tokens). The one part that runs
**fully offline and reproducibly** is the `mcp-context-bridge` package (pure engine, no DB/network),
so it's the demo to run when you want real output without setup:

```sh
pnpm --filter @weekly-food-planner/mcp-context-bridge test        # 16 tests: schema, round-trip, verify→refine, experiment
pnpm --filter @weekly-food-planner/mcp-context-bridge experiment  # 3 baseline runs vs 3 MCP-bridge runs
```

The experiment writes deterministic artifacts and prints the comparison (baseline `pass=0.67 meanIters=7`
vs bridge `pass=1 meanIters=4` — all variance is agent behaviour, since the engine is deterministic):
[`logs/experiment-metrics.json`](../../packages/mcp-context-bridge/logs/experiment-metrics.json),
[`docs/comparison-report.md`](../../packages/mcp-context-bridge/docs/comparison-report.md).

The five verbs the bridge advertises over real stdio MCP — `sendContext`, `requestAction`,
`receiveResult`, `confirm`, `rollback` — wrap the engine in a suggest → verify → confirm/rollback
protocol **without** feeding model output into the engine's decision path, so the determinism
contract is untouched:

```
sendContext(infeasible ctx) → requestAction(generate_menu) → receiveResult → verify: RED (no_valid_recipe)
   → rollback → [agent relaxes one unsatisfiable required tag] → sendContext(refined) → …
   → receiveResult → verify: GREEN (14/14 slots) → confirm → acceptedSeed
```

## How the set impacts the system (summary)

- **Discovery over grepping** — agents introspect the DB (`supabase-*`), the registry (`shadcn`),
  the running app (`playwright`), and the engine (`menu`) directly, instead of speculative
  file reads.
- **Determinism preserved** — the `menu` engine tools are pure; same `(input, seed)` always
  yields the same output, which is what makes the bridge experiment measurable.
- **No mutation path** — every server is read/inspect/drive only; schema changes stay in
  committed migrations. Auth ranges from none → env-var creds → bearer JWT, never a
  service-role key in an agent's hands.
- **CI gap (known)** — [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) runs
  `typecheck` + `test` and does **not** boot MCP servers. MCP is interactive tooling; the
  closest CI coverage is the `menu` server's own unit tests and the
  `mcp-context-bridge` round-trip + verify→refine suite.
