# 2026-06-08 — Cursor-rules + CLAUDE.md hardening (toast-convention fix, trim, cross-linking)

## What changed

Follow-up to the agentic-optimization pass: corrected stale always-loaded rules, trimmed generic boilerplate, and improved cross-module navigation in the CLAUDE.md hierarchy.

### Toast / error convention (correctness — the headline fix)
The rules claimed CRUD modules toast; the live code **throws** and the component layer toasts via `apps/web/lib/toast.ts` (`notifySuccess`/`notifyError`, a `sonner` wrapper). Corrected in all four places it was asserted: [`.cursor/rules/query-patterns.md`](../../../.cursor/rules/query-patterns.md), [`apps/web/CLAUDE.md`](../../../apps/web/CLAUDE.md), [`packages/supabase/CLAUDE.md`](../../../packages/supabase/CLAUDE.md), and the new `supabase-module-author` agent.

### `.cursor/rules/global-rules.md` — trimmed ~708 → ~357 lines (always-loaded, so a real per-session win)
- Removed generic boilerplate that didn't match the codebase: Prometheus/Grafana monitoring, the `_learnings/patterns/` template (dir doesn't exist), and the founder "my job depends on this" persona tail.
- Condensed the idempotency-key / `db.transaction` / optimistic-`version` "Data Mutation" code blocks to the real Supabase invariants (soft-delete + ownership scoping, preconditions, the recompute/`accepted_seed` boundary).
- Condensed the 130-line SQL Migration Style Guide (duplicated verbatim from `packages/supabase/CLAUDE.md`) to a short invariant + pointer.
- Replaced the generic "Security Patterns" list with the project's concrete model (RLS-first, server role re-checks, three clients, no secrets in client/committed files).
- Accuracy: `@repo/supabase` → `@weekly-food-planner/supabase`; rewrote the obsolete "never generate a hook for Supabase" to the real intent (ban `@supabase/auth-helpers-nextjs`; endorse the `module/<table>.ts` + `.react.ts` pair scaffolded by `add-module-and-hooks` / `supabase-module-author`).

### `.cursor/rules/agentic-rules.md` — modernized
Fixed typos ("Calude"/"genration"/"arquitecture") and replaced the stale flat `/prompts /agent-log /docs` file-list with a pointer to `docs/agentic/` + root `CLAUDE.md` as the authoritative catalog, plus a route-to-specialists list.

### NEW `.cursor/rules/design-and-mutations.md` (always-loaded, ~24 lines)
Captures the v1.8 invariants that had no rule home: tokens-only / no-hex in components, theme + reduced-motion parity, accent scoping (per-member vs per-user), and the member-writable-mutation guardrail (membership-not-role; narrow column set; never trigger engine/recompute/`accepted_seed`).

### CLAUDE.md cross-module indexing
Added a consistent "Related areas" footer to [`apps/web/CLAUDE.md`](../../../apps/web/CLAUDE.md), [`packages/constraint-engine/CLAUDE.md`](../../../packages/constraint-engine/CLAUDE.md), and [`packages/supabase/CLAUDE.md`](../../../packages/supabase/CLAUDE.md) so an agent working in one area can navigate to siblings + the right agents/skills without loading every file.

## Why

`global-rules.md` and `agentic-rules.md` are `alwaysApply: true` (loaded every Cursor session) and were carrying stale claims (the toast convention actively misled toward wiring toasts at the data layer) plus a large amount of aspirational boilerplate the codebase never adopted. Trimming cuts always-loaded token cost; the toast fix removes a correctness trap; the new rule file + cross-links encode the v1.8 invariants where agents will actually see them.

## Cross-references

- Companion entries: [`2026-06-08_agentic-optimization-pass.md`](./2026-06-08_agentic-optimization-pass.md), [`2026-06-08_mcp-roadmap-review.md`](./2026-06-08_mcp-roadmap-review.md).
- Convention split (rules vs CLAUDE.md): [`extending.md`](../extending.md).

## Forward-looking

- The data-layer modules still literally `throw`; if a future refactor moves toasting into the modules, update the convention in all four files together (they're now consistent).
- `global-rules.md` still contains generic TS/React guidance that's broadly fine; further trimming is possible but hits diminishing returns vs. churn risk on a shared Cursor artifact.
