-- DATABASE_PRD §6.6.1 — maps ingredients to food_allergy labels.

CREATE TABLE public.ingredient_allergens (
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  allergy TEXT NOT NULL,
  PRIMARY KEY (ingredient_id, allergy)
);

COMMENT ON TABLE public.ingredient_allergens IS
  'Allergen labels per ingredient. Engine joins with member_allergies by exact string match on `allergy`.';

CREATE INDEX idx_ingredient_allergens_allergy
  ON public.ingredient_allergens (allergy);
