# Step 19 — README documentation backfill: UI / API / testing tiers + skill section

## Prompt used

See [/prompts/19-readme-backfill.txt](../prompts/19-readme-backfill.txt).

Summary: the user asked for a README pass covering everything that landed between the initial commit and now — the UI route groups, the REST surface, the test stratification, and the new `constraint-menu-generator-life-cycle-test` skill. Single commit ([03d8828](https://github.com/jorgesoftserve-temp/weekly-food-planner/commit/03d8828)).

## Context files provided

- The repo state after the skill + examples were committed.
- The original [README.md](../README.md) — short, accurate at the time of initial commit but stale after Phases 1–6 of UI work and the recent skill.
- Implicit: every route, page, and test the README would have to reference.

## Expected output

Four new sections inserted before "Project rules":

- **UI** — auth + `(app)` route groups, recipe-edit drawer behavior, route protection in [middleware.ts](../apps/web/middleware.ts).
- **API** — a table of every REST endpoint under `/api/`, grouped by resource, with links to each route file.
- **Testing** — the three-tier split: mocked Vitest (in CI), env-gated integration via [createIntegrationFixture](../packages/test-utils/src/integration/fixture.ts), and the [verify-flow.mjs](../scripts/verify-flow.mjs) end-to-end driver. Also clarified that CI runs typecheck + the mocked tier only.
- **Agent skills** — the new [constraint-menu-generator-life-cycle-test](../.claude/skills/constraint-menu-generator-life-cycle-test/SKILL.md) skill plus a pointer to the example specs under its `docs/`.

Updated **Stack** and **Layout** sections to match reality (see "Observed issue" below).

## Observed issue

The pass surfaced four pre-existing inaccuracies in the README that I corrected while there (flagged to the user in the commit summary so they could push back if they wanted them left alone):

- **Engine claim**: "greedy assignment + local-search refinement" — local-search/soft-constraint scoring is still on the follow-up list per [ARCHITECTURE_PRD §6.1](../docs/PRD/ARCHITECTURE_PRD.md) and [step 18's open items](./18-edit-mode-drawer-and-verify.md). Now reflects actual state.
- **Local infra**: the old command pointed at `infrastructure/docker/docker-compose.yml` — a directory that doesn't exist. Replaced with `pnpm --filter @weekly-food-planner/supabase db:start` (the Supabase CLI command actually wired up).
- **Testing claim**: "Vitest (Playwright optional for E2E)" — Playwright isn't installed. Replaced with a pointer to [verify-flow.mjs](../scripts/verify-flow.mjs).
- **Layout block** listed `infrastructure/docker/` (doesn't exist), missing `scripts/`, `.claude/skills/`, `.github/workflows/`. Fixed.

User didn't object — backfill landed as-is.

## Follow-up fixes

- The API table is hand-curated. Adding new routes in the future will require manual README updates, or a tiny code-gen step that walks `apps/web/app/api/**/route.ts`. Not worth the infra yet at ~15 endpoints.
- The Testing table claims the verify-flow driver is run "locally". Once Playwright + a `verifier-browser` skill land (open from [step 18](./18-edit-mode-drawer-and-verify.md)), this section will need a fourth row.
