-- DATABASE_PRD §6.1 — workspaces (individual or group).

CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.workspace_type NOT NULL,
  name TEXT NOT NULL,
  shared_meal_frequency JSONB,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.workspaces IS
  'Top-level container: individual or group meal-planning workspace.';
COMMENT ON COLUMN public.workspaces.owner_id IS
  'Stable original creator. Workspace_members.role=creator is the live source of truth.';
COMMENT ON COLUMN public.workspaces.shared_meal_frequency IS
  'Workspace-wide meal schedule; see DATABASE_PRD §7.';
COMMENT ON COLUMN public.workspaces.is_deleted IS
  'Soft delete flag; see DATABASE_PRD §6.16.';

CREATE INDEX idx_workspaces_owner_active
  ON public.workspaces (owner_id)
  WHERE is_deleted = FALSE;

CREATE TRIGGER trg_workspaces_updated_at
BEFORE UPDATE ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
