-- v1.8 per-user accent color feature — DATABASE_PRD §6 (new §6.0 profiles).
-- One row per auth.users row; created by sys_create_workspace_on_signup (SECURITY DEFINER).
-- No soft delete: the row is tied to the auth user and cascades on account deletion.
-- No INSERT policy for authenticated: the signup trigger (service-role path) creates the row.
-- No DELETE policy: handled by ON DELETE CASCADE from auth.users.

CREATE TABLE public.profiles (
  -- Primary key — IS the auth user; no separate user_id column.
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Preferences
  accent_color public.accent_color NOT NULL DEFAULT 'strawberry',
  -- Timestamps last
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS
  'One row per auth.users row. Stores per-account UI preferences. '
  'Created automatically by sys_create_workspace_on_signup via SECURITY DEFINER; '
  'not directly insertable by authenticated users.';

COMMENT ON COLUMN public.profiles.id IS
  'Matches auth.users.id exactly — the row IS the user, no indirection.';

COMMENT ON COLUMN public.profiles.accent_color IS
  'The accent colour chosen by the user for their UI. '
  'Defaults to ''strawberry''. Enum values are fixed; see docs/design/user-accent-colors.md.';

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS -------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users may read only their own profile row.
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Users may update only their own profile row.
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
