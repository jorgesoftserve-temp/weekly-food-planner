-- DATABASE_PRD §8 — global ingredient catalog and allergen mappings.
-- Read: any authenticated user. Write: service-role only (catalog is system-managed).

CREATE POLICY ingredients_read ON public.ingredients
FOR SELECT TO authenticated
USING (TRUE);

CREATE POLICY ingredient_allergens_read ON public.ingredient_allergens
FOR SELECT TO authenticated
USING (TRUE);
