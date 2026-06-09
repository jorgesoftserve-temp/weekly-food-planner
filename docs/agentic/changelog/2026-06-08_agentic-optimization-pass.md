# 2026-06-08 — Agentic optimization pass (model tiers, tool scoping, new module agent + 3 skills, catalog de-dup)

## What changed

A token-economy + capability pass on the agentic toolchain as the system (and the v1.8/v2.0 feature surface) grows. Five threads:

### 1. Model tiering (right-size cost to task difficulty)
- `prd-aligner` → **`model: haiku`** (drift detection is mechanical pattern-matching over PRD prose vs. code).
- `constraint-engine-engineer` → **`model: opus`** (hardest reasoning in the repo; determinism bugs are silent and expensive).
- `determinism-snapshot-curator` → **`model: opus`** (intentional-vs-regression judgement on golden fixtures).
- All other agents stay `sonnet`.

### 2. Tool scoping for the read-only agents (structural read-only + smaller context)
Replaced the implicit "All tools" with an explicit `tools:` allowlist:
- `prd-aligner` → `Read, Glob, Grep`.
- `ux-reviewer`, `accessibility-auditor` → `Read, Glob, Grep` + the read-only Playwright browser tools (navigate/snapshot/screenshot/click/hover/press_key/resize/console/wait). They review rendered flows but can no longer Edit/Write or reach migration/write MCP tools.

### 3. NEW agent — `supabase-module-author`
Owns the previously-orphaned **data-layer module pair**: `packages/supabase/src/module/<table>.ts` (pure CRUD, `*_SELECT`, `<Table>Record`/`Create*Payload`/`Update*Patch`) + `<table>.react.ts` (query-key catalogue + hooks) + barrel re-exports. This layer sat between `supabase-migration-author` (stops at SQL) and the consumers (`route-handler-engineer` / `ui-component-builder`), and was hand-written each time. `route-handler-engineer` was updated to hand module authoring to it rather than inlining CRUD. Encodes the live convention that modules **throw** (consumers toast) — diverging from a stale line in `query-patterns.md`.

### 4. EXTENDED `route-handler-engineer`
Added a **"Member-writable menu/grocery mutations (v1.8)"** section: the two narrow exceptions (`menu_slots.cooked_at`/`cooked_by` for Cook mode, `grocery_items.note` for shopper notes) authorize on **membership not role**, touch only their narrow column set, and never trigger the engine, recompute, or `accepted_seed`. Output/hand-off sections now route module work to `supabase-module-author`.

### 5. THREE new skills
- **`add-module-and-hooks`** — emits a new module pair (`.ts` + `.react.ts` + barrel) for an already-migrated table. The "create a module" counterpart to `supabase-add-column` (which only adds a column to an existing one).
- **`add-route-handler`** — scaffolds a standard handler/server action: three-client rule, awaited `params`/`cookies()`, sibling Zod schema, role- OR membership-gated auth, the `{ error, detail }` envelope, integration-test pointer. Worked example is the v1.8 membership-gated `PATCH …/grocery/items/[itemId]` note endpoint.
- **`promote-design-lab-mock`** — the deterministic screen-by-screen plan to graduate a `/design-lab` mock into the live app (v1.8 Phase 3): scoped cozy tokens → promoted globals tokens, `mock-data.ts` → real React Query hooks, `lab-nav` → real routing, responsive + a11y, retire the mock. Worked example: the Members screen.

### 6. Catalog de-duplication (drift control)
Root [`CLAUDE.md`](../../../CLAUDE.md) MCP + agent tables compressed to terse one-line indexes pointing at `docs/agentic/`; the skills list gained the 3 new skills. The four `docs/agentic/` catalogs (`agents.md`, `skills.md`, `mcp-servers.md`, `claude-md.md`) were rewritten from hand-maintained full-detail mirrors into **thin indexes** (one line + link per item; source files authoritative). Net ~240 lines of duplicated prose removed; the source `.md`/`.json` files are now the single source of truth.

### 7. Security fix (incidental)
A live Figma PAT had been hardcoded in [`.mcp.json`](../../../.mcp.json); restored the `${FIGMA_API_KEY}` env reference. Verified the token was never committed or pushed (absent from all git history).

## Why

The toolchain crossed ~25 authored components and is about to grow with v1.8 (cook mode, grocery notes, per-member accent, search) and v2.0 (multi-week, inventory). Three costs were rising: (a) every delegated agent loaded the full tool schema regardless of need; (b) all agents ran `sonnet` regardless of task difficulty; (c) the `docs/agentic/` catalogs duplicated the source files and had already drifted. Tiering + scoping right-sizes per-agent cost; the new module agent + skills remove repeated hand-authoring of boilerplate layers; the catalog de-dup makes the source files canonical so future edits touch one place.

## File inventory

- Agents edited: `prd-aligner.md` (haiku + RO tools; stale `design-system-auditor` ref also fixed in `ux-reviewer.md`), `ux-reviewer.md`, `accessibility-auditor.md`, `constraint-engine-engineer.md` (opus), `determinism-snapshot-curator.md` (opus), `route-handler-engineer.md` (member-writable section + module hand-off).
- Agent added: `.claude/agents/supabase-module-author.md`.
- Skills added: `.claude/skills/{add-module-and-hooks,add-route-handler,promote-design-lab-mock}/SKILL.md` + a worked example under each `docs/examples/`.
- Docs: root `CLAUDE.md` (trimmed + registered), `docs/agentic/{agents,skills,mcp-servers,claude-md}.md` (thin indexes), `.mcp.json` (token fix).

## Cross-references

- Agent catalog: [`agents.md`](../agents.md) · Skill catalog: [`skills.md`](../skills.md) · MCP: [`mcp-servers.md`](../mcp-servers.md) · Extending guide: [`extending.md`](../extending.md).
- v1.8 features the new agent/skills serve: [`docs/PRD/PRODUCT_PRD.md`](../../PRD/PRODUCT_PRD.md) §§12–14, [`DATABASE_PRD.md`](../../PRD/DATABASE_PRD.md) §6.0/6.2/6.12/6.14.

## Forward-looking

- Deferred to a follow-up pass (user-requested): tighten the per-module/submodule CLAUDE.md files for cheaper cross-module indexing; an MCP-usage roadmap for v1.8/v2.0; a `.cursor/rules/` re-review against current + future project knowledge.
- The `tools:` allowlist pattern is now established — future read-only agents should declare a minimal scope rather than defaulting to "All tools".
- Model tiers are frontmatter defaults; the parent loop can still override per-invocation (e.g. invoke a builder with `opus` for an unusually hard task).
