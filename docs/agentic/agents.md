# Agent catalog

Every sub-agent under [`.claude/agents/`](../../.claude/agents/). Grouped by purpose. Each entry is a reference — the agent file itself is the authoritative scope and operating rules.

## Invocation

```
Agent(
  subagent_type: "<name>",
  description: "<3–5 word task summary>",
  prompt: "<self-contained task brief — agent has no conversation context>"
)
```

The parent session's prompt is the agent's only input. Brief it like a smart colleague who just walked into the room: state the goal, share what you've ruled out, give file paths and line numbers where applicable, name the response shape you want.

## Daily-edit agents (cover ~80% of feature work)

### [`ui-component-builder`](../../.claude/agents/ui-component-builder.md)

| Field | Value |
|---|---|
| Model | sonnet |
| Scope | New components under `apps/web/components/` or feature `_components/` |
| Out of scope | Route handlers, data-layer hooks, full pages without an existing feature folder |
| Key non-negotiables | shadcn/ui via CLI only, RO-RO callbacks, flex/gap layout, reuse of `multi-label-combobox` + `ingredient-picker`, single export per file, no toasts in components |
| Hand-offs | Server-side shape → `route-handler-engineer`. A11y review → `accessibility-auditor`. Schema change → `supabase-migration-author`. |
| Output expectations | Component file(s) + Zod schema(s) + a short note (≤5 lines) describing placement + any `npx shadcn@latest add ...` commands |

### [`route-handler-engineer`](../../.claude/agents/route-handler-engineer.md)

| Field | Value |
|---|---|
| Model | sonnet |
| Scope | Route handlers under `apps/web/app/api/` + server actions |
| Out of scope | Migrations (delegate to `supabase-migration-author`), engine implementation (delegate to `constraint-engine-engineer`) |
| Key non-negotiables | Three-Supabase-client rule, authorize → validate → mutate order, awaited `params`/`cookies()`, single `recomputeGroceryListsForMenu` entry point for grocery persistence, structured error shape |
| Hand-offs | Schema change → `supabase-migration-author`. Engine work → `constraint-engine-engineer`. Test coverage → `vitest-integration-author`. |
| Output expectations | Handler file(s) + Zod schema + any new module helpers + note on which Supabase client(s) used + the test that should cover it |

### [`supabase-migration-author`](../../.claude/agents/supabase-migration-author.md)

| Field | Value |
|---|---|
| Model | sonnet |
| Scope | Any schema change — tables, columns, enums, RLS, RPCs, triggers, indexes |
| Out of scope | UI consumption of the change, route handler wiring (delegate after migration lands) |
| Key non-negotiables | Always uses `npx supabase migration new <name>`, prefix conventions (`tbl_` / `enum_` / `rls_` / `fn_` / `sys_` / `trg_` / `idx_`), dependency order (functions → enums → tables → RLS enable → policies), `SECURITY DEFINER` always pairs with `SET search_path`, partial unique indexes for soft delete, `COMMENT ON COLUMN` for every new column |
| Hand-offs | Route handler that consumes the change → `route-handler-engineer`. RLS test → `vitest-integration-author`. |
| Output expectations | Exact `npx supabase migration new` command(s) + full SQL bodies in dependency order + the `gen:types` command + PRD section that needs updating |

### [`vitest-integration-author`](../../.claude/agents/vitest-integration-author.md)

| Field | Value |
|---|---|
| Model | sonnet |
| Scope | Integration tests under `apps/web/integration/` or `packages/supabase/src/__tests__/` |
| Out of scope | Pure-function engine unit tests (those are unit tier; for engine snapshots use `determinism-snapshot-curator`), full HTTP-lifecycle tests (use the `constraint-menu-generator-life-cycle-test` skill) |
| Key non-negotiables | `INTEGRATION_ENABLED=1` env gate, `createIntegrationFixture` for setup, unique UUIDs per test, AAA structure, required test families per endpoint (happy path + role matrix + RLS denial + soft-delete visibility + structured error) |
| Hand-offs | Engine snapshot regression → `determinism-snapshot-curator`. Schema dependency → `supabase-migration-author`. Handler behaviour change → `route-handler-engineer`. |
| Output expectations | Test file(s) with all required families + env-gated run command + note on fixtures used and any new test-utils helpers |

## Review-pass agents (run pre-PR)

### [`ux-reviewer`](../../.claude/agents/ux-reviewer.md)

| Field | Value |
|---|---|
| Model | sonnet |
| Scope | Read-only product UX review against the PRDs |
| Coverage | Empty states, loading/error states, draft/accept affordances, overlay-dedup nudges, shop-for filter, label suggestion behaviour, PDF-ready layout, toast-vs-inline, role gating |
| Out of scope | Accessibility (separate agent), code correctness, visual polish beyond rule violations |
| Output expectations | Punch list grouped by severity (Must fix / Should fix / Nudge) with file:line citations. Categories that pass are omitted. ≤250 lines. |

### [`accessibility-auditor`](../../.claude/agents/accessibility-auditor.md)

| Field | Value |
|---|---|
| Model | sonnet |
| Scope | Read-only a11y review |
| Coverage | Semantic HTML, ARIA on composite widgets (LabelCombobox, IngredientPicker, Sheet drawers), keyboard navigation, focus management, screen-reader copy, contrast, reduced-motion |
| Out of scope | Product UX (separate agent), code correctness |
| Output expectations | Punch list grouped by severity (Blocks merge / Should fix / Nudge) with file:line citations. Recommend the smallest fix, not a refactor. ≤250 lines. |

### [`prd-aligner`](../../.claude/agents/prd-aligner.md)

| Field | Value |
|---|---|
| Model | sonnet |
| Scope | Read-only drift detection between [`docs/PRD/`](../PRD/) and the code |
| Coverage | Every PRD walked end-to-end; mismatches flagged with file:line on both sides |
| Out of scope | Mid-feature work (this is a pre-PR pass); trivial commits |
| Output expectations | Report grouped by who-should-change (Code should change / PRD should change / Either is fine). One-sentence diagnosis per item. ≤300 lines. |

## Engine-protecting agents

### [`constraint-engine-engineer`](../../.claude/agents/constraint-engine-engineer.md)

| Field | Value |
|---|---|
| Model | sonnet |
| Scope | Any change inside `packages/constraint-engine/` |
| Out of scope | Engine regression snapshots (delegate to `determinism-snapshot-curator`), route handler caller-side changes (delegate to `route-handler-engineer`) |
| Key non-negotiables | No I/O, no clocks (`Date.now()`, `new Date()`, `performance.now()` forbidden), no ambient randomness (`Math.random()`, `crypto.randomUUID()` forbidden), no app-package imports, JSON-round-trippable boundary, single seeded RNG entry point, no input mutation |
| Hand-offs | Snapshot work → `determinism-snapshot-curator`. Caller-side overlay/participant logic → `route-handler-engineer`. |
| Output expectations | Engine file(s) + new test files + determinism note (any new RNG paths?) + the engine test command + pointer to snapshot curator if regression suite needs updates |

### [`determinism-snapshot-curator`](../../.claude/agents/determinism-snapshot-curator.md)

| Field | Value |
|---|---|
| Model | sonnet |
| Scope | Engine golden-snapshot regression suite under `packages/constraint-engine/src/__tests__/` |
| Coverage required | Happy paths, constraint interactions, frequency cascade, participants, failure modes, grocery aggregation (full taxonomy in the agent file) |
| Out of scope | Engine implementation work (delegate to `constraint-engine-engineer`), HTTP-lifecycle tests (use the `constraint-menu-generator-life-cycle-test` skill) |
| Key rule | Snapshot diff = "engine produced different output for the same input + seed". Intentional changes land in a **separate commit** with `engine: update regression snapshots for <change>`. Accidental changes mean the engine is wrong, not the snapshot. |
| Output expectations | New fixture file(s) with `_doc` field + updated regression spec + engine test command + note on any modified existing fixtures |

## Agent file structure (for reference)

Every agent file follows the same shape so the parent session knows what to expect:

```markdown
---
name: <kebab-case>
description: <when to use / when NOT to use — full sentence with both>
model: sonnet | haiku | opus
---

# Body sections (in order)
1. One-paragraph framing pointing at the relevant CLAUDE.md / PRD
2. Operating rules — the non-negotiables
3. Domain-specific guidance (e.g. "Menu generation pipeline rules" for route-handler-engineer)
4. Pre-flight checklist (optional but recommended)
5. When to hand off — list of adjacent agents
6. Output expectations — exactly what to return to the parent session
```

See [`extending.md`](./extending.md) for the full conventions and how to add a new agent.
