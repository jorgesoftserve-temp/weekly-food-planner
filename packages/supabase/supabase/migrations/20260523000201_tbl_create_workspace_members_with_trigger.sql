-- DATABASE_PRD §6.2 — workspace members with role + dietary profile.

CREATE TABLE public.workspace_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  role public.workspace_role NOT NULL,
  age_category public.age_category NOT NULL,
  daily_calorie_target INT CHECK (daily_calorie_target IS NULL OR daily_calorie_target > 0),
  meal_frequency JSONB,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.workspace_members IS
  'Members of a workspace, including the creator. Recipient-only members may have user_id = NULL.';
COMMENT ON COLUMN public.workspace_members.meal_frequency IS
  'Per-member override. Falls back to workspaces.shared_meal_frequency. See DATABASE_PRD §7.';

-- Unique active linkage to auth user per workspace.
CREATE UNIQUE INDEX uq_workspace_members_workspace_user_active
  ON public.workspace_members (workspace_id, user_id)
  WHERE user_id IS NOT NULL AND is_deleted = FALSE;

-- Exactly one active creator per workspace.
CREATE UNIQUE INDEX uq_workspace_members_one_creator_active
  ON public.workspace_members (workspace_id)
  WHERE role = 'creator' AND is_deleted = FALSE;

CREATE INDEX idx_workspace_members_workspace_active
  ON public.workspace_members (workspace_id)
  WHERE is_deleted = FALSE;

CREATE INDEX idx_workspace_members_user_active
  ON public.workspace_members (user_id)
  WHERE user_id IS NOT NULL AND is_deleted = FALSE;

CREATE TRIGGER trg_workspace_members_updated_at
BEFORE UPDATE ON public.workspace_members
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
