-- Step 30 — Menu types, variable duration, clone-from-previous.
--
-- New columns:
--   menu_type           — 'weekly' (default) or 'custom'. Custom menus skip
--                         the engine and have NULL seed + inputs_hash.
--   duration_days       — 1..7. Default 7 for legacy + new weekly menus.
--   start_day_of_week   — day_of_week derived from week_start_date; lets the
--                         engine + UI walk N consecutive days from any start
--                         day rather than always Monday→Sunday.
--   cloned_from_menu_id — FK back to the source menu when this draft was
--                         cloned from a historical accepted menu. Pure audit
--                         link; not used to enforce anything.
--
-- seed and inputs_hash become nullable to accommodate custom menus.

ALTER TABLE public.menus
  ADD COLUMN menu_type public.menu_type NOT NULL DEFAULT 'weekly',
  ADD COLUMN duration_days INTEGER NOT NULL DEFAULT 7
    CHECK (duration_days BETWEEN 1 AND 7),
  ADD COLUMN start_day_of_week public.day_of_week NOT NULL DEFAULT 'monday',
  ADD COLUMN cloned_from_menu_id UUID REFERENCES public.menus(id) ON DELETE SET NULL,
  ALTER COLUMN seed DROP NOT NULL,
  ALTER COLUMN inputs_hash DROP NOT NULL;

COMMENT ON COLUMN public.menus.menu_type IS
  'weekly = engine-generated deterministic menu. custom = user-built non-deterministic menu (no seed).';
COMMENT ON COLUMN public.menus.duration_days IS
  'Number of consecutive days covered by the menu (1..7). Defaults to 7 for backwards compatibility.';
COMMENT ON COLUMN public.menus.start_day_of_week IS
  'Day-of-week of week_start_date. Cached so queries do not need to recompute from the date.';
COMMENT ON COLUMN public.menus.cloned_from_menu_id IS
  'When set, this draft was cloned from the referenced (historical accepted) menu. Audit link only.';

-- Backfill the new columns for existing menus. All legacy menus are weekly,
-- 7 days, starting Monday (the only flow we shipped before this step).
UPDATE public.menus
SET menu_type = 'weekly',
    duration_days = 7,
    start_day_of_week = 'monday'
WHERE menu_type IS DISTINCT FROM 'weekly'
   OR duration_days IS DISTINCT FROM 7
   OR start_day_of_week IS DISTINCT FROM 'monday';
