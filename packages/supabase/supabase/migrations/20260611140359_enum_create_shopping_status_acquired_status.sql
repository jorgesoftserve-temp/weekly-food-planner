-- DATABASE_PRD §5.1 (v2.0) — shopping_status and acquired_status system enums.
--
-- shopping_status: overall lifecycle of a shopping_sessions row.
--   in_progress — session is open; the workspace is currently shopping.
--   complete    — finalized; completeness >= 90 %.
--   incomplete  — finalized; completeness < 90 % (30–90 = incomplete, <30 = barely-shopped).
--
-- acquired_status: per-line acquisition state within a shopping session.
--   pending   — not yet addressed (default on session open).
--   acquired  — full required quantity confirmed purchased.
--   partial   — purchased amount is > 0 but < required (acquired_quantity < grocery_items.quantity).
--   skipped   — deliberately skipped (e.g. already in pantry / unavailable).

CREATE TYPE public.shopping_status AS ENUM (
  'in_progress',
  'complete',
  'incomplete'
);

COMMENT ON TYPE public.shopping_status IS
  'Overall lifecycle of a shopping_sessions row (v2.0). '
  'in_progress = open session; complete = finalized ≥90 %; '
  'incomplete = finalized <90 % (30–90 = incomplete, <30 = barely-shopped). '
  'See DATABASE_PRD §5.1 and PRODUCT_PRD §13.';

CREATE TYPE public.acquired_status AS ENUM (
  'pending',
  'acquired',
  'partial',
  'skipped'
);

COMMENT ON TYPE public.acquired_status IS
  'Per-grocery-line acquisition state within a shopping session (v2.0). '
  'pending = not yet addressed; acquired = full qty purchased; '
  'partial = some qty purchased; skipped = deliberately not bought. '
  'See DATABASE_PRD §5.1 and PRODUCT_PRD §13.';
