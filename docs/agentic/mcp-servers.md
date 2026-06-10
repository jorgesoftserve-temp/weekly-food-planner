# MCP servers

The **authoritative lineup** (server, use-for, auth) is the MCP table in [root `CLAUDE.md`](../../CLAUDE.md); the **authoritative wiring** (packages, args, env) is [`.mcp.json`](../../.mcp.json) at the project root. This doc is **not** a second catalog — it holds the *boundary conventions* and a worked demo ([`mcp-demo.md`](./mcp-demo.md)). For the list, read the CLAUDE.md table.

Claude Code auto-discovers all servers on session start; `/mcp` confirms connection. Composition rationale: [`architecture.md`](./architecture.md#mcp-servers). Smoke-test every server's JSON-RPC handshake with `node scripts/smoke-mcp.mjs --all`.

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
