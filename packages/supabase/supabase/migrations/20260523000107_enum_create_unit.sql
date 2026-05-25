-- DATABASE_PRD §5.1 — strict system enum for measurement units.

CREATE TYPE public.unit AS ENUM (
  'g',
  'kg',
  'ml',
  'l',
  'tsp',
  'tbsp',
  'cup',
  'piece',
  'slice',
  'pinch',
  'clove',
  'can',
  'pack'
);
