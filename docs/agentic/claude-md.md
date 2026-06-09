# CLAUDE.md inventory

Index only — the linked CLAUDE.md files are authoritative. Keep entries to one line; section inventories and rule lists live in the source files themselves.

## The auto-load model

Claude Code reads CLAUDE.md files based on the **working directory** of the current operation:

1. The **root** `CLAUDE.md` loads in every session.
2. Editing/reading a file under a subdirectory with its own `CLAUDE.md` loads that file too.
3. Multiple files compose by concatenation — root + per-area, no override semantics.

This **contextual load** model keeps per-package files out of sessions that don't touch the package. The root file is the one constant.

## Inventory

| File | Auto-loaded | Covers |
|---|---|---|
| [`CLAUDE.md`](../../CLAUDE.md) | Always | Project-wide orientation + the 10 non-negotiables |
| [`apps/web/CLAUDE.md`](../../apps/web/CLAUDE.md) | Under `apps/web/` | Next.js App Router: components, forms, Query, Zustand, handlers |
| [`packages/constraint-engine/CLAUDE.md`](../../packages/constraint-engine/CLAUDE.md) | Under `packages/constraint-engine/` | Engine purity + determinism contract |
| [`packages/supabase/CLAUDE.md`](../../packages/supabase/CLAUDE.md) | Under `packages/supabase/` | Migrations + SQL style + module hooks |

## What CLAUDE.md files are NOT

- **Not the PRD** — they link to [`docs/PRD/`](../PRD/), not inline product/architecture detail.
- **Not the cursor rules** — those stay in [`.cursor/rules/`](../../.cursor/rules/).
- **Not a persona file** — the "ship fast / never be lazy" framing is intentionally not duplicated.
- **Not a tutorial** — they state conventions for an agent that already knows the stack.

## Design principles

1. **Short by default** (< 200 lines). Heavy reference splits out into [`docs/`](../).
2. **Link, don't inline** — a table of contents, not an encyclopedia.
3. **Composable** — per-area files are additive on root, no conflicts.
4. **Delegate-friendly** — each ends with a "Delegate to" section.

## When to update a CLAUDE.md

| Change | Update which file |
|---|---|
| New project-wide non-negotiable | Root `CLAUDE.md` |
| New Next.js app convention | `apps/web/CLAUDE.md` |
| Engine contract change | `packages/constraint-engine/CLAUDE.md` |
| New module CRUD pattern or SQL style | `packages/supabase/CLAUDE.md` |
| New agent or skill | Root `CLAUDE.md` agent/skill catalogue |

After updating, add a [`changelog/`](./changelog/) entry.

## When to add a new CLAUDE.md

Add one when a new top-level area appears, or when a subdirectory's conventions diverge significantly and the divergence isn't obvious from existing rules. **Don't** add one to a feature folder — feature conventions live in the parent CLAUDE.md or in agent files.

See [`extending.md`](./extending.md) for the full playbook.
