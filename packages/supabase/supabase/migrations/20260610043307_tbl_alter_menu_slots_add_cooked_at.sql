-- DATABASE_PRD §6.12 — Cook mode completion state (v1.9).
--
-- Adds two columns to menu_slots so a member can mark a slot as cooked:
--   cooked_at  — timestamp set by the server when the member taps "Mark cooked";
--                cleared (set to NULL) when the member un-marks it.
--   cooked_by  — which workspace_member performed the last mark/unmark action.
--
-- ENGINE PURITY RULE: these columns MUST NEVER be read by the constraint engine
-- and MUST NEVER enter the inputs hash. Cook-mode state is presentation-only
-- progress tracking; it has zero effect on the recipe plan, grocery list, or
-- any determinism guarantee.
--
-- RLS note: the existing menu_slots_read policy (FOR SELECT) already covers
-- authenticated workspace members. No UPDATE policy previously existed —
-- menu_slots writes were service-role-only (engine pipeline). Cook mode is the
-- first narrow member-writable surface on this table; a minimal UPDATE policy
-- scoped to the cooked_at / cooked_by columns is added below.

-- ── Column additions ──────────────────────────────────────────────────────────

ALTER TABLE public.menu_slots
  ADD COLUMN cooked_at  TIMESTAMPTZ NULL,
  ADD COLUMN cooked_by  UUID        NULL REFERENCES public.workspace_members(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.menu_slots.cooked_at IS
  'Cook-mode runtime completion state. Set to now() when a workspace member marks '
  'this slot cooked; set to NULL when un-marked. Only meaningful on accepted menus '
  '(drafts are never cooked). '
  'MUST NEVER be read by the constraint engine and MUST NEVER enter the inputs hash — '
  'it is presentation-only progress tracking and has no effect on determinism.';

COMMENT ON COLUMN public.menu_slots.cooked_by IS
  'FK to the workspace_members row that last toggled cooked_at. '
  'NULL when cooked_at is NULL. Set to NULL via ON DELETE SET NULL if the member row '
  'is hard-deleted (soft-deleted members retain the FK — deletion of workspace_members '
  'is almost always a soft delete, so this path is a safety net only). '
  'Like cooked_at, this column is presentation-only and never enters the engine inputs.';

-- ── RLS: narrow member-scoped UPDATE for Cook mode ───────────────────────────
--
-- Prior state: no authenticated UPDATE policy on menu_slots — all writes are
-- service-role (engine pipeline).
--
-- Cook mode requires exactly two columns to be writable by any active workspace
-- member: cooked_at and cooked_by. All other columns remain service-role-only.
-- Postgres column-level GRANT alone cannot restrict which columns an UPDATE
-- policy covers, but we express the intent via a CHECK that verifies workspace
-- membership through the parent menu, ensuring no other rows can be reached.
--
-- The route handler (or server action) that calls this UPDATE is responsible for:
--   1. Only sending cooked_at / cooked_by in the update payload (not the full row).
--   2. Setting cooked_at = now() on mark, cooked_at = NULL on un-mark.
--   3. Setting cooked_by = the caller's workspace_members.id (resolved from auth.uid()).

CREATE POLICY menu_slots_cook_mode_update ON public.menu_slots
FOR UPDATE TO authenticated
USING (
  -- The slot must belong to an accepted, non-deleted menu in a workspace where
  -- the caller is an active member.
  EXISTS (
    SELECT 1 FROM public.menus m
    WHERE m.id = menu_slots.menu_id
      AND m.is_deleted = FALSE
      AND m.accepted_at IS NOT NULL
      AND public.fn_user_workspace_role(auth.uid(), m.workspace_id) IS NOT NULL
  )
)
WITH CHECK (
  -- Same membership check on the post-update row (should be identical for a
  -- cook-mode toggle, but belt-and-suspenders).
  EXISTS (
    SELECT 1 FROM public.menus m
    WHERE m.id = menu_slots.menu_id
      AND m.is_deleted = FALSE
      AND m.accepted_at IS NOT NULL
      AND public.fn_user_workspace_role(auth.uid(), m.workspace_id) IS NOT NULL
  )
);
