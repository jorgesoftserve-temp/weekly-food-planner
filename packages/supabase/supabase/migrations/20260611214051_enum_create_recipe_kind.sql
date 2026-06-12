-- DATABASE_PRD §5.1 (v2.1) — recipe_kind system enum.
--
-- Partitions recipes into engine-eligible meals vs accompaniment addons.
--   meal  = fills menu slots; eligible constraint-engine candidate (default).
--   addon = accompaniment (salsa, guacamole, dessert); excluded at the
--           menu-input-builder boundary; never enters a RecipeSnapshot or
--           inputs_hash; never appears in a golden snapshot.
--
-- The ≥1 meal-type constraint (recipe_meal_types) is enforced at the
-- write/route layer for kind='meal' only — addons may have zero rows.

CREATE TYPE public.recipe_kind AS ENUM ('meal', 'addon');

COMMENT ON TYPE public.recipe_kind IS
  'Partitions recipes into engine-eligible meals (default) and accompaniment '
  'addons. Addons are excluded from menu generation at the input-builder '
  'boundary. DATABASE_PRD §5.1 (v2.1).';
