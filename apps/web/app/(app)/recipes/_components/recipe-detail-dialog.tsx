'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChefHat, Clock, Flame, Users, UtensilsCrossed } from 'lucide-react'
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
import { EmptyState } from '@/components/empty-state'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { resolveRecipeIcon } from '@/lib/recipe-icon'
import { cn } from '@/lib/utils'

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

// Difficulty chip: Easy → success tint, Medium → warning tint, Hard → destructive tint.
const DIFFICULTY_CLASS: Record<string, string> = {
  easy: 'bg-success-tint text-success',
  medium: 'bg-warning-tint text-warning',
  hard: 'bg-destructive/10 text-destructive',
}

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

  // Deterministic icon for the hero area (no photos — emoji fallback only).
  const heroIcon = recipe
    ? resolveRecipeIcon({
        name: recipe.name,
        cuisine: recipe.cuisine ?? null,
        tags: recipe.recipe_dietary_tags.map((t) => t.tag),
        meal: recipe.meal_type,
      })
    : '🍽️'

  const totalMinutes =
    recipe
      ? (recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0)
      : 0

  const difficultyClass = recipe
    ? (DIFFICULTY_CLASS[recipe.difficulty.toLowerCase()] ??
      'bg-muted text-muted-foreground')
    : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-full max-w-2xl overflow-y-auto p-0">
        {/* Always-present accessible name for DialogContent (Radix requires a
            DialogTitle in every render, incl. loading). Visually hidden — the
            loaded state shows the recipe name as a visible <h2> below the hero. */}
        <DialogHeader className="sr-only">
          <DialogTitle>{recipe?.name ?? 'Recipe details'}</DialogTitle>
          <DialogDescription>Read-only recipe view. Use the row menu to edit.</DialogDescription>
        </DialogHeader>
        {recipeQuery.isLoading || !recipeId ? (
          <>
            {/* Loading skeleton — cozy card proportions */}
            <div className="h-40 w-full rounded-t-2xl bg-muted" />
            <div className="flex flex-col gap-4 px-6 pb-6 pt-4">
              <Skeleton className="h-7 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-20 rounded-pill" />
                <Skeleton className="h-6 w-20 rounded-pill" />
                <Skeleton className="h-6 w-20 rounded-pill" />
              </div>
              <Skeleton className="h-10 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
            </div>
          </>
        ) : recipeQuery.error ? (
          <>
            <div className="px-6 pb-6 pt-6">
              <EmptyState
                icon={ChefHat}
                title="Couldn't load recipe"
                description={
                  recipeQuery.error instanceof Error
                    ? recipeQuery.error.message
                    : 'Unknown error.'
                }
              />
            </div>
          </>
        ) : !recipe ? (
          <>
            <div className="px-6 pb-6 pt-6">
              <EmptyState
                icon={ChefHat}
                title="Recipe not found"
                description="It may have been deleted, or it belongs to a different workspace."
              />
            </div>
          </>
        ) : (
          <>
            {/* ── Hero area ─────────────────────────────────────────────── */}
            {/* Emoji hero: gradient tint background, large icon, rounded top */}
            <div
              className="flex h-40 w-full items-center justify-center rounded-t-2xl bg-gradient-empty"
              role="img"
              aria-label={`${recipe.name} recipe icon`}
            >
              <span aria-hidden className="select-none text-7xl leading-none">
                {heroIcon}
              </span>
            </div>

            {/* ── Title + meta ───────────────────────────────────────────── */}
            <div className="flex flex-col gap-3 px-6 pt-4">
              <h2 className="text-xl font-semibold tracking-tight">
                {recipe.name}
              </h2>

              {recipe.description ? (
                <p className="text-sm text-muted-foreground">
                  {recipe.description}
                </p>
              ) : null}

              {/* Meta chips — rounded-pill tints */}
              <div className="flex flex-wrap gap-2 text-xs font-medium">
                <span className="inline-flex items-center gap-1.5 rounded-pill bg-muted px-3 py-1 capitalize text-muted-foreground">
                  <UtensilsCrossed className="size-3.5" />
                  {recipe.meal_type}
                </span>
                {recipe.cuisine ? (
                  <span className="inline-flex items-center gap-1.5 rounded-pill bg-muted px-3 py-1 text-muted-foreground">
                    {recipe.cuisine}
                  </span>
                ) : null}
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-pill px-3 py-1 capitalize',
                    difficultyClass,
                  )}
                >
                  <Flame className="size-3.5" />
                  {recipe.difficulty}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-pill bg-muted px-3 py-1 text-muted-foreground">
                  <Users className="size-3.5" />
                  {recipe.servings} serving{recipe.servings !== 1 ? 's' : ''}
                </span>
                {totalMinutes > 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-pill bg-muted px-3 py-1 text-muted-foreground">
                    <Clock className="size-3.5" />
                    {totalMinutes} min
                  </span>
                ) : null}
                {recipe.calories_per_serving != null ? (
                  <span className="inline-flex items-center gap-1.5 rounded-pill bg-muted px-3 py-1 text-muted-foreground">
                    {recipe.calories_per_serving} kcal
                  </span>
                ) : null}
              </div>
            </div>

            {/* ── Pill segmented tab control ─────────────────────────────── */}
            <div className="px-6 pt-2 pb-0">
              <div
                className="flex gap-1 rounded-pill border border-border bg-muted/40 p-1"
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
                      className={cn(
                        'flex-1 rounded-pill px-3 py-1.5 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Section panels ─────────────────────────────────────────── */}
            <div role="tabpanel" className="flex flex-col gap-3 px-6 pb-6 pt-3">
              {/* DIETARY */}
              {section === 'dietary' ? (
                recipe.recipe_dietary_tags.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No dietary tags on this recipe.
                  </p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {recipe.recipe_dietary_tags.map((tag) => (
                      <li
                        key={tag.tag}
                        className="rounded-pill bg-accent-tint px-3 py-1 text-xs font-medium text-accent-strong"
                      >
                        {tag.tag.replace(/_/g, ' ')}
                      </li>
                    ))}
                  </ul>
                )
              ) : null}

              {/* INGREDIENTS — cozy list rows (Todoist-style) */}
              {section === 'ingredients' ? (
                recipe.recipe_ingredients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No ingredients recorded for this recipe yet.
                  </p>
                ) : (
                  <div className="rounded-2xl border border-border bg-card shadow-sm">
                    <ul className="flex flex-col divide-y divide-border">
                      {recipe.recipe_ingredients.map((row, idx) => (
                        <li
                          key={row.id}
                          className={cn(
                            'flex items-center gap-3 px-4 py-3 text-sm',
                            idx === 0 && 'rounded-t-2xl',
                            idx === recipe.recipe_ingredients.length - 1 &&
                              'rounded-b-2xl',
                          )}
                        >
                          {/* Bullet dot */}
                          <span
                            className="mt-0.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/40"
                            aria-hidden
                          />
                          {/* Ingredient name */}
                          <span className="flex-1 font-medium">
                            {ingredientNamesById[row.ingredient_id] ??
                              `[unknown:${row.ingredient_id.slice(0, 6)}]`}
                          </span>
                          {/* Quantity + unit */}
                          <span className="shrink-0 text-muted-foreground">
                            {formatQuantity(row.quantity)}
                            {row.unit ? ` ${row.unit}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              ) : null}

              {/* INSTRUCTIONS — numbered cozy step cards */}
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
                        className="flex gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
                      >
                        {/* Step number badge — accent tint circle */}
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-tint text-sm font-semibold text-accent-strong">
                          {idx + 1}
                        </span>
                        <div className="flex flex-col gap-1 text-sm">
                          <p className="leading-relaxed">{step.description}</p>
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
      </DialogContent>
    </Dialog>
  )
}
