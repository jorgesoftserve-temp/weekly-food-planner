-- DATABASE_PRD §5.1 (v2.0) — inventory_source system enum.
--
-- Three source values for Phase 1:
--   manual   — user-entered stock (anything typed directly into the pantry)
--   purchase — spilled in from a finalized shopping session (source_menu_id set)
--   leftover — cooked-food surplus emitted when marking a slot cooked (Phase 5)
--
-- NOTE: cook_remainder is a Phase 5 decision (raw-ingredient cook reconciliation).
-- It is intentionally NOT added here — see DATABASE_PRD §5.1 candidate note.
-- When Phase 5 ships, extend with:
--   ALTER TYPE public.inventory_source ADD VALUE 'cook_remainder';

CREATE TYPE public.inventory_source AS ENUM (
  'manual',
  'purchase',
  'leftover'
);

COMMENT ON TYPE public.inventory_source IS
  'Tracks how an inventory_items row entered the workspace pantry. '
  'manual = user-entered; purchase = from a finalized shopping session; '
  'leftover = cooked-food surplus from a slot cook event. '
  'A future cook_remainder value (Phase 5) will cover raw-ingredient remainders.';
