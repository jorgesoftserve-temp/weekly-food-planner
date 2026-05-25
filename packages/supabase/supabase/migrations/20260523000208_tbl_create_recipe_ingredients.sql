-- DATABASE_PRD §6.8 — recipe ingredients with quantities and substitutions.

CREATE TABLE public.recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id),
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit public.unit NOT NULL,
  substitutions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_perishable_override BOOLEAN
);

COMMENT ON COLUMN public.recipe_ingredients.substitutions IS
  'Array of { ingredient_id, note } substitution options.';

CREATE INDEX idx_recipe_ingredients_recipe ON public.recipe_ingredients (recipe_id);
CREATE INDEX idx_recipe_ingredients_ingredient ON public.recipe_ingredients (ingredient_id);
