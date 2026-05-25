-- DATABASE_PRD §5.1 — strict system enum for workspace member role.

CREATE TYPE public.workspace_role AS ENUM ('creator', 'admin', 'member');
