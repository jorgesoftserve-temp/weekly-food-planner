-- DATABASE_PRD §8 §10 — enum_metadata.
-- Read: any authenticated user. Writes happen exclusively via SECURITY DEFINER
-- RPCs (sys_save_label, sys_delete_enum_suggestion, fn_increment_enum_metadata_usage)
-- — no direct INSERT/UPDATE/DELETE policy is granted to authenticated users.

CREATE POLICY enum_metadata_read ON public.enum_metadata
FOR SELECT TO authenticated
USING (TRUE);
