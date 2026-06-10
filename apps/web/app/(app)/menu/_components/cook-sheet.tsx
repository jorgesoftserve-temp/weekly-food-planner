'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Loader2, PartyPopper, RotateCcw } from 'lucide-react'
import { useIngredients, useRecipeDetail } from '@weekly-food-planner/supabase/react'
import type { MenuSlotRecord } from '@weekly-food-planner/supabase'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { useMarkSlotCooked } from '@/lib/hooks/use-cook-slot'
import { resolveRecipeIcon } from '@/lib/recipe-icon'
import { notifyError, notifySuccess } from '@/lib/toast'
import { cn } from '@/lib/utils'

const capitalize = (s: string): string =>
  s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)

const formatQuantity = (n: number | string): string => {
  const num = typeof n === 'string' ? Number.parseFloat(n) : n
  if (!Number.isFinite(num)) return String(n)
  const rounded = Math.round(num * 1000) / 1000
  return rounded.toString()
}

export type CookSheetProps = {
  workspaceId: string
  menuId: string | null
  slot: MenuSlotRecord | null
  recipeName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Full-screen "Cook mode" Sheet opened from an accepted-menu slot. The recipe's
// real ingredients + numbered steps are checkable hands-on (ephemeral, per-cook
// progress — not persisted). "Mark as cooked" writes cooked_at server-side via
// useMarkSlotCooked; an already-cooked slot can be un-marked. Promotes the
// design-lab recipe-cook-mock onto live data.
export const CookSheet = ({
  workspaceId,
  menuId,
  slot,
  recipeName,
  open,
  onOpenChange,
}: CookSheetProps) => {
  const supabase = useSupabase()
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(
    new Set(),
  )
  const [checkedSteps, setCheckedSteps] = useState<Set<string>>(new Set())

  // Reset the ephemeral checklist each time a different slot opens.
  useEffect(() => {
    if (open) {
      setCheckedIngredients(new Set())
      setCheckedSteps(new Set())
    }
  }, [open, slot?.id])

  const recipeQuery = useRecipeDetail({
    supabase,
    workspaceId,
    recipeId: slot?.recipe_id ?? null,
    enabled: open && !!slot,
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

  const markCooked = useMarkSlotCooked({ workspaceId, menuId })
  const isCooked = !!slot?.cooked_at

  const toggle = (set: Set<string>, id: string): Set<string> => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }

  const handleMark = async (cooked: boolean) => {
    if (!slot) return
    try {
      await markCooked.mutateAsync({ slotId: slot.id, cooked })
      notifySuccess(
        cooked ? 'Marked as cooked' : 'Marked as not cooked',
        cooked ? `${recipeName} — enjoy!` : undefined,
      )
      // Close on either toggle: the active-menu query re-fetches fresh slot
      // rows, so the held `slot` prop (with stale cooked_at) is discarded.
      onOpenChange(false)
    } catch (err) {
      notifyError(
        'Could not update',
        err instanceof Error ? err.message : 'Please try again.',
      )
    }
  }

  const heroIcon = resolveRecipeIcon({
    name: recipeName,
    cuisine: recipe?.cuisine ?? null,
    tags: recipe?.recipe_dietary_tags.map((t) => t.tag) ?? null,
    meal: slot?.meal_key,
  })

  const stepCount = sortedInstructions.length
  const checkedStepCount = checkedSteps.size

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl"
      >
        {/* Hero */}
        <SheetHeader className="space-y-0 bg-gradient-hero p-6 text-left">
          <div className="flex items-center gap-4">
            <div
              className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-card text-3xl shadow-sm"
              aria-hidden
            >
              {heroIcon}
            </div>
            <div className="min-w-0">
              {slot ? (
                <p className="text-xs font-medium uppercase tracking-wide text-accent-strong">
                  {capitalize(slot.day_of_week)} · {slot.meal_key}
                </p>
              ) : null}
              <SheetTitle className="truncate text-xl">{recipeName}</SheetTitle>
              <SheetDescription>
                {stepCount > 0
                  ? `${checkedStepCount} of ${stepCount} steps done`
                  : 'Check off ingredients and steps as you cook.'}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-6 p-6">
          {recipeQuery.isLoading ? (
            <>
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-40 w-full rounded-2xl" />
            </>
          ) : recipe ? (
            <>
              {/* Ingredients — checkable */}
              {recipe.recipe_ingredients.length > 0 ? (
                <section className="flex flex-col gap-3">
                  <h3 className="text-sm font-semibold">Ingredients</h3>
                  <ul className="flex flex-col gap-1">
                    {recipe.recipe_ingredients.map((row) => {
                      const done = checkedIngredients.has(row.id)
                      const name =
                        ingredientNamesById[row.ingredient_id] ??
                        `[unknown:${row.ingredient_id.slice(0, 6)}]`
                      return (
                        <li key={row.id}>
                          <button
                            type="button"
                            aria-pressed={done}
                            onClick={() =>
                              setCheckedIngredients((s) => toggle(s, row.id))
                            }
                            className="flex min-h-11 w-full items-center gap-3 text-left text-sm"
                          >
                            <span
                              className={cn(
                                'flex size-6 shrink-0 items-center justify-center rounded-full border-2',
                                done
                                  ? 'border-transparent bg-success-tint text-success'
                                  : 'border-border',
                              )}
                              aria-hidden
                            >
                              {done ? <Check className="size-4" /> : null}
                            </span>
                            <span
                              className={cn(
                                'flex-1',
                                done && 'text-muted-foreground line-through',
                              )}
                            >
                              {name}
                            </span>
                            <span className="shrink-0 text-muted-foreground">
                              {formatQuantity(row.quantity)}
                              {row.unit ? ` ${row.unit}` : ''}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ) : null}

              {/* Instructions — checkable numbered steps */}
              {sortedInstructions.length > 0 ? (
                <section className="flex flex-col gap-3">
                  <h3 className="text-sm font-semibold">Instructions</h3>
                  <ol className="flex flex-col gap-2">
                    {sortedInstructions.map((step, idx) => {
                      const done = checkedSteps.has(step.id)
                      return (
                        <li key={step.id}>
                          <button
                            type="button"
                            aria-pressed={done}
                            onClick={() =>
                              setCheckedSteps((s) => toggle(s, step.id))
                            }
                            className="flex w-full items-start gap-3 text-left"
                          >
                            <span
                              className={cn(
                                'flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                                done
                                  ? 'bg-success-tint text-success'
                                  : 'bg-accent-tint text-accent-strong',
                              )}
                              aria-hidden
                            >
                              {done ? <Check className="size-4" /> : idx + 1}
                            </span>
                            <p
                              className={cn(
                                'pt-0.5 text-sm leading-relaxed',
                                done && 'text-muted-foreground line-through',
                              )}
                            >
                              {step.description}
                            </p>
                          </button>
                        </li>
                      )
                    })}
                  </ol>
                </section>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Couldn&apos;t load this recipe.
            </p>
          )}
        </div>

        {/* Sticky action */}
        <div className="sticky bottom-0 border-t border-border bg-background p-4">
          {isCooked ? (
            <button
              type="button"
              disabled={markCooked.isPending}
              onClick={() => handleMark(false)}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-5 py-3 text-sm font-medium disabled:opacity-60"
            >
              {markCooked.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RotateCcw className="size-4" />
              )}
              Mark as not cooked
            </button>
          ) : (
            <button
              type="button"
              disabled={markCooked.isPending || !slot}
              onClick={() => handleMark(true)}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm disabled:opacity-60"
            >
              {markCooked.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <PartyPopper className="size-4" />
              )}
              Mark as cooked
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
