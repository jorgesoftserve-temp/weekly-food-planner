-- DATABASE_PRD §5.1 — strict system enum for meal slot category.

CREATE TYPE public.meal_type AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');
