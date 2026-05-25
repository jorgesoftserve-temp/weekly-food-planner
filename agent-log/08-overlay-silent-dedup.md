# Step 08 — Switch per-menu overlay rule from strict reject to silent dedup

## Prompt used

See [/prompts/08-overlay-silent-dedup.txt](../prompts/08-overlay-silent-dedup.txt).

Summary: replace the strict-reject duplicate rule (introduced in step 07) with **silent dedup** — the server quietly drops overlay values already present on any member's matching profile field, persists the *effective* (post-dedup) overlay, and the UI shows a friendly inline hint as the user types. No errors, no blocked submissions.

## Context files provided

- All PRDs in their post-step-07 state.

## Expected output

### PRODUCT_PRD
- §4.0 Pre-conditions: removed the "overlay no-duplication" bullet — overlay validation is no longer a pre-condition (nothing about overlays can fail pre-engine).
- §4.2 Per-menu constraint overlay: replaced the "No-duplication rule" subsection with "Silent dedup of overlay values". New text explains the silent-drop behavior, the friendly inline UI hint (*"Already on Alice — will be skipped"*), and the reasoning (avoids hostile UX in the guest-week scenario where one member already happens to carry the constraint).
- §5 Deterministic Output: clarified that "inputs" includes the *effective* (post-dedup) overlay so identical user submissions hash identically.
- §6 Failure handling: removed the duplicate-overlay failure example.
- §10 Menu view: surfaces the *effective* overlay used.

### ARCHITECTURE_PRD
- §4.1 apps/web responsibilities: changed "per-menu overlay validation" to "per-menu overlay dedup" to reflect the new behavior.
- §4.2 engine API: added an inline comment in the type definition stating that `additionalDietaryRestrictions` / `additionalAllergies` are the effective overlay (post-dedup) — the route handler drops duplicates before invoking the engine.
- §5 step 1: simplified back to role + empty_workspace; no overlay validation. Pre-engine failure surface is now just `empty_workspace`.
- §5 step 2 (renamed "Input assembly with overlay dedup"): explicit description of the dedup step — filter `additionalDietaryRestrictions` / `additionalAllergies` to drop values present on any member's matching profile; `ingredientExclusions` passes through unchanged.
- §5 step 7: persists the *effective* overlay snapshot to `menus.generation_options`.
- §6 determinism: notes that two requests with the same effective overlay hash identically even if the raw user input differed.
- §9 API surface: `POST /api/workspaces/:id/menus` description now mentions "silent-dedup applied server-side".
- §10.4 Per-menu overlay form: rewritten to describe the inline-hint UI (non-blocking, informational), the server-side dedup as defense in depth, and the audit semantics (effective overlay persisted).
- §11 testing matrix: "overlay silent-dedup covered (input with duplicates → effective overlay persisted, same final menu as the deduped input)".

### DATABASE_PRD
- §6.11.1 `generation_options` shape: explicitly states the snapshot is the **effective** (post-dedup) overlay, with a one-line description of what "effective" means.
- §6.15 `generation_runs`: pre-engine validation note now lists only `empty_workspace`.
- §6.17 regeneration: clarifies "fresh `generation_options` snapshot of the effective overlay".
- §11 failure payload: `duplicate_member_constraint` removed from the example block and from the `failed_constraint` enum list. Added a closing line: *"The per-menu overlay never produces a failure — duplicate values are silently dropped."*

### Agent artefacts
- `/prompts/08-overlay-silent-dedup.txt` — verbatim user prompt.
- This log file with the five required fields.

## Observed issue

- Reverses the strict-per-member rule chosen in step 07. The step-07 log explicitly flagged that rule as a judgment call open to revisit; user feedback came in and we revisited.
- Determinism stays intact because the route handler canonicalizes the overlay before computing `inputs_hash`. Two requests with identical effective overlays — regardless of how the user typed them — hash to the same value.
- Considered persisting both the raw user input and the effective overlay (for "show what was dropped" UX). Decided against: would add a column with no current consumer, and the inline-hint UI already shows the dedup as it happens.
- Considered moving the dedup inside the engine via pure union semantics (a value already in the member's profile set is a no-op when added again). The behavior would be identical for the engine, but `inputs_hash` would then differ for "same effective input, different raw typing", breaking the "same effective input → same hash" guarantee unless the engine itself canonicalized first. Kept the dedup in the route handler so the engine input is already canonical.

## Follow-up fixes

- One open architectural question remains: hard-delete cleanup cadence for `is_deleted = true` rows.
- Integration tests need a `(raw_input_with_duplicates, deduped_equivalent)` pair that asserts identical `menus.generation_options` and identical `inputs_hash` — locks in the canonicalization contract.
