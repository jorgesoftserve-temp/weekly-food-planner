-- DATABASE_PRD §8 (v2.1) — RLS for menu_addons.
--
-- Read:  any active member of the workspace.
-- Write: creator of the row (created_by = the calling user's workspace_members
--        row for this workspace) OR a workspace creator/admin role.
--
-- Mirrors menu_slot_ingredient_overrides RLS exactly — same two-pronged write
-- gate (role-based OR row-owner via sub-select scoped to the workspace).
-- workspace_id is denormalized on the row so fn_user_workspace_role can be
-- called directly without an EXISTS chain through menus.
--
-- fn_user_workspace_role is SECURITY DEFINER — never re-implement inline.

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.menu_addons ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Read policy
-- Any active member of the workspace may read addon attachments.
-- ---------------------------------------------------------------------------

CREATE POLICY menu_addons_read ON public.menu_addons
  FOR SELECT TO authenticated
  USING (
    public.fn_user_workspace_role(auth.uid(), workspace_id) IS NOT NULL
  );

-- ---------------------------------------------------------------------------
-- Write policy (INSERT / UPDATE / DELETE)
-- Permitted when EITHER:
--   (a) the calling user holds creator or admin role in the workspace, OR
--   (b) the row was created by the calling user's workspace_members row.
--
-- USING  applies to UPDATE and DELETE (existing-row check).
-- WITH CHECK applies to INSERT and UPDATE (new-row check).
-- Both clauses are identical so the gate is symmetric.
-- ---------------------------------------------------------------------------

CREATE POLICY menu_addons_write ON public.menu_addons
  FOR ALL TO authenticated
  USING (
    public.fn_user_workspace_role(auth.uid(), workspace_id) IN ('creator', 'admin')
    OR created_by IN (
      SELECT id FROM public.workspace_members
      WHERE workspace_id = menu_addons.workspace_id
        AND user_id = auth.uid()
        AND is_deleted = FALSE
    )
  )
  WITH CHECK (
    public.fn_user_workspace_role(auth.uid(), workspace_id) IN ('creator', 'admin')
    OR created_by IN (
      SELECT id FROM public.workspace_members
      WHERE workspace_id = menu_addons.workspace_id
        AND user_id = auth.uid()
        AND is_deleted = FALSE
    )
  );
