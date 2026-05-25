-- DATABASE_PRD §10 — enum_metadata: cross-cuts all system enums + extensible labels.
-- Includes seed for every official value (both system enums and extensible labels).

CREATE TABLE public.enum_metadata (
  enum_type TEXT NOT NULL,
  value TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  is_official BOOLEAN NOT NULL,
  is_pending BOOLEAN NOT NULL DEFAULT FALSE,
  suggested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  usage_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (enum_type, value)
);

COMMENT ON TABLE public.enum_metadata IS
  'Cross-cuts all enums and extensible labels. See DATABASE_PRD §10.';

CREATE INDEX idx_enum_metadata_type_usage
  ON public.enum_metadata (enum_type, usage_count DESC);

CREATE INDEX idx_enum_metadata_type_pending
  ON public.enum_metadata (enum_type)
  WHERE is_pending = TRUE;

CREATE TRIGGER trg_enum_metadata_updated_at
BEFORE UPDATE ON public.enum_metadata
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Seed: system enum official values
-- ---------------------------------------------------------------------------
INSERT INTO public.enum_metadata (enum_type, value, display_name, is_official) VALUES
  ('workspace_type', 'individual', 'Individual', TRUE),
  ('workspace_type', 'group',      'Group',      TRUE),
  ('workspace_role', 'creator', 'Creator', TRUE),
  ('workspace_role', 'admin',   'Admin',   TRUE),
  ('workspace_role', 'member',  'Member',  TRUE),
  ('age_category', 'infant',  'Infant',  TRUE),
  ('age_category', 'toddler', 'Toddler', TRUE),
  ('age_category', 'child',   'Child',   TRUE),
  ('age_category', 'teen',    'Teen',    TRUE),
  ('age_category', 'adult',   'Adult',   TRUE),
  ('age_category', 'senior',  'Senior',  TRUE),
  ('meal_type', 'breakfast', 'Breakfast', TRUE),
  ('meal_type', 'lunch',     'Lunch',     TRUE),
  ('meal_type', 'dinner',    'Dinner',    TRUE),
  ('meal_type', 'snack',     'Snack',     TRUE),
  ('difficulty', 'easy',   'Easy',   TRUE),
  ('difficulty', 'medium', 'Medium', TRUE),
  ('difficulty', 'hard',   'Hard',   TRUE),
  ('generation_status', 'pending', 'Pending', TRUE),
  ('generation_status', 'running', 'Running', TRUE),
  ('generation_status', 'success', 'Success', TRUE),
  ('generation_status', 'failed',  'Failed',  TRUE),
  ('day_of_week', 'monday',    'Monday',    TRUE),
  ('day_of_week', 'tuesday',   'Tuesday',   TRUE),
  ('day_of_week', 'wednesday', 'Wednesday', TRUE),
  ('day_of_week', 'thursday',  'Thursday',  TRUE),
  ('day_of_week', 'friday',    'Friday',    TRUE),
  ('day_of_week', 'saturday',  'Saturday',  TRUE),
  ('day_of_week', 'sunday',    'Sunday',    TRUE),
  ('unit', 'g',     'Grams',       TRUE),
  ('unit', 'kg',    'Kilograms',   TRUE),
  ('unit', 'ml',    'Milliliters', TRUE),
  ('unit', 'l',     'Liters',      TRUE),
  ('unit', 'tsp',   'Teaspoons',   TRUE),
  ('unit', 'tbsp',  'Tablespoons', TRUE),
  ('unit', 'cup',   'Cups',        TRUE),
  ('unit', 'piece', 'Pieces',      TRUE),
  ('unit', 'slice', 'Slices',      TRUE),
  ('unit', 'pinch', 'Pinch',       TRUE),
  ('unit', 'clove', 'Cloves',      TRUE),
  ('unit', 'can',   'Cans',        TRUE),
  ('unit', 'pack',  'Packs',       TRUE);

-- ---------------------------------------------------------------------------
-- Seed: extensible label official values (cuisine_type, dietary_restriction,
-- dietary_tag, food_allergy). Stored as text on dependent columns; validated
-- against enum_metadata via sys_save_label.
-- ---------------------------------------------------------------------------
INSERT INTO public.enum_metadata (enum_type, value, display_name, is_official) VALUES
  ('cuisine_type', 'italian',        'Italian',        TRUE),
  ('cuisine_type', 'mexican',        'Mexican',        TRUE),
  ('cuisine_type', 'chinese',        'Chinese',        TRUE),
  ('cuisine_type', 'japanese',       'Japanese',       TRUE),
  ('cuisine_type', 'indian',         'Indian',         TRUE),
  ('cuisine_type', 'mediterranean',  'Mediterranean',  TRUE),
  ('cuisine_type', 'american',       'American',       TRUE),
  ('cuisine_type', 'french',         'French',         TRUE),
  ('cuisine_type', 'thai',           'Thai',           TRUE),
  ('cuisine_type', 'korean',         'Korean',         TRUE),
  ('cuisine_type', 'vietnamese',     'Vietnamese',     TRUE),
  ('cuisine_type', 'middle_eastern', 'Middle Eastern', TRUE),
  ('cuisine_type', 'spanish',        'Spanish',        TRUE),
  ('cuisine_type', 'greek',          'Greek',          TRUE),
  ('cuisine_type', 'brazilian',      'Brazilian',      TRUE),
  ('cuisine_type', 'peruvian',       'Peruvian',       TRUE),
  ('cuisine_type', 'caribbean',      'Caribbean',      TRUE),
  ('cuisine_type', 'african',        'African',        TRUE),
  ('cuisine_type', 'fusion',         'Fusion',         TRUE),
  ('cuisine_type', 'other',          'Other',          TRUE),
  ('dietary_restriction', 'vegetarian',         'Vegetarian',         TRUE),
  ('dietary_restriction', 'vegan',              'Vegan',              TRUE),
  ('dietary_restriction', 'gluten_free',        'Gluten-free',        TRUE),
  ('dietary_restriction', 'dairy_free',         'Dairy-free',         TRUE),
  ('dietary_restriction', 'nut_free',           'Nut-free',           TRUE),
  ('dietary_restriction', 'egg_free',           'Egg-free',           TRUE),
  ('dietary_restriction', 'soy_free',           'Soy-free',           TRUE),
  ('dietary_restriction', 'pescatarian',        'Pescatarian',        TRUE),
  ('dietary_restriction', 'halal',              'Halal',              TRUE),
  ('dietary_restriction', 'kosher',             'Kosher',             TRUE),
  ('dietary_restriction', 'low_sodium',         'Low-sodium',         TRUE),
  ('dietary_restriction', 'diabetic_friendly',  'Diabetic-friendly',  TRUE),
  ('dietary_tag', 'vegetarian',         'Vegetarian',         TRUE),
  ('dietary_tag', 'vegan',              'Vegan',              TRUE),
  ('dietary_tag', 'gluten_free',        'Gluten-free',        TRUE),
  ('dietary_tag', 'dairy_free',         'Dairy-free',         TRUE),
  ('dietary_tag', 'nut_free',           'Nut-free',           TRUE),
  ('dietary_tag', 'egg_free',           'Egg-free',           TRUE),
  ('dietary_tag', 'soy_free',           'Soy-free',           TRUE),
  ('dietary_tag', 'pescatarian',        'Pescatarian',        TRUE),
  ('dietary_tag', 'halal',              'Halal',              TRUE),
  ('dietary_tag', 'kosher',             'Kosher',             TRUE),
  ('dietary_tag', 'low_sodium',         'Low-sodium',         TRUE),
  ('dietary_tag', 'diabetic_friendly',  'Diabetic-friendly',  TRUE),
  ('dietary_tag', 'high_protein',       'High-protein',       TRUE),
  ('dietary_tag', 'low_carb',           'Low-carb',           TRUE),
  ('dietary_tag', 'keto',               'Keto',               TRUE),
  ('dietary_tag', 'paleo',              'Paleo',              TRUE),
  ('dietary_tag', 'whole30',            'Whole30',            TRUE),
  ('food_allergy', 'peanut',    'Peanut',    TRUE),
  ('food_allergy', 'tree_nut',  'Tree nut',  TRUE),
  ('food_allergy', 'dairy',     'Dairy',     TRUE),
  ('food_allergy', 'egg',       'Egg',       TRUE),
  ('food_allergy', 'soy',       'Soy',       TRUE),
  ('food_allergy', 'gluten',    'Gluten',    TRUE),
  ('food_allergy', 'fish',      'Fish',      TRUE),
  ('food_allergy', 'shellfish', 'Shellfish', TRUE),
  ('food_allergy', 'sesame',    'Sesame',    TRUE),
  ('food_allergy', 'mustard',   'Mustard',   TRUE),
  ('food_allergy', 'celery',    'Celery',    TRUE),
  ('food_allergy', 'lupin',     'Lupin',     TRUE),
  ('food_allergy', 'mollusk',   'Mollusk',   TRUE),
  ('food_allergy', 'sulfite',   'Sulfite',   TRUE);
