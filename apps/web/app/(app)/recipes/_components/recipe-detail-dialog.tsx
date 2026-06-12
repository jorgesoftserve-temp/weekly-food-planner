'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChefHat, Clock, Flame, Package, Play, Refrigerator, Users, UtensilsCrossed } from 'lucide-react'
import {
  useIngredients,
  useRecipeDetail,
} from '@weekly-food-planner/supabase/react'
import type { CreateInventoryItemInput } from '@weekly-food-planner/supabase'
import { useCreateInventoryItem } from '@weekly-food-planner/supabase/react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { resolveRecipeIcon } from '@/lib/recipe-icon'
import { notifyError, notifySuccess } from '@/lib/toast'
import { cn } from '@/lib/utils'

export type RecipeDetailSection = 'dietary' | 'ingredients' | 'instructions'

export type RecipeDetailDialogProps = {
  workspaceId: string
  recipeId: string | null
  initialSection: RecipeDetailSection
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ── On-the-fly cook sheet ──────────────────────────────────────────────────────
// v2.1 §24 Track D: ephemeral cook mode for any recipe standalone, with NO menu
// write. Optional leftover save emits an inventory_items row via the existing
// hook. Distinct from the v1.9 menu-slot CookSheet which writes menu_slots.cooked_at.

type StepStatus = 'pending' | 'done'

type OnTheFlyCookSheetProps = {
  workspaceId: string
  recipeId: string
  recipeName: string
  open: boolean
  onClose: () => void
  sortedInstructions: Array<{ id: string; step_order: number; description: string; notes: string | null; duration_minutes: number | null }>
  recipeIngredients: Array<{ id: string; ingredient_id: string; quantity: string | number; unit: string }>
}

const OnTheFlyCookSheet = ({
  workspaceId,
  recipeName,
  open,
  onClose,
  sortedInstructions,
  recipeIngredients,
}: OnTheFlyCookSheetProps) => {
  const supabase = useSupabase()
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(
    sortedInstructions.map(() => 'pending'),
  )
  const [saveLeftovers, setSaveLeftovers] = useState(false)
  const [finished, setFinished] = useState(false)

  const createInventoryItem = useCreateInventoryItem({ supabase, workspaceId })

  // Reset state when sheet re-opens (different recipe or re-open of same).
  useEffect(() => {
    if (open) {
      setStepStatuses(sortedInstructions.map(() => 'pending'))
      setSaveLeftovers(false)
      setFinished(false)
    }
  }, [open, sortedInstructions])

  const doneCount = stepStatuses.filter((s) => s === 'done').length
  const total = sortedInstructions.length
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 100

  const toggleStep = (idx: number) => {
    setStepStatuses((prev) =>
      prev.map((s, i) => (i === idx ? (s === 'done' ? 'pending' : 'done') : s)),
    )
  }

  const handleFinish = async () => {
    // Save each ingredient as a leftover inventory row if toggled — ephemeral
    // quantities are not tracked so we record quantity=0 as a placeholder the
    // user can adjust in the pantry. The key guarantee is NO menu write happens.
    if (saveLeftovers && recipeIngredients.length > 0) {
      try {
        for (const ing of recipeIngredients) {
          const payload: CreateInventoryItemInput = {
            ingredient_id: ing.ingredient_id,
            source: 'leftover',
            quantity: 0,
            unit: ing.unit as CreateInventoryItemInput['unit'],
            label: `Leftover from cooking ${recipeName}`,
          }
          await createInventoryItem.mutateAsync(payload)
        }
        notifySuccess('Leftovers saved', `${recipeName} — added to your pantry.`)
      } catch (err) {
        notifyError(
          'Could not save leftovers',
          err instanceof Error ? err.message : 'Please try again.',
        )
        return
      }
    }
    setFinished(true)
    setTimeout(onClose, 600)
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-lg">
        <SheetHeader className="pb-3">
          <SheetTitle className="flex items-center gap-2">
            <Play className="size-4 text-success" aria-hidden />
            Cook now
          </SheetTitle>
          <SheetDescription>
            On-the-fly cook mode for <strong>{recipeName}</strong>. The active
            menu is not changed.
          </SheetDescription>
        </SheetHeader>

        {/* Progress bar */}
        {total > 0 ? (
          <div className="mb-4 flex flex-col gap-1.5 px-6">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{doneCount} of {total} steps done</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-success motion-safe:transition-all motion-safe:duration-300"
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Cook progress"
              />
            </div>
          </div>
        ) : null}

        {/* Steps */}
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-6 pb-2" role="list" aria-label="Recipe steps">
          {sortedInstructions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No instructions recorded for this recipe.
            </p>
          ) : null}
          {sortedInstructions.map((step, idx) => {
            const status = stepStatuses[idx] ?? 'pending'
            const checkId = `cook-step-${step.id}`
            return (
              <div
                key={step.id}
                role="listitem"
                className={cn(
                  'flex items-start gap-3 rounded-xl border border-border bg-card p-3 transition',
                  status === 'done' && 'border-success/30 bg-success-tint/10',
                )}
              >
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    status === 'done'
                      ? 'bg-success text-white'
                      : 'bg-accent-tint text-accent-strong',
                  )}
                  aria-hidden
                >
                  {idx + 1}
                </span>
                <p
                  className={cn(
                    'flex-1 text-sm leading-relaxed',
                    status === 'done' && 'text-muted-foreground line-through',
                  )}
                >
                  {step.description}
                </p>
                <Checkbox
                  id={checkId}
                  checked={status === 'done'}
                  onCheckedChange={() => toggleStep(idx)}
                  aria-label={`Mark step ${idx + 1} as done`}
                  className="mt-0.5"
                />
              </div>
            )
          })}
        </div>

        {/* Optional leftover save */}
        <div className="mx-6 mt-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/50 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Refrigerator className="size-4 text-muted-foreground" aria-hidden />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Save leftovers to pantry</span>
              <span className="text-xs text-muted-foreground">
                Optional. Ingredients go to your inventory.
              </span>
            </div>
          </div>
          <Checkbox
            id="save-leftovers"
            checked={saveLeftovers}
            onCheckedChange={(v) => setSaveLeftovers(!!v)}
            aria-label="Save leftovers to pantry after cooking"
          />
        </div>

        <SheetFooter className="flex-row gap-2 px-6 pt-4 pb-6">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Abandon
          </Button>
          <Button
            className="flex-1 gap-1.5"
            onClick={handleFinish}
            disabled={finished || createInventoryItem.isPending}
          >
            {finished ? 'Done!' : createInventoryItem.isPending ? 'Saving…' : 'Finish cooking'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
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
  const [cookOpen, setCookOpen] = useState(false)

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
  // v2.1: meal_type scalar replaced by meal_types array — use first entry for icon.
  const heroIcon = recipe
    ? resolveRecipeIcon({
        name: recipe.name,
        cuisine: recipe.cuisine ?? null,
        tags: recipe.recipe_dietary_tags.map((t) => t.tag),
        meal: recipe.meal_types[0] ?? null,
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
            {/* v2.1 §24 Track D — on-the-fly cook sheet, no menu write */}
            <OnTheFlyCookSheet
              workspaceId={workspaceId}
              recipeId={recipeId ?? ''}
              recipeName={recipe?.name ?? ''}
              open={cookOpen}
              onClose={() => setCookOpen(false)}
              sortedInstructions={sortedInstructions}
              recipeIngredients={recipe?.recipe_ingredients ?? []}
            />

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
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-xl font-semibold tracking-tight">
                  {recipe.name}
                </h2>
                {/* v2.1 §24 Track D — Cook now entry point (ephemeral, no menu write) */}
                <Button
                  size="sm"
                  className="shrink-0 gap-1.5"
                  onClick={() => setCookOpen(true)}
                  aria-label={`Cook ${recipe.name} now`}
                >
                  <Play className="size-3.5" aria-hidden />
                  Cook now
                </Button>
              </div>

              {recipe.description ? (
                <p className="text-sm text-muted-foreground">
                  {recipe.description}
                </p>
              ) : null}

              {/* Meta chips — rounded-pill tints */}
              {/* v2.1: addon badge + meal_types array (replaces scalar meal_type) */}
              <div className="flex flex-wrap gap-2 text-xs font-medium">
                {recipe.recipe_kind === 'addon' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-pill bg-addon-tint px-3 py-1 text-addon">
                    <Package className="size-3.5" aria-hidden />
                    Addon
                  </span>
                ) : (
                  recipe.meal_types.map((mt) => (
                    <span key={mt} className="inline-flex items-center gap-1.5 rounded-pill bg-muted px-3 py-1 capitalize text-muted-foreground">
                      <UtensilsCrossed className="size-3.5" aria-hidden />
                      {mt}
                    </span>
                  ))
                )}
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
                      id={`tab-${tab.id}`}
                      role="tab"
                      type="button"
                      aria-selected={isActive}
                      aria-controls="recipe-tabpanel"
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
            <div
              id="recipe-tabpanel"
              role="tabpanel"
              aria-labelledby={`tab-${section}`}
              tabIndex={0}
              className="flex flex-col gap-3 px-6 pb-6 pt-3"
            >
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
