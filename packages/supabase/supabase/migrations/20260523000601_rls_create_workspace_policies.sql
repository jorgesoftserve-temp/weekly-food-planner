-- DATABASE_PRD §8 — workspaces, workspace_members, and the three member_*
-- profile tables. Read by any active workspace member; write by creator/admin
-- with a self-exception so members may edit their own profile fields.

-- ---------------------------------------------------------------------------
-- workspaces
-- ---------------------------------------------------------------------------
CREATE POLICY workspaces_read ON public.workspaces
FOR SELECT TO authenticated
USING (
  is_deleted = FALSE
  AND public.fn_user_workspace_role(auth.uid(), id) IS NOT NULL
);

CREATE POLICY workspaces_insert ON public.workspaces
FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY workspaces_update ON public.workspaces
FOR UPDATE TO authenticated
USING (public.fn_user_workspace_role(auth.uid(), id) IN ('creator', 'admin'))
WITH CHECK (public.fn_user_workspace_role(auth.uid(), id) IN ('creator', 'admin'));

CREATE POLICY workspaces_delete ON public.workspaces
FOR DELETE TO authenticated
USING (public.fn_user_workspace_role(auth.uid(), id) = 'creator');

-- ---------------------------------------------------------------------------
-- workspace_members
-- ---------------------------------------------------------------------------
CREATE POLICY workspace_members_read ON public.workspace_members
FOR SELECT TO authenticated
USING (
  is_deleted = FALSE
  AND public.fn_user_workspace_role(auth.uid(), workspace_id) IS NOT NULL
);

CREATE POLICY workspace_members_insert ON public.workspace_members
FOR INSERT TO authenticated
WITH CHECK (public.fn_user_workspace_role(auth.uid(), workspace_id) IN ('creator', 'admin'));

CREATE POLICY workspace_members_update_self ON public.workspace_members
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY workspace_members_update_admin ON public.workspace_members
FOR UPDATE TO authenticated
USING (public.fn_user_workspace_role(auth.uid(), workspace_id) IN ('creator', 'admin'))
WITH CHECK (public.fn_user_workspace_role(auth.uid(), workspace_id) IN ('creator', 'admin'));

CREATE POLICY workspace_members_delete ON public.workspace_members
FOR DELETE TO authenticated
USING (public.fn_user_workspace_role(auth.uid(), workspace_id) IN ('creator', 'admin'));

-- ---------------------------------------------------------------------------
-- member_dietary_restrictions, member_allergies, member_ingredient_dislikes
-- ---------------------------------------------------------------------------
CREATE POLICY member_dietary_restrictions_read ON public.member_dietary_restrictions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.id = member_id
      AND public.fn_user_workspace_role(auth.uid(), wm.workspace_id) IS NOT NULL
  )
);

CREATE POLICY member_dietary_restrictions_write ON public.member_dietary_restrictions
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.id = member_id
      AND (
        wm.user_id = auth.uid()
        OR public.fn_user_workspace_role(auth.uid(), wm.workspace_id) IN ('creator', 'admin')
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.id = member_id
      AND (
        wm.user_id = auth.uid()
        OR public.fn_user_workspace_role(auth.uid(), wm.workspace_id) IN ('creator', 'admin')
      )
  )
);

CREATE POLICY member_allergies_read ON public.member_allergies
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.id = member_id
      AND public.fn_user_workspace_role(auth.uid(), wm.workspace_id) IS NOT NULL
  )
);

CREATE POLICY member_allergies_write ON public.member_allergies
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.id = member_id
      AND (
        wm.user_id = auth.uid()
        OR public.fn_user_workspace_role(auth.uid(), wm.workspace_id) IN ('creator', 'admin')
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.id = member_id
      AND (
        wm.user_id = auth.uid()
        OR public.fn_user_workspace_role(auth.uid(), wm.workspace_id) IN ('creator', 'admin')
      )
  )
);

CREATE POLICY member_ingredient_dislikes_read ON public.member_ingredient_dislikes
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.id = member_id
      AND public.fn_user_workspace_role(auth.uid(), wm.workspace_id) IS NOT NULL
  )
);

CREATE POLICY member_ingredient_dislikes_write ON public.member_ingredient_dislikes
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.id = member_id
      AND (
        wm.user_id = auth.uid()
        OR public.fn_user_workspace_role(auth.uid(), wm.workspace_id) IN ('creator', 'admin')
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.id = member_id
      AND (
        wm.user_id = auth.uid()
        OR public.fn_user_workspace_role(auth.uid(), wm.workspace_id) IN ('creator', 'admin')
      )
  )
);
