# docs/agentic/

Reference documentation for the Weekly Food Planner's agentic infrastructure: the CLAUDE.md files, sub-agents, skills, MCP servers (forthcoming), and the rules that govern how they compose. **This directory is for static reference material — not session history.** Session history lives in [`agent-log/`](../../agent-log/).

## What's here

| File | Purpose |
|---|---|
| [`README.md`](./README.md) | This file — directory index and pointer to the rest. |
| [`architecture.md`](./architecture.md) | How cursor rules, CLAUDE.md, sub-agents, skills, and MCP fit together. Includes the skill-vs-agent decision criteria. |
| [`agents.md`](./agents.md) | Catalog of every sub-agent under [`.claude/agents/`](../../.claude/agents/) — scope, inputs/outputs, hand-offs. |
| [`skills.md`](./skills.md) | Catalog of every skill under [`.claude/skills/`](../../.claude/skills/) — input shape, output shape, examples. |
| [`claude-md.md`](./claude-md.md) | Inventory of every CLAUDE.md file in the repo, what each covers, and when the harness auto-loads it. |
| [`extending.md`](./extending.md) | Playbook for adding a new agent / skill / CLAUDE.md. Conventions, frontmatter, worked-example expectations. |
| [`changelog/`](./changelog/) | Dated entries describing notable changes to the agentic setup itself. Read the latest entry for "what's new"; older entries for rationale on past decisions. |

## How the layers relate

```
┌─────────────────────────────────────────────────────────────┐
│  .cursor/rules/         Project conventions consumed by     │
│  (cursor + Claude)      both Cursor and Claude Code         │
├─────────────────────────────────────────────────────────────┤
│  CLAUDE.md              Per-area orientation auto-loaded by │
│  (root + per-package)   Claude Code based on cwd            │
├─────────────────────────────────────────────────────────────┤
│  .claude/agents/        Specialist sub-agents the parent    │
│  (one .md per agent)    session delegates to                │
├─────────────────────────────────────────────────────────────┤
│  .claude/skills/        Deterministic, multi-artifact       │
│  (SKILL.md + examples)  emitters invoked by name            │
├─────────────────────────────────────────────────────────────┤
│  MCP servers            External capabilities exposed as    │
│  (.mcp.json)            tools to Claude Code                │
└─────────────────────────────────────────────────────────────┘
```

See [`architecture.md`](./architecture.md) for the full composition model and when each layer is the right fit.

## What is NOT here

- **Session history.** Each conversation that lands a meaningful change is logged in [`agent-log/`](../../agent-log/) per [`.cursor/rules/agentic-rules.md`](../../.cursor/rules/agentic-rules.md): prompt used, context files, expected output, observed issue, follow-up fixes. Don't duplicate that here.
- **Raw prompts.** Prompts live in [`prompts/`](../../prompts/) as `.txt`, per the same rule.
- **Product / architecture / database PRDs.** Those live in [`docs/PRD/`](../PRD/) and describe the product itself, not the toolchain that builds it.
- **Cursor-rule content.** [`.cursor/rules/`](../../.cursor/rules/) is the source of truth for project rules; this directory references those rules but does not duplicate them.

## When to update this directory

- After adding a new agent, skill, or CLAUDE.md → update [`agents.md`](./agents.md), [`skills.md`](./skills.md), or [`claude-md.md`](./claude-md.md), and add a [`changelog/`](./changelog/) entry.
- After a notable change to how the agentic layer composes (e.g. adding an MCP server, restructuring the agent roster) → update [`architecture.md`](./architecture.md) and add a changelog entry.
- After establishing a new convention for writing agents or skills → update [`extending.md`](./extending.md).

See [`extending.md`](./extending.md) for the full playbook.
