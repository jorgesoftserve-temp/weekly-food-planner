-- DATABASE_PRD §5.1 — strict system enum for day of week.

CREATE TYPE public.day_of_week AS ENUM (
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
);
