# Skills — how to invoke

The **authoritative list** of skills is the skill section of [root `CLAUDE.md`](../../CLAUDE.md) and the `SKILL.md` source files under [`.claude/skills/`](../../.claude/skills/), which the harness auto-discovers from each file's frontmatter `description`. This doc is **not** a second catalog — it covers *how to invoke* a skill, *how skill files are structured*, and the *skill-vs-agent decision*. For the full list, read the CLAUDE.md skill section.

## Invocation

When the user types `/<skill-name>` (or asks for it by name) the harness loads the skill's `SKILL.md` automatically and runs its workflow against the conversation's current state.

```
Skill(
  skill: "<skill-name>",
  args: "<optional argument string>"
)
```

The harness auto-discovers any skill under `.claude/skills/<name>/SKILL.md` — a new skill is seen next session without manual registration (only the one-line bullet in root CLAUDE.md is added, for the human-readable index).

The CLAUDE.md skill section groups them by type: **lifecycle** (`constraint-menu-generator-life-cycle-test`), **planning** (`menu-generation-impact-review`), and **mechanical-task** (`supabase-add-column`, `new-table-migration`, `add-module-and-hooks`, `add-route-handler`, `feature-folder-scaffold`, `promote-design-lab-mock`, `design-lab-parity-check`).

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
