# 2026-06-08 — Playwright + Figma MCP servers (v1.8 Phase 2 design tooling)

## What changed

- **`.mcp.json`** — added two servers:
  - `playwright` — `@playwright/mcp@latest --isolated`. No auth.
  - `figma` — Framelink `figma-developer-mcp` reading `FIGMA_API_KEY`. **Dormant** until the token is set.
- **`CLAUDE.md`** + **`docs/agentic/mcp-servers.md`** — registered both in the MCP tables + per-server sections.

## Why

v1.8 Phase 2 is a mock-first redesign reviewed in an in-repo `/design-lab` route. Two tools support that:

- **Playwright** lets the design work be verified in a real browser — screenshot `/design-lab` (and
  the live screens) at phone/tablet/desktop widths to confirm responsive behaviour before the cozy
  restyle is promoted into the live app. It replaces eyeballing and manual devtools resizing.
- **Figma** is added as a **secondary/future** bridge per the user's request: if a design is ever
  authored in Figma, the agent can pull frames into context. It requires a Figma personal access
  token the user supplies (`FIGMA_API_KEY`); without it the server is inert and harmless. The default
  mock vehicle remains `/design-lab` because those mocks are real Tailwind and graduate straight into
  implementation — Figma output would have to be re-built in code.

## Cross-references

- MCP catalog: [`docs/agentic/mcp-servers.md`](../mcp-servers.md).
- Plan of record: [`.claude/plans/v1.8.md`](../../../.claude/plans/v1.8.md) → Phase 2, Part J.
- Smoke driver: [`scripts/smoke-mcp.mjs`](../../../scripts/smoke-mcp.mjs) — note the `figma` server will
  fail the handshake until `FIGMA_API_KEY` is set; that's expected while it's dormant.

## Forward-looking notes

- Phase 3 (the actual cozy restyle of the live shadcn primitives) will lean on the Playwright MCP for
  before/after visual diffs once the `/design-lab` direction is approved.
