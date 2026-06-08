import { z } from 'zod'

// Zod input schemas for the menu MCP tools.
//
// We validate top-level structure at the MCP boundary so obvious malformed
// inputs (string instead of object, missing required fields) are caught early
// with structured error messages. We do NOT replicate the engine's deep
// snapshot types here — that would invite drift between the zod schema and
// the engine's TS types. The engine + its static types are the deep contract;
// the zod schema is a polite gate.
//
// `.passthrough()` lets the engine evolve its input shape (add an optional
// field) without breaking older MCP callers.

// Permissive top-level shape for GenerateMenuInput. Snapshot internals are
// validated by the engine, not here.
export const engineInputSchema = z
  .object({
    workspace: z.object({}).passthrough(),
    members: z.array(z.object({}).passthrough()),
    recipes: z.array(z.object({}).passthrough()),
    ingredients: z.array(z.object({}).passthrough()),
    weekStartDate: z.string(),
    seed: z.number().int(),
    durationDays: z.number().int().min(1).max(7).optional(),
    options: z.object({}).passthrough().optional(),
    now: z.string().optional(),
  })
  .passthrough()

// Raw shape (record of zod schemas) for `McpServer.registerTool({ inputSchema })`.
// The SDK wraps these into a `z.object(...)` internally; passing a raw object
// rather than a built schema is what the SDK signature requires.

export const engineGenerateMenuInputShape = {
  input: engineInputSchema,
  // Optional override — when supplied, replaces `input.seed` for this call.
  // Lets agents do "regenerate with a different seed" without rebuilding the
  // entire input.
  seed: z.number().int().optional(),
}

export const engineComputeInputsHashInputShape = {
  input: engineInputSchema,
}

export const engineValidateInputInputShape = {
  input: engineInputSchema,
}

// ---- Workspace tools (HTTP-backed) -------------------------------------

// Raw overlay matches apps/web/lib/api/menu-overlay.ts RawOverlay. We forward
// the payload unchanged to /menus/preview, which dedupes before calling the
// engine — so the schema here is permissive on values, strict on shape.
export const rawOverlaySchema = z
  .object({
    calorieTolerance: z.number().optional(),
    repetitionLimit: z.number().int().optional(),
    preferredCuisines: z.array(z.string()).optional(),
    ingredientExclusions: z.array(z.string()).optional(),
    additionalDietaryRestrictions: z.array(z.string()).optional(),
    additionalAllergies: z.array(z.string()).optional(),
    memberFrequencyOverrides: z
      .array(
        z.object({
          memberId: z.string(),
          mealFrequency: z.array(z.object({}).passthrough()),
        }),
      )
      .optional(),
  })
  .passthrough()

const workspaceIdShape = {
  workspaceId: z
    .string()
    .uuid()
    .describe('UUID of the workspace to inspect or generate against.'),
}

export const workspacePreviewMenuInputShape = {
  ...workspaceIdShape,
  weekStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe('ISO YYYY-MM-DD week-start date for the menu.'),
  seed: z.number().int().optional(),
  durationDays: z.number().int().min(1).max(7).optional(),
  options: rawOverlaySchema.optional(),
  participantMemberIds: z.array(z.string().uuid()).optional(),
}

export const workspaceMemberConstraintsInputShape = {
  ...workspaceIdShape,
  memberId: z.string().uuid(),
}

const mealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack'])

export const workspaceRecipeUsabilityInputShape = {
  ...workspaceIdShape,
  recipeId: z.string().uuid(),
  memberId: z.string().uuid(),
  mealType: mealTypeSchema
    .optional()
    .describe(
      'When provided, the eligibility check also reports a meal_type_mismatch blocker if the recipe\'s meal_type does not match.',
    ),
}

export const workspaceRecentMenusInputShape = {
  ...workspaceIdShape,
  limit: z.number().int().min(1).max(100).optional(),
}
