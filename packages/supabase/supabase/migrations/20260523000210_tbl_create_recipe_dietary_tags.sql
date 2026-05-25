-- DATABASE_PRD §6.10 — recipe dietary tags (dietary_tag extensible label).

CREATE TABLE public.recipe_dietary_tags (
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (recipe_id, tag)
);

CREATE INDEX idx_recipe_dietary_tags_tag ON public.recipe_dietary_tags (tag);
