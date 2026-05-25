-- DATABASE_PRD §5.1 — strict system enum for member age category.

CREATE TYPE public.age_category AS ENUM (
  'infant',
  'toddler',
  'child',
  'teen',
  'adult',
  'senior'
);
