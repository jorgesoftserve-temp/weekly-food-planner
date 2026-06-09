# MCP demo — executed walkthrough

A runnable companion to [`mcp-demo.md`](./mcp-demo.md). The structure doc explains *what* each
server does; this walkthrough *runs* the reliably-executable parts and shows the real output, then
lists the prerequisites for the servers that need external state (DB / dev server / tokens).

> All commands run from the repo root. Outputs below are captured verbatim from a real run
> (deterministic, so they reproduce).

## Part B — the custom context bridge (fully executable, offline)

The `mcp-context-bridge` package is self-contained (pure engine, no DB/network), so the whole
verify→refine demo runs in CI with no live model calls.

### 1. Tests — round-trip + verify→refine + experiment determinism

```sh
pnpm --filter @weekly-food-planner/mcp-context-bridge test
```

```
 ✓ src/__tests__/schema.test.ts        (7 tests)
 ✓ src/__tests__/round-trip.test.ts    (4 tests)
 ✓ src/__tests__/verify-refine.test.ts (2 tests)
 ✓ src/__tests__/experiment.test.ts    (3 tests)

 Test Files  4 passed (4)
      Tests  16 passed (16)
```

### 2. The comparison experiment (3 baseline runs vs 3 MCP runs)

```sh
pnpm --filter @weekly-food-planner/mcp-context-bridge experiment
```

```
=== MCP context-bridge experiment ===
config: {"runsPerFlow":3,"maxIterations":8,"agentSeeds":[1,2,3]}
baseline-module1   pass=0.67 meanIters=7 iterVar=2 iters=[8,8,5] distinctDiffs=3
mcp-bridge         pass=1    meanIters=4 iterVar=0 iters=[4,4,4] distinctDiffs=1
```

Writes the deliverable artifacts:
- [`packages/mcp-context-bridge/logs/agent-iteration-log.md`](../../packages/mcp-context-bridge/logs/agent-iteration-log.md) / `.jsonl`
- [`packages/mcp-context-bridge/logs/experiment-metrics.json`](../../packages/mcp-context-bridge/logs/experiment-metrics.json)
- [`packages/mcp-context-bridge/fixtures/context.{feasible,infeasible}.json`](../../packages/mcp-context-bridge/fixtures/)

Read the one-page analysis: [`comparison-report.md`](../../packages/mcp-context-bridge/docs/comparison-report.md).

### 3. The five verbs over real stdio MCP

```sh
# initialize → notifications/initialized → tools/list, piped to the server
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  | pnpm --filter @weekly-food-planner/mcp-context-bridge --silent start
```

Advertised tools (the five verbs):

```
"name":"sendContext"
"name":"requestAction"
"name":"receiveResult"
"name":"confirm"
"name":"rollback"
```

### 4. The verb flow, conceptually

```
sendContext(infeasible ctx) → requestAction(generate_menu) → receiveResult → verify: RED (no_valid_recipe)
   → rollback → [agent removes one unsatisfiable required tag] → sendContext(refined) → … ×3
   → receiveResult → verify: GREEN (14/14 slots) → confirm → acceptedSeed
```

## Part A — the six wired servers

Three need no setup beyond a session; the rest need external state. From a Claude Code session,
`/mcp` shows connection status for each.

| Server | Run the demo after… | Demo entry point |
|---|---|---|
| `menu` (custom) | nothing (engine half) / `MENU_MCP_USER_JWT` (workspace half) | `engine_validate_input` → `engine_generate_menu` (same input+seed ⇒ identical output) |
| `shadcn` | nothing | `search_items_in_registries "combobox"` → `get_add_command_for_items` |
| `supabase-local` | `pnpm --filter @weekly-food-planner/supabase db:start` | `query: SELECT count(*) FROM ingredients;` |
| `playwright` | `pnpm dev` | `browser_navigate http://127.0.0.1:3000/menu` → `browser_take_screenshot` |
| `supabase-remote` | set `SUPABASE_PROJECT_REF` + `SUPABASE_ACCESS_TOKEN` | `list_tables` → `get_advisors` |
| `figma` | set `FIGMA_API_KEY` | `get_figma_data <fileKey> <nodeId>` |

Full per-server tool lists, demos, and system-impact notes: [`mcp-demo.md`](./mcp-demo.md).

## What this demonstrates about system impact

- The **engine is deterministic** — same `(input, seed)` ⇒ identical menu — which is exactly what
  makes the bridge's "variance across runs" measurable (all variance is agent behaviour, not the
  engine).
- The bridge wraps that engine in a **suggest → verify → confirm/rollback** protocol without ever
  feeding AI output into the engine's decision path — the determinism contract is untouched.
- No MCP server in the repo mutates the database; the bridge has no DB/network surface at all.
