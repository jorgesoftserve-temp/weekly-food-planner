-- DATABASE_PRD §6.6 — global ingredient catalog. Service-role managed.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE public.ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  image_url TEXT,
  is_perishable BOOLEAN NOT NULL DEFAULT FALSE,
  max_storage_days INT CHECK (max_storage_days IS NULL OR max_storage_days >= 0),
  requires_fresh BOOLEAN NOT NULL DEFAULT FALSE,
  same_day_cook BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.ingredients IS
  'Global ingredient catalog. Service-role managed; no soft delete.';

-- Trigram index for autocomplete search.
CREATE INDEX idx_ingredients_name_trgm
  ON public.ingredients USING gin (name gin_trgm_ops);

CREATE TRIGGER trg_ingredients_updated_at
BEFORE UPDATE ON public.ingredients
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
