# 2026-05-26 — MCP servers (Supabase + shadcn + Vitest)

Wires three Model Context Protocol servers into the repo so agents stop re-deriving what schema introspection, component registry, and test runners can hand them directly. Closes the deferred MCP-evaluation item from [`2026-05-26_initial-agentic-setup.md`](./2026-05-26_initial-agentic-setup.md).

## What changed

### New: [`.mcp.json`](../../../.mcp.json)

Project-root MCP config Claude Code reads on session start. Three servers:

| Server | Command | Purpose | Auth |
|---|---|---|---|
| `supabase` | `npx -y @supabase/mcp-server-supabase@latest --read-only --project-ref=${SUPABASE_PROJECT_REF}` | Schema introspection, RLS policy listing, migration status | `SUPABASE_ACCESS_TOKEN` env var |
| `shadcn` | `npx -y shadcn@latest mcp` | Component registry browsing (list components, fetch demos, fetch source) | None |
| `vitest` | `npx -y vitest-mcp-server@latest` | Run tests + parse JSON reporter output | None — `VITEST_MCP_ROOT` env var pins the working dir |

The Supabase server is hard-coded to `--read-only`. Schema changes still flow through [`supabase-migration-author`](../../../.claude/agents/supabase-migration-author.md) and the migration ritual — the MCP path is for *reading* state, not mutating it.

### Edited: [`docs/agentic/architecture.md`](../architecture.md)

Layer #5 changes from "forthcoming" to active. The §"Forthcoming: MCP servers" tail section is rewritten to describe what's wired today and to keep Playwright as the open candidate.

### Edited: [`docs/agentic/README.md`](../README.md)

Layer diagram drops the "(forthcoming)" tag from the MCP row.

### Edited: [`docs/agentic/changelog/README.md`](./README.md)

Index gains this entry at the top.

### Edited: [`CLAUDE.md`](../../../CLAUDE.md), [`README.md`](../../../README.md)

Root orientation files gain MCP server pointers so every session sees the three tools are available.

### Per the agentic rules

- Raw prompt persisted as [`prompts/37-add-mcp-servers.txt`](../../../prompts/37-add-mcp-servers.txt).
- Session log at [`agent-log/37-add-mcp-servers.md`](../../../agent-log/37-add-mcp-servers.md) with the prompt-used / context / expected output / observed issue / follow-up fixes structure from [`.cursor/rules/agentic-rules.md`](../../../.cursor/rules/agentic-rules.md).

## Why

The original changelog flagged "repeated tool calls today" as the primary evaluation criterion. Each of the three servers maps to a concrete pattern observed in the daily-edit agents:

1. **Supabase MCP** addresses speculative grepping by [`supabase-migration-author`](../../../.claude/agents/supabase-migration-author.md) and [`route-handler-engineer`](../../../.claude/agents/route-handler-engineer.md) — "does column X exist", "is RLS policy Y in place", "what does the current schema look like for table Z". Live introspection is faster than reading generated types after the last migration *should* have updated them.
2. **shadcn MCP** addresses the [`ui-component-builder`](../../../.claude/agents/ui-component-builder.md) loop of "does the registry have a primitive for this, what does the demo look like" — currently the agent either greps locally or asks the user to confirm. The MCP server returns canonical source from the registry on demand.
3. **Vitest MCP** addresses the future `ci-gate-runner` (deferred from the initial setup, still deferred) and the test-authoring agents. Today they run tests via `Bash(pnpm -F ...)` and parse stdout; the MCP server returns structured JSON.

Each clears the bar on (a) — removes repeated tool calls today. None expand capability the agents lacked; they just compress what already worked.

### Why these exact packages

| Server | Package | Why this one |
|---|---|---|
| supabase | `@supabase/mcp-server-supabase` | Official from Supabase. `--read-only` flag is well-supported and matches the safety posture we want. |
| shadcn | `shadcn@latest mcp` | Built into the shadcn CLI 3.x the repo already uses for primitives (`npx shadcn@latest add ...`). No new package to vet. |
| vitest | `vitest-mcp-server@latest` | Community-maintained, but the most-downloaded by this name. Calling this out as the weakest link of the three — see follow-ups. |

### Why read-only Supabase

Two reasons:

1. **RLS state changes are deeply consequential.** Even an accidental "drop policy" via an agent's tool call is hard to reverse without a fresh migration. The migration ritual exists specifically to keep RLS auditable in git.
2. **The migration agent already exists.** [`supabase-migration-author`](../../../.claude/agents/supabase-migration-author.md) is the right path for schema mutation. The MCP path duplicates discovery, not authorship.

## Cross-references

- [`architecture.md`](../architecture.md) — layer #5 now describes the wired state.
- [`agents.md`](../agents.md) — unchanged in this step; agent contracts get the "prefer MCP over grep" guidance only after the servers are validated.
- [`extending.md`](../extending.md) — unchanged; adding a fourth MCP server (e.g. Playwright) follows the same `.mcp.json` pattern.

## Forward-looking notes

### Next session: validation pass

Before agents are told to depend on the MCP servers, validate each boots and returns useful data:

```sh
# In the shell that launches Claude Code:
export SUPABASE_PROJECT_REF=<ref>
export SUPABASE_ACCESS_TOKEN=<token-from-supabase-dashboard>

# Then launch Claude Code and run:
/mcp                     # confirm all three connected
# Drive each server with a token-light call (in-conversation)
```

If `vitest-mcp-server` proves flaky or unmaintained, swap in `@nrjdalal/vitest-mcp` or fall back to the existing `Bash(pnpm -r test)` path. The agent files don't yet reference MCP, so the swap is local to `.mcp.json`.

### Agent-contract updates (deferred)

Once each server is validated, surgically update agent files with a single line each:

- [`supabase-migration-author.md`](../../../.claude/agents/supabase-migration-author.md): "Prefer the `supabase` MCP tool for schema introspection over reading generated types."
- [`route-handler-engineer.md`](../../../.claude/agents/route-handler-engineer.md): same — RLS / policy lookups.
- [`ui-component-builder.md`](../../../.claude/agents/ui-component-builder.md): "Prefer the `shadcn` MCP tool to confirm a primitive exists in the registry before hand-rolling or grepping `apps/web/components/ui/`."
- [`vitest-integration-author.md`](../../../.claude/agents/vitest-integration-author.md): "Prefer the `vitest` MCP tool to run a single test file during authoring."

Premature to do this now — the contract update only pays off once the tool surface is stable.

### Deferred (not in this step)

- **Playwright MCP** — still deferred. E2E coverage doesn't exist; nothing to drive.
- **A `ci-gate-runner` agent** — was deferred in the initial setup. The vitest MCP server makes this cheaper to build (structured test output), but the actual agent is still future work.
- **Per-agent MCP guidance** — see above. Single-line nudges per agent, gated on validation.

### Migration notes for the team

Two env vars must be set in the shell that launches Claude Code:

```sh
export SUPABASE_PROJECT_REF=<your-project-ref>
export SUPABASE_ACCESS_TOKEN=<personal-access-token>
```

Generate the access token from the Supabase dashboard → Account → Access Tokens. Read-only at the org level is sufficient; the `--read-only` MCP flag is a second layer.

`shadcn` and `vitest` servers need no credentials.

Existing agents and skills are unchanged. Anyone who doesn't export the env vars sees the supabase MCP server fail to connect but the other two still work and the repo's existing tools (Bash, Grep, Read) keep functioning as the fallback path.

---

## 2026-06-08 — Correction

A smoke pass on 2026-06-08 surfaced that this entry's `.mcp.json` snippet diverged from reality:

- The `vitest` row pointed at `vitest-mcp-server@latest`, which **does not exist** on the npm registry (404). The entry was removed.
- The original `supabase` row described features (RLS introspection, advisors) that belong to `@supabase/mcp-server-supabase`. Between this entry and the smoke pass, a second supabase entry (`supabase-local`, generic Postgres MCP) was added without a changelog. The current setup has both: `supabase-local` (generic SQL) and `supabase-remote` (the Supabase-feature server).
- The `menu` row (added by [`2026-05-29_menu-mcp-server.md`](./2026-05-29_menu-mcp-server.md)) used `node --import tsx/esm ...`, which failed because `tsx` is not hoisted to repo root under pnpm. Now invoked via `pnpm --filter`.

Full corrections + the smoke driver itself: [`2026-06-08_mcp-server-smoke-corrections.md`](./2026-06-08_mcp-server-smoke-corrections.md).
