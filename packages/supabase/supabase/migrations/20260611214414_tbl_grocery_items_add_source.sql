-- DATABASE_PRD §6.14 (v2.1) — add source column to grocery_items.
--
-- Tags each grocery line with its origin so the grocery UI can group rows
-- into distinct sections ("Meals" vs "Addons" vs future "Extras").
--
-- NOT NULL DEFAULT 'meal' backfills all pre-v2.1 rows to 'meal' at ALTER
-- TABLE time — no explicit UPDATE required. The grocery_source enum defines
-- all three values; 'extra' is dormant until v2.2 manual grocery lines.
--
-- A composite index on (list_id, source) is added per DATABASE_PRD §12 (v2.1)
-- to support the grocery UI section grouping query.
--
-- No RLS change — the existing grocery_items policies (via grocery_lists →
-- menus.workspace_id) cover the new column without modification.

ALTER TABLE public.grocery_items
  ADD COLUMN source public.grocery_source NOT NULL DEFAULT 'meal';

COMMENT ON COLUMN public.grocery_items.source IS
  'Origin of the grocery line: meal = derived from a menu slot recipe (default); '
  'addon = derived from an attached menu_addons recipe; '
  'extra = dormant until v2.2 manual grocery lines. '
  'The grocery UI groups by source to produce the Addons section. '
  'DATABASE_PRD §6.14 (v2.1).';

-- ---------------------------------------------------------------------------
-- Index — DATABASE_PRD §12 (v2.1)
-- ---------------------------------------------------------------------------

-- Grocery UI section grouping: fetch items for a list, partitioned by source.
CREATE INDEX idx_grocery_items_list_source
  ON public.grocery_items (list_id, source);
