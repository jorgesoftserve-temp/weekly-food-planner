-- DATABASE_PRD §6.5 — member ingredient dislikes (soft constraint).

CREATE TABLE public.member_ingredient_dislikes (
  member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  PRIMARY KEY (member_id, ingredient_id)
);

COMMENT ON TABLE public.member_ingredient_dislikes IS
  'Ingredients a member dislikes. Soft constraint for the engine; never blocks a slot.';
