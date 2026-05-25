-- DATABASE_PRD §6.13 — shared + per-member grocery lists.

CREATE TABLE public.grocery_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_id UUID NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
  target_member_id UUID REFERENCES public.workspace_members(id) ON DELETE CASCADE,
  UNIQUE NULLS NOT DISTINCT (menu_id, target_member_id)
);

COMMENT ON TABLE public.grocery_lists IS
  'One list per (menu, target_member). NULL target = shared list.';
