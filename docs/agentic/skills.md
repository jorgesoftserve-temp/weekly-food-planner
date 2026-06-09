# Skill catalog

Index only — the linked `SKILL.md` source files under [`.claude/skills/`](../../.claude/skills/) are authoritative. Keep entries to one line; detail (input shape, steps, non-negotiables, examples) lives in the source.

## Invocation

When the user types `/<skill-name>` (or asks for it by name) the harness loads the skill's `SKILL.md` automatically and runs its workflow against the conversation's current state.

```
Skill(
  skill: "<skill-name>",
  args: "<optional argument string>"
)
```

The harness auto-discovers any skill under `.claude/skills/<name>/SKILL.md` — a new skill is seen next session without manual registration.

## Lifecycle skills

| Skill | Purpose |
|---|---|
| [`constraint-menu-generator-life-cycle-test`](../../.claude/skills/constraint-menu-generator-life-cycle-test/SKILL.md) | Paired life-cycle test: Vitest + Node ESM HTTP driver |

## Planning skills

| Skill | Purpose |
|---|---|
| [`menu-generation-impact-review`](../../.claude/skills/menu-generation-impact-review/SKILL.md) | Layered impact review + plan for a menu-gen feature (no code) |

## Mechanical-task skills

| Skill | Purpose |
|---|---|
| [`supabase-add-column`](../../.claude/skills/supabase-add-column/SKILL.md) | Add a column: migration + types-regen + module updates |
| [`add-module-and-hooks`](../../.claude/skills/add-module-and-hooks/SKILL.md) | New data-layer module pair for an already-migrated table |
| [`add-route-handler`](../../.claude/skills/add-route-handler/SKILL.md) | Scaffold a standard route handler / server action |
| [`feature-folder-scaffold`](../../.claude/skills/feature-folder-scaffold/SKILL.md) | Scaffold a CRUD feature folder under `(app)/<feature>/` |
| [`promote-design-lab-mock`](../../.claude/skills/promote-design-lab-mock/SKILL.md) | Graduate a `/design-lab` mock into the live app (v1.8 Phase 3) |
| [`design-lab-parity-check`](../../.claude/skills/design-lab-parity-check/SKILL.md) | Capture live-vs-mock Playwright evidence (390/820/1440px × light/dark) for the `design-parity-auditor` |

## Skill file structure (for reference)

```
.claude/skills/<name>/
  SKILL.md                       Frontmatter (name, description) + workflow
  docs/
    examples/
      <example>.{md,yaml}        Worked input or output (at least one)
```

The `SKILL.md` body covers: framing, when to invoke / NOT invoke (with the right alternative named), input shape, authoritative repo references, deterministic steps, output template, non-negotiables, and what to flag.

See [`extending.md`](./extending.md) for the full conventions and how to author a new skill.

## Decision: skill vs. agent vs. ad-hoc

| Task profile | Use |
|---|---|
| Deterministic walk against a fixed checklist, repeated, multi-artifact | **Skill** |
| Specialist work that exercises judgment per invocation | **Agent** |
| One-off or exploratory work | **Ad-hoc (parent session)** |

Full criteria in [`architecture.md`](./architecture.md). Rule of thumb: "every time we do X, we have to remember Y" — that's a skill candidate.
