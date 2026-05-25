-- DATABASE_PRD §5.1 — strict system enum for generation_runs.status.

CREATE TYPE public.generation_status AS ENUM (
  'pending',
  'running',
  'success',
  'failed'
);
