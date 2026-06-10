-- v1.8 §12.2 — per-member accent color on workspace_members.
--
-- Adds a nullable accent_color column that lets an admin or the member
-- themselves set an explicit visual identity for member-tied surfaces
-- (selector chips, role badges, avatar dots, member cards).
--
-- NULL means "no explicit accent — derive a stable accent from the member id
-- in the render layer".  This is intentionally distinct from profiles.accent_color
-- (§6.0), which is the per-user chrome accent that follows a user across
-- workspaces.
--
-- RLS: no new policies required.  The existing workspace_members policies already
-- cover all columns:
--   * workspace_members_read        — any active member of the workspace (SELECT)
--   * workspace_members_update_self — a member may update rows where user_id = auth.uid()
--   * workspace_members_update_admin — creator/admin may update any row in the workspace
-- Setting accent_color follows the same creator/admin gating as other member
-- fields — it is NOT one of the member-writable self-exceptions like
-- menu_slots.cooked_at or grocery_items.note.

ALTER TABLE public.workspace_members
  ADD COLUMN accent_color public.accent_color NULL;

COMMENT ON COLUMN public.workspace_members.accent_color IS
  'Per-member visual identity shown on member-tied surfaces (selector chips, '
  'role badges, avatar dots, member cards) in a shared workspace. '
  'NULL = derive a stable accent from the member id at render time. '
  'An admin or the member may set an explicit value. '
  'Distinct from profiles.accent_color (§6.0), which is the per-user chrome '
  'accent that follows the user across all workspaces.';
