# Step 04 — Menu regeneration, soft delete, meal-frequency clarification, agent folders

## Prompt used

See [/prompts/04-menu-regen-soft-delete-agent-folders.txt](../prompts/04-menu-regen-soft-delete-agent-folders.txt).

Summary: commit to replace-on-regenerate for menus; do not store timezone for `meal_frequency` (hours are informational local-user time); add an `is_deleted` soft-delete flag to user-mutable tables; then create `/prompts` and `/agent-log` per [.cursor/rules/agentic-rules.md](../.cursor/rules/agentic-rules.md), backfilling the conversation history (excluding the initial `claude init`).

## Context files provided

- All PRDs in their post-step-03 state.
- `.cursor/rules/agentic-rules.md` (defines required folders, log entry shape, prompt-as-`.txt` rule).

## Expected output

- `is_deleted boolean NOT NULL DEFAULT false` added to `workspaces`, `workspace_members`, `recipes`, `menus` (`DATABASE_PRD §6.1, §6.2, §6.7, §6.11`).
- New `DATABASE_PRD §6.16 Soft delete model` describing scope, RLS impact, partial unique constraints, and the deliberate decision to skip the flag on cascade and junction tables.
- New `DATABASE_PRD §6.17 Menu regeneration` documenting the soft-delete-then-insert flow within a single transaction.
- `DATABASE_PRD §7` clarifies that `default_hour` is informational local-user time, with no timezone enforcement, and lists its purpose (multi-meal-per-day, UI display, future recipe-to-time linking).
- RLS policies and indexes updated to filter / restrict on `is_deleted = false`.
- `ARCHITECTURE_PRD §5` pipeline step 7 spells out the regeneration transaction.
- Open-question lists trimmed: `ARCHITECTURE_PRD §16` and `DATABASE_PRD §13` no longer contain "menu regeneration", "timezone storage", or "soft-delete strategy".
- `PRODUCT_PRD §4.1 Regeneration` added with the user-facing explanation.
- `/prompts/` created with `01-…`, `02-…`, `03-…`, `04-…` `.txt` files (one per non-init user prompt, verbatim).
- `/agent-log/` created with matching `.md` step logs (this file plus 01–03), each containing the five fields required by the agentic rules.

## Observed issue

- The agentic-rules file uses singular `/agent-log`; the user's prompt used `/agent-logs`. Followed the rules file because the technical PRD's repo structure also uses the singular form — internal consistency wins.
- The user wrote "isDelete flag" (camelCase). Used `is_deleted` (snake_case) per the project's SQL conventions (`.cursor/rules/global-rules.md` SQL guide). Will rename if the user objects.
- Decided not to add `is_deleted` to cascade-only tables (`menu_slots`, `recipe_ingredients`, `recipe_instructions`, `grocery_lists`, `grocery_items`) or junction tables (`member_*`, `recipe_dietary_tags`, `ingredient_allergens`) — visibility through a soft-deleted parent is sufficient and avoids surface area.
- `generation_runs` is append-only and intentionally has no soft-delete flag — every run is permanent audit data.

## Follow-up fixes

- Remaining open questions reduced to four: constraint-engine JSON in/out, algorithm choice, enum-suggestion moderation policy, and the as-yet-undefined hard-delete cleanup cadence for soft-deleted rows.
- No code generation in this step — project scaffolding remains gated on user go-ahead.
