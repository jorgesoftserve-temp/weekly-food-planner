'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { IngredientPicker } from '@/components/forms/ingredient-picker'
import {
  addItemSchema,
  type AddItemFormValues,
  UNIT_VALUES,
  INVENTORY_SOURCE_VALUES,
} from './add-item.schema'

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Pantry (manual)',
  purchase: 'From menu',
  leftover: 'Leftover',
}

const UNIT_LABELS: Record<string, string> = {
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'L',
  tsp: 'tsp',
  tbsp: 'tbsp',
  cup: 'cup',
  piece: 'piece',
  slice: 'slice',
  pinch: 'pinch',
  clove: 'clove',
  can: 'can',
  pack: 'pack',
}

type AddItemSheetProps = {
  onAdd: ({ values }: { values: AddItemFormValues }) => void
  isPending?: boolean
}

const DEFAULT_VALUES: AddItemFormValues = {
  ingredient_id: '',
  quantity: '',
  unit: 'piece',
  expiration_date: '',
  source: 'manual',
  label: '',
}

export const AddItemSheet = ({ onAdd, isPending }: AddItemSheetProps) => {
  const [open, setOpen] = useState(false)

  const form = useForm<AddItemFormValues>({
    resolver: zodResolver(addItemSchema),
    defaultValues: DEFAULT_VALUES,
  })

  const handleSubmit: SubmitHandler<AddItemFormValues> = (values) => {
    onAdd({ values })
    form.reset(DEFAULT_VALUES)
    setOpen(false)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) form.reset(DEFAULT_VALUES)
    setOpen(next)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" aria-hidden />
          Add item
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="pb-4">
          <SheetTitle>Add inventory item</SheetTitle>
          <SheetDescription>
            Add an ingredient to your pantry. It will appear in your inventory immediately.
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex flex-1 flex-col gap-0"
          >
            <div className="flex flex-1 flex-col gap-5 overflow-y-auto py-2">
              {/* Ingredient picker — real ingredient catalog, not free text */}
              <FormField
                control={form.control}
                name="ingredient_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Ingredient{' '}
                      <span aria-hidden className="text-destructive">
                        *
                      </span>
                    </FormLabel>
                    <FormControl>
                      <IngredientPicker
                        value={field.value || null}
                        onChange={(id) => field.onChange(id)}
                        placeholder="Search ingredients…"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Quantity + unit side-by-side */}
              <div className="flex gap-3">
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>
                        Quantity{' '}
                        <span aria-hidden className="text-destructive">
                          *
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0.01"
                          step="any"
                          placeholder="e.g. 4"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem className="w-32">
                      <FormLabel>Unit</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {UNIT_VALUES.map((u) => (
                            <SelectItem key={u} value={u}>
                              {UNIT_LABELS[u] ?? u}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Expiration date (optional) */}
              <FormField
                control={form.control}
                name="expiration_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiration date (optional)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Source — default Pantry/manual; "purchase" reserved for menu-linked items */}
              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {INVENTORY_SOURCE_VALUES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {SOURCE_LABELS[s] ?? s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Optional note / label */}
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note (optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. From farmer's market"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <SheetFooter className="flex-row gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={isPending}>
                {isPending ? 'Adding…' : 'Add to inventory'}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
