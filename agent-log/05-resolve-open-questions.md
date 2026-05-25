# Step 05 — Lock in engine algorithm, boundary contract, and label-suggestion UX

## Prompt used

See [/prompts/05-resolve-open-questions.txt](../prompts/05-resolve-open-questions.txt).

Summary: the user resolved three of the four open questions left after step 04:

1. Engine algorithm: greedy + local-search refinement for MVP.
2. Constraint-engine contract: TypeScript-first domain with JSON-serializable DTOs at the boundary (not a language-agnostic source distribution).
3. Enum suggestion UX: debounced autocomplete that never rewrites the user's input; user may save any value (including typos); user may delete their own typoed suggestions afterwards.

The fourth question (soft-delete cleanup cadence) was not addressed and remains open.

## Context files provided

- All PRDs in their post-step-04 state.
- `.cursor/rules/agentic-rules.md` (already loaded in step 04; the prompt-and-log discipline continues here).

## Expected output

### ARCHITECTURE_PRD
- §4.2 rewritten with the TS-first / JSON-serializable boundary contract, including a `JSON.parse(JSON.stringify(input))` round-trip test convention and a switch of label-typed engine inputs (`preferredCuisines`) from generated enum types to `string` to match the new extensible-label model.
- §5 pipeline steps 4–5 rewritten to call out greedy assignment and local-search refinement explicitly.
- New §6.1 `Algorithm` subsection detailing the greedy seed, the swap-based local search, deterministic move ordering, RNG-driven tie-breaking, and the deliberate trade-off (fast and deterministic but not globally optimal).
- §9 API surface gains `/api/labels/search`, `/api/labels/suggestions` (DELETE), and a distinct `/api/enum-suggestions` for strict system enums.
- New §10.3 `Label autocomplete` describing the `<LabelCombobox>` primitive, the debounce, the non-destructive input behavior, and the per-user delete flow.
- §16 trimmed to the single remaining open question (soft-delete cleanup).

### DATABASE_PRD
- §5 split into 5.1 `System enums (strict)` and 5.2 `Extensible labels (user-suggestable)`. `cuisine_type`, `dietary_restriction`, `dietary_tag` moved to extensible labels (text + enum_metadata). `food_allergy` deliberately kept strict for safety.
- §6.3, §6.7, §6.10 changed to use `text` for the user-extensible label columns; engine and UI validate against `enum_metadata`.
- §9 adds `sys_save_label`, `sys_delete_enum_suggestion`, keeps `sys_suggest_enum_value` for strict system enums.
- §10 lifecycle split: system enums require a migration to promote; extensible labels accept the user's value immediately. New §10.3 documents the suggestion UX rules; §10.4 explains why we keep both an enum and a table for system enums but go text-only for extensible labels.
- §12 indexes add `recipes (cuisine)`, `recipe_dietary_tags (tag)`, and `enum_metadata (enum_type) WHERE is_pending = true` (moderation queue).
- §13 trimmed to the single remaining open question.

### PRODUCT_PRD
- New §11 `Label suggestions and corrections`: debounce, non-destructive input, save-anything behavior, "My label suggestions" delete view, and the strict-enum exception for allergies.

### Agent artefacts
- `/prompts/05-resolve-open-questions.txt` containing the verbatim user prompt.
- This log file with the five required fields.

## Observed issue

- Honoring "save any value, even typos" for `cuisine`, `dietary_restriction`, and `dietary_tag` required moving those columns off Postgres enums to `text` + `enum_metadata`. The Postgres enum's `ALTER TYPE ADD VALUE` is too heavyweight for runtime user content.
- `food_allergy` deliberately kept as a strict Postgres enum despite the same UX surface, because mis-tagged allergens are a safety hazard for the hard-constraint filter. UI for allergies remains the same combobox but rejects unknown-value submission and routes "suggest new allergen" through admin review. Called out explicitly so it isn't read as an oversight.
- The user wrote "constraing engine" / "algorithim"; treated as informal typos in the prompt and corrected silently in the docs. The raw prompt file preserves the original wording.
- Postgres FKs cannot reference `enum_metadata` with a `WHERE enum_type=...` filter, so validation lives in `sys_save_label` rather than as a column-level FK. Documented in §5.2.

## Follow-up fixes

- Open architectural questions reduced to one: hard-delete cleanup cadence for `is_deleted = true` rows. Surfaced in ARCHITECTURE_PRD §16 and DATABASE_PRD §13.
- Index list adjusted so the new `text` label columns get indexes where they were previously implicit on the enum types.
- Confirmed the engine boundary types compile cleanly: `string` for labels at the boundary, not generated enum types.
