-- DATABASE_PRD §6.14 — line items per grocery list.

CREATE TABLE public.grocery_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES public.grocery_lists(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id),
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit public.unit NOT NULL,
  scheduled_purchase_day public.day_of_week
);

COMMENT ON COLUMN public.grocery_items.scheduled_purchase_day IS
  'Engine output for freshness-aware multi-purchase scheduling.';

CREATE INDEX idx_grocery_items_list ON public.grocery_items (list_id);
