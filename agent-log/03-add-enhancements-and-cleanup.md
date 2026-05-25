# Step 03 — Add enhancements, rename architecture doc, fix typos

## Prompt used

See [/prompts/03-add-enhancements-and-cleanup.txt](../prompts/03-add-enhancements-and-cleanup.txt).

Summary: resolve the blocking gaps from step 02 — calories on recipes, email verification, images, an `food_allergy` enum, empty-state UX, Vitest confirmation, Zustand, plain Tailwind, PDF-ready menu/grocery views (PDF export deferred), explicit recipe scope, rename `ARQUITECTURE_PRD.md` → `ARCHITECTURE_PRD.md`, and fix typos across all docs.

## Context files provided

- All PRDs in their post-step-02 state.

## Expected output

- `recipes.calories_per_serving` added.
- `recipes.image_url` and `ingredients.image_url` added; Supabase Storage wired in via `TECHNICAL_PRD` and `ARCHITECTURE_PRD`.
- New `food_allergy` enum + `ingredient_allergens` join table; `member_allergies` switched from ingredient-FK to enum-based.
- `recipes.owner_member_id` removed — recipes are workspace-shared, per-member divergence handled at the slot layer via `menu_slots.target_member_id`.
- Email verification flow specified end-to-end in `PRODUCT_PRD §1` and `ARCHITECTURE_PRD §8.1`.
- Empty-workspace UX: "Generate Menu" disabled in UI, server-side enforcement returns `failed_constraint: empty_workspace`.
- Zustand for ephemeral UI state, plain Tailwind for MVP (no component library), documented in `TECHNICAL_PRD` and `ARCHITECTURE_PRD §10`.
- Menu and grocery list views promoted to first-class MVP deliverables with a PDF-ready layout; PDF export itself deferred to next MVP.
- Vitest confirmed everywhere.
- File renamed: `docs/ARQUITECTURE_PRD.md` → `docs/ARCHITECTURE_PRD.md`; cross-references updated; old file deleted via PowerShell `Remove-Item`.
- Typos fixed: OVERVIEW (`memers`, `Proide`, `lits`, `Targer`, `mantain`, `generaiton`, `Arquitcture`), PRODUCT (`Aviallable`, `Preffered`, `glutten-free`, `Freshnes`, trailing space in `Gluten-free `). OVERVIEW section numbering normalized to sequential.

## Observed issue

- Removing `recipes.owner_member_id` cascaded: the related trigger `trg_recipe_owner_member_workspace_check` became obsolete and was removed from `DATABASE_PRD §9`.
- The IDE had `ARQUITECTURE_PRD.md` open at the moment of rename; using `Remove-Item` after writing the new file (rather than mid-edit rename) avoided IDE conflicts.
- Edits to PRODUCT and OVERVIEW were sufficiently numerous that full `Write` rewrites were cleaner than chains of `Edit` calls.

## Follow-up fixes

- Open questions trimmed to: constraint-engine JSON in/out, algorithm choice, menu regeneration policy, enum-suggestion moderation, timezone storage, generation-run retention, soft-delete strategy.
- The remaining items left for the user to decide explicitly in step 04.
