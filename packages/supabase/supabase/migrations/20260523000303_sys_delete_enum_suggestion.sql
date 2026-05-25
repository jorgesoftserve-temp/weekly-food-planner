-- DATABASE_PRD §9 §10 — a user deletes their own pending suggestion.
-- Returns the number of rows removed (should always be 1 on success).
--
-- MVP scope: deletes only the enum_metadata row itself. Dependent text-column
-- rows (recipes.cuisine, recipe_dietary_tags.tag, member_*.allergy/restriction)
-- retain the value but become "orphan" labels — they no longer appear in
-- autocomplete or popularity sorts, but they are not nulled. A future
-- iteration can add scope-aware cleanup via additional RPCs.

CREATE OR REPLACE FUNCTION public.sys_delete_enum_suggestion(
  p_enum_type TEXT,
  p_value TEXT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller UUID := auth.uid();
  deleted_count INT;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  DELETE FROM public.enum_metadata
  WHERE enum_type = p_enum_type
    AND value = p_value
    AND is_official = FALSE
    AND suggested_by = caller;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  IF deleted_count = 0 THEN
    RAISE EXCEPTION 'No matching pending suggestion owned by the caller';
  END IF;

  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.sys_delete_enum_suggestion IS
  'Deletes a pending enum_metadata row owned by the caller. Dependent rows keep the orphan label value (MVP simplification — see comment).';

GRANT EXECUTE ON FUNCTION public.sys_delete_enum_suggestion(TEXT, TEXT) TO authenticated;
