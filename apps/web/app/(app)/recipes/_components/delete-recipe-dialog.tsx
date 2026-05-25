'use client'

import { useState } from 'react'
import { useSoftDeleteRecipe } from '@weekly-food-planner/supabase/react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { notifyError, notifySuccess } from '@/lib/toast'

export type DeleteRecipeDialogProps = {
  workspaceId: string
  recipeId: string
  recipeName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const DeleteRecipeDialog = ({
  workspaceId,
  recipeId,
  recipeName,
  open,
  onOpenChange,
}: DeleteRecipeDialogProps) => {
  const supabase = useSupabase()
  const deleteMutation = useSoftDeleteRecipe({ supabase, workspaceId })
  const [isWorking, setIsWorking] = useState(false)

  const handleConfirm = async () => {
    setIsWorking(true)
    try {
      await deleteMutation.mutateAsync({ recipeId })
      notifySuccess('Recipe deleted', recipeName)
      onOpenChange(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not delete the recipe.'
      notifyError('Delete failed', message)
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{recipeName}&rdquo;?</DialogTitle>
          <DialogDescription>
            The recipe is soft-deleted (hidden everywhere, including the menu
            generator), but the database keeps the row so prior menus that
            referenced it still render correctly.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isWorking}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={isWorking}
          >
            {isWorking ? 'Deleting…' : 'Delete recipe'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
