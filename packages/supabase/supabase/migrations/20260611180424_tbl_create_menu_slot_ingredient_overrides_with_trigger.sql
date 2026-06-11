-- DATABASE_PRD §6.21 (v2.0 Phase 6) — menu_slot_ingredient_overrides table.
--
-- Per-slot ingredient substitution for an accepted menu. A row records that
-- `original_ingredient_id` in the recipe assigned to `menu_slot_id` should be
-- replaced with `substitute_ingredient_id`, optionally with a quantity and/or
-- unit adjustment.
--
-- ENGINE ISOLATION NOTE (v2.0 design contract):
--   This table is keyed by menu_slot_id, which places it ENTIRELY OUTSIDE the
--   accepted_seed hash boundary. accepted_seed hashes only slot recipe-tuples
--   (menu_slots rows), never ingredient lists. The constraint engine never reads
--   or writes this table; overrides are post-accept menu state consumed only by
--   the grocery recompute path (recomputeGroceryListsForMenu). Regenerating the
--   engine from the same seed will never clobber or interact with these rows.
--
-- workspace_id is denormalized from menu_slots → menus for direct RLS gating
-- via fn_user_workspace_role, matching the pattern used by slot_completions,
-- inventory_items, and shopping_sessions.

CREATE TABLE public.menu_slot_ingredient_overrides (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- The slot whose ingredient is being overridden. One override per
  -- (slot, original_ingredient) — see UNIQUE constraint below.
  menu_slot_id UUID NOT NULL REFERENCES public.menu_slots(id) ON DELETE CASCADE,

  -- Workspace scope (denormalized from menu_slots → menus.workspace_id for RLS).
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

  -- The ingredient in the recipe that is being substituted.
  original_ingredient_id UUID NOT NULL REFERENCES public.ingredients(id),

  -- The replacement ingredient.
  substitute_ingredient_id UUID NOT NULL REFERENCES public.ingredients(id),

  -- Optional quantity override. NULL = inherit from recipe_ingredients.
  quantity NUMERIC NULL CONSTRAINT menu_slot_ingredient_overrides_qty_positive CHECK (quantity >= 0),

  -- Optional unit override. NULL = inherit from recipe_ingredients.
  unit public.unit NULL,

  -- Optional free-text annotation (e.g. "used oat milk — same ratio").
  note TEXT NULL,

  -- Who created this override. ON DELETE SET NULL preserves the override record
  -- even if the member is later removed from the workspace.
  created_by UUID NULL REFERENCES public.workspace_members(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One active substitute per original ingredient per slot.
  CONSTRAINT menu_slot_ingredient_overrides_unique UNIQUE (menu_slot_id, original_ingredient_id)
);

COMMENT ON TABLE public.menu_slot_ingredient_overrides IS
  'Per-slot ingredient substitution for accepted menus (v2.0 Phase 6). '
  'Structurally unreachable from accepted_seed and the constraint engine — '
  'overrides are post-accept state consumed only by grocery recompute. '
  'DATABASE_PRD §6.21.';

COMMENT ON COLUMN public.menu_slot_ingredient_overrides.original_ingredient_id IS
  'The ingredient in recipe_ingredients being substituted.';

COMMENT ON COLUMN public.menu_slot_ingredient_overrides.substitute_ingredient_id IS
  'The replacement ingredient. Must already exist in the global ingredients catalog.';

COMMENT ON COLUMN public.menu_slot_ingredient_overrides.quantity IS
  'Override quantity; NULL = inherit from recipe_ingredients. Must be >= 0 when set.';

COMMENT ON COLUMN public.menu_slot_ingredient_overrides.unit IS
  'Override unit; NULL = inherit from recipe_ingredients.';

COMMENT ON COLUMN public.menu_slot_ingredient_overrides.created_by IS
  'workspace_members.id of who created this override. ON DELETE SET NULL.';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Primary lookup: fetch all overrides for a slot during grocery recompute.
-- The UNIQUE constraint already backs (menu_slot_id, original_ingredient_id);
-- a standalone index on menu_slot_id alone lets the recompute scan every
-- override for a slot without supplying original_ingredient_id.
CREATE INDEX idx_menu_slot_ingredient_overrides_slot
  ON public.menu_slot_ingredient_overrides (menu_slot_id);

-- Workspace-scoped scans used by the RLS role lookup and any future
-- per-workspace override audit queries.
CREATE INDEX idx_menu_slot_ingredient_overrides_workspace
  ON public.menu_slot_ingredient_overrides (workspace_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger — matches set_updated_at() pattern from slot_completions.
-- ---------------------------------------------------------------------------

CREATE TRIGGER trg_menu_slot_ingredient_overrides_updated_at
  BEFORE UPDATE ON public.menu_slot_ingredient_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
