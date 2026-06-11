-- DATABASE_PRD §8 (v2.0) — RLS for inventory_items.
--
-- Read:  any active workspace member.
-- Write: creator of the row (created_by = the auth user's workspace_members row
--        for this workspace) OR a workspace creator/admin role.
--
-- SECURITY NOTE: This file enables RLS on inventory_items and attaches policies.
-- fn_user_workspace_role is SECURITY DEFINER and is the canonical role-resolution
-- helper — we never re-implement membership checks inline.
--
-- The write policy uses a two-pronged WITH CHECK / USING clause:
--   1. Role-based gate  — fn_user_workspace_role IN ('creator','admin')
--   2. Row-owner gate   — created_by = the calling user's workspace_members.id
--      resolved via a sub-select (same workspace) to avoid storing auth.uid() directly.
--
-- Matches the pattern in rls_create_recipe_policies.sql and rls_create_menu_policies.sql.

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Read policy
-- Any active member of the workspace may see inventory rows.
-- (is_consumed rows are still readable — the module layer applies the
--  WHERE NOT is_consumed filter; audit paths need the full history.)
-- ---------------------------------------------------------------------------

CREATE POLICY inventory_items_read ON public.inventory_items
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

CREATE POLICY inventory_items_write ON public.inventory_items
  FOR ALL TO authenticated
  USING (
    public.fn_user_workspace_role(auth.uid(), workspace_id) IN ('creator', 'admin')
    OR created_by IN (
      SELECT id FROM public.workspace_members
      WHERE workspace_id = inventory_items.workspace_id
        AND user_id = auth.uid()
        AND is_deleted = FALSE
    )
  )
  WITH CHECK (
    public.fn_user_workspace_role(auth.uid(), workspace_id) IN ('creator', 'admin')
    OR created_by IN (
      SELECT id FROM public.workspace_members
      WHERE workspace_id = inventory_items.workspace_id
        AND user_id = auth.uid()
        AND is_deleted = FALSE
    )
  );
