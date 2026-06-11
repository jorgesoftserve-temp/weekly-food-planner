-- DATABASE_PRD §6.19 (v2.0) — shopping_sessions table.
--
-- One shopping pass over an accepted menu's grocery list. A workspace may have
-- at most one in-progress session per menu at any time — enforced by the partial
-- unique index below.
--
-- completeness is NULL while the session is in_progress; the shopping-finalize
-- helper (apps/web/lib/api/shopping-finalize.ts) computes the quantity-weighted
-- percentage and writes it when the session is closed (complete or incomplete).
--
-- created_by references workspace_members.id (same FK target as inventory_items,
-- menu_slot_ingredient_overrides — DATABASE_PRD §6.18, §6.21). ON DELETE SET NULL
-- so deleting a member row does not cascade-delete the session.

CREATE TABLE public.shopping_sessions (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Menu this shopping pass covers (must be an accepted menu)
  menu_id UUID NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,

  -- Workspace scope (denormalized for RLS and listing queries)
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

  -- Lifecycle state
  status public.shopping_status NOT NULL DEFAULT 'in_progress',

  -- Quantity-weighted completeness % (NULL while in_progress; set at finalize).
  -- Range [0, 100]; the finalize helper clamps to 2 decimal places.
  completeness NUMERIC,

  -- Creator: workspace_members.id (not auth.users.id). ON DELETE SET NULL so
  -- admin deletion of a member row does not cascade-delete the session.
  created_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.shopping_sessions IS
  'One shopping pass over an accepted menu''s grocery list. DATABASE_PRD §6.19 (v2.0). '
  'At most one in_progress session per menu (partial unique index). '
  'completeness is NULL while in_progress; set by shopping-finalize to a [0,100] value.';

COMMENT ON COLUMN public.shopping_sessions.completeness IS
  'Quantity-weighted acquisition completeness [0, 100]. NULL while in_progress. '
  'Written by apps/web/lib/api/shopping-finalize.ts at session close. '
  'Thresholds: ≥90 = complete, 30–89 = incomplete, <30 = barely-shopped.';

COMMENT ON COLUMN public.shopping_sessions.created_by IS
  'workspace_members.id of who opened this session. ON DELETE SET NULL. '
  'Same FK target as inventory_items.created_by (DATABASE_PRD §6.18).';

-- ---------------------------------------------------------------------------
-- Indexes (DATABASE_PRD §12, v2.0)
-- ---------------------------------------------------------------------------

-- Listing: all sessions for a workspace (most recent first in queries)
CREATE INDEX idx_shopping_sessions_workspace
  ON public.shopping_sessions (workspace_id);

-- Enforces at most one open session per menu.
-- UNIQUE so it also serves as a fast lookup for "find the active session for menu X".
CREATE UNIQUE INDEX idx_shopping_sessions_menu_in_progress
  ON public.shopping_sessions (menu_id)
  WHERE status = 'in_progress';

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

CREATE TRIGGER trg_shopping_sessions_updated_at
  BEFORE UPDATE ON public.shopping_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
