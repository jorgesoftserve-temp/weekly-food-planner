-- DATABASE_PRD §6.1 (v2.0) — add leftover_max_days to workspaces.
--
-- Workspace-level fallback for leftover expiry (in days). Used when an
-- ingredient has no max_storage_days set. Each inventory_items.expiration_date
-- is computed per-row at inflow time as:
--   cooked_at::date + COALESCE(ingredients.max_storage_days, workspaces.leftover_max_days)
-- and is independently editable after creation. This column is the fallback
-- default, not a global hard rule. See DATABASE_PRD §6.1 and PRODUCT_PRD §19.

ALTER TABLE public.workspaces
  ADD COLUMN leftover_max_days INT NOT NULL DEFAULT 3;

COMMENT ON COLUMN public.workspaces.leftover_max_days IS
  'Workspace-level fallback for leftover expiry in days (v2.0). '
  'Used when ingredients.max_storage_days is NULL. '
  'Default 3 days. Each leftover row''s expiration_date is independently editable. '
  'See DATABASE_PRD §6.1 and PRODUCT_PRD §19.';
