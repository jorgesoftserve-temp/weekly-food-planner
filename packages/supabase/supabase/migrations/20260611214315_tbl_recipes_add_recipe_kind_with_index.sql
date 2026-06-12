-- DATABASE_PRD §6.7 (v2.1) — add recipe_kind column to recipes.
--
-- recipe_kind partitions recipes into engine-eligible meals (default) and
-- accompaniment addons (salsa, guacamole, dessert). The column has a NOT NULL
-- DEFAULT 'meal', so all existing rows are backfilled to 'meal' by Postgres
-- at ALTER TABLE time — no explicit UPDATE required.
--
-- Two partial indexes added:
--   addon picker — loads workspace addon recipes for the attachment UI.
--   meal filter  — supplements the (workspace_id, meal_type) index that was
--                  dropped alongside recipes.meal_type; the engine input
--                  builder now filters by recipe_kind='meal'.
--
-- No RLS change — the existing recipes_read / recipes_write policies cover
-- the new column without modification.

ALTER TABLE public.recipes
  ADD COLUMN recipe_kind public.recipe_kind NOT NULL DEFAULT 'meal';

COMMENT ON COLUMN public.recipes.recipe_kind IS
  'meal (default) = fills menu slots; engine-eligible. '
  'addon = accompaniment (e.g. salsa, guacamole); excluded from engine input '
  'at the menu-input-builder boundary. DATABASE_PRD §6.7 (v2.1).';

-- ---------------------------------------------------------------------------
-- Indexes — DATABASE_PRD §12 (v2.1)
-- ---------------------------------------------------------------------------

-- Addon picker: workspace addon recipes for the attachment UI.
CREATE INDEX idx_recipes_workspace_addon
  ON public.recipes (workspace_id)
  WHERE recipe_kind = 'addon' AND is_deleted = FALSE;

-- Engine input builder: workspace meal recipes (replaces the old
-- (workspace_id, meal_type) partial index now that meal_type is a junction).
CREATE INDEX idx_recipes_workspace_meal
  ON public.recipes (workspace_id)
  WHERE recipe_kind = 'meal' AND is_deleted = FALSE;
