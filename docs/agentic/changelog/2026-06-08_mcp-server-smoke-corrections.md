# 2026-06-08 — MCP server smoke + corrections

A pre-commit smoke pass on the wired MCP servers surfaced three issues. This entry records the fixes and adds a reusable smoke driver so the same drift can't ship again.

## What changed

### New: [`scripts/smoke-mcp.mjs`](../../../scripts/smoke-mcp.mjs)

Stdio JSON-RPC handshake driver. Reads `.mcp.json`, performs `initialize` → `notifications/initialized` → `tools/list` against the named server (or `--all`), prints server name / version / tool count / tool names, exits non-zero on any protocol or transport error. Run before committing changes to `.mcp.json` or any server's launch command.

```sh
node scripts/smoke-mcp.mjs menu              # one server
node scripts/smoke-mcp.mjs shadcn supabase-local
node scripts/smoke-mcp.mjs --all             # everything in .mcp.json
```

The driver substitutes `${VAR}` / `${VAR:-default}` placeholders in args and env from `process.env`, so missing creds surface as a real handshake failure rather than a silent skip.

### Edited: [`.mcp.json`](../../../.mcp.json)

Three corrections, listed by symptom:

1. **`menu` failed to boot** — `ERR_MODULE_NOT_FOUND: tsx`. The original launch command was `node --import tsx/esm ./apps/menu-mcp-server/src/index.ts`. Under pnpm, `tsx` is a devDep of the `@weekly-food-planner/menu-mcp-server` workspace only, not hoisted to repo root, so Node couldn't resolve it from `cwd=repo-root`. Changed to `pnpm --filter @weekly-food-planner/menu-mcp-server --silent start`, which runs inside the workspace's own resolution scope. Boot ~3.3s, all 8 tools register (ping + 3 engine + 4 workspace).
2. **`vitest` entry pointed at a non-existent npm package** — `npm error 404 Not Found - GET https://registry.npmjs.org/vitest-mcp-server`. No package by that name exists; the closest match is the community fork `@djankies/vitest-mcp` (single maintainer, not official). Entry removed. Agents run tests via `Bash(pnpm test)` — that's what they were doing anyway since the MCP path was never validated end-to-end.
3. **`supabase-local` vs `supabase-remote` were conflated in docs** — the two entries already coexisted in `.mcp.json`, but every doc reference described features of only one of them. `supabase-local` is generic `@modelcontextprotocol/server-postgres` (single `query` tool, no Supabase-feature awareness). `supabase-remote` is `@supabase/mcp-server-supabase --read-only` (schema, RLS, migrations, advisors). Both kept; docs updated to describe each honestly.

### Edited: [`docs/agentic/mcp-servers.md`](../mcp-servers.md), [`docs/agentic/architecture.md`](../architecture.md), [`CLAUDE.md`](../../../CLAUDE.md), [`README.md`](../../../README.md)

Same correction applied to every catalog: split the supabase row into `-local` (generic Postgres `query`) and `-remote` (Supabase-feature MCP), drop the vitest row, leave shadcn + menu unchanged. The `mcp-servers.md` body now has separate per-server sections for `supabase-local` and `supabase-remote`, and the composition diagram routes the integration-test debugging path through `supabase-local` while the schema-introspection path goes through `supabase-remote`.

### Edited: [`docs/agentic/changelog/2026-05-26_mcp-servers.md`](./2026-05-26_mcp-servers.md)

Appended a "2026-06-08 — Correction" footer pointing forward to this entry. The historical body is left intact — the entry described what landed on that date; the correction tracks the gap between that snapshot and reality.

### Edited: [`docs/agentic/changelog/README.md`](./README.md)

Index gains this entry at the top.

## Why each correction was right

**Menu launch fix.** The previous form would have failed in any real `/mcp` session — the smoke caught a bug that was lurking behind never having been booted. `pnpm --filter` is the durable answer because it inherits the workspace's resolution scope automatically; adding `tsx` to root devDeps would have worked too but couples the root package to a binary it doesn't otherwise need.

**Drop the vitest entry.** The original [`2026-05-26_mcp-servers.md`](./2026-05-26_mcp-servers.md) flagged this as the weakest link of the three baseline servers ("Calling this out as the weakest link of the three — see follow-ups"). The follow-up note specifically said: "If `vitest-mcp-server` proves flaky or unmaintained, swap in `@nrjdalal/vitest-mcp` or fall back to the existing `Bash(pnpm -r test)` path. The agent files don't yet reference MCP, so the swap is local to `.mcp.json`." Since no agent file references the vitest MCP today, removal is the path of least surface area. If a structured test runner proves necessary later, a new entry can wire one in.

**Keep both supabase servers, document honestly.** Local SQL probing during fixture debugging and hosted Supabase-feature introspection during migration authorship are genuinely different jobs — collapsing them under one MCP entry would lose the local-DB read path the integration-test agents need. The correction is purely a documentation accuracy fix; no `.mcp.json` change beyond the corrections above.

## Cross-references

- [`mcp-servers.md`](../mcp-servers.md) — now the canonical catalog. Updated lineup table, per-server sections, composition diagram, and boundary conventions (new "smoke before commit" rule).
- [`architecture.md`](../architecture.md) — layer #5 description updated to name all four servers correctly; full MCP table at the bottom updated to match.
- [`scripts/smoke-mcp.mjs`](../../../scripts/smoke-mcp.mjs) — new reusable driver; covered by `## Smoke before commit` in [`mcp-servers.md`](../mcp-servers.md#boundary-conventions).

## Forward-looking notes

### Validation pass (still pending)

The 2026-05-29 entry left "boot the server end-to-end against `/mcp` in a real Claude Code session" as a deferred validation step. The handshake-level smoke this entry adds is necessary but not sufficient — `workspace_*` tools also need a real `MENU_MCP_USER_JWT` to confirm the bearer-JWT flow works against a running Next.js app. That validation pass is still deferred to the next session.

### Per-agent contract updates (still deferred)

The 2026-05-26 entry deferred "Prefer the `<server>` MCP for X" single-line nudges in each agent's contract until validation passed. That deferral stands. The vitest agent contract update is now permanently moot (server removed). The remaining surgical edits are:

- [`supabase-migration-author.md`](../../../.claude/agents/supabase-migration-author.md) — "Prefer the `supabase-remote` MCP for schema and RLS introspection."
- [`route-handler-engineer.md`](../../../.claude/agents/route-handler-engineer.md) — same + add "use `supabase-local` for ad-hoc SQL during RLS-denial reproductions."
- [`ui-component-builder.md`](../../../.claude/agents/ui-component-builder.md) — "Prefer the `shadcn` MCP to confirm a primitive exists in the registry."
- [`constraint-engine-engineer.md`](../../../.claude/agents/constraint-engine-engineer.md) — "Use the `menu` MCP's `engine_validate_input` for pre-flight checks on hand-authored snapshots."

### Why no env-var smoke for `supabase-remote`

The smoke driver intentionally surfaces missing-env failures as real handshake failures so the developer notices, but `SUPABASE_PROJECT_REF` / `SUPABASE_ACCESS_TOKEN` aren't always set in every shell. A `--skip-missing-env` flag could be added; left as a follow-up so the smoke is loud by default.
