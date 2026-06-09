---
description: 
globs: 
alwaysApply: true
---
# Agentic Rules

This project supports Claude Code / Cursor agentic workflows. The **authoritative catalog** of sub-agents, skills, MCP servers, and the CLAUDE.md hierarchy lives in [`docs/agentic/`](../../docs/agentic/) and the root [`CLAUDE.md`](../../CLAUDE.md). Consult those before adding or invoking, and route specialist work to the right agent/skill rather than doing it inline.

## Conventions that always hold

- **Route to specialists.** Schema → `supabase-migration-author`; data-layer modules/hooks → `supabase-module-author`; route handlers → `route-handler-engineer`; engine → `constraint-engine-engineer`; UI → `ui-component-builder`; tokens → `design-system-architect`. Pre-PR reviews: `ux-reviewer`, `accessibility-auditor`, `prd-aligner`. See [`docs/agentic/agents.md`](../../docs/agentic/agents.md).
- **Agent log.** Each major generation step gets an entry under [`/agent-log`](../../agent-log/): prompt used, context files provided, expected output, observed issue, follow-up fixes.
- **Prompts** are stored as raw `.txt` under [`/prompts`](../../prompts/).
- **Docs** — PRDs, specs, architecture docs, and rules are `.md` (under [`/docs`](../../docs/) or `.cursor/rules/`).
- **Extending the toolchain** — follow [`docs/agentic/extending.md`](../../docs/agentic/extending.md) when adding an agent, skill, or CLAUDE.md, and add a dated [`docs/agentic/changelog/`](../../docs/agentic/changelog/) entry.
