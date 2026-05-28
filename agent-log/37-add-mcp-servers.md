# Step 37 — Wire MCP servers (Supabase + shadcn + Vitest)

## Prompt used

[`prompts/37-add-mcp-servers.txt`](../prompts/37-add-mcp-servers.txt). Verbatim:

> Add MCP servers for the things agents query a lot:
> Supabase MCP — schema introspection, RLS policy listing, migration status (kills a lot of speculative grepping).
> shadcn MCP — component registry browsing for ui-component-builder.
> Vitest MCP — run + parse for ci-gate-runner and the test agents.
>
> @.cursor/rules/agentic-rules.md  we need to follow agentic rules for this prompt and the next ones so that we can keep track of the prompting history and claude info

## Context files provided

- [`.cursor/rules/agentic-rules.md`](../.cursor/rules/agentic-rules.md) — mandates the `/prompts`, `/agent-log`, `/docs` triad and the agent-log entry shape (prompt used, context, expected output, observed issue, follow-up fixes).
- [`docs/agentic/changelog/2026-05-26_initial-agentic-setup.md`](../docs/agentic/changelog/2026-05-26_initial-agentic-setup.md) — the previous changelog entry that explicitly deferred MCP server wiring as the "next session" item; lists the four candidates and the evaluation criteria.
- [`docs/agentic/architecture.md`](../docs/agentic/architecture.md) — layer #5 ("MCP servers — forthcoming") and the §"Forthcoming: MCP servers" tail section; both updated in this step.
- [`docs/agentic/README.md`](../docs/agentic/README.md) — layer diagram with "(forthcoming)" next to MCP; updated.

## Expected output

1. A repo-root [`.mcp.json`](../.mcp.json) wiring three MCP servers Claude Code auto-discovers on session start:
   - **supabase** — read-only mode, project-ref + access token via env vars.
   - **shadcn** — `shadcn@latest mcp` (built into the shadcn CLI the repo already uses for primitives).
   - **vitest** — `vitest-mcp-server@latest` with `VITEST_MCP_ROOT` pinned to the repo root.
2. Reference docs updated:
   - [`docs/agentic/architecture.md`](../docs/agentic/architecture.md) — layer #5 + tail section moved from "forthcoming" to "active", criteria reframed for evaluating the *next* MCP server (Playwright).
   - [`docs/agentic/README.md`](../docs/agentic/README.md) — diagram drops "(forthcoming)".
3. Root orientation updated:
   - [`CLAUDE.md`](../CLAUDE.md) — new "MCP servers" subsection in "Where to read more".
   - [`README.md`](../README.md) — Agentic collaboration section gains an MCP servers row.
4. Changelog entry [`docs/agentic/changelog/2026-05-26_mcp-servers.md`](../docs/agentic/changelog/2026-05-26_mcp-servers.md) explaining what landed, why each candidate was chosen, what's deferred. Index in [`docs/agentic/changelog/README.md`](../docs/agentic/changelog/README.md) updated.
5. Raw prompt persisted as [`prompts/37-add-mcp-servers.txt`](../prompts/37-add-mcp-servers.txt) and this agent-log entry.

## Observed issues

1. **Vitest MCP package name is not a single canonical project.** Multiple community packages claim the name (`vitest-mcp-server`, `vitest-mcp`, `@nrjdalal/vitest-mcp`). Picked `vitest-mcp-server@latest` because it's the most-downloaded npm name as of writing, but the package is community-maintained — first invocation may need verification, and the package can be swapped in `.mcp.json` without touching anything else. The `VITEST_MCP_ROOT` env var pins the run directory so the server doesn't drift to a sibling workspace.
2. **Supabase MCP requires two env vars users must export themselves** — `SUPABASE_PROJECT_REF` and `SUPABASE_ACCESS_TOKEN`. Documented in the changelog entry rather than hard-coded in `.mcp.json` (committing secrets is a non-starter). `--read-only` is on so that even if the token is over-privileged, agents can't mutate schema through the MCP path; schema changes still flow through [`supabase-migration-author`](../.claude/agents/supabase-migration-author.md) and the migration ritual.
3. **Playwright MCP not wired.** Deferred per the initial changelog note — E2E coverage doesn't exist yet, so the server has nothing to drive. Logged as the next candidate in the new changelog entry.
4. **No code paths exercise the servers yet.** This step wires the discovery, not the consumption. Agents will start using the tools opportunistically when the harness re-injects the system reminder listing MCP tools.

## Follow-up fixes

- None landed in this step — the change is config + docs only. No code touched, no tests run (nothing to run).
- Next session should validate each server boots: `claude mcp list` then a token-light invocation per server (e.g. Supabase schema listing on a throwaway query, shadcn `list_components`, vitest `run --reporter=json` on a single test file) and capture results in a follow-up agent-log entry.
- Agent files that benefit most (`supabase-migration-author`, `route-handler-engineer`, `ui-component-builder`, `vitest-integration-author`) should get a one-line "Prefer the `<server>` MCP tool over speculative grepping when available" guidance, but only after the servers are validated to work — premature to update the agent contracts before we know the tool surface.

## Files

New:
- [`.mcp.json`](../.mcp.json)
- [`prompts/37-add-mcp-servers.txt`](../prompts/37-add-mcp-servers.txt)
- [`agent-log/37-add-mcp-servers.md`](./37-add-mcp-servers.md) (this file)
- [`docs/agentic/changelog/2026-05-26_mcp-servers.md`](../docs/agentic/changelog/2026-05-26_mcp-servers.md)

Edited:
- [`docs/agentic/architecture.md`](../docs/agentic/architecture.md)
- [`docs/agentic/README.md`](../docs/agentic/README.md)
- [`docs/agentic/changelog/README.md`](../docs/agentic/changelog/README.md)
- [`CLAUDE.md`](../CLAUDE.md)
- [`README.md`](../README.md)

## Setup notes for the team

Before the MCP layer is useful, every dev needs the two Supabase env vars exported in the shell that launches Claude Code:

```sh
export SUPABASE_PROJECT_REF=<your-project-ref>
export SUPABASE_ACCESS_TOKEN=<personal-access-token-from-supabase-dashboard>
```

The `shadcn` and `vitest` servers need no credentials. After exporting the vars, restart Claude Code; it loads `.mcp.json` at session start. Run `/mcp` inside Claude Code to confirm the three servers are listed as connected.
