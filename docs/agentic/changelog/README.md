# Agentic changelog

Dated entries describing notable changes to the agentic infrastructure: new agents, new skills, CLAUDE.md additions, MCP servers wired up, conventions established. **This is the changelog for the toolchain, not the code.** Code change history lives in git commits and session history in [`agent-log/`](../../../agent-log/).

## Entries (newest first)

- [`2026-05-26_mcp-servers.md`](./2026-05-26_mcp-servers.md) — Wires three MCP servers (Supabase read-only, shadcn CLI, Vitest) via repo-root [`.mcp.json`](../../../.mcp.json). Closes the deferred MCP-evaluation item from the initial setup.
- [`2026-05-26_initial-agentic-setup.md`](./2026-05-26_initial-agentic-setup.md) — Initial agentic foundation: root + per-package CLAUDE.md, 9 sub-agents, 3 skills (impact-review, supabase-add-column, feature-folder-scaffold), and the [`docs/agentic/`](../) reference docs themselves.

## When to add a new entry

Add a new entry when any of these happen:

- A new agent, skill, or CLAUDE.md file is added.
- An existing one is significantly restructured or removed.
- A new MCP server is wired in.
- A cross-cutting convention is established (e.g. all skills must include at least one worked example).
- A deferred item from a previous entry is implemented or cancelled.

## Entry filename convention

`YYYY-MM-DD_<short-kebab-case-slug>.md` — the date is when the change landed, not when it was planned. If multiple entries land the same day, suffix the slug to differentiate (`2026-05-26_initial-agentic-setup.md`, `2026-05-26_mcp-server-evaluation.md`).

## Entry structure

See [`extending.md`](../extending.md) for the full convention. Briefly:

1. **What changed** — file inventory + one-line per file.
2. **Why** — rationale, especially anything hard to derive from the current state (decision criteria, trade-offs considered).
3. **Cross-references** — pointers to the reference doc(s) that now describe the change in detail.
4. **Forward-looking notes** — what this unlocks or blocks; what's deferred for a future entry.

Keep entries focused on **what changed about the agentic setup**. Don't duplicate the catalog content from [`agents.md`](../agents.md), [`skills.md`](../skills.md), or [`claude-md.md`](../claude-md.md) — link to them.
