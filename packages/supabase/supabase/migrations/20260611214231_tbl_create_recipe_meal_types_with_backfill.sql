-- DATABASE_PRD §6.23 (v2.1) — recipe_meal_types junction table.
--
-- Replaces the scalar recipes.meal_type column with a set-valued junction so a
-- recipe can be eligible for multiple meal timeframes (sandwich = breakfast +
-- snack + dinner). Mirrors recipe_dietary_tags in structure.
--
-- BACKFILL ORDER (all in one transaction — critical for data safety):
--   1. CREATE TABLE recipe_meal_types
--   2. INSERT one row per existing recipe from recipes.meal_type (backfill)
--   3. DROP COLUMN recipes.meal_type   <-- runs AFTER the backfill
--
-- The ≥1 row constraint for kind='meal' recipes is enforced at the write/route
-- layer, not via a DB constraint (addons may have zero rows).
--
-- No is_deleted — visibility follows the parent recipe (CASCADE on recipe delete).

CREATE TABLE public.recipe_meal_types (
  -- The recipe this row belongs to.
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,

  -- One of the meal timeframes the recipe can fill.
  meal_type public.meal_type NOT NULL,

  -- Composite PK — one row per (recipe, meal_type) pair.
  CONSTRAINT recipe_meal_types_pk PRIMARY KEY (recipe_id, meal_type)
);

COMMENT ON TABLE public.recipe_meal_types IS
  'Junction table for multi-timeframe recipe eligibility (v2.1). Replaces the '
  'scalar recipes.meal_type column. Each row asserts the recipe can fill that '
  'meal timeframe. Mirrors recipe_dietary_tags. DATABASE_PRD §6.23.';

COMMENT ON COLUMN public.recipe_meal_types.meal_type IS
  'A meal timeframe this recipe can fill (breakfast, lunch, dinner, snack). '
  'A recipe may have multiple rows for different timeframes.';

-- ---------------------------------------------------------------------------
-- Indexes — DATABASE_PRD §12 (v2.1)
-- ---------------------------------------------------------------------------

-- Engine input builder: join meal-type set per recipe.
CREATE INDEX idx_recipe_meal_types_recipe
  ON public.recipe_meal_types (recipe_id);

-- Filter-by-meal-type query on the junction (engine slot matching, recipe list UI).
CREATE INDEX idx_recipe_meal_types_meal_type
  ON public.recipe_meal_types (meal_type);

-- ---------------------------------------------------------------------------
-- BACKFILL: one row per existing recipe, from the current scalar meal_type.
--
-- Recipes where meal_type IS NULL (none should exist given the NOT NULL
-- constraint, but guarded here for safety) are skipped via WHERE clause.
-- After the INSERT, every recipe has exactly one recipe_meal_types row
-- matching its former scalar meal_type value — parity is guaranteed.
-- ---------------------------------------------------------------------------

INSERT INTO public.recipe_meal_types (recipe_id, meal_type)
SELECT id, meal_type
FROM public.recipes
WHERE meal_type IS NOT NULL;

-- ---------------------------------------------------------------------------
-- DROP the scalar recipes.meal_type column AFTER the backfill is committed.
--
-- SAFETY: The INSERT above must complete (and this file runs in a single
-- transaction via the Supabase migration runner) before this DROP executes.
-- Any failure in the INSERT rolls back the entire file — the scalar column
-- is never dropped if the backfill fails.
-- ---------------------------------------------------------------------------

ALTER TABLE public.recipes DROP COLUMN meal_type;
