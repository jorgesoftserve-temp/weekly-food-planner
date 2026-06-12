'use client'

import { useMemo } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  Refrigerator,
  Snowflake,
  Sparkles,
} from 'lucide-react'
import {
  useIngredients,
  useRecipesList,
} from '@weekly-food-planner/supabase/react'
import type {
  IngredientRecord,
  RecipeRecord,
} from '@weekly-food-planner/supabase'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useSupabase } from '@/lib/hooks/use-supabase'

export type IngredientDetailDialogProps = {
  workspaceId: string | null
  ingredientId: string | null
  activeMenuRecipeIds: Set<string>
  open: boolean
  onOpenChange: (open: boolean) => void
}

type FreshnessFlag = {
  icon: typeof Refrigerator
  label: string
  description: string
  tone: 'neutral' | 'warn' | 'info'
}

const computeFreshnessFlags = (ing: IngredientRecord): FreshnessFlag[] => {
  const flags: FreshnessFlag[] = []
  if (ing.is_perishable) {
    flags.push({
      icon: Refrigerator,
      label: 'Perishable',
      description:
        ing.max_storage_days != null
          ? `Best within ${ing.max_storage_days} day${ing.max_storage_days === 1 ? '' : 's'} of purchase.`
          : 'Spoils faster than a pantry staple.',
      tone: 'warn',
    })
  } else {
    flags.push({
      icon: Snowflake,
      label: 'Pantry-stable',
      description: 'No special storage requirement.',
      tone: 'neutral',
    })
  }
  if (ing.requires_fresh) {
    flags.push({
      icon: Sparkles,
      label: 'Requires fresh',
      description: 'Must be purchased the same week it is cooked.',
      tone: 'info',
    })
  }
  if (ing.same_day_cook) {
    flags.push({
      icon: CalendarClock,
      label: 'Same-day cook',
      description: 'Buy on the day it is cooked for best results.',
      tone: 'info',
    })
  }
  return flags
}

const TONE_CLASS: Record<FreshnessFlag['tone'], string> = {
  neutral: 'border-border bg-muted/40 text-foreground',
  warn: 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200',
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-200',
}

const findRecipesUsing = ({
  ingredientId,
  recipes,
  activeMenuRecipeIds,
}: {
  ingredientId: string
  recipes: RecipeRecord[]
  activeMenuRecipeIds: Set<string>
}): RecipeRecord[] => {
  return recipes.filter(
    (r) =>
      activeMenuRecipeIds.has(r.id) &&
      r.recipe_ingredients.some((ri) => ri.ingredient_id === ingredientId),
  )
}

export const IngredientDetailDialog = ({
  workspaceId,
  ingredientId,
  activeMenuRecipeIds,
  open,
  onOpenChange,
}: IngredientDetailDialogProps) => {
  const supabase = useSupabase()
  const ingredientsQuery = useIngredients({ supabase, enabled: open })
  const recipesQuery = useRecipesList({
    supabase,
    workspaceId,
    enabled: open && !!workspaceId,
  })

  const ingredient = useMemo(() => {
    if (!ingredientId) return null
    return (
      (ingredientsQuery.data ?? []).find((i) => i.id === ingredientId) ?? null
    )
  }, [ingredientId, ingredientsQuery.data])

  const recipesUsing = useMemo(() => {
    if (!ingredientId) return []
    return findRecipesUsing({
      ingredientId,
      recipes: recipesQuery.data ?? [],
      activeMenuRecipeIds,
    })
  }, [ingredientId, recipesQuery.data, activeMenuRecipeIds])

  const isLoading = ingredientsQuery.isLoading || recipesQuery.isLoading
  const flags = ingredient ? computeFreshnessFlags(ingredient) : []
  const allergens = ingredient?.ingredient_allergens ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-full max-w-lg overflow-y-auto p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>{ingredient?.name ?? 'Ingredient details'}</DialogTitle>
          <DialogDescription>
            Freshness rules and where it appears in this week&apos;s menu.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-6 pb-6 pt-4">
          {isLoading && !ingredient ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : !ingredient ? (
            <p className="text-sm text-muted-foreground">
              Couldn&apos;t find this ingredient in the catalog.
            </p>
          ) : (
            <>
              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Freshness
                </h3>
                <ul className="flex flex-col gap-2">
                  {flags.map((flag) => {
                    const Icon = flag.icon
                    return (
                      <li
                        key={flag.label}
                        className={`flex items-start gap-3 rounded-md border px-3 py-2 text-sm ${TONE_CLASS[flag.tone]}`}
                      >
                        <Icon className="mt-0.5 size-4 shrink-0" />
                        <div className="flex flex-col">
                          <span className="font-medium">{flag.label}</span>
                          <span className="text-xs opacity-80">
                            {flag.description}
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>

              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Allergens
                </h3>
                {allergens.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No allergens tagged on this ingredient.
                  </p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {allergens.map((a) => (
                      <li
                        key={a.allergy}
                        className="flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive"
                      >
                        <AlertTriangle className="size-3" />
                        {a.allergy.replace(/_/g, ' ')}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Used this week
                </h3>
                {recipesUsing.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Not used by any recipe in the active menu.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {recipesUsing.map((r) => (
                      <li
                        key={r.id}
                        className="rounded-md border border-border bg-card/60 px-3 py-1.5 text-sm"
                      >
                        <span className="font-medium">{r.name}</span>
                        <span className="ml-2 text-xs capitalize text-muted-foreground">
                          {r.meal_types.join(', ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
