-- DATABASE_PRD §6.11 — generated 7-day menu, audit-friendly with overlay snapshot.

CREATE TABLE public.menus (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  seed BIGINT NOT NULL,
  inputs_hash TEXT NOT NULL,
  generation_options JSONB,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.menus.generation_options IS
  'Effective (post-dedup) overlay snapshot. See DATABASE_PRD §6.11.1.';
COMMENT ON COLUMN public.menus.inputs_hash IS
  'SHA-256 over canonical JSON of the engine input. Deterministic.';

-- Only one active menu per (workspace, week).
CREATE UNIQUE INDEX uq_menus_workspace_week_active
  ON public.menus (workspace_id, week_start_date)
  WHERE is_deleted = FALSE;

CREATE TRIGGER trg_menus_updated_at
BEFORE UPDATE ON public.menus
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
