import type {
  GenerateMenuOptions,
  GenerationError,
  IngredientSnapshot,
  MemberSnapshot,
  RecipeSnapshot,
} from './types.js'
import type { SlotSpec } from './slots.js'
import { createFilterContext, isRecipeValidForSlot } from './filter.js'
import type { Rng } from './random.js'

export type SlotAssignment = {
  slot: SlotSpec
  recipeId: string
}

export type AssignmentResult =
  | { ok: true; assignments: SlotAssignment[] }
  | { ok: false; error: GenerationError }

// MVP greedy: walk slots in deterministic order; for each slot, pick a random
// (RNG-driven) candidate from those passing hard constraints. Soft-constraint
// scoring and local-search refinement are deferred — adding them is a swap of
// this function for one that consumes the same shape.
export const assignGreedy = ({
  slots,
  recipes,
  members,
  ingredients,
  options,
  rng,
}: {
  slots: SlotSpec[]
  recipes: RecipeSnapshot[]
  members: MemberSnapshot[]
  ingredients: IngredientSnapshot[]
  options: GenerateMenuOptions | undefined
  rng: Rng
}): AssignmentResult => {
  const membersById = new Map(members.map((m) => [m.id, m]))
  const filterContextsByMember = new Map(
    members.map((m) => [m.id, createFilterContext({ member: m, options, ingredients })]),
  )

  const assignments: SlotAssignment[] = []
  for (const slot of slots) {
    const member = membersById.get(slot.targetMemberId)
    if (!member) {
      return {
        ok: false,
        error: {
          failedConstraint: 'internal_error',
          scope: 'member',
          affectedMemberId: slot.targetMemberId,
          reasonCode: 'MEMBER_NOT_FOUND',
          humanMessage: `Slot references unknown member ${slot.targetMemberId}.`,
        },
      }
    }
    const ctx = filterContextsByMember.get(member.id)
    if (!ctx) {
      return {
        ok: false,
        error: {
          failedConstraint: 'internal_error',
          scope: 'member',
          affectedMemberId: member.id,
          reasonCode: 'FILTER_CONTEXT_MISSING',
          humanMessage: 'Filter context was not built for member.',
        },
      }
    }
    const candidates = recipes.filter((recipe) =>
      isRecipeValidForSlot({ recipe, slot, ctx }),
    )
    if (candidates.length === 0) {
      return {
        ok: false,
        error: {
          failedConstraint: 'no_valid_recipe',
          scope: 'member',
          affectedMemberId: member.id,
          affectedMeal: { day: slot.dayOfWeek, mealKey: slot.mealKey },
          reasonCode: 'NO_CANDIDATES',
          humanMessage: `No valid ${slot.mealType} recipe found for ${member.name}.`,
        },
      }
    }
    const sorted = [...candidates].sort((a, b) => a.id.localeCompare(b.id))
    const pickedIndex = rng.nextInt(sorted.length)
    const picked = sorted[pickedIndex]
    if (!picked) {
      return {
        ok: false,
        error: {
          failedConstraint: 'internal_error',
          scope: 'menu',
          reasonCode: 'RNG_OUT_OF_RANGE',
          humanMessage: 'Engine RNG returned an out-of-range index.',
        },
      }
    }
    assignments.push({ slot, recipeId: picked.id })
  }
  return { ok: true, assignments }
}
