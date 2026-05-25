-- DATABASE_PRD §6.15 — append-only audit trail of every engine attempt.

CREATE TABLE public.generation_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_id UUID REFERENCES public.menus(id) ON DELETE SET NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  seed BIGINT NOT NULL,
  inputs_hash TEXT NOT NULL,
  status public.generation_status NOT NULL,
  error_payload JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

COMMENT ON TABLE public.generation_runs IS
  'Append-only audit. Pre-engine validation failures (empty_workspace) do NOT produce rows.';

CREATE INDEX idx_generation_runs_workspace_started
  ON public.generation_runs (workspace_id, started_at DESC);
