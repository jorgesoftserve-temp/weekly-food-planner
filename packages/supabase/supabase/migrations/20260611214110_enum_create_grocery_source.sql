-- DATABASE_PRD §5.1 (v2.1) — grocery_source system enum.
--
-- Tags each grocery_items row with its origin:
--   meal  = line derived from a meal slot recipe (default; all pre-v2.1 rows).
--   addon = line derived from an attached menu_addons recipe
--           (recomputeGroceryListsForMenu addon pass).
--   extra = dormant until v2.2 manual grocery lines; defined now so the
--           column type is stable and the value can be migrated into without
--           a second column-type change.
--
-- The grocery UI groups rows by source to produce the "Addons" section.

CREATE TYPE public.grocery_source AS ENUM ('meal', 'addon', 'extra');

COMMENT ON TYPE public.grocery_source IS
  'Origin of a grocery_items row. meal = from a menu slot; addon = from an '
  'attached menu_addons recipe; extra = dormant until v2.2 manual lines. '
  'DATABASE_PRD §5.1 (v2.1).';
