# 2026-05-26 — Initial agentic foundation

First entry in [`docs/agentic/changelog/`](./). Establishes the agentic foundation for Claude Code: CLAUDE.md orientation files, a 9-agent roster, 3 skills, and the reference documentation under [`docs/agentic/`](../).

## What changed

### CLAUDE.md files added

| File | Scope |
|---|---|
| [`CLAUDE.md`](../../../CLAUDE.md) | Repo root — orientation that every session loads |
| [`apps/web/CLAUDE.md`](../../../apps/web/CLAUDE.md) | Next.js application conventions |
| [`packages/constraint-engine/CLAUDE.md`](../../../packages/constraint-engine/CLAUDE.md) | Engine determinism contract |
| [`packages/supabase/CLAUDE.md`](../../../packages/supabase/CLAUDE.md) | Migrations + SQL style + module hooks |

Full inventory and rationale: [`claude-md.md`](../claude-md.md).

### Sub-agents added (9)

Daily-edit roster (~80% of feature work):

- [`ui-component-builder`](../../../.claude/agents/ui-component-builder.md)
- [`route-handler-engineer`](../../../.claude/agents/route-handler-engineer.md)
- [`supabase-migration-author`](../../../.claude/agents/supabase-migration-author.md)
- [`vitest-integration-author`](../../../.claude/agents/vitest-integration-author.md)

Review-pass roster (pre-PR):

- [`ux-reviewer`](../../../.claude/agents/ux-reviewer.md)
- [`accessibility-auditor`](../../../.claude/agents/accessibility-auditor.md)
- [`prd-aligner`](../../../.claude/agents/prd-aligner.md)

Engine-protecting roster:

- [`constraint-engine-engineer`](../../../.claude/agents/constraint-engine-engineer.md)
- [`determinism-snapshot-curator`](../../../.claude/agents/determinism-snapshot-curator.md)

Full catalog and operating rules: [`agents.md`](../agents.md).

### Skills added (3 in this session, joining 1 pre-existing)

Pre-existing:

- `constraint-menu-generator-life-cycle-test` — paired Vitest + mjs HTTP driver emitter

Added this session:

- [`menu-generation-impact-review`](../../../.claude/skills/menu-generation-impact-review/SKILL.md) — structural impact-review planner for menu-generation features (no code; produces a plan).
- [`supabase-add-column`](../../../.claude/skills/supabase-add-column/SKILL.md) — column-add change set emitter (migration + types regen + TS patches).
- [`feature-folder-scaffold`](../../../.claude/skills/feature-folder-scaffold/SKILL.md) — CRUD feature folder scaffolder (page + dialogs + integration test + middleware/sidebar patches).

Full catalog: [`skills.md`](../skills.md).

### Reference documentation added

- [`docs/agentic/README.md`](../README.md) — directory index
- [`docs/agentic/architecture.md`](../architecture.md) — composition model + skill-vs-agent criteria
- [`docs/agentic/agents.md`](../agents.md) — agent catalog
- [`docs/agentic/skills.md`](../skills.md) — skill catalog
- [`docs/agentic/claude-md.md`](../claude-md.md) — CLAUDE.md inventory + auto-load model
- [`docs/agentic/extending.md`](../extending.md) — playbook for adding new agents/skills/CLAUDE.md
- [`docs/agentic/changelog/README.md`](./README.md) — changelog index
- [`docs/agentic/changelog/2026-05-26_initial-agentic-setup.md`](./2026-05-26_initial-agentic-setup.md) — this entry

### Root files updated

- [`README.md`](../../../README.md) — "Agent skills" + "Project rules" sections replaced with a unified "Agentic collaboration" section linking the agent roster, skills, CLAUDE.md files, cursor rules, and this changelog.

## Why

Two pain points motivated the work:

1. **Session bloat.** Pulling all five PRDs and the cursor rules via `@`-mentions at the start of every conversation cost thousands of tokens before any work began. CLAUDE.md fixes that by giving Claude Code a small, persistent, contextual orientation that references PRDs instead of inlining them.
2. **No delegation surface.** Every task — UI, route handlers, migrations, tests, engine work — ran in the parent context. Single-purpose sub-agents let the parent delegate specialist work without polluting its own context, which compounds the token win.

Design decisions worth flagging:

- The root CLAUDE.md deliberately does NOT inline the "ship fast / never be lazy" framing from [`global-rules.md`](../../../.cursor/rules/global-rules.md). It adds tokens without changing model behaviour in Claude Code. Cursor still reads `global-rules.md` directly.
- Per-package CLAUDE.md files are loaded contextually (when the agent is editing that area). They aren't pulled into sessions that don't touch the package.
- Each CLAUDE.md ends with a "Delegate to" section pointing to the relevant agent so the parent session has a clear hand-off path.

### Skill-vs-agent decision criteria applied

Three skill candidates were evaluated mid-session:

1. **"add a column with migration + RLS + types regen"** — implemented as `supabase-add-column`. Highest-fit candidate: mechanical, repeated, multi-artifact-must-stay-aligned, subtle failure modes.
2. **"scaffold a new feature folder"** — implemented as `feature-folder-scaffold`, **narrowed** from the original framing. Restricted to CRUD features with list + create/edit drawer + soft delete (the canonical members/recipes shape). Read-only pages, full-page-create flows, and features without an existing module are explicitly out-of-scope.
3. **"shadcn-based form with overlay-dedup nudge"** — **skipped**. The overlay-dedup nudge is too rare a pattern (one or two forms total in the app) to justify a skill, and a broader "shadcn form scaffolder" would overlap heavily with the `ui-component-builder` agent's scope. The pattern is captured implicitly in that agent's "Forms" guidance instead.

Full criteria documented in [`architecture.md`](../architecture.md).

## Cross-references

- [`agents.md`](../agents.md) — full agent catalog with operating rules.
- [`skills.md`](../skills.md) — full skill catalog with input/output shapes.
- [`claude-md.md`](../claude-md.md) — CLAUDE.md inventory and auto-load model.
- [`architecture.md`](../architecture.md) — how the layers compose, decision criteria, token economics.
- [`extending.md`](../extending.md) — playbook for adding new agents/skills/CLAUDE.md.

## Forward-looking notes

### Next session: MCP server evaluation

Candidates to evaluate when MCP servers come up:

- **Supabase MCP** — schema introspection, RLS policy listing, migration status. Cuts speculative grepping by `supabase-migration-author` and `route-handler-engineer`.
- **shadcn MCP** — component registry browsing for `ui-component-builder`.
- **Vitest MCP** — run + parse for the test-authoring agents and a future `ci-gate-runner`.
- **Playwright MCP** — once E2E coverage lands.

Evaluation criteria: (a) does it remove repeated tool calls today, (b) does it give agents capability they currently lack, (c) what's the security blast radius.

### Deferred (not in this initial setup)

- Additional agents — `form-architect`, `react-query-architect`, `rls-policy-author`, `ci-gate-runner`, `monorepo-dep-auditor`, `red-green-refactor-driver`. Worth adding when the four daily-edit agents prove insufficient. Premature to add all of them up front.
- Offload of heavy reference material from `global-rules.md` into `docs/conventions/`. A second token-trim pass once we see which conventions agents actually need on-demand.
- Promoting recurring agent prompts into skills. Watch which patterns the agents repeat in real use, then promote.
- Decision on whether to remove the "my job depends on this" framing from `global-rules.md`. That rule file is still read by Cursor and may still serve a purpose there.

### Migration notes for the team

Nothing to migrate — the additions are non-breaking. Existing skill, cursor rules, PRDs, and code are unchanged. Cursor users see no difference; Claude Code users get the new orientation + agents automatically.

If you previously started a Claude Code session by `@`-mentioning all five PRDs, you can stop. The root [`CLAUDE.md`](../../../CLAUDE.md) covers what every session needs, and individual PRDs are linked for on-demand reads.

To invoke an agent: use the Agent tool with `subagent_type: "<agent-name>"`. To invoke a skill: use `/<skill-name>` or the Skill tool.
