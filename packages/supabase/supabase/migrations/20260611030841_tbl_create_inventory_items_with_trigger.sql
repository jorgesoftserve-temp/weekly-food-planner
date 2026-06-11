-- DATABASE_PRD §6.18 (v2.0) — inventory_items table.
--
-- Tracks per-workspace pantry stock. An item enters inventory via one of three
-- paths mirrored by inventory_source: manual entry, a finalized shopping session
-- (source='purchase', source_menu_id set), or a leftover from a slot cook event
-- (source='leftover', source_slot_id + source_menu_id set).
--
-- Lifecycle flag: is_consumed (NOT is_deleted). Inventory is user stock — rows
-- are consumed, not soft-deleted. Consumed rows stay for audit but are excluded
-- from on-hand calculations via the partial indexes.
--
-- unit mirrors recipe_ingredients.unit: public.unit NOT NULL (system enum).
-- created_by references workspace_members.id (same pattern as shopping_sessions
-- and menu_slot_ingredient_overrides per DATABASE_PRD §6.18/§6.21).

CREATE TABLE public.inventory_items (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Workspace scope
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

  -- What ingredient this represents
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id),

  -- How the item arrived in the pantry
  source public.inventory_source NOT NULL DEFAULT 'manual',

  -- Stock amount — decremented on partial spoilage/consumption
  quantity NUMERIC NOT NULL CHECK (quantity >= 0),
  unit public.unit NOT NULL,

  -- Optional expiry (per-row, independently editable).
  -- Defaulted on leftover inflow from cooked_at + COALESCE(ingredients.max_storage_days, workspaces.leftover_max_days).
  expiration_date DATE,

  -- Provenance back-references (set by the shopping-finalize / leftover flows)
  source_menu_id UUID REFERENCES public.menus(id) ON DELETE SET NULL,
  source_slot_id UUID REFERENCES public.menu_slots(id) ON DELETE SET NULL,

  -- Optional free-text annotation (e.g. "organic", "freezer")
  label TEXT,

  -- Lifecycle: consumed rows excluded from on-hand calculations but retained for audit.
  -- This is NOT soft-delete — it is the natural inventory lifecycle.
  is_consumed BOOLEAN NOT NULL DEFAULT FALSE,

  -- Creator: workspace_members.id (not auth.users.id) matching the pattern in
  -- shopping_sessions / menu_slot_ingredient_overrides (DATABASE_PRD §6.18, §6.21).
  -- ON DELETE SET NULL so admin deletion of a member row doesn't cascade-delete stock.
  created_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.inventory_items IS
  'Workspace pantry stock. DATABASE_PRD §6.18 (v2.0). '
  'is_consumed is the lifecycle flag (not is_deleted — inventory is user stock).';

COMMENT ON COLUMN public.inventory_items.source IS
  'Inflow path: manual | purchase | leftover. See inventory_source enum.';

COMMENT ON COLUMN public.inventory_items.quantity IS
  'Current on-hand quantity. Decremented directly for partial spoilage (no event log in v2).';

COMMENT ON COLUMN public.inventory_items.expiration_date IS
  'Optional per-row expiry. Defaulted on leftover/purchase inflow; independently editable.';

COMMENT ON COLUMN public.inventory_items.source_menu_id IS
  'Set when source is purchase or leftover; FK → menus.id ON DELETE SET NULL.';

COMMENT ON COLUMN public.inventory_items.source_slot_id IS
  'Set when source is leftover; FK → menu_slots.id ON DELETE SET NULL.';

COMMENT ON COLUMN public.inventory_items.is_consumed IS
  'TRUE once fully consumed (manually or via lazy expiry scan). '
  'Consumed rows excluded from on-hand calculations via partial indexes.';

COMMENT ON COLUMN public.inventory_items.created_by IS
  'workspace_members.id of who created this row. ON DELETE SET NULL.';

-- ---------------------------------------------------------------------------
-- Indexes (DATABASE_PRD §12, v2.0)
-- Both partial: exclude consumed rows (the hot path only cares about on-hand stock).
-- ---------------------------------------------------------------------------

-- On-hand lookup by ingredient (e.g. pantry annotation in grocery view)
CREATE INDEX idx_inventory_items_workspace_ingredient_active
  ON public.inventory_items (workspace_id, ingredient_id)
  WHERE NOT is_consumed;

-- Lazy expiry scan on read
CREATE INDEX idx_inventory_items_workspace_expiry_active
  ON public.inventory_items (workspace_id, expiration_date)
  WHERE NOT is_consumed;

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

CREATE TRIGGER trg_inventory_items_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
