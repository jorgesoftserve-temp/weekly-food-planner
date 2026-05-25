-- DATABASE_PRD §6.7 — workspace-shared recipes.

CREATE TABLE public.recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  meal_type public.meal_type NOT NULL,
  cuisine TEXT,
  difficulty public.difficulty NOT NULL,
  prep_time_minutes INT CHECK (prep_time_minutes IS NULL OR prep_time_minutes >= 0),
  cook_time_minutes INT CHECK (cook_time_minutes IS NULL OR cook_time_minutes >= 0),
  servings INT NOT NULL CHECK (servings > 0),
  calories_per_serving INT CHECK (calories_per_serving IS NULL OR calories_per_serving >= 0),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.recipes IS
  'Workspace-shared recipes (no per-member ownership). Per-member divergence happens at the menu_slot layer.';
COMMENT ON COLUMN public.recipes.cuisine IS
  'cuisine_type label from enum_metadata (extensible).';
COMMENT ON COLUMN public.recipes.calories_per_serving IS
  'Used by the soft calorie-balancing constraint.';

CREATE INDEX idx_recipes_workspace_active
  ON public.recipes (workspace_id)
  WHERE is_deleted = FALSE;

CREATE INDEX idx_recipes_workspace_meal_type_active
  ON public.recipes (workspace_id, meal_type)
  WHERE is_deleted = FALSE;

CREATE INDEX idx_recipes_cuisine_active
  ON public.recipes (cuisine)
  WHERE is_deleted = FALSE;

CREATE TRIGGER trg_recipes_updated_at
BEFORE UPDATE ON public.recipes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
