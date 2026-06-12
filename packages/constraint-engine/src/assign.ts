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

// v2.1: a member's EFFECTIVE inclusive preferences = profile dietaryPreferences
// unioned with the per-generation options.additionalDietaryPreferences. These
// are SOFT — they only bias selection, never exclude. An empty set degrades the
// soft-bias to a no-op, preserving byte-identical pre-v2.1 behaviour.
type InclusivePrefs = { tags: ReadonlySet<string>; ingredients: ReadonlySet<string> }

const effectiveInclusivePrefs = ({
  member,
  options,
}: {
  member: MemberSnapshot
  options: GenerateMenuOptions | undefined
}): InclusivePrefs => ({
  tags: new Set([...member.dietaryPreferences.tags, ...(options?.additionalDietaryPreferences?.tags ?? [])]),
  ingredients: new Set([
    ...member.dietaryPreferences.ingredients,
    ...(options?.additionalDietaryPreferences?.ingredients ?? []),
  ]),
})

// A recipe is "preferred" when it matches ANY inclusive tag or ingredient.
const recipeMatchesPrefs = ({
  recipe,
  prefs,
}: {
  recipe: RecipeSnapshot
  prefs: InclusivePrefs
}): boolean => {
  if (prefs.tags.size > 0) {
    for (const tag of recipe.dietaryTags) {
      if (prefs.tags.has(tag)) return true
    }
  }
  if (prefs.ingredients.size > 0) {
    for (const ri of recipe.ingredients) {
      if (prefs.ingredients.has(ri.ingredientId)) return true
    }
  }
  return false
}

// MVP greedy: walk slots in deterministic order; for each slot, pick a
// (RNG-driven) candidate from those passing hard constraints. v2.1 adds the
// first real soft-constraint hook: among the hard-valid candidates we partition
// into "preferred" (matches an inclusive tag/ingredient) vs the rest, and the
// seeded RNG draws from "preferred" when non-empty, else from the full set.
//
// DETERMINISM / byte-identity guarantee: when the effective inclusive-pref set
// is empty (the pre-v2.1 / no-preferences path), the "preferred" partition is
// always empty, so pickFrom === the same id-sorted candidate list as before and
// rng.nextInt(pickFrom.length) consumes the RNG in the identical order. No
// snapshot churn on the no-op path.
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
  const prefsByMember = new Map(
    members.map((m) => [m.id, effectiveInclusivePrefs({ member: m, options })]),
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
          affectedMemberName: member.name,
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
          affectedMemberName: member.name,
          affectedMeal: { day: slot.dayOfWeek, mealKey: slot.mealKey },
          reasonCode: 'NO_CANDIDATES',
          humanMessage: `No valid ${slot.mealType} recipe found for ${member.name}.`,
        },
      }
    }
    const sorted = [...candidates].sort((a, b) => a.id.localeCompare(b.id))
    // Soft-bias partition (v2.1). Filtering the already-sorted list preserves
    // deterministic order within each partition. When prefs are empty, preferred
    // is empty and pickFrom === sorted — identical RNG draw as pre-v2.1.
    const prefs = prefsByMember.get(member.id) ?? { tags: new Set<string>(), ingredients: new Set<string>() }
    const preferred = sorted.filter((recipe) => recipeMatchesPrefs({ recipe, prefs }))
    const pickFrom = preferred.length > 0 ? preferred : sorted
    const pickedIndex = rng.nextInt(pickFrom.length)
    const picked = pickFrom[pickedIndex]
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
