# CLAUDE.md inventory

Every CLAUDE.md file in the repo, what it covers, and when the harness auto-loads it. Reference for understanding what context the model sees by default in each area.

## The auto-load model

Claude Code reads CLAUDE.md files based on the **working directory** of the current operation:

1. The **root** `CLAUDE.md` loads in every session.
2. When the agent edits or reads a file under a subdirectory that contains its own `CLAUDE.md`, the harness loads that file too.
3. Multiple `CLAUDE.md` files compose by concatenation — root + per-area, no override semantics.

This is the **contextual load** model. Per-package files don't bloat sessions that don't touch the package. The root file is the one constant.

## Inventory

### [`CLAUDE.md`](../../CLAUDE.md) — repository root

| Field | Value |
|---|---|
| Auto-loaded | Always |
| Scope | Project-wide orientation |
| Sections | What this repo is, stack at a glance, **the 10 non-negotiables**, where to read more (PRDs + cursor rules + per-package CLAUDE.md), agents available to delegate to, agent skills available, commands worth remembering, what this file is NOT |
| Length target | < 200 lines |

The 10 non-negotiables it enforces:

1. Three Supabase clients, never anything else
2. Types via the package barrel
3. RO-RO everywhere
4. Fat-arrow functions, one export per file, kebab-case filenames
5. Tailwind: `flex` + `gap-*` over `margin-*` / `space-*`
6. shadcn/ui via CLI only
7. Next.js 15 async APIs (`await params`, `await cookies()`, `await headers()`)
8. Migrations via `npx supabase migration new` with the prefix conventions
9. Constraint engine purity (no clocks, no randomness, no I/O)
10. Soft delete is the default

### [`apps/web/CLAUDE.md`](../../apps/web/CLAUDE.md) — Next.js application

| Field | Value |
|---|---|
| Auto-loaded | When the agent works under `apps/web/` |
| Scope | Frontend + backend (Next.js App Router) conventions |
| Sections | Layout, component conventions, forms (shadcn + react-hook-form + Zod), TanStack Query, Zustand, route handlers (with skeleton), middleware, testing, things this app deliberately does NOT do |
| Length target | < 150 lines |

Key constraints surfaced:

- shadcn primitives live in [`apps/web/components/ui/`](../../apps/web/components/ui/) and are CLI-generated only.
- Feature components colocate under `app/(app)/<feature>/_components/`.
- React Query hooks come from `@weekly-food-planner/supabase/react` — no app-level hooks.
- Zustand is for **ephemeral UI state only**; never server data.
- Middleware sanitizes the `next` query parameter against open-redirect.

### [`packages/constraint-engine/CLAUDE.md`](../../packages/constraint-engine/CLAUDE.md) — deterministic menu generator

| Field | Value |
|---|---|
| Auto-loaded | When the agent works under `packages/constraint-engine/` |
| Scope | The engine's purity and determinism contract |
| Sections | Hard rules (5 non-negotiables), surface area (file-by-file), boundary contract, frequency cascade, determinism contract, trade-offs, tests, delegate to |
| Length target | < 200 lines |

Hard rules:

1. No I/O
2. No clocks (`Date.now()`, `new Date()`, `performance.now()` forbidden)
3. No ambient randomness — seeded RNG only
4. No app-package imports
5. JSON-round-trippable boundary

### [`packages/supabase/CLAUDE.md`](../../packages/supabase/CLAUDE.md) — Supabase package

| Field | Value |
|---|---|
| Auto-loaded | When the agent works under `packages/supabase/` |
| Scope | Migrations + SQL style + module hooks |
| Sections | Layout, the migration ritual, file naming, dependency order, RPC required content, table style, soft delete rules, RLS conventions, generated types, module hooks, delegate to |
| Length target | < 200 lines |

Surface-level rules:

- Migrations via `cd packages/supabase && npx supabase migration new <name>`.
- Generated types regenerated via `pnpm --filter @weekly-food-planner/supabase db:gen:types`.
- Module pattern: `<table>.ts` (CRUD + types + keys) + `<table>.react.ts` (TanStack Query wrappers).
- Import only from the package barrel `@weekly-food-planner/supabase`.

## What CLAUDE.md files are NOT

- **Not the PRD.** They link to PRDs under [`docs/PRD/`](../PRD/); they do not inline product or architecture detail.
- **Not the cursor rules.** Cursor rules live in [`.cursor/rules/`](../../.cursor/rules/) and are still loaded by Cursor. CLAUDE.md references the rules but does not duplicate them.
- **Not a persona file.** The "ship fast / never be lazy" framing from `global-rules.md` is intentionally not duplicated in CLAUDE.md — it adds tokens without changing model behavior in Claude Code.
- **Not a tutorial.** They orient an agent that already knows TypeScript / Next.js / Supabase. They state conventions; they don't teach the stack.

## Design principles

1. **Short by default.** Every file aims for < 200 lines. If it grows past that, split heavy reference material out into [`docs/`](../) and link to it.
2. **Link, don't inline.** PRDs, cursor rules, and detailed conventions are linked. CLAUDE.md is the **table of contents**, not the encyclopedia.
3. **Composable.** Per-area files are additive on top of root. No override semantics; no conflicting rules.
4. **Delegate-friendly.** Every CLAUDE.md ends with a "Delegate to" section pointing at the right agent for work in that area.

## When to update a CLAUDE.md

| Change | Update which file |
|---|---|
| New non-negotiable rule that applies project-wide | Root `CLAUDE.md` |
| New convention specific to the Next.js app | `apps/web/CLAUDE.md` |
| Engine contract change (new boundary field, new determinism rule) | `packages/constraint-engine/CLAUDE.md` |
| New module CRUD pattern or SQL style change | `packages/supabase/CLAUDE.md` |
| New agent or skill | Root `CLAUDE.md` agent/skill catalogue |

After updating, add a [`changelog/`](./changelog/) entry describing what changed and why.

## When to add a new CLAUDE.md

Add a new per-area CLAUDE.md when:

- A new top-level area is added (e.g. `packages/test-utils/CLAUDE.md` if test-utils grows enough complexity to warrant orientation).
- A subdirectory has conventions that diverge significantly from its parent and the divergence isn't obvious from existing rules.

**Don't** add a CLAUDE.md to a feature folder (e.g. `apps/web/app/(app)/recipes/CLAUDE.md`) — feature-level conventions live in the parent CLAUDE.md or in agent files, not in nested CLAUDE.md.

See [`extending.md`](./extending.md) for the full playbook.
