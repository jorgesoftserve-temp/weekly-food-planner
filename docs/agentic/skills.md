# Skill catalog

Every skill under [`.claude/skills/`](../../.claude/skills/). Skills are deterministic, multi-artifact emitters invoked by name — they walk a fixed workflow rather than exercising judgment. Each `SKILL.md` is the authoritative spec; this file is a reference index.

## Invocation

When the user types `/<skill-name>` (or asks for it by name) the Claude Code harness loads the skill's `SKILL.md` automatically. The skill then runs its workflow against the conversation's current state.

```
Skill(
  skill: "<skill-name>",
  args: "<optional argument string>"
)
```

The harness auto-discovers any skill under `.claude/skills/<name>/SKILL.md`. After adding a new skill the next session sees it without manual registration.

## Lifecycle skills

### [`constraint-menu-generator-life-cycle-test`](../../.claude/skills/constraint-menu-generator-life-cycle-test/SKILL.md)

| Field | Value |
|---|---|
| Purpose | Given a recipes + dietary-constraints spec, emit a paired life-cycle integration test: Vitest `*.integration.test.ts` for the engine + DB layer AND a Node ESM HTTP driver `scripts/flow-<scenario>.mjs` mirroring [`scripts/verify-flow.mjs`](../../scripts/verify-flow.mjs) |
| Input shape | YAML with `scenario` slug, `members`, `mealFrequency`, `recipes`, optional `overlay`, and `expectations` (slot count, included/excluded recipes, grocery contents, export substrings) |
| Output | Two artifacts: Vitest test under `packages/supabase/src/module/__tests__/` + mjs driver under `scripts/` |
| Invoke when | Asked for a flow test for an allergy/restriction/cuisine combination, regression coverage for a constraint-engine change, before/after pairs for engine work |
| Do NOT invoke for | Unit tests of a single helper, API-route smoke tests without menu generation, UI/browser flows |
| Examples | [`basic-flow.yaml`](../../.claude/skills/constraint-menu-generator-life-cycle-test/docs/examples/basic-flow.yaml), [`peanut-allergy-mixed-household.yaml`](../../.claude/skills/constraint-menu-generator-life-cycle-test/docs/examples/peanut-allergy-mixed-household.yaml) |

## Planning skills

### [`menu-generation-impact-review`](../../.claude/skills/menu-generation-impact-review/SKILL.md)

| Field | Value |
|---|---|
| Purpose | Walk the menu-generation system layer-by-layer against a 12-category checklist and produce a structured impact plan for a proposed feature. **No code.** |
| Input | A feature description in prose; one round of batched clarification if vague |
| Output | Markdown report with: layers touched, gaps + risks, backwards compatibility, tests to add/update, PRD updates, proposed per-agent implementation order, out-of-scope items |
| Invoke when | Scoping a new menu/grocery feature, evaluating an architecture change, pre-flighting a refactor, reviewing a stalled feature |
| Do NOT invoke for | Writing code (use the agents), writing tests (use `vitest-integration-author` or the lifecycle skill), updating PRDs directly, pure-UI tweaks that don't touch generation |
| Checklist categories | (1) Engine contract, (2) Engine internals, (3) Route handler dedup/participants, (4) Persistence, (5) Three modes (weekly/custom/clone), (6) Lifecycle, (7) Grocery recompute, (8) Failure modes, (9) Regression suite, (10) Integration tests, (11) UI surface, (12) PRD updates |
| Examples | [`max-budget-per-week.md`](../../.claude/skills/menu-generation-impact-review/docs/examples/max-budget-per-week.md) |

## Mechanical-task skills

### [`supabase-add-column`](../../.claude/skills/supabase-add-column/SKILL.md)

| Field | Value |
|---|---|
| Purpose | Emit the full multi-artifact change set for adding a column (or set of related columns) to an existing Supabase table |
| Input shape | YAML with `table`, `columns` (name, type, nullable, default, comment, optional FK references), optional `backfill`, optional `indexImpact`, optional `extensibleLabel` enum_type |
| Output | Migration SQL body (with `COMMENT ON COLUMN`, soft-delete-aware partial-index awareness, idempotent backfill) + commands to run (`db:migration:new`, `db:gen:types`) + deterministic patches for `packages/supabase/src/module/<table>.ts` (record type + select string + payloads + CRUD functions) + list of route handler and test files to update + PRD §6.x patch |
| Invoke when | Adding a single scalar column, a small set of related columns, or a column with backfill |
| Do NOT invoke for | New tables, new RPCs, new RLS policies in isolation, junction tables, renames, type changes — those go to the `supabase-migration-author` agent |
| Key rules | Always uses `db:migration:new`; idempotent backfill; `COMMENT ON COLUMN` mandatory; partial-index awareness; types regen ordered before TS edits; no drive-by changes |
| Examples | [`ingredients-cost-per-unit.md`](../../.claude/skills/supabase-add-column/docs/examples/ingredients-cost-per-unit.md) |

### [`feature-folder-scaffold`](../../.claude/skills/feature-folder-scaffold/SKILL.md)

| Field | Value |
|---|---|
| Purpose | Scaffold a new CRUD feature folder under `apps/web/app/(app)/<feature>/` matching the canonical members/recipes shape |
| Input shape | YAML with `feature` slug, `title`, `description`, `icon`, the underlying `module` + `record` + `keys` + hook names, `formFields` (name/label/type/required/options), `listColumns`, optional `zustand` |
| Output | `page.tsx` + `_components/<feature>-form.tsx` + `<feature>-form-dialog.tsx` + `delete-<feature>-dialog.tsx` + colocated integration test + inline patches for `middleware.ts` (protected prefix) and `app-sidebar.tsx` (nav entry) |
| Invoke when | Adding a new authenticated CRUD page whose underlying table + module already exist |
| Do NOT invoke for | Read-only pages, full-page create flows (where create is at `/<feature>/new`, like recipes), public auth pages, features without an existing `packages/supabase/src/module/<table>.ts` module |
| Hard rules | Never generates new app-level React Query hooks (they live in the supabase package); always includes role gating in UI; defaults to no Zustand; uses `flex` + `gap-*` (never `space-*` or `mt-*`); one export per file |
| Examples | [`shopping-templates.md`](../../.claude/skills/feature-folder-scaffold/docs/examples/shopping-templates.md) |

## Skill file structure (for reference)

Every skill follows the same shape:

```
.claude/skills/<name>/
  SKILL.md                       Frontmatter (name, description) + workflow
  docs/
    examples/
      <example-1>.{md,yaml}      Worked input or output (at least one)
      <example-2>.{md,yaml}      Additional examples for complex skills
```

The `SKILL.md` body contains:

1. **One-paragraph framing** — what the skill produces and why
2. **When to invoke** — explicit scope
3. **When NOT to invoke** — out-of-scope cases, with the right alternative named
4. **Input** — the shape the skill expects, with one round of batched clarification rules
5. **Authoritative repo references** — files the emitted output must stay consistent with
6. **Steps** — the deterministic workflow
7. **Report structure / output template** — what the skill returns
8. **Non-negotiables** — rules the workflow must not violate
9. **What to flag in the report** — surface conditions that need user attention

See [`extending.md`](./extending.md) for the full conventions and how to author a new skill.

## Decision: skill vs. agent vs. ad-hoc

| Task profile | Use |
|---|---|
| Deterministic walk against a fixed checklist, repeated work, multi-artifact | **Skill** |
| Specialist work that exercises judgment per invocation | **Agent** |
| One-off or exploratory work | **Ad-hoc (parent session)** |

Full criteria in [`architecture.md`](./architecture.md). Rule of thumb: if you find yourself writing "every time we do X, we have to remember Y" — that's a skill candidate.
