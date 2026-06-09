# Weekly Food Planner

[![CI](https://github.com/jorgesoftserve-temp/weekly-food-planner/actions/workflows/ci.yml/badge.svg)](https://github.com/jorgesoftserve-temp/weekly-food-planner/actions/workflows/ci.yml)

Constraint-based weekly menu planner with reproducible, deterministic generation.

A Turborepo monorepo for the Recipe Manager & Constraint-Based Weekly Menu Planner. See [`docs/PRD/`](./docs/PRD/) for the product, architecture, technical, and database specifications.

## Stack

- **Frontend & backend**: Next.js (App Router) + React + TypeScript + Tailwind CSS + shadcn/ui
- **Server-state cache**: TanStack Query (React Query) — see [`.cursor/rules/query-patterns.md`](./.cursor/rules/query-patterns.md)
- **UI state**: Zustand (ephemeral state only — modals, drawers, form drafts)
- **Database**: PostgreSQL via Supabase (Auth + RLS + Storage)
- **Constraint engine**: pure TypeScript, deterministic — greedy assignment (soft-constraint scoring + local-search refinement per ARCHITECTURE_PRD §6.1 are on the follow-up list)
- **Testing**: Vitest for unit + integration; [scripts/verify-flow.mjs](./scripts/verify-flow.mjs) as the end-to-end HTTP driver (Playwright not yet wired up)
- **Orchestration**: Turborepo + pnpm workspaces
- **Local infrastructure**: Supabase CLI (Docker under the hood)

## Layout

```
apps/
  web/                  Next.js app (UI + route handlers + server actions)
packages/
  constraint-engine/    Deterministic menu generator (pure TS, no I/O)
  supabase/             Migrations, generated types, DB helpers, React Query hooks
                        + Supabase CLI config for local dev (supabase/)
  test-utils/           Integration fixture, factories, seeded RNG helpers
scripts/                One-off end-to-end drivers (verify-flow.mjs)
docs/PRD/               Product, architecture, technical, database PRDs
prompts/                Raw agent prompts (.txt)
agent-log/              Generation logs per major step (.md)
.claude/skills/         Custom skills (see "Agent skills" below)
.cursor/rules/          Project rules (Cursor + Claude)
.github/workflows/      CI (typecheck + test)
```

## Getting started

```sh
# Install pnpm if not already present
npm install -g pnpm@9.12.3

# Install dependencies
pnpm install

# Start local Supabase (Postgres + Auth + Storage). Requires Docker.
pnpm --filter @weekly-food-planner/supabase db:start

# Start the web app on http://127.0.0.1:3000
pnpm dev
```

Stopping the local stack: `pnpm --filter @weekly-food-planner/supabase db:stop`.

## UI

The Next.js app is organized into two route groups under [`apps/web/app/`](./apps/web/app/):

- `(auth)/` — public auth pages. [`login`](./apps/web/app/(auth)/login/page.tsx), [`signup`](./apps/web/app/(auth)/signup/page.tsx), [`verify-email`](./apps/web/app/(auth)/verify-email/page.tsx) (with one-click resend), [`verify-success`](./apps/web/app/(auth)/verify-success/page.tsx), [`forgot-password`](./apps/web/app/(auth)/forgot-password/page.tsx), [`reset-password`](./apps/web/app/(auth)/reset-password/page.tsx).
- `(app)/` — authenticated app, wrapped by [`layout.tsx`](./apps/web/app/(app)/layout.tsx) which provides the sidebar + header shell. The sidebar collapses to icons on desktop and slides in as a Sheet drawer below the `md:` breakpoint (≤768 px); a viewport export in [`apps/web/app/layout.tsx`](./apps/web/app/layout.tsx) wires the meta tag.
  - [`/dashboard`](./apps/web/app/(app)/dashboard/page.tsx) — landing after login. Includes a household members card that links into the dedicated members page.
  - [`/members`](./apps/web/app/(app)/members/page.tsx) — household members CRUD. Drawer-based create + edit ([`member-form-dialog.tsx`](./apps/web/app/(app)/members/_components/member-form-dialog.tsx) hosts [`member-form.tsx`](./apps/web/app/(app)/members/_components/member-form.tsx)) with dietary restrictions, allergies, ingredient dislikes, optional per-member meal-frequency override, and soft-delete (creator member is protected).
  - [`/recipes`](./apps/web/app/(app)/recipes/page.tsx) — list with create + edit. Editing the recipe opens a **right-side drawer** ([`edit-recipe-drawer.tsx`](./apps/web/app/(app)/recipes/_components/edit-recipe-drawer.tsx)); clicking the per-column View buttons (Dietary / Ingredients / Instructions, visible at `lg:` and up) opens a read-only [`recipe-detail-dialog.tsx`](./apps/web/app/(app)/recipes/_components/recipe-detail-dialog.tsx). New-recipe creation is a full-page route at [`/recipes/new`](./apps/web/app/(app)/recipes/new/page.tsx).
  - [`/menu`](./apps/web/app/(app)/menu/page.tsx) — generation creates a **draft** that must be reviewed and accepted before it becomes the workspace's active menu. The generate dialog now exposes a **"Cooking for & meal schedule"** panel for picking a subset of members the menu is for and per-member frequency overrides ([`participants-frequency-panel.tsx`](./apps/web/app/(app)/menu/_components/participants-frequency-panel.tsx)). Draft review supports replacing a slot ([`replace-slot-dialog.tsx`](./apps/web/app/(app)/menu/_components/replace-slot-dialog.tsx)), adding a new slot per day ([`add-slot-dialog.tsx`](./apps/web/app/(app)/menu/_components/add-slot-dialog.tsx)), discarding the draft, or accepting it. Acceptance assigns a deterministic `accepted_seed` to the final menu state and supersedes the previously accepted menu (which moves to history).
  - [`/menu/history`](./apps/web/app/(app)/menu/history/page.tsx) — list of accepted menus with engine seed, inputs hash, and accepted seed; flags whether the user modified any slots before acceptance.
  - [`/grocery`](./apps/web/app/(app)/grocery/page.tsx) — grocery list aggregated from the active menu, with markdown + CSV export from the page header and an [`ingredient-detail-dialog.tsx`](./apps/web/app/(app)/grocery/_components/ingredient-detail-dialog.tsx) that surfaces freshness rules, allergens, and which recipes use the ingredient this week. A **"Shop for"** chip picker ([`shop-for-picker.tsx`](./apps/web/app/(app)/grocery/_components/shop-for-picker.tsx)) lets the user narrow to a subset of the menu's participants; the shared list rescales by `selectedCount / participantCount` and per-member buckets filter to the selection. URL-synced via `?shop_for=`.

Route protection lives in [`apps/web/middleware.ts`](./apps/web/middleware.ts). Protected prefixes (`/dashboard`, `/members`, `/recipes`, `/menu`, `/grocery`) redirect to `/login?next=…` when the Supabase session cookie is missing; `next` is sanitized against open-redirect attacks.

## API

All routes are typed Next.js Route Handlers under [`apps/web/app/api/`](./apps/web/app/api/). Auth comes from the Supabase session cookie via `@supabase/ssr`; admin-only endpoints additionally require `x-admin-key`.

| Path | Methods | Purpose |
|---|---|---|
| [`/api/me`](./apps/web/app/api/me/route.ts) | GET | Current user + their workspaces |
| [`/api/ingredients`](./apps/web/app/api/ingredients/route.ts) | GET | Workspace-visible ingredient catalog |
| [`/api/labels/search`](./apps/web/app/api/labels/search/route.ts) | GET | Search the extensible label sets (cuisine, dietary tag, allergen) |
| [`/api/workspaces/[id]`](./apps/web/app/api/workspaces/[id]/route.ts) | GET, PATCH | Read or update a workspace (name, `shared_meal_frequency`) |
| [`/api/workspaces/[id]/members`](./apps/web/app/api/workspaces/[id]/members/route.ts) | GET, POST | List or create members |
| [`/api/workspaces/[id]/members/[memberId]`](./apps/web/app/api/workspaces/[id]/members/[memberId]/route.ts) | GET, PATCH, DELETE | Read, update, or soft-delete a member |
| [`/api/workspaces/[id]/members/[memberId]/{allergies,dietary-restrictions,ingredient-dislikes}`](./apps/web/app/api/workspaces/[id]/members/[memberId]/) | PUT | Replace a member's constraint set (each value funnelled through `sys_save_label` for the extensible-label types) |
| [`/api/workspaces/[id]/recipes`](./apps/web/app/api/workspaces/[id]/recipes/route.ts) | GET, POST | List or create recipes |
| [`/api/workspaces/[id]/recipes/[recipeId]`](./apps/web/app/api/workspaces/[id]/recipes/[recipeId]/route.ts) | GET, PATCH, DELETE | Read, update scalars, or soft-delete |
| [`/api/workspaces/[id]/recipes/[recipeId]/{ingredients,instructions,dietary-tags}`](./apps/web/app/api/workspaces/[id]/recipes/[recipeId]/) | PUT | Replace the array fields atomically (delete-then-insert) |
| [`/api/workspaces/[id]/menus`](./apps/web/app/api/workspaces/[id]/menus/route.ts) | POST | Build a menu DRAFT in one of three modes (`mode` body field). **`weekly`** (default): engine-generated, accepts `seed`, `durationDays` (1–7), `participantMemberIds` (subset of the household; omit = all active members), `options.memberFrequencyOverrides` (per-member meal-frequency override for this menu only), and the dietary/allergy overlay. **`custom`**: user-supplied `slots[]`, no engine, no seed; still accepts `participantMemberIds`. **`clone`**: copy a historical accepted menu by `cloneFromMenuId` (participants are copied verbatim). One outstanding draft per (workspace, week). |
| [`/api/workspaces/[id]/menus/active`](./apps/web/app/api/workspaces/[id]/menus/active/route.ts) | GET | The accepted (active) menu for the workspace |
| [`/api/workspaces/[id]/menus/draft`](./apps/web/app/api/workspaces/[id]/menus/draft/route.ts) | GET | The current draft menu, if any |
| [`/api/workspaces/[id]/menus/history`](./apps/web/app/api/workspaces/[id]/menus/history/route.ts) | GET | Accepted menus in reverse-chronological order, with `is_modified` flag |
| [`/api/workspaces/[id]/menus/[menuId]`](./apps/web/app/api/workspaces/[id]/menus/[menuId]/route.ts) | DELETE | Discard a draft (rejects accepted menus) |
| [`/api/workspaces/[id]/menus/[menuId]/accept`](./apps/web/app/api/workspaces/[id]/menus/[menuId]/accept/route.ts) | POST | Promote a draft to active. Computes a deterministic `accepted_seed` from inputs + slot recipes |
| [`/api/workspaces/[id]/menus/[menuId]/slots`](./apps/web/app/api/workspaces/[id]/menus/[menuId]/slots/route.ts) | POST | Add a new slot to a draft. Server validates the recipe belongs to the workspace, the `targetMemberId` (when set) is a menu participant, and — for `weekly` drafts — the engine's hard-constraint filter passes. Auto-derives a unique `meal_key` in the (day, target_member_id) bucket. |
| [`/api/workspaces/[id]/menus/[menuId]/slots/[slotId]`](./apps/web/app/api/workspaces/[id]/menus/[menuId]/slots/[slotId]/route.ts) | PATCH | Replace a draft slot's recipe (server re-runs the engine's hard-constraint filter) |
| [`/api/workspaces/[id]/grocery`](./apps/web/app/api/workspaces/[id]/grocery/route.ts) | GET | Grocery lists aggregated from the active menu |
| [`/api/workspaces/[id]/export`](./apps/web/app/api/workspaces/[id]/export/route.ts) | GET | `?format=markdown` or `?format=csv`; same single-rectangle layout in both |
| [`/api/admin/{confirm-user,seed-ingredients,seed-recipes}`](./apps/web/app/api/admin/) | POST | Local/dev convenience — require `x-admin-key` header |

## Testing

The repo separates **mocked unit tests**, **integration tests against a real Supabase**, and **end-to-end HTTP drivers**. Each tier has a different runtime precondition.

| Tier | Tool | Where | What it covers | How to run |
|---|---|---|---|---|
| Mocked unit | Vitest | `**/__tests__/*.test.ts` (not `.integration.*`) | Pure functions: constraint engine, export renderers, mocked DB helpers | `pnpm test` (also runs in CI) |
| Integration | Vitest | `**/__tests__/*.integration.test.ts` | Helpers + signup trigger + RLS against a real Supabase using [`createIntegrationFixture`](./packages/test-utils/src/integration/fixture.ts) | `INTEGRATION_ENABLED=1 SUPABASE_TEST_URL=... SUPABASE_TEST_SERVICE_KEY=... pnpm test` — auto-skipped without the env vars |
| End-to-end | Node ESM driver | [`scripts/verify-flow.mjs`](./scripts/verify-flow.mjs) | Full Next.js API walk with a hand-built `sb-127-auth-token` cookie: signup → recipes (create + array edits) → menu → grocery → markdown + CSV export | `pnpm --filter @weekly-food-planner/supabase db:start && pnpm dev`, then `node scripts/verify-flow.mjs` |

The `apps/web/integration/end-to-end.integration.test.ts` test exercises the full menu-generation pipeline (loader → engine → persistence → export render) at the package boundary, using the same `INTEGRATION_ENABLED` gate.

CI ([`.github/workflows/ci.yml`](./.github/workflows/ci.yml)) runs typecheck + the mocked unit tier. Integration and end-to-end drivers are run locally — they need a Supabase instance and (for the driver) a running dev server.

## Agentic collaboration

This repo is set up for both Claude Code and Cursor.

### CLAUDE.md

A short, token-efficient orientation file lives at the root and at each package boundary. Claude Code loads them automatically when working in that area; PRDs are referenced by path so they aren't pulled into every session.

- [`CLAUDE.md`](./CLAUDE.md) — root: stack snapshot, the 10 non-negotiables, agent + skill catalogue, commands cheat sheet.
- [`apps/web/CLAUDE.md`](./apps/web/CLAUDE.md) — Next.js + React Query + Zustand + shadcn conventions.
- [`packages/constraint-engine/CLAUDE.md`](./packages/constraint-engine/CLAUDE.md) — engine determinism contract.
- [`packages/supabase/CLAUDE.md`](./packages/supabase/CLAUDE.md) — migrations + SQL style + module hooks.

### Agents

Subagent definitions live under [`.claude/agents/`](./.claude/agents/) and can be invoked via the Agent tool with `subagent_type: "<name>"`. Each agent has a tight scope and a hand-off list so the parent session can delegate without bloat.

| Agent | When to use |
|---|---|
| [`ui-component-builder`](./.claude/agents/ui-component-builder.md) | New UI under `apps/web/components/` or any feature `_components/` |
| [`route-handler-engineer`](./.claude/agents/route-handler-engineer.md) | New or modified handlers under `apps/web/app/api/` and server actions |
| [`supabase-migration-author`](./.claude/agents/supabase-migration-author.md) | Any schema change — tables, columns, enums, RLS, functions, triggers, indexes |
| [`vitest-integration-author`](./.claude/agents/vitest-integration-author.md) | New `.integration.test.ts` covering CRUD + RLS + role matrix |
| [`constraint-engine-engineer`](./.claude/agents/constraint-engine-engineer.md) | Any edit inside `packages/constraint-engine/` |
| [`determinism-snapshot-curator`](./.claude/agents/determinism-snapshot-curator.md) | Engine golden snapshots and regression suite |
| [`ux-reviewer`](./.claude/agents/ux-reviewer.md) | Pre-PR review of UI flows against product UX expectations |
| [`accessibility-auditor`](./.claude/agents/accessibility-auditor.md) | Pre-PR a11y review (keyboard nav, ARIA, contrast) |
| [`design-parity-auditor`](./.claude/agents/design-parity-auditor.md) | Post-promotion check that a live screen matches its `/design-lab` mock (Playwright, read-only) |
| [`prd-aligner`](./.claude/agents/prd-aligner.md) | Cross-check code state against the PRDs, flag drift |

### Skills

Custom skills live under [`.claude/skills/`](./.claude/skills/) and are auto-discovered.

- **[`constraint-menu-generator-life-cycle-test`](./.claude/skills/constraint-menu-generator-life-cycle-test/SKILL.md)** — given a recipes + dietary-constraints spec, emits a paired life-cycle integration test: a Vitest `*.integration.test.ts` for the engine + DB layer (gated on `INTEGRATION_ENABLED`) and a Node ESM HTTP driver mirroring [`scripts/verify-flow.mjs`](./scripts/verify-flow.mjs) for the full Next.js API walk. Both artifacts come from the same input so the engine and HTTP layers can't drift. Reference inputs live in the skill's [`docs/examples/`](./.claude/skills/constraint-menu-generator-life-cycle-test/docs/examples/).
- **[`menu-generation-impact-review`](./.claude/skills/menu-generation-impact-review/SKILL.md)** — given a proposed menu-generation feature, produces a structured impact review (no code): which layers change, what could break, snapshot drift risk, tests to add, PRD sections to update, and the agent-by-agent implementation order. Invoke when scoping a new feature, evaluating an architecture change, or pre-flighting a refactor. Worked example: [`docs/examples/max-budget-per-week.md`](./.claude/skills/menu-generation-impact-review/docs/examples/max-budget-per-week.md).
- **[`supabase-add-column`](./.claude/skills/supabase-add-column/SKILL.md)** — emit the full multi-artifact change set for adding a column (migration with `COMMENT ON COLUMN`, soft-delete-aware partial-index handling, optional backfill, types regen command, and the list of TypeScript files that need to update in lockstep). Worked example: [`docs/examples/ingredients-cost-per-unit.md`](./.claude/skills/supabase-add-column/docs/examples/ingredients-cost-per-unit.md).
- **[`feature-folder-scaffold`](./.claude/skills/feature-folder-scaffold/SKILL.md)** — scaffold a CRUD feature folder under `apps/web/app/(app)/<feature>/` matching the canonical shape (client list page + create/edit drawer + soft-delete confirm + Zod schema + integration test + middleware/sidebar patches). Reuses hooks from `@weekly-food-planner/supabase/react`; never generates app-level hooks. Worked example: [`docs/examples/shopping-templates.md`](./.claude/skills/feature-folder-scaffold/docs/examples/shopping-templates.md).
- **[`design-lab-parity-check`](./.claude/skills/design-lab-parity-check/SKILL.md)** — drive Playwright over a promoted live screen and its `/design-lab` mock at 390/820/1440px × light/dark, snapshot the DOM/a11y tree + screenshots, and tabulate the structural + token deltas. Capture-and-tabulate only — the PASS/BLOCK verdict is the [`design-parity-auditor`](./.claude/agents/design-parity-auditor.md)'s. Worked example: [`docs/examples/members-parity-check.md`](./.claude/skills/design-lab-parity-check/docs/examples/members-parity-check.md).

### MCP servers

Four servers wired via [`.mcp.json`](./.mcp.json) at the repo root, auto-discovered by Claude Code on session start. Run `/mcp` inside Claude Code to confirm connection.

| Server | Use for | Auth |
|---|---|---|
| `supabase-local` | Generic Postgres MCP (`@modelcontextprotocol/server-postgres`) pointed at the local dev DB on `127.0.0.1:54322`. Exposes a single `query` tool — ad-hoc SQL reads while iterating. Does NOT introspect Supabase-specific state (RLS, migrations, advisors). | None — connection string baked in. Requires `pnpm --filter @weekly-food-planner/supabase db:start`. |
| `supabase-remote` | `@supabase/mcp-server-supabase --read-only` against the hosted project. Schema introspection, RLS policy listing, migration status, advisors. | `SUPABASE_PROJECT_REF` + `SUPABASE_ACCESS_TOKEN` env vars |
| `shadcn` | Component registry browsing (list / demo / source) — backs `ui-component-builder` | None |
| `menu` | Custom server in [`apps/menu-mcp-server/`](./apps/menu-mcp-server/). Engine tools (`engine_generate_menu`, `engine_compute_inputs_hash`, `engine_validate_input`) wrap the constraint engine directly; workspace tools (`workspace_preview_menu`, `workspace_member_constraints`, `workspace_recipe_usability`, `workspace_recent_menus`) hit the running Next.js app. | `MENU_MCP_USER_JWT` (Supabase user JWT with admin role on a dev workspace) — workspace tools only. Optionally `MENU_MCP_BASE_URL` (default `http://127.0.0.1:3000`). Engine tools work without any env. |

Read-only Supabase keeps schema mutations on the migration-ritual path through [`supabase-migration-author`](./.claude/agents/supabase-migration-author.md). The menu server impersonates a real workspace member via JWT — RLS still applies, bounding blast radius. See [`docs/agentic/changelog/2026-05-26_mcp-servers.md`](./docs/agentic/changelog/2026-05-26_mcp-servers.md), [`docs/agentic/changelog/2026-05-29_menu-mcp-server.md`](./docs/agentic/changelog/2026-05-29_menu-mcp-server.md), and [`docs/agentic/changelog/2026-06-08_mcp-server-smoke-corrections.md`](./docs/agentic/changelog/2026-06-08_mcp-server-smoke-corrections.md) for env-var setup, rationale, and the smoke-driven corrections.

### Cursor rules

The [`.cursor/rules/`](./.cursor/rules/) directory contains rules consumed by both Cursor and Claude Code. CLAUDE.md files reference these but do not duplicate them:

- [`global-rules.md`](./.cursor/rules/global-rules.md) — TypeScript / React / Supabase / SQL conventions
- [`agentic-rules.md`](./.cursor/rules/agentic-rules.md) — Agent collaboration: required folders, prompt + log format
- [`query-patterns.md`](./.cursor/rules/query-patterns.md) — TanStack Query + Next.js hydration patterns

### Reference docs

The [`docs/agentic/`](./docs/agentic/) directory holds the detailed reference documentation for the agentic infrastructure — start with [`docs/agentic/README.md`](./docs/agentic/README.md) for the directory index. Quick links:

- [`architecture.md`](./docs/agentic/architecture.md) — how cursor rules, CLAUDE.md, agents, skills, and MCP servers compose; the skill-vs-agent decision criteria.
- [`agents.md`](./docs/agentic/agents.md) — full agent catalog.
- [`skills.md`](./docs/agentic/skills.md) — full skill catalog.
- [`claude-md.md`](./docs/agentic/claude-md.md) — CLAUDE.md inventory + auto-load model.
- [`extending.md`](./docs/agentic/extending.md) — playbook for adding new agents/skills/CLAUDE.md.
- [`changelog/`](./docs/agentic/changelog/) — dated entries describing notable changes to the agentic setup itself.

Session-by-session history (prompt + context + observed issues + follow-ups) lives in [`agent-log/`](./agent-log/) per [`.cursor/rules/agentic-rules.md`](./.cursor/rules/agentic-rules.md), distinct from the static reference docs above.
