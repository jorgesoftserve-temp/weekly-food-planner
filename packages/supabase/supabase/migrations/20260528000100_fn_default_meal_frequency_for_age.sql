-- Default meal_frequency per age_category for newly created members.
--
-- Per DATABASE_PRD §7 + PRODUCT_PRD member CRUD, a fresh member should
-- start with a sensible meal_frequency for their age rather than NULL.
-- NULL still works (it means "fall back to workspaces.shared_meal_frequency"),
-- so users can opt back into the workspace default after creation by
-- clearing their per-member override — the "Inherit from workspace"
-- toggle in the member form does exactly this.
--
-- Strategy:
--   1. Pure function returns the default JSONB array for a given
--      age_category (NULL for ages we don't want to opinionate on —
--      currently only 'infant', who should defer to whoever feeds them).
--   2. BEFORE INSERT trigger on workspace_members applies the default
--      ONLY when the caller passed meal_frequency IS NULL. Callers that
--      want explicit overrides — or explicit NULL ("use workspace
--      fallback") after creation — can still UPDATE to NULL later.
--
-- The JSONB entries match the application's MealFrequencyEntry shape:
--   { key, title, mealType, defaultHour }
-- so loadEngineSnapshot's parseMealFrequency reads them without any
-- transform layer.

CREATE OR REPLACE FUNCTION public.fn_default_meal_frequency_for_age(
  p_age public.age_category
)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_age
    WHEN 'infant' THEN NULL
    WHEN 'toddler' THEN jsonb_build_array(
      jsonb_build_object('key', 'breakfast', 'title', 'Breakfast', 'mealType', 'breakfast', 'defaultHour', 8),
      jsonb_build_object('key', 'lunch',     'title', 'Lunch',     'mealType', 'lunch',     'defaultHour', 12),
      jsonb_build_object('key', 'snack',     'title', 'Snack',     'mealType', 'snack',     'defaultHour', 15),
      jsonb_build_object('key', 'dinner',    'title', 'Dinner',    'mealType', 'dinner',    'defaultHour', 18)
    )
    WHEN 'child' THEN jsonb_build_array(
      jsonb_build_object('key', 'breakfast', 'title', 'Breakfast', 'mealType', 'breakfast', 'defaultHour', 8),
      jsonb_build_object('key', 'lunch',     'title', 'Lunch',     'mealType', 'lunch',     'defaultHour', 12),
      jsonb_build_object('key', 'snack',     'title', 'Snack',     'mealType', 'snack',     'defaultHour', 15),
      jsonb_build_object('key', 'dinner',    'title', 'Dinner',    'mealType', 'dinner',    'defaultHour', 18)
    )
    WHEN 'teen' THEN jsonb_build_array(
      jsonb_build_object('key', 'breakfast', 'title', 'Breakfast', 'mealType', 'breakfast', 'defaultHour', 8),
      jsonb_build_object('key', 'lunch',     'title', 'Lunch',     'mealType', 'lunch',     'defaultHour', 12),
      jsonb_build_object('key', 'dinner',    'title', 'Dinner',    'mealType', 'dinner',    'defaultHour', 19)
    )
    WHEN 'adult' THEN jsonb_build_array(
      jsonb_build_object('key', 'breakfast', 'title', 'Breakfast', 'mealType', 'breakfast', 'defaultHour', 8),
      jsonb_build_object('key', 'lunch',     'title', 'Lunch',     'mealType', 'lunch',     'defaultHour', 12),
      jsonb_build_object('key', 'dinner',    'title', 'Dinner',    'mealType', 'dinner',    'defaultHour', 19)
    )
    WHEN 'senior' THEN jsonb_build_array(
      jsonb_build_object('key', 'breakfast', 'title', 'Breakfast', 'mealType', 'breakfast', 'defaultHour', 8),
      jsonb_build_object('key', 'lunch',     'title', 'Lunch',     'mealType', 'lunch',     'defaultHour', 12),
      jsonb_build_object('key', 'dinner',    'title', 'Dinner',    'mealType', 'dinner',    'defaultHour', 18)
    )
    ELSE NULL
  END;
$$;

COMMENT ON FUNCTION public.fn_default_meal_frequency_for_age IS
  'Default meal_frequency per age_category. Used by the workspace_members BEFORE INSERT trigger to fill NULL meal_frequency on new rows. See DATABASE_PRD §7.';

GRANT EXECUTE ON FUNCTION public.fn_default_meal_frequency_for_age(public.age_category)
  TO postgres, service_role, authenticated;

CREATE OR REPLACE FUNCTION public.sys_apply_default_meal_frequency()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only fill when the caller didn't supply a meal_frequency. NULL after
  -- this trigger means the age has no opinionated default (e.g. infant)
  -- and the engine will fall back to workspaces.shared_meal_frequency.
  IF NEW.meal_frequency IS NULL THEN
    NEW.meal_frequency := public.fn_default_meal_frequency_for_age(NEW.age_category);
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sys_apply_default_meal_frequency IS
  'BEFORE INSERT trigger function for workspace_members.meal_frequency defaults.';

DROP TRIGGER IF EXISTS trg_workspace_members_default_meal_frequency
  ON public.workspace_members;

CREATE TRIGGER trg_workspace_members_default_meal_frequency
BEFORE INSERT ON public.workspace_members
FOR EACH ROW EXECUTE FUNCTION public.sys_apply_default_meal_frequency();
