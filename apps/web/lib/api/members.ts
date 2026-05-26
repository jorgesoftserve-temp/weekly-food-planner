import { z } from 'zod'

const AGE_CATEGORIES = [
  'infant',
  'toddler',
  'child',
  'teen',
  'adult',
  'senior',
] as const

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const

// `creator` is intentionally omitted — the signup trigger owns it; the API
// must reject any attempt to set it via create/update.
const ASSIGNABLE_ROLES = ['admin', 'member'] as const

const mealFrequencyEntrySchema = z.object({
  key: z.string().trim().min(1),
  title: z.string().trim().min(1),
  mealType: z.enum(MEAL_TYPES),
  defaultHour: z.number().int().min(0).max(23),
})

const mealFrequencySchema = z
  .array(mealFrequencyEntrySchema)
  .refine(
    (entries) => new Set(entries.map((e) => e.key)).size === entries.length,
    { message: 'meal_frequency entries must have unique keys' },
  )

const dailyCalorieTargetSchema = z
  .number()
  .int()
  .positive()
  .nullable()
  .optional()

export const createMemberBodySchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  role: z.enum(ASSIGNABLE_ROLES),
  age_category: z.enum(AGE_CATEGORIES),
  daily_calorie_target: dailyCalorieTargetSchema,
  meal_frequency: mealFrequencySchema.nullable().optional(),
  user_id: z.string().uuid().nullable().optional(),
  dietary_restrictions: z.array(z.string().trim().min(1)).optional(),
  allergies: z.array(z.string().trim().min(1)).optional(),
  ingredient_dislikes: z.array(z.string().uuid()).optional(),
})

export const updateMemberBodySchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    role: z.enum(ASSIGNABLE_ROLES).optional(),
    age_category: z.enum(AGE_CATEGORIES).optional(),
    daily_calorie_target: dailyCalorieTargetSchema,
    meal_frequency: mealFrequencySchema.nullable().optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, {
    message: 'at least one field is required',
  })

export const valuesBodySchema = z.object({
  values: z.array(z.string().trim().min(1)),
})

export const ingredientIdsBodySchema = z.object({
  ingredient_ids: z.array(z.string().uuid()),
})

export type CreateMemberBody = z.infer<typeof createMemberBodySchema>
export type UpdateMemberBody = z.infer<typeof updateMemberBodySchema>

// Pretty single-line error message for badRequest() detail. Keeps the API
// response shape consistent with how the rest of the routes report 400s.
export const formatZodError = (error: z.ZodError): string =>
  error.issues
    .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
    .join('; ')
