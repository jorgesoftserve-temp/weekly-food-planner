-- DATABASE_PRD §5.1 — strict system enum for recipe difficulty.

CREATE TYPE public.difficulty AS ENUM ('easy', 'medium', 'hard');
