'use client'

import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { useCreateIngredient } from '@weekly-food-planner/supabase/react'
import type { IngredientRecord } from '@weekly-food-planner/supabase'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { notifyError, notifySuccess } from '@/lib/toast'

export type CreateIngredientDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (ingredient: IngredientRecord) => void
}

// Minimal form for adding a row to the global ingredient catalog. Allergens
// are taken as comma-separated strings to avoid nesting another popover-based
// combobox inside a Dialog (Radix focus traps don't compose cleanly).
export const CreateIngredientDialog = ({
  open,
  onOpenChange,
  onCreated,
}: CreateIngredientDialogProps) => {
  const [name, setName] = useState('')
  const [isPerishable, setIsPerishable] = useState(false)
  const [maxStorageDays, setMaxStorageDays] = useState('')
  const [allergensInput, setAllergensInput] = useState('')

  const mutation = useCreateIngredient()

  const reset = () => {
    setName('')
    setIsPerishable(false)
    setMaxStorageDays('')
    setAllergensInput('')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (trimmedName.length === 0) return

    const parsedDays = maxStorageDays.trim().length === 0
      ? null
      : Number.parseInt(maxStorageDays, 10)
    if (parsedDays !== null && (Number.isNaN(parsedDays) || parsedDays < 0)) {
      notifyError('Invalid storage days', 'Use a non-negative whole number, or leave blank.')
      return
    }

    const allergens = allergensInput
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a.length > 0)

    try {
      const ingredient = await mutation.mutateAsync({
        name: trimmedName,
        isPerishable,
        maxStorageDays: parsedDays,
        allergens: allergens.length > 0 ? allergens : undefined,
      })
      notifySuccess('Ingredient added', `“${ingredient.name}” is now in the catalog.`)
      reset()
      onOpenChange(false)
      onCreated?.(ingredient)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not add ingredient.'
      notifyError('Add ingredient failed', message)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Add ingredient</DialogTitle>
            <DialogDescription>
              Adds a row to the shared catalog. Visible to every workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="ingredient_name">Name</Label>
            <Input
              id="ingredient_name"
              required
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Lentils"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="ingredient_is_perishable"
              type="checkbox"
              checked={isPerishable}
              onChange={(event) => setIsPerishable(event.target.checked)}
              className="size-4 rounded border-input"
            />
            <Label htmlFor="ingredient_is_perishable" className="text-sm font-normal">
              Perishable (needs fridge or freezer)
            </Label>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="ingredient_max_storage_days">
              Max storage days <span className="text-xs text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="ingredient_max_storage_days"
              type="number"
              min={0}
              step={1}
              value={maxStorageDays}
              onChange={(event) => setMaxStorageDays(event.target.value)}
              placeholder="e.g. 7"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="ingredient_allergens">
              Allergens <span className="text-xs text-muted-foreground">(comma-separated, optional)</span>
            </Label>
            <Input
              id="ingredient_allergens"
              value={allergensInput}
              onChange={(event) => setAllergensInput(event.target.value)}
              placeholder="e.g. dairy, soy"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || name.trim().length === 0}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Adding…
                </>
              ) : (
                'Add ingredient'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
