-- Step 29 — Per-slot override tracking for menu review.
--
-- When a user replaces a slot's recipe while reviewing a draft, the new
-- recipe_id overwrites the original. We preserve the engine's original pick
-- in original_recipe_id so the accepted_seed hash can reflect "the user
-- changed N slots" and history can show pristine vs. modified slots.

ALTER TABLE public.menu_slots
  ADD COLUMN is_overridden BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN original_recipe_id UUID REFERENCES public.recipes(id);

COMMENT ON COLUMN public.menu_slots.is_overridden IS
  'TRUE when the user replaced the engine''s pick during draft review. recipe_id holds the user-chosen recipe; original_recipe_id holds the engine''s.';
COMMENT ON COLUMN public.menu_slots.original_recipe_id IS
  'Engine''s original pick before any user override. NULL on pristine slots; equal to the now-overwritten recipe_id when is_overridden = TRUE.';
