# Agent catalog

Index only — the linked source files under [`.claude/agents/`](../../.claude/agents/) are authoritative. Keep entries to one line; detail (scope, operating rules, hand-offs, output shape) lives in the source.

## Invocation

```
Agent(
  subagent_type: "<name>",
  description: "<3–5 word task summary>",
  prompt: "<self-contained task brief — agent has no conversation context>"
)
```

The parent session's prompt is the agent's only input. Brief it like a smart colleague who just walked in: state the goal, what you've ruled out, file paths/line numbers, and the response shape you want.

## Daily-edit agents (cover ~80% of feature work)

| Agent | Model | Purpose |
|---|---|---|
| [`design-system-architect`](../../.claude/agents/design-system-architect.md) | sonnet | Visual design system — tokens, theme, per-user accent |
| [`ui-component-builder`](../../.claude/agents/ui-component-builder.md) | sonnet | New components + feature `_components/` |
| [`route-handler-engineer`](../../.claude/agents/route-handler-engineer.md) | sonnet | Route handlers + server actions |
| [`supabase-migration-author`](../../.claude/agents/supabase-migration-author.md) | sonnet | Any schema change (DDL, RLS, RPCs) |
| [`supabase-module-author`](../../.claude/agents/supabase-module-author.md) | sonnet | Data-layer modules + hooks (`module/<table>.ts` + `.react.ts` + barrel) |
| [`vitest-integration-author`](../../.claude/agents/vitest-integration-author.md) | sonnet | CRUD + RLS + role-matrix integration tests |

## Review-pass agents (run pre-PR)

| Agent | Model | Purpose |
|---|---|---|
| [`ux-reviewer`](../../.claude/agents/ux-reviewer.md) | sonnet, tool-scoped (Read/Glob/Grep + read-only Playwright) | Product UX review against the PRDs |
| [`accessibility-auditor`](../../.claude/agents/accessibility-auditor.md) | sonnet, tool-scoped (Read/Glob/Grep + read-only Playwright) | A11y review — keyboard, ARIA, contrast |
| [`design-parity-auditor`](../../.claude/agents/design-parity-auditor.md) | sonnet, tool-scoped (Read/Glob/Grep + read-only Playwright + Skill) | Phase-3 promotion fidelity — live screen vs. `/design-lab` mock (runs `design-lab-parity-check`) |
| [`prd-aligner`](../../.claude/agents/prd-aligner.md) | haiku, tool-scoped read-only | Drift detection between PRDs and code |

## Engine-protecting agents

| Agent | Model | Purpose |
|---|---|---|
| [`constraint-engine-engineer`](../../.claude/agents/constraint-engine-engineer.md) | opus | Changes inside `packages/constraint-engine/` |
| [`determinism-snapshot-curator`](../../.claude/agents/determinism-snapshot-curator.md) | opus | Engine golden-snapshot regression suite |

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
