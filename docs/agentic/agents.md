# Agents — how to invoke

The **authoritative list** of agents (name, model tier, one-line "when") is the agent table in [root `CLAUDE.md`](../../CLAUDE.md) — auto-loaded every session — and the source files under [`.claude/agents/`](../../.claude/agents/), which the harness auto-discovers from each file's frontmatter `description`. This doc is **not** a second catalog (it used to be, and the two drifted): it covers *how to invoke* an agent and *how agent files are structured*. To see the full lineup, read the CLAUDE.md table.

## Invocation

```
Agent(
  subagent_type: "<name>",
  description: "<3–5 word task summary>",
  prompt: "<self-contained task brief — agent has no conversation context>"
)
```

The parent session's prompt is the agent's only input. Brief it like a smart colleague who just walked in: state the goal, what you've ruled out, file paths/line numbers, and the response shape you want.

## How the lineup is organized

The CLAUDE.md table groups the agents by use pattern — useful for picking the right one:

- **Daily-edit agents** (cover ~80% of feature work): `design-system-architect`, `ui-component-builder`, `route-handler-engineer`, `supabase-migration-author`, `supabase-module-author`, `vitest-integration-author`, `prd-author`.
- **Review-pass agents** (run pre-PR, read-only/tool-scoped): `ux-reviewer`, `accessibility-auditor`, `design-parity-auditor`, `prd-aligner`.
- **Engine-protecting agents** (opus): `constraint-engine-engineer`, `determinism-snapshot-curator`.

Model tiers and exact scopes live in each source file's frontmatter and the CLAUDE.md table — not duplicated here.

## Agent file structure (for reference)

Every agent file follows the same shape:

```markdown
---
name: <kebab-case>
description: <when to use / when NOT to use — full sentence with both>
model: sonnet | haiku | opus
---

# Body sections (in order)
1. One-paragraph framing pointing at the relevant CLAUDE.md / PRD
2. Operating rules — the non-negotiables
3. Domain-specific guidance
4. Pre-flight checklist (optional)
5. When to hand off — adjacent agents
6. Output expectations
```

See [`extending.md`](./extending.md) for the full conventions and how to add a new agent.
