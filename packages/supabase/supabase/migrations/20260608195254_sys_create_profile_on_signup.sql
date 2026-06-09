-- v1.8 per-user accent color feature.
-- Extends sys_create_workspace_on_signup to also insert a profiles row so that
-- every new auth user gets a profile automatically at signup.
--
-- Strategy: CREATE OR REPLACE the existing function body, keeping all prior
-- workspace + creator-member logic intact.  A second trigger on auth.users is
-- NOT added — trg_auth_user_create_workspace already fires this function.
--
-- Security note: SECURITY DEFINER + SET search_path = public bypasses RLS so
-- the function can write to public.profiles on behalf of the new user even
-- before the row exists (and therefore before self-ownership can be proven).
-- The profiles INSERT policy intentionally has no authenticated role to prevent
-- direct inserts; only this SECURITY DEFINER path creates the row.

CREATE OR REPLACE FUNCTION public.sys_create_workspace_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_workspace_id UUID;
  derived_name TEXT;
BEGIN
  derived_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1),
    'My Workspace'
  );

  -- Create the default individual workspace for the new user.
  INSERT INTO public.workspaces (owner_id, type, name)
  VALUES (NEW.id, 'individual', derived_name || '''s Workspace')
  RETURNING id INTO new_workspace_id;

  -- Add the user as the workspace creator / member.
  INSERT INTO public.workspace_members (
    workspace_id, user_id, name, role, age_category
  ) VALUES (
    new_workspace_id,
    NEW.id,
    derived_name,
    'creator',
    'adult'
  );

  -- Create the per-user profile row (accent colour preference, etc.).
  -- No INSERT RLS policy exists for authenticated users on profiles;
  -- this SECURITY DEFINER context is the only authorised creation path.
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sys_create_workspace_on_signup IS
  'Creates an individual workspace + creator member + profiles row '
  'when a new auth user is inserted. '
  'Fired by trg_auth_user_create_workspace (AFTER INSERT ON auth.users).';

-- GRANTs are unchanged from the original migration; repeated here for
-- idempotency in case this migration runs on a fresh schema.
GRANT EXECUTE ON FUNCTION public.sys_create_workspace_on_signup()
  TO postgres, service_role;
