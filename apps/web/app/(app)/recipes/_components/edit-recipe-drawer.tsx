'use client'

import { ChefHat } from 'lucide-react'
import { useRecipeDetail } from '@weekly-food-planner/supabase/react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { EmptyState } from '@/components/empty-state'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { RecipeForm } from './recipe-form'

export type EditRecipeDrawerProps = {
  workspaceId: string
  recipeId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Right-side sheet hosting the full RecipeForm in edit mode. Replaces the
// /recipes/[id]/edit standalone route so users stay on the list view —
// per the step-18 follow-up. The form's Cancel/Save buttons close the
// drawer via the onClose callback we hand to RecipeForm.
export const EditRecipeDrawer = ({
  workspaceId,
  recipeId,
  open,
  onOpenChange,
}: EditRecipeDrawerProps) => {
  const supabase = useSupabase()
  // The query is gated on `open` so closing the drawer also stops React
  // Query from refetching the now-irrelevant detail.
  const recipeQuery = useRecipeDetail({
    supabase,
    workspaceId,
    recipeId,
    enabled: open && !!recipeId,
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
      >
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle>
            {recipeQuery.data
              ? `Edit ${recipeQuery.data.name}`
              : 'Edit recipe'}
          </SheetTitle>
          <SheetDescription>
            Saves scalar fields and the ingredient / instruction / dietary-tag
            arrays in one go.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {!recipeId ? null : recipeQuery.isLoading ? (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
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
          ) : !recipeQuery.data ? (
            <EmptyState
              icon={ChefHat}
              title="Recipe not found"
              description="It may have been deleted, or it belongs to a different workspace."
            />
          ) : (
            <RecipeForm
              mode="edit"
              workspaceId={workspaceId}
              recipe={recipeQuery.data}
              onClose={() => onOpenChange(false)}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
