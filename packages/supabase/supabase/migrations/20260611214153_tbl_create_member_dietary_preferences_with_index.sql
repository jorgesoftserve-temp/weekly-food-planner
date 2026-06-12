-- DATABASE_PRD §6.22 (v2.1) — member_dietary_preferences table.
--
-- Stores INCLUSIVE (soft) dietary preferences per member. These bias the
-- constraint engine toward liked tags/ingredients during candidate selection
-- without ever hard-excluding any recipe (hard exclusions remain in the
-- existing member_dietary_restrictions / member_allergies / member_ingredient_dislikes).
--
-- STORAGE CHOICE for value:
--   A single TEXT column holds both dietary_tag labels (e.g. 'high_protein')
--   and ingredient UUIDs cast to text (e.g. 'a1b2c3d4-...'). This matches the
--   PRD §6.22 spec ("ingredient id as text, for uniform column type") and avoids
--   a nullable-FK / nullable-text split. The kind column is the discriminator;
--   the route layer validates that ingredient values parse as valid UUIDs
--   referencing the global ingredients catalog.
--
-- COMPOSITE PK (member_id, kind, value) enforces one row per (member, preference)
-- pair — no duplicates, direct DELETE for removal (no soft delete here).
--
-- workspace_id is denormalized from workspace_members for RLS gating via
-- fn_user_workspace_role without an EXISTS chain (same pattern as inventory_items,
-- slot_completions, menu_slot_ingredient_overrides).

CREATE TABLE public.member_dietary_preferences (
  -- Primary key composite: one preference per (member, kind, value) triplet.
  -- Declared via constraint below so the column order reads naturally.
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- The member who holds this preference.
  member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,

  -- Workspace scope (denormalized for RLS — avoids an EXISTS join through
  -- workspace_members on every policy check).
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

  -- Discriminates dietary_tag preferences from ingredient preferences.
  kind public.preference_kind NOT NULL,

  -- The preference value:
  --   kind='dietary_tag'  -> a label string from the dietary_tag set
  --   kind='ingredient'   -> the ingredients.id UUID stored as text
  value TEXT NOT NULL,

  -- Timestamps (no updated_at — only INSERT and DELETE; no in-place updates).
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One preference per (member, kind, value) triplet.
  CONSTRAINT member_dietary_preferences_unique UNIQUE (member_id, kind, value)
);

COMMENT ON TABLE public.member_dietary_preferences IS
  'Inclusive (soft) dietary preferences per member (v2.1). Distinct from hard '
  'restrictions (member_dietary_restrictions / member_allergies). Biases the '
  'constraint engine toward liked tags/ingredients without hard-excluding any '
  'recipe. DATABASE_PRD §6.22.';

COMMENT ON COLUMN public.member_dietary_preferences.kind IS
  'dietary_tag: value is a dietary_tag label string. '
  'ingredient: value is an ingredients.id UUID cast to text.';

COMMENT ON COLUMN public.member_dietary_preferences.value IS
  'For kind=dietary_tag: label from the dietary_tag extensible set. '
  'For kind=ingredient: UUID string referencing ingredients.id. '
  'Validated by the route layer; stored as text for a uniform column type.';

-- ---------------------------------------------------------------------------
-- Indexes — DATABASE_PRD §12 (v2.1)
-- ---------------------------------------------------------------------------

-- Primary lookup: load all inclusive prefs for a member during input assembly.
CREATE INDEX idx_member_dietary_preferences_member
  ON public.member_dietary_preferences (member_id);

-- Workspace-scoped scan for RLS role lookup.
CREATE INDEX idx_member_dietary_preferences_workspace
  ON public.member_dietary_preferences (workspace_id);
