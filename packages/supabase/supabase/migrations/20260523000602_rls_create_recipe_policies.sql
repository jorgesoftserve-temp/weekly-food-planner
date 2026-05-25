-- DATABASE_PRD §8 — recipes and their child tables.
-- Read: any active member of the recipe's workspace, active recipes only.
-- Write: creator/admin only.

CREATE POLICY recipes_read ON public.recipes
FOR SELECT TO authenticated
USING (
  is_deleted = FALSE
  AND public.fn_user_workspace_role(auth.uid(), workspace_id) IS NOT NULL
);

CREATE POLICY recipes_write ON public.recipes
FOR ALL TO authenticated
USING (public.fn_user_workspace_role(auth.uid(), workspace_id) IN ('creator', 'admin'))
WITH CHECK (public.fn_user_workspace_role(auth.uid(), workspace_id) IN ('creator', 'admin'));

-- ---------------------------------------------------------------------------
-- recipe_ingredients
-- ---------------------------------------------------------------------------
CREATE POLICY recipe_ingredients_read ON public.recipe_ingredients
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.recipes r
    WHERE r.id = recipe_id
      AND r.is_deleted = FALSE
      AND public.fn_user_workspace_role(auth.uid(), r.workspace_id) IS NOT NULL
  )
);

CREATE POLICY recipe_ingredients_write ON public.recipe_ingredients
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.recipes r
    WHERE r.id = recipe_id
      AND public.fn_user_workspace_role(auth.uid(), r.workspace_id) IN ('creator', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.recipes r
    WHERE r.id = recipe_id
      AND public.fn_user_workspace_role(auth.uid(), r.workspace_id) IN ('creator', 'admin')
  )
);

-- ---------------------------------------------------------------------------
-- recipe_instructions
-- ---------------------------------------------------------------------------
CREATE POLICY recipe_instructions_read ON public.recipe_instructions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.recipes r
    WHERE r.id = recipe_id
      AND r.is_deleted = FALSE
      AND public.fn_user_workspace_role(auth.uid(), r.workspace_id) IS NOT NULL
  )
);

CREATE POLICY recipe_instructions_write ON public.recipe_instructions
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.recipes r
    WHERE r.id = recipe_id
      AND public.fn_user_workspace_role(auth.uid(), r.workspace_id) IN ('creator', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.recipes r
    WHERE r.id = recipe_id
      AND public.fn_user_workspace_role(auth.uid(), r.workspace_id) IN ('creator', 'admin')
  )
);

-- ---------------------------------------------------------------------------
-- recipe_dietary_tags
-- ---------------------------------------------------------------------------
CREATE POLICY recipe_dietary_tags_read ON public.recipe_dietary_tags
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.recipes r
    WHERE r.id = recipe_id
      AND r.is_deleted = FALSE
      AND public.fn_user_workspace_role(auth.uid(), r.workspace_id) IS NOT NULL
  )
);

CREATE POLICY recipe_dietary_tags_write ON public.recipe_dietary_tags
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.recipes r
    WHERE r.id = recipe_id
      AND public.fn_user_workspace_role(auth.uid(), r.workspace_id) IN ('creator', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.recipes r
    WHERE r.id = recipe_id
      AND public.fn_user_workspace_role(auth.uid(), r.workspace_id) IN ('creator', 'admin')
  )
);
