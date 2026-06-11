-- DATABASE_PRD §8 (v2.0 Phase 4) — RLS for slot_completions.
--
-- Read:  any active workspace member.
-- Write: any active workspace member. Marking a meal planned/cooked/skipped is a
--        runtime household action (not a structural edit), exactly like the v1.9
--        cook-mode toggle which any member may flip — so we gate on active
--        membership rather than creator/admin role.
--
-- fn_user_workspace_role is SECURITY DEFINER and is the canonical role-resolution
-- helper — we never re-implement membership checks inline. workspace_id is
-- denormalized onto the row, so the gate reads it directly (no EXISTS chain).

ALTER TABLE public.slot_completions ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Read policy — any active member of the workspace.
-- ---------------------------------------------------------------------------

CREATE POLICY slot_completions_read ON public.slot_completions
  FOR SELECT TO authenticated
  USING (
    public.fn_user_workspace_role(auth.uid(), workspace_id) IS NOT NULL
  );

-- ---------------------------------------------------------------------------
-- Write policy (INSERT / UPDATE / DELETE) — any active member.
-- USING gates UPDATE/DELETE (existing row); WITH CHECK gates INSERT/UPDATE
-- (new row). Both require active membership of the row's workspace.
-- ---------------------------------------------------------------------------

CREATE POLICY slot_completions_write ON public.slot_completions
  FOR ALL TO authenticated
  USING (
    public.fn_user_workspace_role(auth.uid(), workspace_id) IS NOT NULL
  )
  WITH CHECK (
    public.fn_user_workspace_role(auth.uid(), workspace_id) IS NOT NULL
  );
