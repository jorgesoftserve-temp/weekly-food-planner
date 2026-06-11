-- DATABASE_PRD §5.1 (v2.0) — system enum that tracks the origin of an
-- ingredient's food_group classification.
--
-- Values:
--   seed  = assigned during the catalog seed / admin seeding route
--   ai    = derived by the Claude-API food-group classifier and cached on the row
--   unset = not yet classified (default for newly created ingredients)

CREATE TYPE public.food_group_source AS ENUM ('seed', 'ai', 'unset');

COMMENT ON TYPE public.food_group_source IS
  'Tracks how an ingredient''s food_group value was assigned. '
  'seed = set during catalog seeding; ai = derived by the Claude-API classifier; '
  'unset = no classification yet. See DATABASE_PRD §5.1 (v2.0).';

-- Seed enum_metadata official display rows so autocomplete and moderation UI
-- have entries for this enum (system-enum lifecycle per DATABASE_PRD §10.2).
INSERT INTO public.enum_metadata (enum_type, value, display_name, is_official) VALUES
  ('food_group_source', 'seed',  'Seed',  TRUE),
  ('food_group_source', 'ai',    'AI',    TRUE),
  ('food_group_source', 'unset', 'Unset', TRUE);
