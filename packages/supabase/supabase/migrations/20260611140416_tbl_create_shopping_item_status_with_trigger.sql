-- DATABASE_PRD §6.20 (v2.0) — shopping_item_status table.
--
-- Per-grocery-line acquisition state within a shopping session.
-- One row per (session_id, grocery_item_id) pair; the UNIQUE constraint
-- enforces this and doubles as the primary lookup index.
--
-- acquired_quantity tracks how much of the grocery_items.quantity was
-- actually picked up. The finalize helper uses this alongside the required
-- quantity to compute the session's quantity-weighted completeness.
--
-- There is no is_deleted on this table — rows cascade-delete with the
-- parent shopping_session (child table pattern: DATABASE_PRD §6.20).

CREATE TABLE public.shopping_item_status (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parent session
  session_id UUID NOT NULL REFERENCES public.shopping_sessions(id) ON DELETE CASCADE,

  -- The grocery line item being tracked
  grocery_item_id UUID NOT NULL REFERENCES public.grocery_items(id) ON DELETE CASCADE,

  -- How much was actually acquired (0 by default = not yet picked up)
  acquired_quantity NUMERIC NOT NULL DEFAULT 0 CHECK (acquired_quantity >= 0),

  -- Acquisition state
  status public.acquired_status NOT NULL DEFAULT 'pending',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Exactly one status row per grocery item per session
  UNIQUE (session_id, grocery_item_id)
);

COMMENT ON TABLE public.shopping_item_status IS
  'Per-grocery-line acquisition state within a shopping session. DATABASE_PRD §6.20 (v2.0). '
  'One row per (session_id, grocery_item_id). No is_deleted — cascade-deletes with session. '
  'acquired_quantity + status are updated as the shopper marks items.';

COMMENT ON COLUMN public.shopping_item_status.acquired_quantity IS
  'Quantity actually picked up. Used by the finalize helper to compute completeness. '
  'CHECK >= 0; may exceed grocery_items.quantity if the shopper bought extra.';

COMMENT ON COLUMN public.shopping_item_status.status IS
  'pending | acquired | partial | skipped. '
  'The finalize helper sets partial when 0 < acquired_quantity < required, '
  'acquired when acquired_quantity >= required, skipped when the user skips.';

-- ---------------------------------------------------------------------------
-- Indexes (DATABASE_PRD §12, v2.0)
-- The UNIQUE (session_id, grocery_item_id) constraint already creates an index
-- that covers the primary lookup (all items for a session). We add a reverse
-- lookup by grocery_item_id for ad-hoc item history queries.
-- ---------------------------------------------------------------------------

CREATE INDEX idx_shopping_item_status_grocery_item
  ON public.shopping_item_status (grocery_item_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

CREATE TRIGGER trg_shopping_item_status_updated_at
  BEFORE UPDATE ON public.shopping_item_status
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
