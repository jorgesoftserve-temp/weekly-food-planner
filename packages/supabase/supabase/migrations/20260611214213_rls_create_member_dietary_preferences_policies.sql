-- DATABASE_PRD §8 (v2.1) — RLS for member_dietary_preferences.
--
-- Read:  any active member of the same workspace.
-- Write: self (workspace_members.user_id = auth.uid()) OR creator/admin role.
--
-- Mirrors member_dietary_restrictions / member_allergies / member_ingredient_dislikes
-- policies from rls_create_workspace_policies.sql exactly — the workspace join
-- goes through the member_id FK to workspace_members, then checks either
-- self-ownership (wm.user_id = auth.uid()) or role in ('creator','admin').
--
-- workspace_id is denormalized on the row, but we still join through
-- workspace_members for the write policy so we can check wm.user_id = auth.uid()
-- (the denormalized workspace_id alone cannot verify self-ownership).
--
-- fn_user_workspace_role is SECURITY DEFINER — never re-implement inline.

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.member_dietary_preferences ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Read policy
-- Any active member of the workspace may read inclusive preferences.
-- ---------------------------------------------------------------------------

CREATE POLICY member_dietary_preferences_read ON public.member_dietary_preferences
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.id = member_id
      AND public.fn_user_workspace_role(auth.uid(), wm.workspace_id) IS NOT NULL
  )
);

-- ---------------------------------------------------------------------------
-- Write policy (INSERT / DELETE — no UPDATE; prefs are replace-by-delete)
-- Permitted when EITHER:
--   (a) the calling user is the member themselves (wm.user_id = auth.uid()), OR
--   (b) the calling user holds creator or admin role in the workspace.
-- ---------------------------------------------------------------------------

CREATE POLICY member_dietary_preferences_write ON public.member_dietary_preferences
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
