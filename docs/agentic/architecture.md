# Agentic architecture

How the Weekly Food Planner's agentic toolchain composes. Reference for understanding why the layers exist and when each is the right fit.

## The five layers

1. **Cursor rules** — [`.cursor/rules/`](../../.cursor/rules/). Project-wide conventions consumed by both Cursor and Claude Code. Authored as `.md` with optional frontmatter (`alwaysApply: true` for global rules). Three files today: `global-rules.md` (TypeScript / React / Supabase / SQL), `query-patterns.md` (TanStack Query + Next.js hydration), `agentic-rules.md` (required folders for prompts/logs/docs).
2. **CLAUDE.md files** — root + per-package. Token-efficient orientation auto-loaded by Claude Code based on the working directory. Each is short and links out to PRDs / cursor rules rather than inlining them. See [`claude-md.md`](./claude-md.md).
3. **Sub-agents** — [`.claude/agents/`](../../.claude/agents/). Specialist roles the parent session can delegate to via the Agent tool. Each has a tight scope, frontmatter (`name`, `description`, `model`), operating rules, hand-off list, and output expectations. See [`agents.md`](./agents.md).
4. **Skills** — [`.claude/skills/`](../../.claude/skills/). Deterministic, multi-artifact emitters invoked by name. Each has a `SKILL.md` (with frontmatter), authoritative repo references, step-by-step workflow, non-negotiables, and at least one worked example under `docs/examples/`. See [`skills.md`](./skills.md).
5. **MCP servers** — [`.mcp.json`](../../.mcp.json) at the repo root. External capabilities exposed to Claude Code as tools. Four wired today: `supabase-local` (generic Postgres `query` against local dev DB), `supabase-remote` (read-only Supabase-feature MCP — schema, RLS, advisors), `shadcn` (component registry browsing), `menu` (custom in-repo). See [`mcp-servers.md`](./mcp-servers.md).

## When each layer is the right fit

```
┌──────────────────────┬──────────────────────────────────────────┐
│ Need                 │ Right layer                              │
├──────────────────────┼──────────────────────────────────────────┤
│ Project-wide rule    │ .cursor/rules/                           │
│ (always loaded)      │                                          │
├──────────────────────┼──────────────────────────────────────────┤
│ Per-area orientation │ CLAUDE.md (root or per-package)          │
│ (contextual load)    │                                          │
├──────────────────────┼──────────────────────────────────────────┤
│ Specialist role      │ Sub-agent                                │
│ exercising judgment  │                                          │
├──────────────────────┼──────────────────────────────────────────┤
│ Deterministic, repeated, │ Skill                                │
│ multi-artifact output    │                                      │
├──────────────────────┼──────────────────────────────────────────┤
│ External capability  │ MCP server                               │
│ (DB, registry, etc.) │                                          │
└──────────────────────┴──────────────────────────────────────────┘
```

## Skill vs. agent — decision criteria

Both can produce code or plans. The split is about **how repeatable the work is**:

| Pick a **skill** when | Pick an **agent** when |
|---|---|
| The work is a deterministic walk against a fixed checklist | Every invocation needs judgment |
| Output is multi-artifact and files must stay aligned | Output is a single file or small targeted edit |
| The pattern is repeated often (weekly+) | The work is rare enough to go stale as a template |
| Subtle failure modes worth catching mechanically | Mistakes are obvious and self-correcting |
| Output shape is well-defined (a report or a file set) | Output shape varies significantly per invocation |

Reference applications in this repo:

- `supabase-add-column` ticks all five → **skill**. Adding a column always walks the same artifacts.
- `route-handler-engineer` writes route handlers that vary widely (auth shape, validation rules, transaction boundaries, error contract) → **agent**.
- `menu-generation-impact-review` walks a 12-layer checklist to produce a structured plan → **skill**.
- `ux-reviewer` exercises product judgment against the PRDs to produce a punch list → **agent**.

When in doubt, prototype as an agent first. Promoting a recurring agent prompt to a skill is cheaper than scoping back a too-broad skill.

## How a typical session composes

```
parent session
  │
  ├── reads CLAUDE.md (root + per-package, contextual)
  ├── reads .cursor/rules/ (when Cursor; Claude Code reads on demand)
  │
  ├── for routine work: edits files directly
  │
  ├── for specialist work: Agent(subagent_type: "<agent-name>", ...)
  │       └── sub-agent has its own context window, returns a single message
  │
  ├── for deterministic emit: Skill(skill: "<skill-name>", args: "...")
  │       └── skill loads SKILL.md, walks the workflow, emits the artifacts
  │
  └── for external capability: MCP server tool call (supabase / shadcn / vitest)
```

Sub-agent context isolation is the key reason to delegate: it keeps PRD reads, schema inspection, and test scaffolding out of the parent's context window. The parent sees only the agent's final report.

## Token economics — why this structure exists

Before this setup, every session started with `@`-mentions of all five PRDs and the three cursor rules — ~4000+ lines of context before any work began. Two problems:

1. The model paid the tokenization cost on every turn, even when the task didn't need most of that context.
2. The prompt cache (5-minute TTL) was unevenly utilized because PRDs are static while session content churns.

The fix has three parts:

1. **CLAUDE.md** loads automatically and stays small (<150 lines each). Root + per-package = ~400 lines of context-light orientation. PRDs are linked, not inlined.
2. **Sub-agents** carry their own context. When the parent delegates schema work to `supabase-migration-author`, the parent doesn't pay the cost of the agent's reads.
3. **Skills** push static reference material (file paths, conventions, example shapes) into the skill file itself. Activating a skill replaces what would otherwise be repeated re-derivation in the conversation.

## Hand-off conventions

Every agent ends its file with a **"When to hand off"** section pointing to adjacent specialists. Every skill ends with a **"Hand-offs"** section in its report template. This is intentional: it lets the parent session chain work through the right specialists without re-deriving the routing each time.

Common chains:

- New feature scoped → [`menu-generation-impact-review`](../../.claude/skills/menu-generation-impact-review/SKILL.md) skill → identifies layers → parent invokes each agent in order.
- New schema → [`supabase-add-column`](../../.claude/skills/supabase-add-column/SKILL.md) skill OR [`supabase-migration-author`](../../.claude/agents/supabase-migration-author.md) agent → emits migration + TS patches → parent invokes [`route-handler-engineer`](../../.claude/agents/route-handler-engineer.md) for the API side → [`vitest-integration-author`](../../.claude/agents/vitest-integration-author.md) for the test → optionally [`ui-component-builder`](../../.claude/agents/ui-component-builder.md) for the UI surface.
- Pre-PR review → [`ux-reviewer`](../../.claude/agents/ux-reviewer.md) + [`accessibility-auditor`](../../.claude/agents/accessibility-auditor.md) + [`prd-aligner`](../../.claude/agents/prd-aligner.md) in parallel.

## What this architecture explicitly does NOT do

- **No global state across sessions.** Each new conversation starts fresh. The `memory/` system holds persistent facts about the user and feedback, but agents and skills are stateless.
- **No automatic chaining.** The parent session decides which agent to invoke next based on the previous one's report. Agents do not call other agents directly.
- **No magic file loading.** Only CLAUDE.md files in the working-directory hierarchy auto-load. Reference docs under [`docs/agentic/`](./) (this directory) and PRDs under [`docs/PRD/`](../PRD/) are loaded on demand via Read/Glob/Grep.

## MCP servers

Four servers wired via [`.mcp.json`](../../.mcp.json) at the repo root. Claude Code reads the file on session start and exposes each server as tools. The full catalog is in [`mcp-servers.md`](./mcp-servers.md); the table here is the at-a-glance view.

| Server | Purpose | Auth | Consuming agents |
|---|---|---|---|
| `supabase-local` | Generic Postgres MCP (`@modelcontextprotocol/server-postgres`) against local dev DB on `127.0.0.1:54322`. Single `query` tool — ad-hoc SQL only, not Supabase-aware. | None — needs local Supabase running | [`vitest-integration-author`](../../.claude/agents/vitest-integration-author.md), [`route-handler-engineer`](../../.claude/agents/route-handler-engineer.md) (debugging fixtures / RLS denials) |
| `supabase-remote` | Supabase-feature MCP (`@supabase/mcp-server-supabase`, `--read-only`) against the hosted project. Schema, RLS policies, migrations, advisors. | `SUPABASE_PROJECT_REF` + `SUPABASE_ACCESS_TOKEN` env vars | [`supabase-migration-author`](../../.claude/agents/supabase-migration-author.md), [`route-handler-engineer`](../../.claude/agents/route-handler-engineer.md) |
| `shadcn` | Component registry browsing (list, demo, source). | None | [`ui-component-builder`](../../.claude/agents/ui-component-builder.md) |
| `menu` | Custom server at [`apps/menu-mcp-server/`](../../apps/menu-mcp-server/). Engine half (`engine_generate_menu`, `engine_compute_inputs_hash`, `engine_validate_input`) wraps the constraint engine in-process. Workspace half (`workspace_preview_menu`, `workspace_member_constraints`, `workspace_recipe_usability`, `workspace_recent_menus`) talks to the running Next.js app via authenticated bearer JWT. | `MENU_MCP_USER_JWT` (workspace half only). `MENU_MCP_BASE_URL` optional, defaults to `http://127.0.0.1:3000`. | [`constraint-engine-engineer`](../../.claude/agents/constraint-engine-engineer.md), [`route-handler-engineer`](../../.claude/agents/route-handler-engineer.md), [`vitest-integration-author`](../../.claude/agents/vitest-integration-author.md) |

Read-only / non-mutating posture is intentional: schema mutations stay on the migration-ritual path through [`supabase-migration-author`](../../.claude/agents/supabase-migration-author.md) so the change is auditable in git. The `menu` server is non-mutating from the MCP side — `workspace_preview_menu` deliberately uses a no-persist route so what-if loops don't pollute history; persisting menu generation still flows through `POST /menus`.

A `vitest` MCP entry was removed on 2026-06-08 after smoke-testing revealed its npm package (`vitest-mcp-server`) does not exist. Agents run tests via `Bash(pnpm test)` instead. See [`changelog/2026-06-08_mcp-server-smoke-corrections.md`](./changelog/2026-06-08_mcp-server-smoke-corrections.md).

See [`changelog/2026-05-26_mcp-servers.md`](./changelog/2026-05-26_mcp-servers.md) for the initial baseline, [`changelog/2026-05-29_menu-mcp-server.md`](./changelog/2026-05-29_menu-mcp-server.md) for the custom menu server, and [`changelog/2026-06-08_mcp-server-smoke-corrections.md`](./changelog/2026-06-08_mcp-server-smoke-corrections.md) for the smoke-driven corrections.

### Open candidate

- **Playwright MCP** — deferred until E2E coverage lands. There's nothing to drive today.

### When to add a new MCP server

Evaluation criteria (carried from the initial setup):

1. Does it remove repeated tool calls today (grep / read patterns the agents perform every session)?
2. Does it give the agents capability they currently lack?
3. What's the security blast radius — does it need a read-only flag, scoped credentials, or both?

If a candidate clears all three, add it to [`.mcp.json`](../../.mcp.json), update the MCP row in [root `CLAUDE.md`](../../CLAUDE.md), and record the rationale in the commit message.
