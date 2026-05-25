-- DATABASE_PRD §9 / ARCHITECTURE_PRD §8.1 — auto-create an individual
-- workspace + creator member when a new auth user is inserted. Functional
-- once the user verifies their email (Supabase EMAIL_CONFIRM enabled).

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

  INSERT INTO public.workspaces (owner_id, type, name)
  VALUES (NEW.id, 'individual', derived_name || '''s Workspace')
  RETURNING id INTO new_workspace_id;

  INSERT INTO public.workspace_members (
    workspace_id, user_id, name, role, age_category
  ) VALUES (
    new_workspace_id,
    NEW.id,
    derived_name,
    'creator',
    'adult'
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sys_create_workspace_on_signup IS
  'Creates an individual workspace + creator member when a new auth user is inserted.';

GRANT EXECUTE ON FUNCTION public.sys_create_workspace_on_signup()
  TO postgres, service_role;

DROP TRIGGER IF EXISTS trg_auth_user_create_workspace ON auth.users;

CREATE TRIGGER trg_auth_user_create_workspace
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sys_create_workspace_on_signup();
