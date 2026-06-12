-- DATABASE_PRD §6.24 (v2.1) — menu_addons table.
--
-- Post-accept menu state recording which addon recipes are attached to an
-- accepted menu. Structurally invisible to accepted_seed — analogous to
-- menu_slot_ingredient_overrides (§6.21). accepted_seed hashes only slot
-- recipe-tuples (menu_slots rows); this table is keyed by menu_id and is
-- never read by the constraint engine.
--
-- ENGINE ISOLATION NOTE:
--   Attaching or detaching a menu_addons row does NOT change the menu's
--   accepted_seed or inputs_hash. The engine never reads this table.
--   Addon ingredients appear in the grocery list via a separate
--   recomputeGroceryListsForMenu addon pass (tagged source='addon').
--
-- addon_recipe_id must reference a recipe with recipe_kind='addon' — this
-- constraint is enforced at the route layer, not via a DB CHECK, to keep
-- the migration engine-free and the schema stable.
--
-- target_slot_id NULL  = week-wide addon (accompanies any/all meals).
-- target_slot_id SET   = tied to a specific slot (e.g. "guac with Tuesday lunch").
-- ON DELETE SET NULL preserves the addon row if the slot is removed.
--
-- workspace_id is denormalized from menus for direct RLS gating via
-- fn_user_workspace_role, matching slot_completions / menu_slot_ingredient_overrides.
--
-- NO is_deleted — the sibling post-accept tables (slot_completions,
-- menu_slot_ingredient_overrides) carry no soft delete; menu_addons follows
-- the same pattern. Visibility follows the parent menu.

CREATE TABLE public.menu_addons (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- The menu this addon is attached to.
  menu_id UUID NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,

  -- Workspace scope (denormalized from menus.workspace_id for RLS).
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

  -- The addon recipe being attached. Must have recipe_kind='addon';
  -- enforced at the route layer.
  addon_recipe_id UUID NOT NULL REFERENCES public.recipes(id),

  -- Optional slot association. NULL = week-wide; SET = tied to one slot.
  -- ON DELETE SET NULL so removing/replacing a slot doesn't delete the addon.
  target_slot_id UUID NULL REFERENCES public.menu_slots(id) ON DELETE SET NULL,

  -- Optional scaling hint (number of servings to prepare).
  servings NUMERIC NULL CONSTRAINT menu_addons_servings_positive CHECK (servings > 0),

  -- Optional free-text annotation (e.g. "double the batch for the party").
  note TEXT NULL,

  -- Who attached this addon. ON DELETE SET NULL preserves the row on member removal.
  created_by UUID NULL REFERENCES public.workspace_members(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.menu_addons IS
  'Post-accept menu state: addon recipes attached to an accepted menu (v2.1). '
  'Structurally invisible to accepted_seed and the constraint engine — '
  'same isolation proof as menu_slot_ingredient_overrides. '
  'Addon ingredients surface in grocery_items with source=''addon'' via '
  'the recomputeGroceryListsForMenu addon pass. DATABASE_PRD §6.24.';

COMMENT ON COLUMN public.menu_addons.addon_recipe_id IS
  'The addon recipe being attached. Must have recipe_kind=''addon''; '
  'enforced at the route layer, not via DB constraint.';

COMMENT ON COLUMN public.menu_addons.target_slot_id IS
  'NULL = week-wide addon. SET = tied to a specific menu slot. '
  'ON DELETE SET NULL preserves the addon row if the slot is removed.';

COMMENT ON COLUMN public.menu_addons.servings IS
  'Optional scaling hint. NULL = use the recipe''s default servings. Must be > 0.';

COMMENT ON COLUMN public.menu_addons.created_by IS
  'workspace_members.id of who attached this addon. ON DELETE SET NULL.';

-- ---------------------------------------------------------------------------
-- Indexes — DATABASE_PRD §12 (v2.1)
-- ---------------------------------------------------------------------------

-- Primary lookup: load all addons for a menu during grocery recompute.
CREATE INDEX idx_menu_addons_menu
  ON public.menu_addons (menu_id);

-- Workspace-scoped scan for RLS role lookup.
CREATE INDEX idx_menu_addons_workspace
  ON public.menu_addons (workspace_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger — matches set_updated_at() pattern.
-- ---------------------------------------------------------------------------

CREATE TRIGGER trg_menu_addons_updated_at
  BEFORE UPDATE ON public.menu_addons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
