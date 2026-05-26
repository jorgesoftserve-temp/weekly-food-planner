-- Step 29 — Draft / accept lifecycle for menus.
--
-- New columns:
--   accepted_at      — NULL while the menu is a draft. Set on acceptance.
--                      Acceptance promotes a draft to the workspace's active
--                      menu for the week (drives the grocery list).
--   accepted_seed    — Hash of the final accepted menu state (engine output +
--                      user overrides). Distinct from `seed` (engine RNG seed)
--                      so a "pristine" acceptance reproduces deterministically
--                      and a "modified" acceptance gets a stable identifier
--                      for history review. NULL while draft.
--
-- The previous uniqueness invariant ("only one active menu per (workspace,
-- week)") is REPLACED by "only one accepted menu per (workspace, week)" — so
-- drafts can coexist with the accepted menu. The old partial unique index is
-- dropped in favour of a new one filtering on accepted_at.

ALTER TABLE public.menus
  ADD COLUMN accepted_at TIMESTAMPTZ,
  ADD COLUMN accepted_seed TEXT;

COMMENT ON COLUMN public.menus.accepted_at IS
  'Set when a draft menu is accepted. The accepted menu is the workspace''s active menu for the week and drives the grocery list. NULL = draft.';
COMMENT ON COLUMN public.menus.accepted_seed IS
  'Hash of the final accepted menu state (engine output + any user overrides). NULL while draft. Distinct from menus.seed (engine RNG seed) to give modified menus a stable history identifier.';

-- Backfill: every existing (non-deleted) menu is treated as accepted at
-- generated_at, with accepted_seed equal to inputs_hash (no overrides existed
-- before this migration).
UPDATE public.menus
SET accepted_at = generated_at,
    accepted_seed = inputs_hash
WHERE is_deleted = FALSE AND accepted_at IS NULL;

DROP INDEX IF EXISTS public.uq_menus_workspace_week_active;

CREATE UNIQUE INDEX uq_menus_workspace_week_accepted
  ON public.menus (workspace_id, week_start_date)
  WHERE is_deleted = FALSE AND accepted_at IS NOT NULL;

-- Only one outstanding draft per (workspace, week) — generating again while a
-- draft exists replaces it via the route handler.
CREATE UNIQUE INDEX uq_menus_workspace_week_draft
  ON public.menus (workspace_id, week_start_date)
  WHERE is_deleted = FALSE AND accepted_at IS NULL;

CREATE INDEX idx_menus_workspace_history
  ON public.menus (workspace_id, week_start_date DESC)
  WHERE is_deleted = FALSE AND accepted_at IS NOT NULL;
