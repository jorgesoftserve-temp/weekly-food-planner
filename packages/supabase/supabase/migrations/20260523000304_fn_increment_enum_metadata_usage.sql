-- DATABASE_PRD §9 — increments usage_count for popularity-sorted autocomplete.
-- Called by the application after any successful write that uses an
-- extensible-label value.

CREATE OR REPLACE FUNCTION public.fn_increment_enum_metadata_usage(
  p_enum_type TEXT,
  p_value TEXT
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.enum_metadata
  SET usage_count = usage_count + 1
  WHERE enum_type = p_enum_type
    AND value = p_value;
$$;

COMMENT ON FUNCTION public.fn_increment_enum_metadata_usage IS
  'Increments usage_count for popularity-sorted autocomplete.';

GRANT EXECUTE ON FUNCTION public.fn_increment_enum_metadata_usage(TEXT, TEXT)
  TO authenticated;
