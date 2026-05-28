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

| Agent | When |
|---|---|
| `ui-component-builder` | New UI under [`apps/web/components/`](./apps/web/components/) or any feature `_components/` |
| `route-handler-engineer` | New or modified handlers under [`apps/web/app/api/`](./apps/web/app/api/) and server actions |
| `supabase-migration-author` | Any schema change — new tables, columns, enums, RLS, functions, triggers, indexes |
| `vitest-integration-author` | New `.integration.test.ts` covering CRUD + RLS + role matrix |
| `constraint-engine-engineer` | Any edit inside [`packages/constraint-engine/`](./packages/constraint-engine/) |
| `determinism-snapshot-curator` | Engine golden snapshot updates and regression suite |
| `ux-reviewer` | Pre-PR review of UI flows against product UX expectations |
| `accessibility-auditor` | Pre-PR review for a11y compliance (keyboard nav, ARIA, contrast) |
| `prd-aligner` | Cross-checks code state against the PRDs, flags drift |

## MCP servers available

Wired via [`.mcp.json`](./.mcp.json) at the repo root. Claude Code auto-discovers on session start; run `/mcp` to confirm connection.

| Server | Use for | Auth |
|---|---|---|
| `supabase` | Schema introspection, RLS policy listing, migration status. Read-only. | `SUPABASE_PROJECT_REF` + `SUPABASE_ACCESS_TOKEN` env vars |
| `shadcn` | Component registry browsing (list / demo / source) for `ui-component-builder` | None |
| `vitest` | Run + parse JSON reporter for the test-authoring agents | None |

Prefer these over speculative grepping when the data lives in the database or registry. Setup + rationale: [`docs/agentic/changelog/2026-05-26_mcp-servers.md`](./docs/agentic/changelog/2026-05-26_mcp-servers.md).

## Agent skills available

Defined under [`.claude/skills/`](./.claude/skills/) (project-local) and the user's global skills directory:

- `constraint-menu-generator-life-cycle-test` — given a recipes + dietary-constraints spec, emits a Vitest integration test and a Node ESM HTTP driver.
- `menu-generation-impact-review` — given a proposed menu-generation feature, produces a layered impact review + implementation plan (no code). Invoke before scoping any change that touches the engine, route handler, persistence, or grocery recompute.
- `supabase-add-column` — emits a migration + types-regen + module-update plan for adding columns to existing Supabase tables. Invoke instead of having an agent re-derive the full multi-file change each time.
- `feature-folder-scaffold` — scaffolds a CRUD feature folder under `apps/web/app/(app)/<feature>/` matching the canonical members/recipes shape. Use when adding a new authenticated CRUD page whose underlying table + module already exist.

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
