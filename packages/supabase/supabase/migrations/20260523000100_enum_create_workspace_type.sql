-- DATABASE_PRD §5.1 — strict system enum for workspace kind.

CREATE TYPE public.workspace_type AS ENUM ('individual', 'group');
