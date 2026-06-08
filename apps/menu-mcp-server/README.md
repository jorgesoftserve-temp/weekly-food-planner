# @weekly-food-planner/menu-mcp-server

A custom Model Context Protocol server exposing the Weekly Food Planner's constraint engine and workspace state to Claude Code (and any MCP-compatible client) as first-class tools.

**Status:** scaffold — step 4 of the menu-mcp landing plan. Only the `ping` tool is registered; real `engine.*` and `workspace.*` tools land in steps 5 + 6. See [`agent-log/38-menu-mcp-server.md`](../../agent-log/38-menu-mcp-server.md) for the full plan.

## Why this exists

Two reasons agents currently re-derive every session:

1. **Constraint inspection** — "can member M eat recipe R, and if not why" needs a join across `member_dietary_restrictions`, `member_allergies`, `member_ingredient_dislikes`, `recipe_dietary_tags`, `recipe_ingredients`, `ingredient_allergens`. The existing `supabase` MCP exposes raw SQL; this server exposes the engine's own eligibility logic, so the answer matches what the menu generator would actually see.
2. **What-if generation** — agents need to call `generateMenu` with overlay variations to verify constraint enforcement, without writing rows. The `workspace.preview_menu` tool wraps `POST /menus/preview` (added in step 2 of the plan) for exactly this.

## Architecture (when complete)

```
┌──────────────────────── menu MCP server ────────────────────────┐
│                                                                 │
│  engine.* tools          workspace.* tools                      │
│  (in-process, pure)      (HTTP → Next.js app)                   │
│  ┌────────────────┐      ┌──────────────────────────────────┐   │
│  │ generate_menu  │      │ preview_menu                     │   │
│  │ compute_hash   │      │ member_constraints               │   │
│  │ validate_input │      │ recipe_usability                 │   │
│  └────────────────┘      │ recent_menus                     │   │
│        │                 │ assert_constraint (engine+HTTP)  │   │
│        ▼                 └──────────────────────────────────┘   │
│  @weekly-food-planner/                  │                        │
│  constraint-engine                      ▼                        │
│                          MENU_MCP_BASE_URL (default localhost)   │
│                          + MENU_MCP_USER_JWT (Bearer)            │
└─────────────────────────────────────────────────────────────────┘
```

The MCP server **never** holds a service-role key. It impersonates a real workspace member via a JWT, so RLS applies. This bounds blast radius and matches what an end user would experience.

## Environment variables

| Var | Required for | Default | Notes |
|---|---|---|---|
| `MENU_MCP_BASE_URL` | `workspace.*` | `http://127.0.0.1:3000` | Base URL of the running Next.js app. |
| `MENU_MCP_USER_JWT` | `workspace.*` | unset | Supabase user JWT with admin role on a dev workspace. Mint via Supabase CLI (`supabase auth tokens`) or the dashboard. `engine.*` tools work without this set; `workspace.*` tools return a "not configured" error. |

## Running locally

```sh
# Install (run once at the monorepo root):
pnpm install

# Start in dev mode — re-runs on src changes:
pnpm -F @weekly-food-planner/menu-mcp-server dev

# One-shot for stdio JSON-RPC drivers (e.g. .mcp.json):
pnpm -F @weekly-food-planner/menu-mcp-server start
```

## Wiring into `.mcp.json` (step 7)

Once steps 5 + 6 land, the project root `.mcp.json` will gain:

```json
"menu": {
  "command": "node",
  "args": ["--import", "tsx/esm", "./apps/menu-mcp-server/src/index.ts"],
  "env": {
    "MENU_MCP_BASE_URL": "${MENU_MCP_BASE_URL:-http://127.0.0.1:3000}",
    "MENU_MCP_USER_JWT": "${MENU_MCP_USER_JWT}"
  }
}
```

`node --import tsx/esm` runs the TS source directly without a build step — same workspace-resolution semantics as `apps/web`. Cold start is ~500ms vs ~150ms for compiled JS; that's a follow-up optimization once the API stabilises.

## Layout

```
apps/menu-mcp-server/
  src/
    index.ts        # MCP server bootstrap + tool registration
    http-client.ts  # bearer-JWT wrapped fetch for workspace.* tools
    schemas.ts      # zod input schemas (placeholder; filled in steps 5+6)
    tools/          # one file per tool (added in steps 5+6)
  package.json
  tsconfig.json
  README.md         # this file
```

## Tool surface (planned)

### engine.* (step 5 — pure, in-process)

| Tool | Input | Output |
|---|---|---|
| `engine.generate_menu` | `{ input: GenerateMenuInput, seed?: number }` | `GenerateMenuResult` |
| `engine.compute_inputs_hash` | `{ input: GenerateMenuInput }` | `{ inputsHash: string }` |
| `engine.validate_input` | `{ input: GenerateMenuInput }` | `{ ok, slotCount, issues[] }` |

### workspace.* (step 6 — HTTP-backed)

| Tool | Calls | Returns |
|---|---|---|
| `workspace.preview_menu` | `POST /api/workspaces/:id/menus/preview` | preview payload (no DB writes) |
| `workspace.member_constraints` | member + restriction joins | structured bundle |
| `workspace.recipe_usability` | `GET /api/workspaces/:id/recipes/:id/usability` | `{ eligible, blockedBy[] }` |
| `workspace.recent_menus` | `GET /api/workspaces/:id/menus/history` | menu summaries |
| `workspace.assert_constraint` | hybrid (engine + HTTP) | `{ pass, violations[] }` |

## Hand-offs

- Engine purity rules → [`packages/constraint-engine/CLAUDE.md`](../../packages/constraint-engine/CLAUDE.md)
- Route handlers consumed by `workspace.*` → [`apps/web/app/api/workspaces/[id]/menus/preview/route.ts`](../../apps/web/app/api/workspaces/[id]/menus/preview/route.ts), [`apps/web/app/api/workspaces/[id]/recipes/[recipeId]/usability/route.ts`](../../apps/web/app/api/workspaces/[id]/recipes/[recipeId]/usability/route.ts)
- Shared input builder → [`apps/web/lib/api/menu-input-builder.ts`](../../apps/web/lib/api/menu-input-builder.ts)
