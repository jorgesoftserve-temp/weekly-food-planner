# MCP servers

Index only — [`.mcp.json`](../../.mcp.json) at the project root is the authoritative source for server wiring (packages, args, env). Keep entries to one line; tool lists and command args live in the source and the linked changelog entries. Companion to [`agents.md`](./agents.md), [`skills.md`](./skills.md), and [`claude-md.md`](./claude-md.md).

Claude Code auto-discovers all servers on session start; `/mcp` confirms connection. Composition rationale: [`architecture.md`](./architecture.md#mcp-servers). Smoke-test every server's JSON-RPC handshake with `node scripts/smoke-mcp.mjs --all`.

## The lineup

| Server | Purpose | Auth |
|---|---|---|
| `supabase-local` | Ad-hoc SQL reads against the local dev DB (`127.0.0.1:54322`) | None — needs local Supabase running |
| `supabase-remote` | Supabase-feature introspection on the hosted project (read-only) | `SUPABASE_PROJECT_REF` + `SUPABASE_ACCESS_TOKEN` |
| `shadcn` | Component registry browsing (list / view / demo) | None |
| `playwright` | Drive / screenshot the running app in a real browser | None — needs `pnpm dev` running |
| `figma` | Pull Figma frames into context (secondary / dormant) | `FIGMA_API_KEY` (inert without it) |
| `menu` | Engine + workspace tools for menu generation | `MENU_MCP_USER_JWT` (workspace tools only) |

## Boundary conventions

- **No mutations through MCP.** Schema changes always go through the migration ritual (auditable in git), never MCP.
- **JWT, never service-role** on the menu server — it impersonates a member so RLS applies.
- **Smoke before commit** — `node scripts/smoke-mcp.mjs --all` catches package-rename and dependency issues before a live session.

## Cross-references

- Wiring + initial three servers: [`changelog/2026-05-26_mcp-servers.md`](./changelog/2026-05-26_mcp-servers.md).
- Custom menu server (engine + workspace tools, route additions): [`changelog/2026-05-29_menu-mcp-server.md`](./changelog/2026-05-29_menu-mcp-server.md).
- Smoke-driven corrections (dropped vitest, split supabase local/remote, fixed menu launch): [`changelog/2026-06-08_mcp-server-smoke-corrections.md`](./changelog/2026-06-08_mcp-server-smoke-corrections.md).
- Composition with the other agentic layers: [`architecture.md`](./architecture.md).
- Adding a new MCP server: [`extending.md`](./extending.md) and [`architecture.md`](./architecture.md#when-to-add-a-new-mcp-server).
