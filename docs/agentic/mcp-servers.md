# MCP servers

Catalog of every MCP server wired into this repo: what each one does, who consumes it, and what a typical call looks like. Companion to [`agents.md`](./agents.md), [`skills.md`](./skills.md), and [`claude-md.md`](./claude-md.md).

All four servers are declared in [`.mcp.json`](../../.mcp.json) at the project root. Claude Code auto-discovers them on session start; `/mcp` confirms connection. The composition rationale (why MCP rather than agent prompts, read-only defaults, etc.) lives in [`architecture.md`](./architecture.md#mcp-servers). The smoke driver at [`scripts/smoke-mcp.mjs`](../../scripts/smoke-mcp.mjs) validates each server's stdio JSON-RPC handshake.

## The lineup

| Server | Source | What it gives the agent | Auth |
|---|---|---|---|
| `supabase-local` | `@modelcontextprotocol/server-postgres` (npx) | Generic Postgres connection to the local dev DB on `127.0.0.1:54322`. Single tool: `query`. Useful for ad-hoc SQL reads while iterating; does **not** know about RLS, migrations, or advisors. | None — connection string baked in. Requires local Supabase running (`pnpm --filter @weekly-food-planner/supabase db:start`). |
| `supabase-remote` | `@supabase/mcp-server-supabase` (npx, `--read-only`) | Supabase-feature introspection against the **hosted** project: schema, RLS policy listing, migration status, advisor checks. | `SUPABASE_PROJECT_REF` + `SUPABASE_ACCESS_TOKEN` |
| `shadcn` | `shadcn@latest mcp` (npx) | Component registry browsing — list / search / view / demo any shadcn primitive without re-grepping. | None |
| `menu` | Custom in-repo at [`apps/menu-mcp-server/`](../../apps/menu-mcp-server/) | 3 pure-engine tools + 4 workspace tools — see below. | `MENU_MCP_USER_JWT` (workspace half only) |

A `vitest` MCP server was originally wired but removed on 2026-06-08 — the configured npm package (`vitest-mcp-server`) does not exist. Agents fall back to running tests via `Bash(pnpm test)`, which is what they were doing anyway. See [`changelog/2026-06-08_mcp-server-smoke-corrections.md`](./changelog/2026-06-08_mcp-server-smoke-corrections.md).

## Per-server functionality

### `supabase-local` (generic Postgres)

**Functionality.** A single `query` tool against the local Supabase Postgres instance on `127.0.0.1:54322`. The package is `@modelcontextprotocol/server-postgres` — generic, not Supabase-aware. It does not know about RLS policies, migrations, or advisors; it just runs SQL.

**Who consumes it.** Any agent that needs an ad-hoc SQL read against local state — most often [`vitest-integration-author`](../../.claude/agents/vitest-integration-author.md) and [`route-handler-engineer`](../../.claude/agents/route-handler-engineer.md) when debugging a fixture or RLS denial reproduction.

**Example.** During a flaky-integration-test investigation, an agent runs `SELECT * FROM workspace_members WHERE workspace_id = '...'` to confirm the fixture seeded the row before the assertion fired. Faster than writing a one-off Vitest probe.

### `supabase-remote` (Supabase-feature MCP, read-only)

**Functionality.** Schema introspection (`list_tables`), RLS policy enumeration, migration status, advisor checks. All read-only by design — mutations stay on the migration ritual path so the change is auditable in git.

**Who consumes it.** [`supabase-migration-author`](../../.claude/agents/supabase-migration-author.md) and [`route-handler-engineer`](../../.claude/agents/route-handler-engineer.md).

**Example.** Before writing a migration to add a column, the migration-author calls the remote supabase MCP to confirm:

- the target table exists with the expected primary key,
- which RLS policies already gate it (so the new column gets matching policy coverage),
- whether soft-delete (`is_deleted`) is in use on the table (it is on `workspaces`, `recipes`, `menus`, `workspace_members`) so the partial-unique-index pattern is applied.

This replaces the old "grep through [`packages/supabase/migrations/`](../../packages/supabase/migrations/) and hope you found everything" pattern. **Requires** `SUPABASE_PROJECT_REF` + `SUPABASE_ACCESS_TOKEN` exported in the shell that launches Claude Code.

### `shadcn`

**Functionality.** List items in the registry, view a component's source, fetch the install command (`npx shadcn@latest add ...`), pull example usage.

**Who consumes it.** [`ui-component-builder`](../../.claude/agents/ui-component-builder.md).

**Example.** When building a new dialog or combobox surface, the ui-component-builder queries shadcn MCP for `dialog` / `combobox` / `command` primitives, copies the install command into the worklog, and uses the canonical example as the scaffold — guaranteeing we're not hand-rolling a primitive that already exists in the registry.

### `menu` (custom, in-repo)

**Functionality.** Two halves, snake_case tool names:

**Pure engine half** — runs the constraint engine in-process, no DB, no JWT needed:

- `engine_generate_menu` — full `GenerateMenuInput` → deterministic output.
- `engine_compute_inputs_hash` — `sha256OfInput` wrapper; useful for cache lookups.
- `engine_validate_input` — pre-flight: slot count, member / recipe / ingredient counts, detects `ALL_MEALS_PASSED` and similar pathologies.

**Workspace half** — bearer-JWT-authenticated HTTP calls back into the running Next.js app; **RLS still applies** because the JWT impersonates a real workspace member:

- `workspace_preview_menu` — POSTs `/menus/preview` (non-persisting engine run against the live snapshot).
- `workspace_member_constraints` — GETs `/members/:id/constraints` (joined profile + cascade-resolved frequency + dietary + allergies + dislikes).
- `workspace_recipe_usability` — GETs `/recipes/:id/usability?memberId=...` (returns `eligible` + `blockedBy[]` of structured blockers).
- `workspace_recent_menus` — GETs `/menus/history` for context-aware planning.

**Who consumes it.** [`constraint-engine-engineer`](../../.claude/agents/constraint-engine-engineer.md), [`route-handler-engineer`](../../.claude/agents/route-handler-engineer.md), [`vitest-integration-author`](../../.claude/agents/vitest-integration-author.md).

**Example flows.**

*"Why didn't recipe X make it into the menu?"* — the agent calls `workspace_recipe_usability` for that recipe + member and gets back something like:

```
{ eligible: false, blockedBy: [{ kind: "allergen_present", allergen: "peanut", ingredientId: "..." }] }
```

No more guessing; the engine itself explains the rejection via `describeRecipeEligibility` ([`packages/constraint-engine/src/filter.ts`](../../packages/constraint-engine/src/filter.ts)).

*"What does the menu look like if member A goes vegan next week?"* — the agent calls `workspace_preview_menu` with an overlay (`{ additionalDietaryRestrictions: ['vegan'] }`) and inspects the resulting slots without writing anything to history. The `/menus/preview` route ([`apps/web/app/api/workspaces/[id]/menus/preview/route.ts`](../../apps/web/app/api/workspaces/[id]/menus/preview/route.ts)) deliberately does NOT persist so what-if loops don't pollute drafts.

*Reproducing a constraint regression as a Vitest test* — see [`menu-constraint-regression.integration.test.ts`](../../apps/web/integration/menu-constraint-regression.integration.test.ts): same engine the MCP wraps, called directly through the lib pattern, asserting that adding a peanut allergy drops the peanut-noodles recipe with seed `1729` and week `2026-07-13`.

## How they compose in a typical session

```
parent session
  ├── reads CLAUDE.md (root + per-area)
  ├── delegates to a sub-agent ──► sub-agent calls MCP tools
  │       e.g. supabase-migration-author → supabase-remote MCP (schema/RLS check)
  │            vitest-integration-author → supabase-local  MCP (ad-hoc SQL probe)
  │            ui-component-builder       → shadcn          MCP (registry lookup)
  │            constraint-engine-engineer → menu            MCP (engine_validate_input)
  └── parent never directly pays the context cost of those tool calls
```

The point is **delegation + context isolation**: the parent session sees the sub-agent's final report, not the full schema dump or registry walk that produced it. Each MCP server collapses a class of repeated tool calls (grep, read, run, then re-parse) into a single structured call.

## Boundary conventions

- **No mutations through MCP.** `supabase-remote` is `--read-only`; `supabase-local` is the generic Postgres MCP whose `query` tool theoretically permits writes, but the agents are instructed to read-only against it (and the same migration-ritual rule applies — schema changes never go through MCP). The menu MCP's workspace half deliberately hits non-persisting routes (or read-only GETs).
- **JWT, never service-role.** The menu MCP impersonates a member so RLS applies — same auth contract real users have.
- **Snake_case tool names** on the menu server for broader client compatibility; the host adds an `mcp__menu__` prefix when surfacing them.
- **Smoke before commit.** Run `node scripts/smoke-mcp.mjs --all` to verify every server in `.mcp.json` can complete the JSON-RPC handshake and return its tool list. Catches package-rename and dependency-resolution issues before they reach a live session.

## Cross-references

- Wiring + initial three servers: [`changelog/2026-05-26_mcp-servers.md`](./changelog/2026-05-26_mcp-servers.md).
- Custom menu server (engine + workspace tools, route additions, regression suite): [`changelog/2026-05-29_menu-mcp-server.md`](./changelog/2026-05-29_menu-mcp-server.md).
- Smoke-driven corrections (dropped vitest entry, split supabase into local/remote, fixed menu launch command): [`changelog/2026-06-08_mcp-server-smoke-corrections.md`](./changelog/2026-06-08_mcp-server-smoke-corrections.md).
- Composition with the other agentic layers: [`architecture.md`](./architecture.md).
- Adding a new MCP server: [`extending.md`](./extending.md) and the criteria in [`architecture.md`](./architecture.md#when-to-add-a-new-mcp-server).
