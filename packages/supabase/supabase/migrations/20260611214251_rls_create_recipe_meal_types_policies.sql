-- DATABASE_PRD §8 (v2.1) — RLS for recipe_meal_types.
--
-- Read:  any active member of the recipe's workspace (active recipes only).
-- Write: creator/admin only — mirrors recipe_dietary_tags policy in
--        rls_create_recipe_policies.sql exactly.
--
-- The EXISTS subquery joins through recipes to resolve the workspace_id and
-- check both the soft-delete flag (for reads) and the role (for writes).
-- fn_user_workspace_role is SECURITY DEFINER — never re-implement inline.

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.recipe_meal_types ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Read policy
-- Any active workspace member may read meal-type rows for active recipes.
-- ---------------------------------------------------------------------------

CREATE POLICY recipe_meal_types_read ON public.recipe_meal_types
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.recipes r
    WHERE r.id = recipe_id
      AND r.is_deleted = FALSE
      AND public.fn_user_workspace_role(auth.uid(), r.workspace_id) IS NOT NULL
  )
);

-- ---------------------------------------------------------------------------
-- Write policy (INSERT / UPDATE / DELETE)
-- Only creator/admin may mutate meal-type rows.
-- ---------------------------------------------------------------------------

CREATE POLICY recipe_meal_types_write ON public.recipe_meal_types
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
