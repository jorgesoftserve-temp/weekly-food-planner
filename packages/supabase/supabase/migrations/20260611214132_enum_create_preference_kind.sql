-- DATABASE_PRD §5.1 (v2.1) — preference_kind system enum.
--
-- Discriminates rows in member_dietary_preferences (§6.22):
--   dietary_tag  = a label string from the dietary_tag extensible label set
--                  (e.g. 'high_protein', 'pescatarian').
--   ingredient   = a specific ingredient; the ingredient id is stored as text
--                  in the value column for uniform column type (mirrors how
--                  member_ingredient_dislikes stores ingredient_id separately,
--                  but here value is text to keep a single column for both
--                  preference kinds without a nullable FK beside a nullable text).

CREATE TYPE public.preference_kind AS ENUM ('dietary_tag', 'ingredient');

COMMENT ON TYPE public.preference_kind IS
  'Discriminates member_dietary_preferences rows: dietary_tag stores a '
  'dietary_tag label; ingredient stores an ingredient UUID as text. '
  'DATABASE_PRD §5.1 (v2.1).';
