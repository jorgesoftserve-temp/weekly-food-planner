-- DATABASE_PRD §8 (v2.0 Phase 6) — RLS for menu_slot_ingredient_overrides.
--
-- Read:  any active workspace member.
-- Write: creator of the row (created_by = the calling user's workspace_members
--        row for this workspace) OR a workspace creator/admin role.
--
-- This matches the inventory_items RLS pattern exactly — overrides are a
-- member-visible, restricted-write resource (not a shared household action like
-- slot_completions). The two-pronged write gate is:
--   1. Role-based gate  — fn_user_workspace_role IN ('creator','admin')
--   2. Row-owner gate   — created_by = the calling user's workspace_members.id,
--      resolved via a sub-select scoped to the row's workspace.
--
-- workspace_id is denormalized onto the row so fn_user_workspace_role can be
-- called without an EXISTS chain through menu_slots → menus. The read policy
-- intentionally gates via workspace_id for the same reason.
--
-- fn_user_workspace_role is SECURITY DEFINER — we never re-implement membership
-- checks inline.

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.menu_slot_ingredient_overrides ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Read policy
-- Any active member of the workspace may read ingredient overrides.
-- ---------------------------------------------------------------------------

CREATE POLICY menu_slot_ingredient_overrides_read
  ON public.menu_slot_ingredient_overrides
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

CREATE POLICY menu_slot_ingredient_overrides_write
  ON public.menu_slot_ingredient_overrides
  FOR ALL TO authenticated
  USING (
    public.fn_user_workspace_role(auth.uid(), workspace_id) IN ('creator', 'admin')
    OR created_by IN (
      SELECT id FROM public.workspace_members
      WHERE workspace_id = menu_slot_ingredient_overrides.workspace_id
        AND user_id = auth.uid()
        AND is_deleted = FALSE
    )
  )
  WITH CHECK (
    public.fn_user_workspace_role(auth.uid(), workspace_id) IN ('creator', 'admin')
    OR created_by IN (
      SELECT id FROM public.workspace_members
      WHERE workspace_id = menu_slot_ingredient_overrides.workspace_id
        AND user_id = auth.uid()
        AND is_deleted = FALSE
    )
  );
