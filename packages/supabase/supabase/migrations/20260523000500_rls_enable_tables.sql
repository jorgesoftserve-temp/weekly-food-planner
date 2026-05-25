-- DATABASE_PRD §8 — enable RLS on every public table. Policies follow.

ALTER TABLE public.workspaces                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_dietary_restrictions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_allergies              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_ingredient_dislikes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_allergens          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_instructions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_dietary_tags           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menus                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_slots                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grocery_lists                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grocery_items                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_runs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enum_metadata                 ENABLE ROW LEVEL SECURITY;
