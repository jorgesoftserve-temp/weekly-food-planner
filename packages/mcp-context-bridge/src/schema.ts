// Context schema (executable) + canonical serialisation, hashing, round-trip.
//
// This is the runtime counterpart of docs/context-schema.md. `contextEnvelopeSchema`
// validates the shape; `canonicalJson` + `hashContext` give a stable content
// address for a context so two byte-identical contexts hash identically and the
// round-trip is provably lossless.

import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { ContextEnvelope } from './types.js'

const mealType = z.enum(['breakfast', 'lunch', 'dinner', 'snack'])
const unit = z.enum([
  'g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'piece', 'slice', 'pinch', 'clove', 'can', 'pack',
])
const ageCategory = z.enum(['infant', 'toddler', 'child', 'teen', 'adult', 'senior'])
const difficulty = z.enum(['easy', 'medium', 'hard'])
const workspaceRole = z.enum(['creator', 'admin', 'member'])
const workspaceType = z.enum(['individual', 'group'])

const mealFrequencyEntry = z.object({
  key: z.string(),
  title: z.string(),
  mealType,
  defaultHour: z.number(),
})

const workspaceSnapshot = z.object({
  id: z.string(),
  type: workspaceType,
  name: z.string(),
  sharedMealFrequency: z.array(mealFrequencyEntry).optional(),
})

const memberSnapshot = z.object({
  id: z.string(),
  name: z.string(),
  role: workspaceRole,
  ageCategory,
  dailyCalorieTarget: z.number().optional(),
  mealFrequency: z.array(mealFrequencyEntry).optional(),
  dietaryRestrictions: z.array(z.string()),
  allergies: z.array(z.string()),
  ingredientDislikes: z.array(z.string()),
})

const recipeIngredientSnapshot = z.object({
  ingredientId: z.string(),
  quantity: z.number(),
  unit,
  substitutions: z.array(z.object({ ingredientId: z.string(), note: z.string().optional() })),
  isPerishableOverride: z.boolean().nullable(),
})

const ingredientSnapshot = z.object({
  id: z.string(),
  name: z.string(),
  isPerishable: z.boolean(),
  maxStorageDays: z.number().nullable(),
  requiresFresh: z.boolean(),
  sameDayCook: z.boolean(),
  allergens: z.array(z.string()),
})

const recipeSnapshot = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  mealType,
  cuisine: z.string().optional(),
  difficulty,
  prepTimeMinutes: z.number().optional(),
  cookTimeMinutes: z.number().optional(),
  servings: z.number(),
  caloriesPerServing: z.number().optional(),
  ingredients: z.array(recipeIngredientSnapshot),
  dietaryTags: z.array(z.string()),
})

const generateMenuOptions = z.object({
  calorieTolerance: z.number().optional(),
  repetitionLimit: z.number().optional(),
  preferredCuisines: z.array(z.string()).optional(),
  ingredientExclusions: z.array(z.string()).optional(),
  additionalDietaryRestrictions: z.array(z.string()).optional(),
  additionalAllergies: z.array(z.string()).optional(),
  memberFrequencyOverrides: z
    .array(z.object({ memberId: z.string(), mealFrequency: z.array(mealFrequencyEntry) }))
    .optional(),
})

const generateMenuInput = z.object({
  workspace: workspaceSnapshot,
  members: z.array(memberSnapshot),
  recipes: z.array(recipeSnapshot),
  ingredients: z.array(ingredientSnapshot),
  weekStartDate: z.string(),
  seed: z.number(),
  options: generateMenuOptions.optional(),
  durationDays: z.number().optional(),
  now: z.string().optional(),
})

export const contextEnvelopeSchema = z.object({
  kind: z.literal('menu-generation'),
  intent: z.string().min(1),
  payload: generateMenuInput,
  meta: z.object({ createdBy: z.string(), note: z.string().optional() }),
})

// Recursively sort object keys so the serialisation is stable regardless of
// key insertion order. Arrays keep their order (order is semantic for slots).
const sortValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortValue)
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(source).sort()) {
      out[key] = sortValue(source[key])
    }
    return out
  }
  return value
}

export const canonicalJson = (value: unknown): string => JSON.stringify(sortValue(value))

export const sha256Hex = (input: string): string =>
  createHash('sha256').update(input).digest('hex')

// Content address of a context envelope — stable across key ordering.
export const hashContext = (envelope: ContextEnvelope): string =>
  sha256Hex(canonicalJson(envelope))

// The JSON round-trip the boundary promises. Used to take defensive copies and
// to prove (in tests) that serialisation is lossless.
export const roundTrip = <T>(value: T): T =>
  JSON.parse(JSON.stringify(value)) as T
