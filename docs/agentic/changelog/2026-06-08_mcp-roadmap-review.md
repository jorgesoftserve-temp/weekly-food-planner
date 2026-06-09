# 2026-06-08 — MCP usage review + roadmap (v1.8 → v2.0)

## What changed

A deliberate review of MCP server usage against the v1.8/v2.0 feature surface. **Outcome: no `.mcp.json` change.** The six servers (`supabase-local`, `supabase-remote`, `shadcn`, `playwright`, `figma`, `menu`) stay as-is for v1.8. This entry records the decision + roadmap so it isn't re-litigated. Governing principle: **six servers is already at the edge of healthy — a new MCP earns its slot only when it removes a *repeated* multi-step loop that an existing tool, agent, or skill cannot.**

## Decisions

**v1.8 — keep all six, add none.** v1.8 is a presentation-layer release plus the `profiles` accent preference; it deliberately doesn't touch the engine or the menu/grocery contracts, so almost every "would an MCP help?" resolves to "existing tools cover it":
- `supabase-local` (ad-hoc SQL / RLS checks), `shadcn` (Phase-3 primitive promotion), `playwright` (design-lab + live screenshots, the a11y pass) are at peak utility now — keep.
- `supabase-remote` (advisors/introspection) and `menu` (engine/preview) are quieter in v1.8 but cheap to keep.
- `figma` stays **dormant** — activating it for design-to-code is overkill against the project's own decision that `/design-lab` mocks (real Tailwind) graduate straight into code; Figma output would be rebuilt anyway.
- Candidates explicitly **rejected** for v1.8: a Supabase Storage MCP (no upload feature in scope), new `menu` cooked-state/search tools (plain CRUD/read — `supabase-local` `query` covers; no engine join to wrap), a docs/library-reference MCP (`shadcn` + `supabase-remote`'s `search_docs` already cover most).

**a11y matrix — try a technique, not a server.** v1.8's bar ("AA on every accent in light + dark") is matrix-shaped. Run **axe-core inside the existing `playwright` MCP** via `browser_evaluate` (inject `axe.min.js`, run, read violations) rather than adding a dedicated axe MCP. Promote to a real server only if the in-Playwright technique proves clumsy across repeated runs.

**v2.0 — grow the `menu` server, don't add new ones.** v2 is where the engine/workspace state expands:
- Track C (inclusive prefs, multi-timeframe) rides the **existing** `engine_*` / `workspace_preview_menu` tools once the engine types carry the new fields — near-zero MCP cost.
- `workspace_inventory` / `community_recipes_search` read tools are pre-authorized in [`v2.md`](../../../.claude/plans/v2.md) but should be built **only when** inventory/community features start *and* inspection loops actually repeat. New tools on the existing server → no `.mcp.json` change, just a changelog entry + a row in the `menu` tool surface.

## Why

The toolchain is growing and MCP sprawl has a real cost (version/auth fatigue, tool-schema weight per agent). Right-sizing here means resisting additions whose value an existing tool/skill already delivers. The one place a *new* server might eventually be justified is a dedicated axe/a11y MCP — and only if the cheaper in-Playwright technique fails.

## Cross-references

- Server index: [`mcp-servers.md`](../mcp-servers.md) (source of truth: [`.mcp.json`](../../../.mcp.json)).
- Prior MCP entries: [`2026-05-26_mcp-servers.md`](./2026-05-26_mcp-servers.md), [`2026-05-29_menu-mcp-server.md`](./2026-05-29_menu-mcp-server.md), [`2026-06-08_playwright-figma-mcp.md`](./2026-06-08_playwright-figma-mcp.md).
- Feature scope driving the review: [`.claude/plans/v1.8.md`](../../../.claude/plans/v1.8.md), [`.claude/plans/v2.md`](../../../.claude/plans/v2.md), [`docs/PRD/PRODUCT_PRD.md`](../../PRD/PRODUCT_PRD.md) §§12–14.

## Forward-looking

- **When v1.8 a11y work starts:** add a short axe-via-Playwright recipe to the `accessibility-auditor` contract; document as its own changelog entry only if it graduates to a server.
- **When v2 Track C / inventory / community start:** extend `apps/menu-mcp-server/src/tools/` (template: `workspace-recent-menus.ts`); no new server.
- Incidental during this review: a hardcoded Figma PAT in `.mcp.json` was replaced with the `${FIGMA_API_KEY}` env reference (never committed — see the agentic-optimization-pass entry).
