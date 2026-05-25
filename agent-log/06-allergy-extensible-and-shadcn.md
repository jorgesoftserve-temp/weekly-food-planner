# Step 06 — Move `food_allergy` to extensible labels; adopt shadcn/ui

## Prompt used

See [/prompts/06-allergy-extensible-and-shadcn.txt](../prompts/06-allergy-extensible-and-shadcn.txt).

Summary: collapse `food_allergy` into the same extensible-label pattern used by `cuisine_type`, `dietary_restriction`, and `dietary_tag` (text + `enum_metadata`), and adopt shadcn/ui as the component primitive set — picked up from the new "Updates you should be aware of" block in `.cursor/rules/global-rules.md`.

## Context files provided

- All PRDs in their post-step-05 state.
- `.cursor/rules/global-rules.md` (updated by the user to include shadcn CLI usage: `npx shadcn@latest init`, `npx shadcn@latest add <component>`).

## Expected output

### DATABASE_PRD
- §5.1: `food_allergy` removed from system enums.
- §5.2: `food_allergy` added to extensible labels, with the 14-allergen seed list and an explicit **engine-matching note** explaining the safety bound (an untagged allergen has no engine effect).
- §6.4 `member_allergies.allergy`: column type changed from `food_allergy` enum to `text`, validated via `enum_metadata`.
- §6.6.1 `ingredient_allergens.allergy`: same change — `text` validated via `enum_metadata`.
- §9: `sys_suggest_enum_value` removed (no current system enum has a user-suggestion path in MVP).
- §10.2: lifecycle simplified — extensible labels go through `sys_save_label`; system enums require a migration. No user-suggestion path for system enums in MVP.
- §10.3: added a bullet describing the engine-matching safety note that the UI surfaces for `food_allergy`.
- §12: added `member_allergies (allergy)` index to support the engine join.
- §14: migration ordering example trimmed (no `enum_create_food_allergy.sql`; no `sys_suggest_enum_value.sql`).
- Entity overview updated to show `food_allergy label` rather than `food_allergy enum`.

### ARCHITECTURE_PRD
- §3 topology and monorepo notes mention `apps/web/components/ui/` for shadcn-generated primitives.
- §4.2: boundary-type note now lists "allergy labels" alongside cuisine/dietary on the `string`-typed boundary fields.
- §5 step 3 reworded: allergy matching is an exact-string join between `member_allergies` and `ingredient_allergens`; untagged allergens are silently skipped, with a forward link to PRODUCT_PRD §11.3.
- §9 API surface: `/api/enum-suggestions` removed (no longer needed). `/api/labels/*` covers all four extensible labels including allergies.
- §10 Styling: switched from "plain Tailwind, no component library" to **Tailwind + shadcn/ui via the CLI**. Documented init and per-component install commands. Kept the cursor rule about `flex` and `gap`.
- §10.3 `Label autocomplete`: now describes the `<LabelCombobox>` as built on the shadcn `Command` primitive, applied to all four extensible labels including `food_allergy`, with the inline safety note for untagged allergens.

### TECHNICAL_PRD
- Stack updated: Tailwind + shadcn/ui replaces the previous "plain Tailwind, no component library" wording. CLI commands captured (`npx shadcn@latest init`, `npx shadcn@latest add button`).
- Repo structure note: shadcn components live under `apps/web/components/ui/`.

### PRODUCT_PRD
- §11 rewritten:
  - Intro now lists allergies as one of the extensible labels (parenthetical exclusion removed).
  - §11.3 reframed from "strict enum" to "engine-matching caveat" — describes the inline safety note shown when a user types an unknown allergen value.

### Agent artefacts
- `/prompts/06-allergy-extensible-and-shadcn.txt` — verbatim user prompt.
- This log file with the five required fields.

## Observed issue

- Moving `food_allergy` off the strict Postgres enum dropped the engine's "type-level" guarantee that an allergy label is one of the 14 known allergens. Mitigated at the UI layer with the inline "not yet tagged on any ingredient" note — captured in DATABASE_PRD §5.2, §10.3 and PRODUCT_PRD §11.3 so the user-facing safety bound is documented, not implicit.
- `sys_suggest_enum_value` had been the path for proposing values for strict enums. With `food_allergy` (the only realistic candidate for user-suggested strict-enum extension) now extensible, the RPC has no callers in MVP. Removed entirely rather than leaving dead code in the spec.
- The cursor rule's shadcn snippet uses `npx shadcn@latest` (no leading scope). Captured verbatim — the docs reference exactly that CLI invocation so future agents won't drift toward the older `shadcn-ui` package name.
- ARCHITECTURE_PRD §10 previously said component-library adoption was "post-MVP". Reversed to match the new direction; no other doc claimed plain-Tailwind-only.

## Follow-up fixes

- One open architectural question remains: hard-delete cleanup cadence for `is_deleted = true` rows.
- The `<LabelCombobox>` primitive is now spec'd but not built — it depends on `npx shadcn@latest add command` being run during scaffolding.
- Engine tests should add explicit coverage for the "untagged allergen is silently skipped" branch so the documented safety bound is verifiable.
