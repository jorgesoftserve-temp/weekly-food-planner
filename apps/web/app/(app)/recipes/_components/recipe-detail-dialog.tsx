'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChefHat } from 'lucide-react'
import {
  useIngredients,
  useRecipeDetail,
} from '@weekly-food-planner/supabase/react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/empty-state'
import { useSupabase } from '@/lib/hooks/use-supabase'

export type RecipeDetailSection = 'dietary' | 'ingredients' | 'instructions'

export type RecipeDetailDialogProps = {
  workspaceId: string
  recipeId: string | null
  initialSection: RecipeDetailSection
  open: boolean
  onOpenChange: (open: boolean) => void
}

const SECTION_TABS: Array<{ id: RecipeDetailSection; label: string }> = [
  { id: 'dietary', label: 'Dietary' },
  { id: 'ingredients', label: 'Ingredients' },
  { id: 'instructions', label: 'Instructions' },
]

const formatQuantity = (n: number | string): string => {
  const num = typeof n === 'string' ? Number.parseFloat(n) : n
  if (!Number.isFinite(num)) return String(n)
  const rounded = Math.round(num * 1000) / 1000
  return rounded.toString()
}

export const RecipeDetailDialog = ({
  workspaceId,
  recipeId,
  initialSection,
  open,
  onOpenChange,
}: RecipeDetailDialogProps) => {
  const supabase = useSupabase()
  const [section, setSection] = useState<RecipeDetailSection>(initialSection)

  // Re-sync the active tab every time the caller opens the dialog with a
  // different initial section. Without this, clicking "View ingredients"
  // after previously closing the dialog on "Instructions" would land on the
  // wrong tab.
  useEffect(() => {
    if (open) setSection(initialSection)
  }, [open, initialSection])

  const recipeQuery = useRecipeDetail({
    supabase,
    workspaceId,
    recipeId,
    enabled: open && !!recipeId,
  })
  const ingredientsQuery = useIngredients({
    supabase,
    enabled: open && !!recipeQuery.data,
  })

  const ingredientNamesById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const ing of ingredientsQuery.data ?? []) map[ing.id] = ing.name
    return map
  }, [ingredientsQuery.data])

  const recipe = recipeQuery.data

  const sortedInstructions = useMemo(() => {
    if (!recipe) return []
    return [...recipe.recipe_instructions].sort(
      (a, b) => a.step_order - b.step_order,
    )
  }, [recipe])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-full max-w-2xl overflow-y-auto p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>{recipe?.name ?? 'Recipe details'}</DialogTitle>
          <DialogDescription>
            Read-only view. Use the row menu to edit.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-6 pb-6 pt-4">
          {recipeQuery.isLoading || !recipeId ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : recipeQuery.error ? (
            <EmptyState
              icon={ChefHat}
              title="Couldn't load recipe"
              description={
                recipeQuery.error instanceof Error
                  ? recipeQuery.error.message
                  : 'Unknown error.'
              }
            />
          ) : !recipe ? (
            <EmptyState
              icon={ChefHat}
              title="Recipe not found"
              description="It may have been deleted, or it belongs to a different workspace."
            />
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                <div className="flex flex-col">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Meal
                  </dt>
                  <dd className="capitalize">{recipe.meal_type}</dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Difficulty
                  </dt>
                  <dd className="capitalize">{recipe.difficulty}</dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Servings
                  </dt>
                  <dd>{recipe.servings}</dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Calories / serving
                  </dt>
                  <dd>{recipe.calories_per_serving ?? '—'}</dd>
                </div>
              </dl>

              {recipe.description ? (
                <p className="text-sm text-muted-foreground">
                  {recipe.description}
                </p>
              ) : null}

              <div
                className="flex gap-1 rounded-md border border-border bg-muted/40 p-1"
                role="tablist"
                aria-label="Recipe sections"
              >
                {SECTION_TABS.map((tab) => {
                  const isActive = section === tab.id
                  return (
                    <button
                      key={tab.id}
                      role="tab"
                      type="button"
                      aria-selected={isActive}
                      onClick={() => setSection(tab.id)}
                      className={`flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {tab.label}
                    </button>
                  )
                })}
              </div>

              <div role="tabpanel" className="flex flex-col gap-3">
                {section === 'dietary' ? (
                  recipe.recipe_dietary_tags.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No dietary tags on this recipe.
                    </p>
                  ) : (
                    <ul className="flex flex-wrap gap-1.5">
                      {recipe.recipe_dietary_tags.map((tag) => (
                        <li
                          key={tag.tag}
                          className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                        >
                          {tag.tag.replace(/_/g, ' ')}
                        </li>
                      ))}
                    </ul>
                  )
                ) : null}

                {section === 'ingredients' ? (
                  recipe.recipe_ingredients.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No ingredients recorded for this recipe yet.
                    </p>
                  ) : (
                    <div className="overflow-hidden rounded-md border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ingredient</TableHead>
                            <TableHead className="w-28 text-right">
                              Quantity
                            </TableHead>
                            <TableHead className="w-20">Unit</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recipe.recipe_ingredients.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell className="font-medium">
                                {ingredientNamesById[row.ingredient_id] ??
                                  `[unknown:${row.ingredient_id.slice(0, 6)}]`}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatQuantity(row.quantity)}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {row.unit}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )
                ) : null}

                {section === 'instructions' ? (
                  sortedInstructions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No instructions recorded for this recipe yet.
                    </p>
                  ) : (
                    <ol className="flex flex-col gap-3">
                      {sortedInstructions.map((step, idx) => (
                        <li
                          key={step.id}
                          className="flex gap-3 rounded-md border border-border p-3"
                        >
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {idx + 1}
                          </span>
                          <div className="flex flex-col gap-1 text-sm">
                            <p>{step.description}</p>
                            {step.duration_minutes != null ? (
                              <p className="text-xs text-muted-foreground">
                                ~{step.duration_minutes} min
                              </p>
                            ) : null}
                            {step.notes ? (
                              <p className="text-xs italic text-muted-foreground">
                                {step.notes}
                              </p>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ol>
                  )
                ) : null}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
