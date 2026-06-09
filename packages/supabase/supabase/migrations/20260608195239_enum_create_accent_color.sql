-- v1.8 per-user accent color feature.
-- Six curated accent values; new values require a migration (strict enum, not extensible label).
-- See docs/design/user-accent-colors.md for the colour palette definition.

CREATE TYPE public.accent_color AS ENUM (
  'strawberry',
  'moss',
  'teal',
  'amber',
  'ocean',
  'plum'
);

COMMENT ON TYPE public.accent_color IS
  'Curated set of accent colours a user may choose for their UI. '
  'Values are fixed; adding a new colour requires a migration. '
  'Defined in docs/design/user-accent-colors.md.';
