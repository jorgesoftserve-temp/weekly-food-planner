# Step 07 — Per-menu constraint overlay with no-duplication validation

## Prompt used

See [/prompts/07-per-menu-constraint-overlay.txt](../prompts/07-per-menu-constraint-overlay.txt).

Summary: support an "additional nutrition constraints" overlay (dietary, allergy, ingredient exclusions) attached to a single menu generation, with a hard validation that no overlay value duplicates a constraint already on any member's profile.

## Context files provided

- All PRDs in their post-step-06 state.

## Expected output

### PRODUCT_PRD
- New §4.2 *Per-menu constraint overlay* — describes the three overlay fields (additional dietary restrictions, additional food allergies, ingredient exclusions), the user scenarios that drive them (guest week, vegan week, out-of-season ingredient), and the **no-duplication rule** in plain language with the reasoning behind a strict reject (clean audit on `menus.generation_options`; route users to the right surface — member profile vs. per-menu overlay).
- §4.0 Pre-conditions: now lists overlay duplicate-check as a pre-condition.
- §4 "Menu generator inputs > Optional": adds the two new entries with a back-link to §4.2.
- §4 "Constraint Rules > Hard constraints": calls out that the effective set is member-profile ∪ per-menu overlay.
- §5 Deterministic Output: clarifies that "inputs" includes the overlay (necessary for repeatable regeneration).
- §6 Failure handling: adds the pre-engine duplicate-overlay example to the existing failure-message list.
- §10 Menu view: surfaces the overlay used (sourced from `menus.generation_options`).

### ARCHITECTURE_PRD
- §4.2 engine API: `options` now lists `additionalDietaryRestrictions?: string[]` and `additionalAllergies?: string[]` alongside the existing `ingredientExclusions`, grouped under a "hard constraints" comment block. Explicit note that the engine reads the overlay from `options` directly — it does NOT receive pre-merged member snapshots; the route handler validates duplicates and then the engine merges per slot.
- §5 step 1 reworded to fold the overlay duplicate check into the same pre-engine validation phase as `empty_workspace`. Pre-engine validation failures do not produce `generation_runs` rows.
- §5 step 2: assembles the canonical `GenerateMenuInput` including the raw overlay so `inputs_hash` covers it.
- §5 step 3: explicit "union of profile + overlay" wording for the hard-constraint filter.
- §5 step 7: persists the overlay snapshot to `menus.generation_options` in the same transaction as the menu rows.
- §6 determinism: clarifies that the overlay is captured in `options` so two regenerations with the same overlay + same seed produce identical menus.
- §6.1 algorithm: candidate set wording updated to "union of profile + overlay".
- §9 API surface: `POST /api/workspaces/:id/menus` accepts overlay options.
- New §10.4 *Per-menu overlay form* — UI behavior: `<LabelCombobox>` reuse, client-side duplicate rejection with inline "Bob already has *peanut*" message and one-click remove-from-overlay, server-side re-check as defense in depth.
- §11 testing: engine unit tests cover the union-applied overlay; route-handler integration tests cover the duplicate-rejection path.

### DATABASE_PRD
- §6.11 `menus`: new column `generation_options jsonb NULL`.
- New §6.11.1 `generation_options` shape: example JSON listing every key (calorieTolerance, repetitionLimit, preferredCuisines, ingredientExclusions, additionalDietaryRestrictions, additionalAllergies); all keys optional; absent / empty means no overlay.
- §6.15 `generation_runs`: note added that pre-engine validation failures (`empty_workspace`, `duplicate_member_constraint`) do **not** write a `generation_runs` row.
- §6.17 regeneration: clarifies that the fresh `generation_options` snapshot is captured on the new menu row.
- §11 failure payload: split into two examples — engine-side (existing `no_valid_recipe`) and pre-engine (new `duplicate_member_constraint` with a `duplicates` array of `{kind, value, member_id}`). `failed_constraint` enum now includes `duplicate_member_constraint`, with the doc explicitly tagging which values are pre-engine vs. engine.

### Agent artefacts
- `/prompts/07-per-menu-constraint-overlay.txt` — verbatim user prompt.
- This log file with the five required fields.

## Observed issue

- The user's phrasing "restriction to avoid duplication with the ones from the members" was ambiguous on scope (any member vs. all members vs. silent dedup). Chose **strict per-member reject** — if even one member already carries the value, the overlay request fails. Documented the reasoning in PRODUCT_PRD §4.2 so the user can push back if a different rule (e.g. silent dedup, or "reject only when universal") matches intent better.
- Considered two designs for how the engine sees the overlay: (a) route handler pre-merges into member snapshots, engine is transparent; (b) overlay stays in `options` and the engine merges per slot. Chose (b) — keeps regression tests ergonomic (fixtures can specify overlay separately) and keeps `inputs_hash` reflecting the original input shape. Persisted `generation_options` on the menu row provides redundant audit even if the input layout changes later.
- `failed_constraint` now mixes pre-engine and engine reasons in the same enum. Documented the distinction inline rather than splitting the enum, since the API response shape is uniform across both kinds.
- The user said "before generating the project" — interpreting this as the final doc-tweak step before scaffolding. No project setup performed yet.

## Follow-up fixes

- One open architectural question remains: hard-delete cleanup cadence for `is_deleted = true` rows.
- The strict-per-member duplication rule is a debatable UX choice; flagged here so a later iteration can revisit if user testing shows it's too restrictive.
- Determinism regression suite needs to include at least one fixture per overlay field so the persistence + merge round-trips are locked in.
