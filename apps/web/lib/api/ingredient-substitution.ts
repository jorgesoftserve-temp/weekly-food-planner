import {
  createFilterContext,
  describeRecipeEligibility,
  type IngredientSnapshot,
  type MemberSnapshot,
  type RecipeSnapshot,
} from '@weekly-food-planner/constraint-engine'

// (v2.0 Phase 6) Route-layer validation for a menu-level ingredient substitution.
// A substitute is rejected when it introduces an allergen the slot's eater(s)
// react to, or an ingredient excluded by the per-menu overlay. This REUSES the
// engine's pure eligibility logic at the route layer (describeRecipeEligibility)
// — it does NOT edit the engine, and substitutions never reach the engine or
// accepted_seed. PRODUCT_PRD §20, ARCHITECTURE_PRD §19.

export type SubstituteOverlay = {
  ingredientExclusions?: string[]
  additionalDietaryRestrictions?: string[]
  additionalAllergies?: string[]
}

export type SubstituteBlocker =
  | { kind: 'allergen_present'; allergen: string; memberName: string }
  | { kind: 'excluded_ingredient'; ingredientId: string; memberName: string }

export type SubstituteValidationResult =
  | { ok: true }
  | { ok: false; blockers: SubstituteBlocker[] }

// Validate one substitute ingredient against every eater of the slot. We build a
// synthetic recipe whose only ingredient is the substitute, pre-satisfying the
// member's dietary tags (an ingredient swap can't change recipe-level tags) and
// omitting the meal-type check — so the only blockers that can fire are
// allergen_present and excluded_ingredient, exactly what a substitution risks.
export const validateSubstituteForSlot = ({
  substituteIngredientId,
  eaters,
  ingredients,
  overlay,
}: {
  substituteIngredientId: string
  eaters: MemberSnapshot[]
  ingredients: IngredientSnapshot[]
  overlay: SubstituteOverlay | undefined
}): SubstituteValidationResult => {
  const blockers: SubstituteBlocker[] = []

  for (const member of eaters) {
    const requiredTags = [
      ...member.dietaryRestrictions,
      ...(overlay?.additionalDietaryRestrictions ?? []),
    ]
    const syntheticRecipe: RecipeSnapshot = {
      id: 'substitute-probe',
      name: 'substitute-probe',
      mealType: 'dinner',
      difficulty: 'easy',
      servings: 1,
      dietaryTags: requiredTags,
      ingredients: [
        {
          ingredientId: substituteIngredientId,
          quantity: 1,
          unit: 'piece',
          substitutions: [],
          isPerishableOverride: null,
        },
      ],
    }
    const ctx = createFilterContext({ member, options: overlay, ingredients })
    // No forMealType → the meal-type check is skipped.
    const result = describeRecipeEligibility({ recipe: syntheticRecipe, ctx })
    for (const blocked of result.blockedBy) {
      if (blocked.kind === 'allergen_present') {
        blockers.push({
          kind: 'allergen_present',
          allergen: blocked.allergen,
          memberName: member.name,
        })
      } else if (blocked.kind === 'excluded_ingredient') {
        blockers.push({
          kind: 'excluded_ingredient',
          ingredientId: blocked.ingredientId,
          memberName: member.name,
        })
      }
    }
  }

  return blockers.length > 0 ? { ok: false, blockers } : { ok: true }
}

// Human-readable summary for the 422 response detail.
export const describeBlockers = (blockers: SubstituteBlocker[]): string =>
  blockers
    .map((b) =>
      b.kind === 'allergen_present'
        ? `introduces ${b.allergen} (allergen for ${b.memberName})`
        : `is excluded for ${b.memberName}`,
    )
    .join('; ')
