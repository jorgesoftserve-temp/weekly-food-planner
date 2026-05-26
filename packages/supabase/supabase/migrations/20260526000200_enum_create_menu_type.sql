-- Step 30 — Menu types.
--
-- `weekly` (default): deterministic engine-generated menu honouring member
--   meal_frequency and the per-menu dietary/allergy overlay. Editable per
--   slot during draft review.
-- `custom`: non-deterministic user-built menu. Slots are user-supplied
--   (any recipe, multiple per meal_type, ad-hoc duration). No engine seed.
--   Same draft/accept lifecycle as weekly.

CREATE TYPE public.menu_type AS ENUM ('weekly', 'custom');
