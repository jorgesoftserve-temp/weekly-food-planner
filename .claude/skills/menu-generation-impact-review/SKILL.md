---
name: menu-generation-impact-review
description: Produces a structured impact review and small implementation plan when adding or modifying a feature in the menu generation system (constraint engine, route handler, persistence, lifecycle, grocery recompute, or any of their UIs). Walks the system layer-by-layer against a checklist and surfaces gaps, regressions risks, and PRD updates the change would require BEFORE any code is written. Invoke when scoping a new menu/grocery feature, evaluating an architecture change, or pre-flighting a refactor. Do NOT use this skill to write code, write tests, or update PRDs — it produces a plan; the agents (constraint-engine-engineer, route-handler-engineer, supabase-migration-author, etc.) do the implementation.
---

# menu-generation-impact-review

Given a feature description, produce a structured impact review of how the proposed change ripples through the Weekly Food Planner's menu generation system. Output is a markdown plan — no code, no test files, no PRD edits. The plan tells the user (and the parent session) exactly which layers will need to change, what could break, which tests are needed, and which agent owns each piece.

## When to invoke

- **Scoping a new feature** that touches menu generation, grocery aggregation, or any of the lifecycle states (draft / accept / supersede / clone).
- **Evaluating an architecture change** (e.g. swap greedy + local-search for simulated annealing).
- **Pre-flighting a refactor** that crosses layer boundaries.
- **Reviewing a stalled feature** — re-run the skill to find the gap that's blocking it.

## When NOT to invoke

- For writing code → use the relevant agent (`constraint-engine-engineer`, `route-handler-engineer`, `supabase-migration-author`, `ui-component-builder`).
- For writing tests → use `vitest-integration-author` or the `constraint-menu-generator-life-cycle-test` skill.
- For updating PRDs directly → propose updates in the report; the user (or a follow-up session) applies them.
- For pure-UI tweaks that don't touch generation logic (e.g. restyling the recipe list).
- For non-menu features (auth, member profile, recipe CRUD outside the menu pipeline).

## Input

The user provides a short feature description. If it's underspecified, ask **one** batched clarification covering all unknowns at once — never loop. Useful clarifications:

- **Hard or soft constraint?** Affects whether the engine's filter or its scoring composite changes.
- **Per-menu, per-member, or workspace-global?** Affects where the data lives (`menus.generation_options`, `workspace_members`, `workspaces`).
- **Weekly mode only, custom mode only, or both?** Affects whether the engine is invoked at all.
- **Does it change persisted shape?** Migration vs. JSONB shape evolution.
- **Acceptance behaviour?** Does it shift the `accepted_seed` computation or interact with regeneration / clone?

If the user hands over a vague request, anchor on what's actually proposed. Don't fabricate scope.

## Authoritative repo references

Read these before producing the report. If a referenced file has shape that differs from this skill's snippets, **follow the live file**, not this skill.

| Reference | Why it matters |
|---|---|
| [`packages/constraint-engine/src/types.ts`](../../../packages/constraint-engine/src/types.ts) | Engine boundary contract. Any input/output shape change is a breaking change downstream. |
| [`packages/constraint-engine/src/generate.ts`](../../../packages/constraint-engine/src/generate.ts) | Public `generateMenu`. Where new engine behaviour wires in. |
| [`packages/constraint-engine/src/filter.ts`](../../../packages/constraint-engine/src/filter.ts) | Hard-constraint filter. Where new hard constraints land. |
| [`packages/constraint-engine/src/assign.ts`](../../../packages/constraint-engine/src/assign.ts) | Greedy + local-search. Where new soft-constraint scoring lands. |
| [`packages/constraint-engine/src/slots.ts`](../../../packages/constraint-engine/src/slots.ts) | Slot enumeration + frequency cascade. |
| [`packages/constraint-engine/src/grocery.ts`](../../../packages/constraint-engine/src/grocery.ts) | Engine-side grocery aggregation with `eaters / recipe.servings` scaling. |
| [`packages/constraint-engine/src/canonical.ts`](../../../packages/constraint-engine/src/canonical.ts) + [`hash.ts`](../../../packages/constraint-engine/src/hash.ts) | Inputs canonicalization → `inputs_hash`. Any new input field that affects output must enter the canonical form. |
| [`apps/web/app/api/workspaces/[id]/menus/route.ts`](../../../apps/web/app/api/workspaces/[id]/menus/route.ts) | Three-mode dispatch (`weekly`/`custom`/`clone`), overlay dedup, participant resolution, transactional persistence. |
| [`apps/web/lib/api/menu-grocery.ts`](../../../apps/web/lib/api/menu-grocery.ts) | Single grocery-recompute entry point used by drafts, custom, clone, and accept. |
| [`apps/web/app/api/workspaces/[id]/menus/[menuId]/accept/route.ts`](../../../apps/web/app/api/workspaces/[id]/menus/[menuId]/accept/route.ts) | Accept = compute `accepted_seed`, soft-delete prior accepted, set `accepted_at`. |
| [`apps/web/app/api/workspaces/[id]/menus/[menuId]/slots/route.ts`](../../../apps/web/app/api/workspaces/[id]/menus/[menuId]/slots/route.ts) | Add-slot during draft review; re-runs the engine's hard-constraint filter for weekly drafts. |
| [`apps/web/app/api/workspaces/[id]/menus/[menuId]/slots/[slotId]/route.ts`](../../../apps/web/app/api/workspaces/[id]/menus/[menuId]/slots/[slotId]/route.ts) | Replace-slot during draft review; same re-filter. |
| [`packages/supabase/supabase/migrations/`](../../../packages/supabase/supabase/migrations/) | All schema. New columns, RLS, triggers go here via `npx supabase migration new`. |
| [`docs/PRD/PRODUCT_PRD.md`](../../../docs/PRD/PRODUCT_PRD.md) §4 | Product behaviour for menu generation, lifecycle, overlay, participants, frequency override. |
| [`docs/PRD/ARCHITECTURE_PRD.md`](../../../docs/PRD/ARCHITECTURE_PRD.md) §5–7 | Engine pipeline, determinism contract, grocery + freshness scheduling. |
| [`docs/PRD/DATABASE_PRD.md`](../../../docs/PRD/DATABASE_PRD.md) §6.11–6.17 | Menus table, participants junction, slots, generation_runs, lifecycle. |

## Steps

1. **Anchor.** Restate the feature in one sentence. If vague, ask one batched clarification.
2. **Read the layers.** Walk the authoritative references in the table above that the feature plausibly touches. Don't read all of them — pick the ones the feature description hints at.
3. **Walk the checklist** (next section) end-to-end. For each category, decide: **affects / does not affect / unclear**. Be specific. "Yes, this adds a new field to `GenerateMenuInput.options` called `maxBudget`" beats "yes, affects engine".
4. **Identify gaps and risks.** Anything you can't decide from the live code is a gap — name it and propose how to resolve.
5. **Propose an implementation order.** Smallest sequence of agent invocations that lands the feature without breaking CI mid-stream.
6. **Report** in the structure below. No code. No PRD edits. Just the plan.

## The checklist — walk all 12 categories

### 1. Engine contract (`GenerateMenuInput` / `GenerateMenuResult`)

- Does it add or change a field?
- If yes: does the new shape JSON-round-trip cleanly? (No `Date`, `Map`, `Set`, `BigInt`, class instances.)
- Are existing fixtures backwards-compatible, or will every golden snapshot need to regenerate?
- Does the new field need to enter the canonical form so it contributes to `inputs_hash`?

### 2. Engine internals (slots, filter, assign, grocery)

- Which file(s) change?
- New non-determinism risk? (Clocks, randomness, ambient state.)
- New RNG draws? If yes, that **will** shift every existing snapshot's output — flag as intentional drift.
- Scoring composite change? Tie-break order change?

### 3. Route handler dedup / participant filter

- New per-menu option? Does it have a member-profile equivalent that requires silent-dedup like `additionalAllergies` does?
- Should non-participant entries be stripped before invocation (like `memberFrequencyOverrides`)?
- Pre-engine validation that should return 412 / 422 before the engine runs?

### 4. Persistence (`menus`, `menu_slots`, `menu_participants`, `grocery_*`, `generation_runs`)

- New column on `menus`? Migration with prefix + dependency order?
- New junction table?
- `generation_options` JSONB shape addition? (No migration, but document in [DATABASE_PRD §6.11.1](../../../docs/PRD/DATABASE_PRD.md).)
- RLS change? Use `fn_user_workspace_role`; soft-delete-aware reads.
- Backfill for existing rows? Especially historical accepted menus.
- Does the new column need to be in the partial unique indexes on `menus`?

### 5. Three modes — weekly / custom / clone

- **Weekly** (engine-generated): does the engine see and use the new field?
- **Custom** (user-built, engine not invoked): does the feature still apply? If not, how does the UI prevent the user from setting it?
- **Clone** (copies historical accepted menu): does the field carry over? If the source had it but the target shouldn't, where's the strip step?

### 6. Lifecycle (draft → accept → supersede → clone)

- Draft creation: replaces any prior draft for `(workspace, week)`. Does the new field flow into the new draft?
- Slot replacement (`PATCH .../slots/[slotId]`): does the change interact with hard-constraint re-validation?
- Add-slot (`POST .../slots`): same question.
- Accept: does the change affect `accepted_seed` computation? Acceptance soft-deletes the previously-accepted menu; the change might invalidate that menu's grocery list.
- Discard / clone: same questions.

### 7. Grocery recompute

- Does the change affect `eaters / recipe.servings` scaling?
- Does it change [`recomputeGroceryListsForMenu`](../../../apps/web/lib/api/menu-grocery.ts) signature?
- Does it interact with freshness scheduling (`scheduled_purchase_day`)?
- Does it interact with the shop-for-subset filter? URL state? Export endpoints?
- The single-recompute-path invariant must hold — drafts, custom, clone, and accept must all keep delegating to the same function.

### 8. Failure modes

- New structured error needed?
- Add to `failed_constraint` enum or extend `error_payload` JSONB shape?
- User-facing message? Does the UI need a new copy line?
- Does the change introduce a path where the engine can produce an invalid menu that should now be rejected? Add a hard-constraint check, not a soft penalty.

### 9. Regression suite (engine golden snapshots)

- Will existing snapshots drift? Intentional or accidental?
- New scenarios that need fixtures? (See [`determinism-snapshot-curator`](../../agents/determinism-snapshot-curator.md) for the required coverage taxonomy.)
- New JSON round-trip property test if the input/output shape changed?

### 10. Integration tests

- New `.integration.test.ts` needed?
- Role-matrix coverage updated?
- RLS test for any new policy?
- Silent-dedup test if the change introduces a new dedup path?
- Soft-delete visibility test if the change touches a soft-delete column?

### 11. UI surface

- Generate form: new field?
- Menu header: does the effective overlay display include the new value?
- Draft review: any new affordance per slot or per day?
- Grocery view: any new section, scaling indicator, or per-member bucket interaction?
- Shop-for picker: any interaction with the new feature?
- Export (markdown + CSV): does the new field appear in the downloaded file?

### 12. PRD updates

For each PRD that needs a change, name the section:

- [OVERVIEW_PRD.md](../../../docs/PRD/OVERVIEW_PRD.md) §3 / §5 / §6 — scope, core features, MVP inclusion?
- [PRODUCT_PRD.md](../../../docs/PRD/PRODUCT_PRD.md) §4 (menu generation), §4.1 (lifecycle), §4.1.3 (participants/frequency), §4.2 (overlay), §7 (grocery), §10 (views)?
- [ARCHITECTURE_PRD.md](../../../docs/PRD/ARCHITECTURE_PRD.md) §4.2 (engine contract), §5 (pipeline), §6 (determinism), §7 (grocery), §9 (API surface), §10 (frontend)?
- [DATABASE_PRD.md](../../../docs/PRD/DATABASE_PRD.md) §5 (enums), §6.11 (menus), §6.11.1 (`generation_options` shape), §6.11a (participants), §6.12 (slots), §6.16 (soft delete), §6.17 (lifecycle), §11 (error payload)?

## Report structure

Emit a single markdown document with these sections in this order:

```markdown
## Feature: <one-sentence restatement>

### Summary
2–4 sentences. What changes, what it unlocks, what surface it touches.

### Layers touched
Tick-list per category from the checklist (1–12). Only include categories that actually change — skip the ones marked "does not affect".

For each touched category, one bullet per concrete change with the file path:
- `[1] Engine contract` — add `options.maxBudget?: number` to [GenerateMenuInput](packages/constraint-engine/src/types.ts:42). Add to canonical form so it enters `inputs_hash`.
- `[2] Engine internals` — extend the scoring composite in [assign.ts](packages/constraint-engine/src/assign.ts) to penalise candidates whose grocery cost exceeds the budget. No new RNG draws.
- ...

### Gaps + risks
Numbered list. Each item: one-line title + 1–3 sentences of context + a concrete resolution proposal.

1. **No ingredient cost in the DB yet.** Budget enforcement is meaningless without a per-ingredient cost. Add `cost_per_unit numeric` to `ingredients` in the same migration, seed with placeholder values, document the limitation. Owner: `supabase-migration-author`.

### Backwards compatibility
- Existing accepted menus: <what happens to them>
- Existing golden snapshots: <intentional drift? if yes, regenerate in a separate commit>
- API consumers (mjs HTTP drivers, integration tests): <impact>

### Tests to add or update
- Engine unit tests: <list>
- Golden snapshots: <list of new fixtures>
- Integration tests: <list of new files>
- E2E HTTP driver updates: <if any>

### PRD updates
- `docs/PRD/<file>.md` §<section> — <one-line description of the change>
- ...

### Proposed implementation order
Numbered. Each step: which agent runs it, what they produce, what the next step depends on.

1. `supabase-migration-author` — new migration for `cost_per_unit` on `ingredients` + seed. Output: migration file path, regenerated types command.
2. `constraint-engine-engineer` — extend input type, canonical form, scoring composite. Output: engine diff.
3. `determinism-snapshot-curator` — regenerate snapshots in a separate commit. Output: snapshot regeneration commit.
4. `route-handler-engineer` — accept new option in the request body, dedup if applicable, pass through to engine. Output: handler diff + Zod schema update.
5. `ui-component-builder` — add the input to the generate form. Output: form component diff.
6. `vitest-integration-author` — integration test for the new option (happy path + edge case where budget is unreachable → `calorie_target_unreachable`-style failure mode). Output: test file.
7. PRD updates as listed above. Owner: parent session.

### Out of scope (deferred)
What this review explicitly does not cover. Future work the user might want.
```

## Non-negotiables

- **No code.** Not even a skeleton. The skill produces a plan; agents produce code.
- **No PRD edits.** Propose updates with section numbers; leave the writing for the user or a follow-up session.
- **Read live files first.** If a checklist item references behaviour that has changed since this skill was written, trust the code over this skill.
- **One clarification round, batched.** If the feature is vague, ask one question containing every unknown. Don't loop.
- **Cite file:line.** Every concrete change in the report cites a file path. Vague references ("update the engine") are not acceptable.
- **Order matters.** The implementation order must be runnable end-to-end — no step depends on a later step.

## What to flag in the report

- **Determinism risks.** Any path that introduces a clock, random source, or input-not-in-canonical-form is a hard fail. Call it out at the top of the report.
- **Three-mode asymmetry.** If the feature applies to `weekly` but not `custom` (or vice versa), and the UI doesn't already gate it, that's a UX risk worth surfacing.
- **Single-recompute-path violations.** If the proposed change would force draft / accept / clone / custom to compute grocery lists differently, that's an architectural regression — flag and propose an alternative that preserves the invariant.
- **Backfill traps.** Adding a NOT NULL column to `menus` without a default breaks every historical row. Either default it, make it nullable, or backfill in the same migration.
- **Snapshot drift.** Any engine change that would invalidate existing golden snapshots needs to land in a **separate commit** with `engine: update regression snapshots for <change>` so reviewers can see the intent.

## Example

See [`docs/examples/max-budget-per-week.md`](./docs/examples/max-budget-per-week.md) for a worked impact review on a hypothetical "add a max-budget-per-week soft constraint" feature. It demonstrates the layered walk, the gap identification, the implementation order, and the PRD update list. Use it as the template for the output shape.
