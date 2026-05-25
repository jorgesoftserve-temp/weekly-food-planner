import type {
  GenerateMenuInput,
  GenerateMenuResult,
  GeneratedSlot,
} from './types.js'
import { buildSlots } from './slots.js'
import { assignGreedy } from './assign.js'
import { aggregateGroceryLists } from './grocery.js'
import { createRng } from './random.js'
import { sha256OfInput } from './hash.js'

export const generateMenu = async (
  input: GenerateMenuInput,
): Promise<GenerateMenuResult> => {
  const slots = buildSlots({ input })

  if (slots.length === 0) {
    return {
      ok: false,
      error: {
        failedConstraint: 'internal_error',
        scope: 'input',
        reasonCode: 'NO_SLOTS',
        humanMessage:
          'No meal slots could be derived. Configure a meal_frequency on the workspace or its members.',
      },
    }
  }

  const rng = createRng({ seed: input.seed })

  const assignmentResult = assignGreedy({
    slots,
    recipes: input.recipes,
    members: input.members,
    ingredients: input.ingredients,
    options: input.options,
    rng,
  })

  if (!assignmentResult.ok) {
    return { ok: false, error: assignmentResult.error }
  }

  const generatedSlots: GeneratedSlot[] = assignmentResult.assignments.map((a) => ({
    dayOfWeek: a.slot.dayOfWeek,
    mealKey: a.slot.mealKey,
    mealType: a.slot.mealType,
    recipeId: a.recipeId,
    targetMemberId: a.slot.targetMemberId,
  }))

  const groceryLists = aggregateGroceryLists({
    assignments: assignmentResult.assignments,
    recipes: input.recipes,
  })

  const inputsHash = await sha256OfInput({ value: input })

  return {
    ok: true,
    inputsHash,
    menu: {
      weekStartDate: input.weekStartDate,
      seed: input.seed,
      slots: generatedSlots,
    },
    groceryLists,
  }
}
