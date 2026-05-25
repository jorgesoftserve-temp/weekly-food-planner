-- DATABASE_PRD §6.4 — member allergy labels (food_allergy extensible label).

CREATE TABLE public.member_allergies (
  member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
  allergy TEXT NOT NULL,
  PRIMARY KEY (member_id, allergy)
);

COMMENT ON TABLE public.member_allergies IS
  'Member allergy labels. Engine joins with ingredient_allergens by exact string match.';

CREATE INDEX idx_member_allergies_allergy
  ON public.member_allergies (allergy);
