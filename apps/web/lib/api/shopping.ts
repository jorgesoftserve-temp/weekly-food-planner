import { z } from 'zod'

// (v2.0 Phase 2) Zod schemas for the shopping-session route handlers.
// See PRODUCT_PRD §13, DATABASE_PRD §6.19/§6.20.

export const ACQUIRED_STATUS_VALUES = [
  'pending',
  'acquired',
  'partial',
  'skipped',
] as const

export const updateShoppingItemBodySchema = z
  .object({
    acquired_quantity: z
      .number()
      .min(0, 'acquired_quantity must be >= 0')
      .optional(),
    status: z.enum(ACQUIRED_STATUS_VALUES).optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, {
    message: 'at least one field is required',
  })

export type UpdateShoppingItemBody = z.infer<typeof updateShoppingItemBodySchema>

// Matches the `formatZodError` pattern used throughout the rest of lib/api.
export const formatZodError = (error: z.ZodError): string =>
  error.issues
    .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
    .join('; ')
