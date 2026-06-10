# CLAUDE.md — Weekly Food Planner

Token-efficient orientation for Claude Code. **Load the PRDs only when the task needs them** — this file is intentionally short so it can ride in every session without bloat.

## What this repo is

A Turborepo monorepo for a constraint-based weekly menu planner. Deterministic engine, Supabase backend, Next.js App Router frontend. The product, architecture, technical, and database specs live under [`docs/PRD/`](./docs/PRD/) — read on demand, not by default.

## Stack at a glance

- **App**: Next.js 15 (App Router) + React 19 + TypeScript + Tailwind + shadcn/ui
- **State**: TanStack Query for server data, Zustand for ephemeral UI state only
- **Forms**: react-hook-form + Zod via shadcn `Form` primitives
- **DB**: PostgreSQL via Supabase (Auth + RLS + Storage), migrations via Supabase CLI
- **Engine**: pure TS, deterministic, no I/O — [`packages/constraint-engine`](./packages/constraint-engine/)
- **Testing**: Vitest (unit + integration), Node ESM driver for E2E via [`scripts/verify-flow.mjs`](./scripts/verify-flow.mjs)
- **Tooling**: Turborepo, pnpm workspaces

## The non-negotiables

Most session pain comes from violating one of these. Re-read before generating code.

1. **Three Supabase clients, never anything else** — `supabaseClient` ([client.ts](./apps/web/utils/supabase/client.ts)) for browser, `supabaseServerClient` ([server.ts](./apps/web/utils/supabase/server.ts)) for RSC/route handlers/server actions, `supabaseAdminClient` ([admin.ts](./apps/web/utils/supabase/admin.ts)) for privileged work. Never use `@supabase/auth-helpers-nextjs`.
2. **Types via the package barrel** — `import { ... } from "@weekly-food-planner/supabase"`. Never reach into `packages/supabase/src/...` directly.
3. **RO-RO everywhere** — Receive an Object, Return an Object. Named params, typed inputs and outputs.
4. **Fat-arrow functions**, one export per file, kebab-case file names.
5. **Tailwind layout** — `flex` + `gap-*` over `margin-*` / `space-*`.
6. **shadcn/ui via CLI only** — `npx shadcn@latest add <component>`. Never hand-roll a primitive that exists in the registry. Primitives live in [`apps/web/components/ui/`](./apps/web/components/ui/).
7. **Next.js 15 async APIs** — `await params`, `await cookies()`, `await headers()` in route handlers, pages, and server components.
8. **Migrations** — `cd packages/supabase && npx supabase migration new <file_name>`. Naming: `[timestamp]_[type]_[action]_[subject]_[modifier].sql` where type is one of `sys_` / `enum_` / `tbl_` / `trg_` / `rls_` / `fn_` / `idx_`. Order: functions → enums → tables → RLS enable → RLS policies (RLS lives in the same file as the RPC it gates).
9. **Constraint engine purity** — no `Date.now()`, `new Date()`, `Math.random()`, `crypto.randomUUID()`. Seeded RNG only, injected. Inputs and outputs must JSON-round-trip.
10. **Soft delete is the default** — `workspaces`, `workspace_members`, `recipes`, `menus` all carry `is_deleted`. Read policies filter `is_deleted = false`. Unique constraints become partial.

## Where to read more

- Project rules: [`.cursor/rules/global-rules.md`](./.cursor/rules/global-rules.md), [`.cursor/rules/query-patterns.md`](./.cursor/rules/query-patterns.md), [`.cursor/rules/agentic-rules.md`](./.cursor/rules/agentic-rules.md)
- PRDs: [`docs/PRD/OVERVIEW_PRD.md`](./docs/PRD/OVERVIEW_PRD.md), [`PRODUCT_PRD.md`](./docs/PRD/PRODUCT_PRD.md), [`ARCHITECTURE_PRD.md`](./docs/PRD/ARCHITECTURE_PRD.md), [`DATABASE_PRD.md`](./docs/PRD/DATABASE_PRD.md), [`TECHNICAL_PRD.md`](./docs/PRD/TECHNICAL_PRD.md)
- Agentic reference docs: [`docs/agentic/`](./docs/agentic/) — full catalogs ([`agents.md`](./docs/agentic/agents.md), [`skills.md`](./docs/agentic/skills.md), [`claude-md.md`](./docs/agentic/claude-md.md)), [`architecture.md`](./docs/agentic/architecture.md), [`extending.md`](./docs/agentic/extending.md), and a dated [`changelog/`](./docs/agentic/changelog/)
- Per-area CLAUDE.md — load contextually when editing that area:
  - [`apps/web/CLAUDE.md`](./apps/web/CLAUDE.md) — Next.js + React Query + Zustand + shadcn conventions
  - [`packages/constraint-engine/CLAUDE.md`](./packages/constraint-engine/CLAUDE.md) — determinism contract
  - [`packages/supabase/CLAUDE.md`](./packages/supabase/CLAUDE.md) — migrations + SQL style + module hooks

## Agents available to delegate to

Defined under [`.claude/agents/`](./.claude/agents/). Delegate work to these instead of doing everything in the parent session:

Terse index — the source files under [`.claude/agents/`](./.claude/agents/) are authoritative (full scope, model tier, hand-offs); [`docs/agentic/agents.md`](./docs/agentic/agents.md) covers how to invoke + agent-file structure.

| Agent | When |
|---|---|
| `design-system-architect` | Design tokens, gradients, fonts, accents — owns globals.css + Tailwind + docs/design/ |
| `ui-component-builder` | New UI under apps/web/components/ or feature `_components/` |
| `supabase-migration-author` | Any schema change (tables, columns, enums, RLS, RPCs, triggers, indexes) |
| `supabase-module-author` | Data-layer modules + hooks (`module/<table>.ts` + `.react.ts` + barrel) |
| `route-handler-engineer` | Handlers under apps/web/app/api/ + server actions; menu pipeline |
| `constraint-engine-engineer` | Any edit inside packages/constraint-engine/ (model: opus) |
| `determinism-snapshot-curator` | Engine golden snapshots + regression suite (model: opus) |
| `vitest-integration-author` | New `.integration.test.ts` (CRUD + RLS + role matrix) |
| `ux-reviewer` | Pre-PR product-UX review (read-only) |
| `accessibility-auditor` | Pre-PR a11y review — keyboard, ARIA, contrast (read-only) |
| `design-parity-auditor` | Post-promotion check that a live screen matches its `/design-lab` mock (read-only, Playwright) |
| `prd-aligner` | PRD↔code drift punch list (read-only, model: haiku) |
| `prd-author` | Write/update the PRDs (docs/PRD/*.md) for shipped or planned features — build-capable counterpart to prd-aligner |

## MCP servers available

Wired via [`.mcp.json`](./.mcp.json) at the repo root. Claude Code auto-discovers on session start; run `/mcp` to confirm connection.

Terse index — wiring (packages/args/env) lives in [`.mcp.json`](./.mcp.json); boundary conventions + a worked demo in [`docs/agentic/mcp-servers.md`](./docs/agentic/mcp-servers.md) and [`docs/agentic/mcp-demo.md`](./docs/agentic/mcp-demo.md).

| Server | Use for | Auth |
|---|---|---|
| `supabase-local` | Ad-hoc Postgres SQL on the local dev DB (`:54322`) | none — needs `db:start` |
| `supabase-remote` | Hosted-project introspection (schema/RLS/advisors), read-only | env vars |
| `shadcn` | Component registry browse (list / demo / source) | none |
| `playwright` | Drive / screenshot the running app; responsive checks | none — needs dev server |
| `figma` | Pull Figma frames for reference; dormant until a token is set | `FIGMA_API_KEY` |
| `menu` | Engine + workspace menu-generation tools | `MENU_MCP_USER_JWT` (workspace tools) |

Prefer these over speculative grepping when the data lives in the database or registry.

## Agent skills available

Defined under [`.claude/skills/`](./.claude/skills/) (project-local) and the user's global skills directory. Terse index — full input schemas + worked examples live in each [`.claude/skills/<name>/SKILL.md`](./.claude/skills/); [`docs/agentic/skills.md`](./docs/agentic/skills.md) covers how to invoke + the skill-vs-agent decision.

- `menu-generation-impact-review` — layered impact plan before any engine/route/persistence/grocery change (no code).
- `constraint-menu-generator-life-cycle-test` — emits a Vitest + Node ESM flow test from a recipes + constraints spec.
- `supabase-add-column` — migration + types-regen + module-edit plan for adding column(s) to an existing table.
- `new-table-migration` — ordered migration set for a NEW table: enums + table (soft-delete, indexes, updated_at trigger) + RLS, types regen, module/PRD hand-offs.
- `add-module-and-hooks` — emits a new data-layer module pair (`.ts` + `.react.ts` + barrel) for an already-migrated table.
- `add-route-handler` — scaffolds a standard route handler / server action (three-client rule, Zod, error envelope, auth).
- `feature-folder-scaffold` — scaffolds a CRUD feature folder under `apps/web/app/(app)/<feature>/` (table + module must exist).
- `promote-design-lab-mock` — screen-by-screen plan to graduate a `/design-lab` mock into the live app (v1.8 Phase 3).
- `design-lab-parity-check` — Playwright capture matrix (live vs. mock at 390/820/1440px × light/dark) feeding the `design-parity-auditor` verdict.

## Commands worth remembering

```sh
# Install
pnpm install

# Start local Supabase (requires Docker)
pnpm --filter @weekly-food-planner/supabase db:start

# Dev server
pnpm dev                                       # http://127.0.0.1:3000

# Typecheck + unit tests across the workspace
pnpm typecheck && pnpm test

# Integration tests (requires running Supabase + env vars)
INTEGRATION_ENABLED=1 SUPABASE_TEST_URL=... SUPABASE_TEST_SERVICE_KEY=... pnpm test

# End-to-end HTTP driver
node scripts/verify-flow.mjs

# New migration
cd packages/supabase && npx supabase migration new <file_name>

# Add a shadcn component
cd apps/web && npx shadcn@latest add <component>
```

## What this file is NOT

- Not the PRD. Don't inline product or architecture detail here — link to PRDs and let the agent read on demand.
- Not the cursor rules. Those stay in [`.cursor/rules/`](./.cursor/rules/) and are still loaded by Cursor.
- Not a persona file. The "ship fast, never be lazy" framing from `global-rules.md` is intentionally not duplicated here — it adds tokens without changing behavior.
