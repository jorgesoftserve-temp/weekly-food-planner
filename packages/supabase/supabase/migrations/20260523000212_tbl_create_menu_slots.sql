-- DATABASE_PRD §6.12 — one slot per (menu, day, meal_key, target_member?).

CREATE TABLE public.menu_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_id UUID NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
  day_of_week public.day_of_week NOT NULL,
  meal_key TEXT NOT NULL,
  meal_type public.meal_type NOT NULL,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id),
  target_member_id UUID REFERENCES public.workspace_members(id) ON DELETE CASCADE,
  UNIQUE NULLS NOT DISTINCT (menu_id, day_of_week, meal_key, target_member_id)
);

COMMENT ON TABLE public.menu_slots IS
  'A single meal slot. target_member_id NULL = shared. NULLS NOT DISTINCT ensures only one shared slot per (menu, day, meal_key).';

CREATE INDEX idx_menu_slots_menu ON public.menu_slots (menu_id);
