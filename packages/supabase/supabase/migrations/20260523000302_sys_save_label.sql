-- DATABASE_PRD §9 §10 — idempotently ensures an enum_metadata row exists for
-- (enum_type, value). Called by the application before any write to an
-- extensible-label column (cuisine, dietary_restriction, dietary_tag,
-- food_allergy). Inserts a pending row if missing.

CREATE OR REPLACE FUNCTION public.sys_save_label(
  p_enum_type TEXT,
  p_value TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  canonical TEXT;
  caller UUID := auth.uid();
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  canonical := trim(p_value);
  IF canonical = '' THEN
    RAISE EXCEPTION 'Label value cannot be empty';
  END IF;

  INSERT INTO public.enum_metadata (
    enum_type, value, display_name, is_official, is_pending, suggested_by
  ) VALUES (
    p_enum_type,
    canonical,
    initcap(replace(canonical, '_', ' ')),
    FALSE,
    TRUE,
    caller
  )
  ON CONFLICT (enum_type, value) DO NOTHING;

  RETURN canonical;
END;
$$;

COMMENT ON FUNCTION public.sys_save_label IS
  'Idempotent: inserts a pending enum_metadata row if missing. Returns the canonical (trimmed) value.';

GRANT EXECUTE ON FUNCTION public.sys_save_label(TEXT, TEXT) TO authenticated;
