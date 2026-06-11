import { z } from 'zod'

export const UNIT_VALUES = [
  'g',
  'kg',
  'ml',
  'l',
  'tsp',
  'tbsp',
  'cup',
  'piece',
  'slice',
  'pinch',
  'clove',
  'can',
  'pack',
] as const

export const INVENTORY_SOURCE_VALUES = [
  'manual',
  'purchase',
  'leftover',
] as const

// Quantity is kept as a string in form state so numeric inputs stay uncontrolled-friendly.
// The mutation caller converts it to a number using parseQuantity().
export const addItemSchema = z.object({
  ingredient_id: z.string().min(1, 'Select an ingredient'),
  quantity: z
    .string()
    .min(1, 'Quantity is required')
    .refine(
      (v) => !Number.isNaN(Number(v)) && Number(v) > 0,
      { message: 'Enter a valid positive quantity' },
    ),
  unit: z.enum(UNIT_VALUES),
  expiration_date: z.string().optional(),
  // No .default() — set the default in form defaultValues instead so the
  // inferred type matches what react-hook-form expects.
  source: z.enum(INVENTORY_SOURCE_VALUES),
  label: z.string().optional(),
})

export type AddItemFormValues = z.infer<typeof addItemSchema>

/** Convert the string quantity field to a number for persistence. */
export const parseQuantity = (v: string): number => Number(v)
