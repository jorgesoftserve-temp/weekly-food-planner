'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { useIngredients } from '@weekly-food-planner/supabase/react'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { cn } from '@/lib/utils'

export type IngredientPickerProps = {
  value: string | null
  onChange: (next: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export const IngredientPicker = ({
  value,
  onChange,
  placeholder = 'Pick an ingredient…',
  className,
  disabled,
}: IngredientPickerProps) => {
  const supabase = useSupabase()
  const [open, setOpen] = useState(false)
  const ingredientsQuery = useIngredients({ supabase, enabled: open || !!value })

  const ingredients = ingredientsQuery.data ?? []
  const selected = useMemo(
    () => ingredients.find((ing) => ing.id === value) ?? null,
    [ingredients, value],
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between', className)}
        >
          <span className={cn(!selected && 'text-muted-foreground')}>
            {selected?.name ?? placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search ingredients…" />
          <CommandList>
            <CommandEmpty>
              {ingredientsQuery.isLoading
                ? 'Loading ingredients…'
                : 'No matching ingredient.'}
            </CommandEmpty>
            <CommandGroup>
              {ingredients.map((ing) => (
                <CommandItem
                  key={ing.id}
                  value={`${ing.name} ${ing.id}`}
                  onSelect={() => {
                    onChange(ing.id)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 size-4',
                      ing.id === value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span className="flex-1 truncate">{ing.name}</span>
                  {ing.is_perishable ? (
                    <span className="ml-2 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      perishable
                    </span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
