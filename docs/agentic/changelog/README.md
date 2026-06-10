# Agentic changelog

> **Frozen as of 2026-06-10.** This hand-written changelog duplicated what `git log` already
> records, and writing an entry per change was a velocity tax on every toolchain edit. The dated
> entries below are kept as **historical record** (they hold decision rationale that predates this
> freeze), but **new agentic changes are no longer logged here** — use `git log` + the commit
> message. The authoritative state of the toolchain is its source files: [`.claude/agents/`](../../../.claude/agents/),
> [`.claude/skills/`](../../../.claude/skills/), [`.mcp.json`](../../../.mcp.json), and the catalog/index in
> [root `CLAUDE.md`](../../../CLAUDE.md).

Dated entries describing notable changes to the agentic infrastructure: new agents, new skills, CLAUDE.md additions, MCP servers wired up, conventions established. **This is the (frozen) changelog for the toolchain, not the code.** Code change history lives in git commits and session history in [`agent-log/`](../../../agent-log/).

## Entries (newest first)

- [`2026-06-09_design-parity-auditor.md`](./2026-06-09_design-parity-auditor.md) — Adds the missing v1.8 Phase-3 review pass: the **`design-parity-auditor`** agent (read-only, Playwright) verifies a promoted live screen matches its approved `/design-lab` mock, gating mock retirement, and the **`design-lab-parity-check`** skill captures the deterministic evidence (live vs. mock at 390/820/1440px × light/dark, structural + token deltas). Heuristic, not pixel-diff. Wires into `promote-design-lab-mock`, the `design-and-mutations` + `agentic-rules` rules, and cross-references the two existing reviewers.
- [`2026-06-08_rules-and-claude-md-hardening.md`](./2026-06-08_rules-and-claude-md-hardening.md) — Corrects the stale toast/error convention across the rules + CLAUDE.md (modules throw; the component layer toasts), trims `global-rules.md` ~708→~357 lines of always-loaded boilerplate, modernizes `agentic-rules.md`, adds a `design-and-mutations.md` rule for the v1.8 invariants (tokens-only, accent scoping, member-writable guardrail), and cross-links the per-area CLAUDE.md files.
- [`2026-06-08_mcp-roadmap-review.md`](./2026-06-08_mcp-roadmap-review.md) — Reviews MCP usage against the v1.8/v2.0 surface and decides to add **zero** servers for v1.8 (keep all six; figma stays dormant; try axe-core inside the existing Playwright MCP for the a11y matrix); v2.0 grows the `menu` server rather than adding new ones. Records the roadmap so it isn't re-litigated.
- [`2026-06-08_agentic-optimization-pass.md`](./2026-06-08_agentic-optimization-pass.md) — Token-economy + capability pass: model tiers (prd-aligner→haiku, engine/determinism→opus), read-only tool scoping (prd-aligner/ux-reviewer/accessibility-auditor), a new `supabase-module-author` agent + member-writable extension to `route-handler-engineer`, three new skills (`add-module-and-hooks`, `add-route-handler`, `promote-design-lab-mock`), CLAUDE.md trim, and `docs/agentic/` catalog de-duplication into thin indexes. Plus a Figma-token `.mcp.json` fix.
- [`2026-06-08_design-lab-review-pass.md`](./2026-06-08_design-lab-review-pass.md) — Folds review feedback into the `/design-lab` mocks: clickable prototype nav, per-member accent, render-on-type topbar search, day×meal menu grid, cook mode, grocery notes (⚠ proposed). One live change — brand strawberry rosied `#fb4b4e → #fb4b66`.
- [`2026-06-08_design-lab-figma-make-pass.md`](./2026-06-08_design-lab-figma-make-pass.md) — Adopts the valuable parts of an external Figma-Make spec into `/design-lab` (real food imagery + fallback, Members mock, Todoist-style grocery, status palette, device-width viewport toggle); rejects its stack-specific bits (inline hex, `@import` fonts, `prefers-color-scheme`).
- [`2026-06-08_playwright-figma-mcp.md`](./2026-06-08_playwright-figma-mcp.md) — Adds the `playwright` MCP (browser drive/screenshot for the v1.8 redesign + responsive checks) and a dormant `figma` MCP (Framelink, token-gated, secondary/future). Registered in CLAUDE.md + mcp-servers.md.
- [`2026-06-08_design-system-architect.md`](./2026-06-08_design-system-architect.md) — Adds the build-capable `design-system-architect` agent (v1.8 UI rework) that owns the color tokens, gradients, typography, and the per-user accent mechanism, plus the new `docs/design/` docs (color-palette, user-accent-colors, v1.8-ui-mockups). The authority other UI agents defer to on visual language; contrast co-signed by `accessibility-auditor`.
- [`2026-06-08_mcp-server-smoke-corrections.md`](./2026-06-08_mcp-server-smoke-corrections.md) — Pre-commit smoke pass on the four MCP servers surfaces three corrections: fixes the `menu` launch command (pnpm-filter, not `node --import tsx/esm` which couldn't resolve `tsx` from repo root), removes the `vitest` entry (configured npm package doesn't exist), and splits `supabase-local` vs `supabase-remote` honestly in every catalog. Adds reusable [`scripts/smoke-mcp.mjs`](../../../scripts/smoke-mcp.mjs).
- [`2026-05-29_menu-mcp-server.md`](./2026-05-29_menu-mcp-server.md) — Adds a fourth MCP server: a custom in-repo runtime at [`apps/menu-mcp-server/`](../../../apps/menu-mcp-server/) with three pure-engine tools and four HTTP-backed workspace tools. Backed by three new app routes (`/menus/preview`, `/recipes/:id/usability`, `/members/:id/constraints`), a shared `buildWeeklyEngineInput` helper, an engine extension (`describeRecipeEligibility`), and a 3-test constraint-regression suite.
- [`2026-05-26_mcp-servers.md`](./2026-05-26_mcp-servers.md) — Wires three MCP servers (Supabase read-only, shadcn CLI, Vitest) via repo-root [`.mcp.json`](../../../.mcp.json). Closes the deferred MCP-evaluation item from the initial setup.
- [`2026-05-26_initial-agentic-setup.md`](./2026-05-26_initial-agentic-setup.md) — Initial agentic foundation: root + per-package CLAUDE.md, 9 sub-agents, 3 skills (impact-review, supabase-add-column, feature-folder-scaffold), and the [`docs/agentic/`](../) reference docs themselves.

## How toolchain changes are recorded now

No new entries. When you add/change/remove an agent, skill, MCP server, or convention:

1. Edit the **source file** ([`.claude/agents/`](../../../.claude/agents/), [`.claude/skills/`](../../../.claude/skills/), or [`.mcp.json`](../../../.mcp.json)) — it is authoritative.
2. Add/update its **one-line row** in [root `CLAUDE.md`](../../../CLAUDE.md).
3. Describe the *why* in the **commit message**. `git log -- docs/agentic .claude .mcp.json` is the audit trail.

The rationale for non-obvious decisions belongs in the commit message or, if it's a durable convention, in [`extending.md`](../extending.md) / [`architecture.md`](../architecture.md) — not a dated file that only grows.
