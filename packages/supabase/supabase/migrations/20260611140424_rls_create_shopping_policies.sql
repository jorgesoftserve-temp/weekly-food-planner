-- DATABASE_PRD §8 (v2.0) — RLS for shopping_sessions and shopping_item_status.
--
-- shopping_sessions
--   Read:  any active workspace member (fn_user_workspace_role IS NOT NULL).
--   Write: workspace creator/admin OR the row's created_by resolves to the
--          calling user's workspace_members.id — mirrors inventory_items_write
--          in rls_create_inventory_items_policies.sql exactly.
--
-- shopping_item_status (child of shopping_sessions)
--   Read:  active member of the session's workspace — uses an EXISTS subquery
--          joining shopping_item_status → shopping_sessions → fn_user_workspace_role,
--          mirroring the grocery_items_read / menu_slots_read EXISTS pattern in
--          rls_create_menu_policies.sql.
--   Write: workspace creator/admin of the session's workspace — same EXISTS join
--          but adds the role check. No row-owner gate on the child table (the
--          session's created_by is the owner gate; item-level writes are role-gated).
--
-- SECURITY NOTE: fn_user_workspace_role is SECURITY DEFINER — we never
-- re-implement membership checks inline.

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.shopping_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_item_status   ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- shopping_sessions — read policy
-- Any active member of the workspace may read sessions.
-- ---------------------------------------------------------------------------

CREATE POLICY shopping_sessions_read ON public.shopping_sessions
  FOR SELECT TO authenticated
  USING (
    public.fn_user_workspace_role(auth.uid(), workspace_id) IS NOT NULL
  );

-- ---------------------------------------------------------------------------
-- shopping_sessions — write policy (INSERT / UPDATE / DELETE)
-- Permitted when EITHER:
--   (a) the calling user holds creator or admin role in the workspace, OR
--   (b) the row was created by the calling user's workspace_members row.
--
-- USING applies to UPDATE and DELETE (existing-row check).
-- WITH CHECK applies to INSERT and UPDATE (new-row check).
-- Both clauses are identical so the gate is symmetric.
-- Mirrors inventory_items_write in rls_create_inventory_items_policies.sql.
-- ---------------------------------------------------------------------------

CREATE POLICY shopping_sessions_write ON public.shopping_sessions
  FOR ALL TO authenticated
  USING (
    public.fn_user_workspace_role(auth.uid(), workspace_id) IN ('creator', 'admin')
    OR created_by IN (
      SELECT id FROM public.workspace_members
      WHERE workspace_id = shopping_sessions.workspace_id
        AND user_id = auth.uid()
        AND is_deleted = FALSE
    )
  )
  WITH CHECK (
    public.fn_user_workspace_role(auth.uid(), workspace_id) IN ('creator', 'admin')
    OR created_by IN (
      SELECT id FROM public.workspace_members
      WHERE workspace_id = shopping_sessions.workspace_id
        AND user_id = auth.uid()
        AND is_deleted = FALSE
    )
  );

-- ---------------------------------------------------------------------------
-- shopping_item_status — read policy
-- Active member of the session's workspace may read item-status rows.
-- Uses an EXISTS join through shopping_sessions (child-table pattern
-- mirroring grocery_items_read in rls_create_menu_policies.sql).
-- ---------------------------------------------------------------------------

CREATE POLICY shopping_item_status_read ON public.shopping_item_status
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shopping_sessions ss
      WHERE ss.id = session_id
        AND public.fn_user_workspace_role(auth.uid(), ss.workspace_id) IS NOT NULL
    )
  );

-- ---------------------------------------------------------------------------
-- shopping_item_status — write policy (INSERT / UPDATE / DELETE)
-- Workspace creator/admin may write item-status rows.
-- The row-owner gate lives at the session level (shopping_sessions_write),
-- not here — item-level writes are role-gated only (tighter: only
-- creator/admin can mark items acquired/skipped on behalf of the workspace).
-- ---------------------------------------------------------------------------

CREATE POLICY shopping_item_status_write ON public.shopping_item_status
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shopping_sessions ss
      WHERE ss.id = session_id
        AND public.fn_user_workspace_role(auth.uid(), ss.workspace_id) IN ('creator', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shopping_sessions ss
      WHERE ss.id = session_id
        AND public.fn_user_workspace_role(auth.uid(), ss.workspace_id) IN ('creator', 'admin')
    )
  );
