-- DATABASE_PRD §6.21 (v2.0 Phase 4) — slot_completions table.
--
-- The cook-status execution record for an accepted-menu slot. Deliberately a
-- SEPARATE table (not a column on menu_slots) so cook-status is structurally
-- invisible to accepted_seed and to the slot-replace paths — the determinism
-- contract holds with zero engine awareness of this table. One row per slot
-- (UNIQUE(menu_slot_id)); an absent row reads as 'planned'.
--
-- workspace_id is denormalized onto the row (sourced from the slot's menu) so
-- RLS can gate via fn_user_workspace_role without an EXISTS chain — same shape
-- as inventory_items / shopping_sessions.
--
-- cooked_at here is the execution-record timestamp (set when status flips to
-- 'cooked', server clock only). It is distinct from menu_slots.cooked_at (the
-- v1.9 cook-mode quick toggle); the completion route keeps the two in sync.

CREATE TABLE public.slot_completions (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- The slot this completion records. One completion per slot.
  menu_slot_id UUID NOT NULL REFERENCES public.menu_slots(id) ON DELETE CASCADE,

  -- Workspace scope (denormalized from menu_slots → menus.workspace_id for RLS).
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

  -- Execution state. Absent row = 'planned'; the explicit default lets a row be
  -- created in any state.
  status public.slot_cook_status NOT NULL DEFAULT 'planned',

  -- When the slot was marked cooked (server clock). NULL unless status='cooked'.
  cooked_at TIMESTAMPTZ,

  -- Optional free-text execution note (e.g. "swapped in leftovers", "burnt the rice").
  notes TEXT,

  -- Who recorded it: workspace_members.id (matches inventory_items / shopping_sessions).
  -- ON DELETE SET NULL so removing a member doesn't erase the cook history.
  created_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Exactly one completion per slot — the upsert key.
  CONSTRAINT slot_completions_menu_slot_unique UNIQUE (menu_slot_id)
);

COMMENT ON TABLE public.slot_completions IS
  'Cook-status execution record per accepted-menu slot (planned/cooked/skipped). '
  'Separate table so it is invisible to accepted_seed + the engine. '
  'DATABASE_PRD §6.21 (v2.0 Phase 4).';

COMMENT ON COLUMN public.slot_completions.status IS
  'planned | cooked | skipped. Absent row = planned.';

COMMENT ON COLUMN public.slot_completions.cooked_at IS
  'Execution timestamp set when status flips to cooked (server clock). '
  'Kept in sync with menu_slots.cooked_at by the completion route.';

COMMENT ON COLUMN public.slot_completions.created_by IS
  'workspace_members.id of who recorded the status. ON DELETE SET NULL.';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Lookup all completions for a menu's slots (alerts + menu-view) joins through
-- menu_slot_id; the UNIQUE constraint already indexes it. workspace_id gets its
-- own index for the RLS role lookup + per-workspace scans.
CREATE INDEX idx_slot_completions_workspace
  ON public.slot_completions (workspace_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

CREATE TRIGGER trg_slot_completions_updated_at
  BEFORE UPDATE ON public.slot_completions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
