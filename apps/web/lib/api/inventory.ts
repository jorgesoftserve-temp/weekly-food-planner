import { z } from 'zod'

// (v2.0 Phase 1) Zod schemas for the inventory route handlers.
// See PRODUCT_PRD §12, DATABASE_PRD §6.18.

const UNIT_VALUES = [
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

const INVENTORY_SOURCE_VALUES = [
  'manual',
  'purchase',
  'leftover',
  'cook_remainder',
] as const

// ISO date string (YYYY-MM-DD) or null.
const isoDateOrNull = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be an ISO date (YYYY-MM-DD)')
  .nullable()
  .optional()

export const createInventoryItemBodySchema = z.object({
  ingredient_id: z.string().uuid('ingredient_id must be a UUID'),
  source: z.enum(INVENTORY_SOURCE_VALUES).optional(),
  quantity: z.number().min(0, 'quantity must be >= 0'),
  unit: z.enum(UNIT_VALUES),
  expiration_date: isoDateOrNull,
  source_menu_id: z.string().uuid().nullable().optional(),
  source_slot_id: z.string().uuid().nullable().optional(),
  label: z.string().min(1).max(255).nullable().optional(),
})

export const updateInventoryItemBodySchema = z
  .object({
    quantity: z.number().min(0, 'quantity must be >= 0').optional(),
    unit: z.enum(UNIT_VALUES).optional(),
    expiration_date: isoDateOrNull,
    label: z.string().min(1).max(255).nullable().optional(),
    is_consumed: z.boolean().optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, {
    message: 'at least one field is required',
  })

// (v2.0 Phase 5) Cook-time reconciliation → leftovers. `remainders` are raw
// ingredient leftovers (used < planned, → cook_remainder); `surplus` is
// prepared-dish leftover (→ leftover). Both default to empty so "Skip" sends
// nothing and creates no pantry rows.
const leftoverLineSchema = z.object({
  ingredient_id: z.string().uuid('ingredient_id must be a UUID'),
  quantity: z.number().positive('quantity must be > 0'),
  unit: z.enum(UNIT_VALUES),
})

export const cookLeftoversBodySchema = z
  .object({
    label: z.string().min(1).max(255).nullable().optional(),
    remainders: z.array(leftoverLineSchema).max(50).optional(),
    surplus: z.array(leftoverLineSchema).max(50).optional(),
  })
  .refine(
    (b) => (b.remainders?.length ?? 0) + (b.surplus?.length ?? 0) > 0,
    { message: 'at least one remainder or surplus line is required' },
  )

export type CreateInventoryItemBody = z.infer<typeof createInventoryItemBodySchema>
export type UpdateInventoryItemBody = z.infer<typeof updateInventoryItemBodySchema>
export type CookLeftoversBody = z.infer<typeof cookLeftoversBodySchema>

// Matches the `formatZodError` pattern used throughout the rest of lib/api.
export const formatZodError = (error: z.ZodError): string =>
  error.issues
    .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
    .join('; ')
