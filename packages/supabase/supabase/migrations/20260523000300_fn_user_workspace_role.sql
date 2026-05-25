-- DATABASE_PRD §8 — central helper used by RLS policies to look up a user's
-- role within a workspace. SECURITY DEFINER so it can read workspace_members
-- regardless of the caller's RLS policies on that table.

CREATE OR REPLACE FUNCTION public.fn_user_workspace_role(
  p_user_id UUID,
  p_workspace_id UUID
)
RETURNS public.workspace_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.workspace_members
  WHERE workspace_id = p_workspace_id
    AND user_id = p_user_id
    AND is_deleted = FALSE
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.fn_user_workspace_role IS
  'Returns the role of an authenticated user within a workspace, or NULL if not an active member.';

GRANT EXECUTE ON FUNCTION public.fn_user_workspace_role(UUID, UUID)
  TO authenticated, service_role;
