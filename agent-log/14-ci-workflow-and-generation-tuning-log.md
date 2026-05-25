# Step 14 — CI workflow + generation-rule tuning log

## Prompt used

See [/prompts/14-ci-workflow-and-generation-tuning-log.txt](../prompts/14-ci-workflow-and-generation-tuning-log.txt).

Summary: two deliverables in one cycle — (a) wire up a GitHub Actions CI workflow that runs `pnpm typecheck` and `pnpm test` plus a badge in [README.md](../README.md); (b) add a dedicated agent-log entry that pulls together every prompt that shaped the constraint engine's generation rules, since the project deliverable explicitly calls for "agent_log entries for prompts used to tune generation rules" and the existing logs (01–13) interleave that history with non-engine work.

## Context files provided

- [.cursor/rules/agentic-rules.md](../.cursor/rules/agentic-rules.md) — log format + prompt-as-`.txt` rule.
- [package.json](../package.json) — confirms root scripts `test` and `typecheck` both dispatch through `turbo run …`.
- [turbo.json](../turbo.json) — confirms the `test` and `typecheck` task graph.
- [.npmrc](../.npmrc) + [pnpm-workspace.yaml](../pnpm-workspace.yaml) — pnpm 9.12.3, workspaces under `apps/*` and `packages/*`.
- Agent-log entries 04, 06, 07, 08, 09, 10, 12, 13 — the cycles that introduced or changed generation-engine rules (or, for 13, the export surface that consumes them).

## Expected output

### A — CI workflow

- New [.github/workflows/ci.yml](../.github/workflows/ci.yml):
  - Triggers on `push` + `pull_request` against `main`.
  - `concurrency` group cancels superseded runs on the same ref.
  - Pins `pnpm@9.12.3` via [`pnpm/action-setup@v4`](https://github.com/pnpm/action-setup) (matches the root `packageManager` field).
  - `actions/setup-node@v4` with `node-version: 20` (matches the `engines.node: >=20` constraint) and `cache: pnpm`.
  - `pnpm install --frozen-lockfile` → `pnpm typecheck` → `pnpm test`.
- Badge added to [README.md](../README.md) directly under the H1, pointing at `actions/workflows/ci.yml/badge.svg`. Owner segment uses the `<your-org>` placeholder with an inline replace-this note — the repo is not yet pushed to a remote, so the real path is not knowable from inside the working copy.

### B — Generation-rule tuning log

The constraint engine's behavior was shaped across seven prompt cycles. This is the consolidated map of which prompt changed which rule, with links to the original logs for full context.

#### 1. Hard-constraint filtering — meal_type, dietary tags, allergies, ingredient exclusions

- **Prompt 09** — [prompts/09-begin-project-generation.txt](../prompts/09-begin-project-generation.txt) → [log 09](./09-scaffold-foundation-engine-db-and-auth.md).
  Engine skeleton in place; `generateMenu` throws `NOT_IMPLEMENTED`. The four hard-constraint families are listed in the type contract (`GenerateMenuInput.options`, recipe + member shapes) but no filter logic exists yet.
- **Prompt 10** — [prompts/10-phases-5-7-api-and-postman.txt](../prompts/10-phases-5-7-api-and-postman.txt) → [log 10](./10-engine-impl-api-and-postman.md).
  [`src/filter.ts`](../packages/constraint-engine/src/filter.ts) implements all four hard constraints in one pass: meal_type exact match, dietary tag union with overlay, ingredient-exclusion membership, allergen string-match via `ingredient_allergens`. [`filter.test.ts`](../packages/constraint-engine/src/__tests__/filter.test.ts) covers each branch (6 tests).

#### 2. Soft-constraint scoring + local-search refinement (deferred)

- **Prompt 10** — [log 10 — Observed issue](./10-engine-impl-api-and-postman.md#observed-issue).
  Engine MVP is **greedy-only**. Variety, calorie balance, cuisine diversity, and ingredient-reuse scoring per [ARCHITECTURE_PRD §6.1](../docs/PRD/ARCHITECTURE_PRD.md) are stubbed. Greedy uses the RNG to break ties between valid candidates — hooks (`assignGreedy` signature, RNG injection, JSON-serializable boundary) are deliberately in place so a scoring + swap-pass refinement can be slotted in without API churn. **This is still the dominant open tuning target.**

#### 3. Determinism — same input + same seed → same menu

- **Prompt 09** — `random.test.ts`, `hash.test.ts`, `canonical.test.ts` lock in the seeded RNG, canonicalization, and SHA-256 input hash. 14 tests.
- **Prompt 10** — orchestrator [`generate.ts`](../packages/constraint-engine/src/generate.ts) computes `inputs_hash` via `sha256OfInput` over the canonicalized input including overlay. [`generate.test.ts`](../packages/constraint-engine/src/__tests__/generate.test.ts) asserts same-seed reproducibility and seed-divergence (7 tests).

#### 4. Menu regeneration — soft-delete-then-insert in one transaction

- **Prompt 04** — [prompts/04-menu-regen-soft-delete-agent-folders.txt](../prompts/04-menu-regen-soft-delete-agent-folders.txt) → [log 04](./04-menu-regen-soft-delete-agent-folders.md).
  Established the **replace-on-regenerate** rule: previous menu is soft-deleted (`is_deleted = true`) and a fresh menu/slots/grocery row inserted in one transaction. Captured in [DATABASE_PRD §6.17](../docs/PRD/DATABASE_PRD.md) and [ARCHITECTURE_PRD §5 step 7](../docs/PRD/ARCHITECTURE_PRD.md).
- **Prompt 10** — implemented in [`apps/web/lib/api/menu-persistence.ts`](../apps/web/lib/api/menu-persistence.ts) inside the `POST /workspaces/[id]/menus` route, writing the `generation_runs` audit row in the same transaction.

#### 5. Allergy handling — strict enum → extensible label + safety bound

- **Prompt 06** — [prompts/06-allergy-extensible-and-shadcn.txt](../prompts/06-allergy-extensible-and-shadcn.txt) → [log 06](./06-allergy-extensible-and-shadcn.md).
  `food_allergy` collapsed into the same extensible-label pattern as `cuisine_type` / `dietary_tag`. `member_allergies.allergy` and `ingredient_allergens.allergy` switched from a strict Postgres enum to `text` validated via `enum_metadata`. The engine match becomes an exact-string join (`member_allergies` ⋈ `ingredient_allergens`); **untagged allergens are silently skipped** — documented as the engine-matching safety bound the UI must surface. Listed as a follow-up: engine tests should pin the silent-skip branch explicitly.

#### 6. Per-menu constraint overlay — strict reject → silent dedup

- **Prompt 07** — [prompts/07-per-menu-constraint-overlay.txt](../prompts/07-per-menu-constraint-overlay.txt) → [log 07](./07-per-menu-constraint-overlay.md).
  Introduced the overlay (`additionalDietaryRestrictions`, `additionalAllergies`, `ingredientExclusions`) attached to a single generation. First-pass rule: **strict-per-member reject** — if any member already carried the overlay value, the request failed pre-engine with `duplicate_member_constraint`. Engine receives the raw overlay in `options` and merges per slot (rejected option (a): pre-merge into member snapshots; kept (b) so `inputs_hash` reflects the original input shape).
- **Prompt 08** — [prompts/08-overlay-silent-dedup.txt](../prompts/08-overlay-silent-dedup.txt) → [log 08](./08-overlay-silent-dedup.md).
  **Reversed the rule:** server now silently drops overlay values already on a member, persists the *effective* (post-dedup) overlay to `menus.generation_options`, and the UI shows a non-blocking inline hint. `duplicate_member_constraint` removed from the `failed_constraint` enum. `inputs_hash` is computed on the effective overlay so "same effective input, different raw typing" hashes identically.
- **Prompt 10** — implemented in [`apps/web/lib/api/menu-overlay.ts`](../apps/web/lib/api/menu-overlay.ts); engine tests still cover the union-applied overlay path. [`menu-overlay.test.ts`](../apps/web/lib/api/__tests__/menu-overlay.test.ts) adds 7 dedup-specific assertions in step 12.

#### 7. Pre-engine validation — `empty_workspace`

- **Prompt 07** — first introduced the pre-engine validation phase (split from engine-side `no_valid_recipe`); originally housed two reasons: `empty_workspace` + `duplicate_member_constraint`.
- **Prompt 08** — collapsed to just `empty_workspace` after silent-dedup removed the overlay-duplicate reject. Pre-engine failures explicitly **do not** write a `generation_runs` row (audit-clean).

#### 8. Failure surfacing — `no_valid_recipe` carries actionable context

- **Prompt 10** — [`src/assign.ts`](../packages/constraint-engine/src/assign.ts) raises `no_valid_recipe` with a structured `affected_member_id` + `affected_meal` payload when a slot's candidate set is empty after hard-constraint filtering. The API surfaces this verbatim so the UI can render a specific message instead of a generic failure.

#### 9. Grocery aggregation — shared list now; per-member splits deferred

- **Prompt 10** — [`src/grocery.ts`](../packages/constraint-engine/src/grocery.ts) aggregates across all assigned recipes into a single shared list. The constraint-divergence case from [PRODUCT_PRD §7](../docs/PRD/PRODUCT_PRD.md) is detected at slot assignment but not yet propagated to a per-member split — flagged as follow-up.
- **Prompt 10** — `scheduled_purchase_day` always set to `null`; freshness-aware scheduling deferred. The engine has the data shape; only the algorithm is missing.

#### 10. Test-utils + integration coverage

- **Prompt 12** — [prompts/12-followups-from-step-10-and-11.txt](../prompts/12-followups-from-step-10-and-11.txt) → [log 12](./12-followups-test-utils-crud-members-tests.md).
  Factories moved to [`packages/constraint-engine/src/test-utils/`](../packages/constraint-engine/src/test-utils/) and re-exported from [`packages/test-utils`](../packages/test-utils/) (resolved a pnpm cyclic-dependency warning that turbo rejected). Engine main barrel deliberately omits factories so production consumers only get production types. Final counts: engine 31 + supabase 17 mocked + apps/web 7 = **55 passing, 5 integration skipped without `SUPABASE_TEST_URL` / `SUPABASE_TEST_SERVICE_KEY`**.

#### Summary table

| Rule / area                            | Introduced in | Re-tuned in | Files                                                                                      |
| -------------------------------------- | ------------- | ----------- | ------------------------------------------------------------------------------------------ |
| Hard-constraint filter                 | prompt 10     | —           | `filter.ts`, `filter.test.ts`                                                              |
| Soft-constraint scoring + local search | prompt 10     | _open_      | `assign.ts` (stub), ARCHITECTURE_PRD §6.1                                                  |
| Determinism (seed + hash)              | prompts 09/10 | —           | `random.ts`, `canonical.ts`, `hash.ts`, `generate.ts`                                      |
| Menu regeneration tx                   | prompt 04     | prompt 10   | DATABASE_PRD §6.17, `menu-persistence.ts`                                                  |
| Allergy → extensible label             | prompt 06     | —           | DATABASE_PRD §5.2, §6.4, §6.6.1, `filter.ts`                                               |
| Overlay rule (reject → silent dedup)   | prompt 07     | prompt 08   | `menu-overlay.ts`, `menu-overlay.test.ts`, DATABASE_PRD §6.11.1                            |
| Pre-engine validation                  | prompt 07     | prompt 08   | route handler, ARCHITECTURE_PRD §5 step 1                                                  |
| `no_valid_recipe` payload shape        | prompt 10     | —           | `assign.ts`, `generate.test.ts`                                                            |
| Grocery aggregation                    | prompt 10     | _open_      | `grocery.ts`, PRODUCT_PRD §7                                                               |
| Test-utils + factories                 | prompt 12     | —           | `packages/constraint-engine/src/test-utils/`, `packages/test-utils/src/`                   |

## Observed issue

- **Badge owner placeholder.** The repo is initialised on `master` with no remote configured at the time this log was written, so the badge URL uses `example-org/weekly-food-planner` (a deliberate stand-in) with a one-line "replace this" callout under the H1. The CI workflow itself is correct as-written — the badge will resolve on first push once the owner segment is swapped for the real GitHub org/owner.
- **Synthesis vs. cycle-log granularity.** This is the first agent-log entry that re-cuts prior history under a topic lens rather than a chronological lens. Per [agentic-rules.md](../.cursor/rules/agentic-rules.md) the per-prompt-cycle log convention is preserved (this file documents the step-13 prompt cycle); the topic synthesis lives inside the body under "Expected output → B". A future agent looking for "how did rule X end up the way it is" reads this file; a future agent looking for "what did the agent do in cycle N" still reads logs 01–13 sequentially.
- **Lint task in turbo, no scripts wired.** Root `package.json` exposes `lint` and [turbo.json](../turbo.json) lists a `lint` task, but no workspace currently defines a `lint` script — running `pnpm lint` is a no-op. Excluded from CI to keep the gate honest; adding ESLint to each workspace is its own follow-up.
- **`pnpm/action-setup@v4` vs. corepack.** Used the action over corepack-enable because [.npmrc](../.npmrc) has `auto-install-peers=true` and `shared-workspace-lockfile=true` — the action's `run_install: false` separation lets `cache: pnpm` on `setup-node@v4` resolve the lockfile before install runs.
- **`--frozen-lockfile` in CI.** Forces installs to match [pnpm-lock.yaml](../pnpm-lock.yaml) exactly; a dependency drift will fail CI rather than silently update the lockfile.

## Follow-up fixes

- After the first push to GitHub: swap `example-org` in the README badge URL for the real owner/org. No code change needed — the workflow file is repo-agnostic.
- Add CSV support to [/api/workspaces/[id]/export](../apps/web/app/api/workspaces/%5Bid%5D/export/route.ts). Step 13 reserved the `format` gate via a `Set` (`SUPPORTED_FORMATS = new Set(['markdown'])`) and explicitly deferred CSV; the deliverable language in the project description mentions both formats, so this remains open.
- Add an explicit engine test for the "untagged allergen is silently skipped" branch (carried from [log 06 follow-ups](./06-allergy-extensible-and-shadcn.md#follow-up-fixes); still open).
- Add an engine fixture pair `(raw_input_with_duplicates, deduped_equivalent)` that asserts identical `menus.generation_options` and identical `inputs_hash` (carried from [log 08 follow-ups](./08-overlay-silent-dedup.md#follow-up-fixes); still open).
- Implement soft-constraint scoring + local-search refinement per [ARCHITECTURE_PRD §6.1](../docs/PRD/ARCHITECTURE_PRD.md) — the dominant open tuning target.
- Wire the `pnpm test:integration` script into CI behind a job guard that only runs when `SUPABASE_TEST_URL` / `SUPABASE_TEST_SERVICE_KEY` are set in repository secrets — currently the integration suite (including the [end-to-end determinism test](../apps/web/integration/end-to-end.integration.test.ts) added in step 13) skips cleanly in CI's empty environment.
