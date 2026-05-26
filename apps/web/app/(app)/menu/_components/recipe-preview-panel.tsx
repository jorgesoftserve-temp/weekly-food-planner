'use client'

import { useMemo, useState } from 'react'
import { ChefHat, Plus } from 'lucide-react'
import { useRecipesList } from '@weekly-food-planner/supabase/react'
import type { RecipeRecord } from '@weekly-food-planner/supabase'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { RecipeForm } from '@/app/(app)/recipes/_components/recipe-form'

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

const MEAL_TYPE_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

export type RecipePreviewPanelProps = {
  workspaceId: string
}

// Compact, read-only preview of the workspace's recipes shown inside the
// menu-generation dialog. The intent is "I'm about to generate, do I have
// enough recipes in the pool?" The +New button opens a Sheet with the
// existing RecipeForm, so the user can fill out a recipe without leaving
// the dialog. New recipes appear in the list immediately because
// useCreateRecipe invalidates the list cache on success.
export const RecipePreviewPanel = ({
  workspaceId,
}: RecipePreviewPanelProps) => {
  const supabase = useSupabase()
  const recipesQuery = useRecipesList({
    supabase,
    workspaceId,
    enabled: true,
  })
  const [createOpen, setCreateOpen] = useState(false)

  const recipes = useMemo(
    () => recipesQuery.data ?? [],
    [recipesQuery.data],
  )
  const byMealType = useMemo(() => {
    const map: Record<MealType, RecipeRecord[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    }
    for (const r of recipes) {
      const bucket = map[r.meal_type as MealType]
      if (bucket) bucket.push(r)
    }
    return map
  }, [recipes])

  return (
    <details className="rounded-md border border-border bg-card/40 px-3 py-2 text-sm">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-2 font-medium">
        <span>
          Recipes in this workspace ({recipes.length})
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setCreateOpen(true)
          }}
        >
          <Plus className="size-4" />
          New recipe
        </Button>
      </summary>
      <div className="flex flex-col gap-3 pt-3">
        {recipesQuery.isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        ) : recipes.length === 0 ? (
          <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-border bg-card/60 px-3 py-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <ChefHat className="size-4" />
              <span className="font-medium text-foreground">
                No recipes yet
              </span>
            </div>
            <p>
              The engine has nothing to pick from. Click &quot;New recipe&quot;
              above to add one without leaving this dialog.
            </p>
          </div>
        ) : (
          MEAL_TYPE_ORDER.map((mealType) => {
            const list = byMealType[mealType]
            if (list.length === 0) return null
            return (
              <div key={mealType} className="flex flex-col gap-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {mealType} · {list.length}
                </p>
                <ul className="flex flex-wrap gap-1">
                  {list.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-full border border-border bg-background px-2 py-0.5 text-xs"
                    >
                      {r.name}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })
        )}
      </div>

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
        >
          <SheetHeader className="border-b border-border px-6 py-4">
            <SheetTitle>New recipe</SheetTitle>
            <SheetDescription>
              Persists to the workspace catalog and immediately enters the
              candidate pool for menu generation.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <RecipeForm
              mode="create"
              workspaceId={workspaceId}
              onClose={() => setCreateOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </details>
  )
}
