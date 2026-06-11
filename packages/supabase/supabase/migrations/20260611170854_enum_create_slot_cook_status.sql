-- DATABASE_PRD §6.21 (v2.0 Phase 4) — slot_cook_status enum.
--
-- The execution state of a single accepted-menu slot. Distinct from the v1.9
-- menu_slots.cooked_at quick toggle: this is the richer planned/cooked/skipped
-- state machine recorded in slot_completions, which drives leftovers (Phase 5)
-- and incomplete-shopping alerts (Phase 3). An absent slot_completions row is
-- read as 'planned'.

CREATE TYPE public.slot_cook_status AS ENUM ('planned', 'cooked', 'skipped');

COMMENT ON TYPE public.slot_cook_status IS
  'Execution state of an accepted-menu slot: planned | cooked | skipped. '
  'Absent slot_completions row = planned. DATABASE_PRD §6.21 (v2.0 Phase 4).';
