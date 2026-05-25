-- DATABASE_PRD §6.9 — ordered recipe steps.

CREATE TABLE public.recipe_instructions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  step_order INT NOT NULL CHECK (step_order > 0),
  description TEXT NOT NULL,
  notes TEXT,
  duration_minutes INT CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
  UNIQUE (recipe_id, step_order)
);

CREATE INDEX idx_recipe_instructions_recipe ON public.recipe_instructions (recipe_id, step_order);
