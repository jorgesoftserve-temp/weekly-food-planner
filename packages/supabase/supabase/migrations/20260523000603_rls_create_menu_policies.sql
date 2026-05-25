-- DATABASE_PRD §8 — menus, menu_slots, grocery_lists, grocery_items, generation_runs.
-- Read: any active member of the workspace (active menus only for menu/slot/grocery reads).
-- Write: service-role only (engine pipeline). The web app calls into service-role
-- via server actions / route handlers; direct table writes from authenticated
-- clients are intentionally blocked here.

CREATE POLICY menus_read ON public.menus
FOR SELECT TO authenticated
USING (
  is_deleted = FALSE
  AND public.fn_user_workspace_role(auth.uid(), workspace_id) IS NOT NULL
);

CREATE POLICY menu_slots_read ON public.menu_slots
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.menus m
    WHERE m.id = menu_id
      AND m.is_deleted = FALSE
      AND public.fn_user_workspace_role(auth.uid(), m.workspace_id) IS NOT NULL
  )
);

CREATE POLICY grocery_lists_read ON public.grocery_lists
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.menus m
    WHERE m.id = menu_id
      AND m.is_deleted = FALSE
      AND public.fn_user_workspace_role(auth.uid(), m.workspace_id) IS NOT NULL
  )
);

CREATE POLICY grocery_items_read ON public.grocery_items
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.grocery_lists gl
    JOIN public.menus m ON m.id = gl.menu_id
    WHERE gl.id = list_id
      AND m.is_deleted = FALSE
      AND public.fn_user_workspace_role(auth.uid(), m.workspace_id) IS NOT NULL
  )
);

-- Generation runs are admin-level audit (creator/admin only).
CREATE POLICY generation_runs_read ON public.generation_runs
FOR SELECT TO authenticated
USING (public.fn_user_workspace_role(auth.uid(), workspace_id) IN ('creator', 'admin'));
