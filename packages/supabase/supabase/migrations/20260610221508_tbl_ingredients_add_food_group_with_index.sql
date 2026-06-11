-- DATABASE_PRD §6.6 (v2.0) — add food_group + food_group_source to ingredients.
--
-- food_group is an extensible label (text column, values gated by sys_save_label /
-- enum_metadata) belonging to the 'food_group' label set — same family as
-- cuisine_type / dietary_restriction / dietary_tag / food_allergy.
--
-- food_group_source is the system enum created in the preceding migration; it
-- records how the classification was obtained.
--
-- DATABASE_PRD §12 mandates one partial index: ingredients(food_group) WHERE
-- food_group IS NOT NULL — supports the shopping-session GROUP BY food_group query.

-- ---------------------------------------------------------------------------
-- Column additions
-- ---------------------------------------------------------------------------

ALTER TABLE public.ingredients
  ADD COLUMN food_group TEXT NULL,
  ADD COLUMN food_group_source public.food_group_source NOT NULL DEFAULT 'unset';

COMMENT ON COLUMN public.ingredients.food_group IS
  'Extensible label from the food_group set (DATABASE_PRD §5.2, v2.0). '
  'Validated via sys_save_label before write. '
  'Seeded for catalog ingredients (food_group_source=''seed''); '
  'derived by the Claude-API classifier for user-created ingredients (food_group_source=''ai''). '
  'NULL until classified.';

COMMENT ON COLUMN public.ingredients.food_group_source IS
  'Tracks the origin of the food_group value: seed | ai | unset. '
  'See food_group_source enum and DATABASE_PRD §5.1 (v2.0).';

-- ---------------------------------------------------------------------------
-- Index (DATABASE_PRD §12, v2.0)
-- Supports GROUP BY food_group in the shopping-session grouped view (Phase 2).
-- ---------------------------------------------------------------------------

CREATE INDEX idx_ingredients_food_group
  ON public.ingredients (food_group)
  WHERE food_group IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Seed: official food_group extensible-label values into enum_metadata.
-- Extensible-label lifecycle: is_official=true rows ship with the migration;
-- users may later suggest additional values via sys_save_label.
-- DATABASE_PRD §5.2, §10.1, §10.2.
-- ---------------------------------------------------------------------------

INSERT INTO public.enum_metadata (enum_type, value, display_name, is_official) VALUES
  ('food_group', 'vegetables',    'Vegetables',    TRUE),
  ('food_group', 'fruits',        'Fruits',        TRUE),
  ('food_group', 'grains',        'Grains',        TRUE),
  ('food_group', 'proteins',      'Proteins',      TRUE),
  ('food_group', 'dairy',         'Dairy',         TRUE),
  ('food_group', 'fats_oils',     'Fats & Oils',   TRUE),
  ('food_group', 'herbs_spices',  'Herbs & Spices', TRUE),
  ('food_group', 'condiments',    'Condiments',    TRUE),
  ('food_group', 'beverages',     'Beverages',     TRUE),
  ('food_group', 'other',         'Other',         TRUE);
