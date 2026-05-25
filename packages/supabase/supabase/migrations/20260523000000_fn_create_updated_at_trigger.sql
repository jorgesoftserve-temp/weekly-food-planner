-- Foundation: required extensions + generic updated_at trigger function.
-- DATABASE_PRD §9.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at IS
  'Sets NEW.updated_at = NOW() on UPDATE. Attach via BEFORE UPDATE trigger.';
