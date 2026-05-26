-- Step 34 — Menu participants (subset of household this menu is for).
--
-- Per PRODUCT_PRD §4.3 a menu may be created for a subset of household
-- members. The engine only enumerates slots for participating members, and
-- Phase 4's grocery scaling formula (eaters_for_shared / recipe.servings)
-- uses the participant count as the head-count denominator.
--
-- Junction shape mirrors the rest of the repo: composite PK + ON DELETE
-- CASCADE both ways. No is_deleted column: visibility follows the parent
-- menu (DATABASE_PRD §6.16 — cascaded junctions don't get their own flag).
--
-- Backfill: for every existing menu, every active workspace_member becomes
-- a participant. That preserves the pre-Phase-2 behaviour ("a menu is for
-- the whole household") for any menus that predate this column.

CREATE TABLE public.menu_participants (
  menu_id UUID NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
  PRIMARY KEY (menu_id, member_id)
);

CREATE INDEX idx_menu_participants_member ON public.menu_participants(member_id);

COMMENT ON TABLE public.menu_participants IS
  'Subset of workspace_members this menu was generated for. The grocery list scaling formula uses COUNT(*) here as the household-eaters denominator. See PRODUCT_PRD §4.3.';

-- RLS — read is gated on the parent menu being visible to the caller, same
-- shape as menu_slots_read. No write policy: the route handlers persist
-- through the service-role admin client (matches menus / menu_slots).
ALTER TABLE public.menu_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY menu_participants_read ON public.menu_participants
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.menus m
    WHERE m.id = menu_id
      AND m.is_deleted = FALSE
      AND public.fn_user_workspace_role(auth.uid(), m.workspace_id) IS NOT NULL
  )
);

-- Backfill: every existing menu was effectively for everyone in the
-- household. Insert one row per (menu, active member) pair so post-Phase-2
-- consumers (grocery scaling, menu-view participant pill, etc.) work for
-- legacy menus without special-casing "missing participants = whole household".
INSERT INTO public.menu_participants (menu_id, member_id)
SELECT m.id, wm.id
FROM public.menus m
JOIN public.workspace_members wm
  ON wm.workspace_id = m.workspace_id
 AND wm.is_deleted = FALSE
WHERE m.is_deleted = FALSE
ON CONFLICT DO NOTHING;
