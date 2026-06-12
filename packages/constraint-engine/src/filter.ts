import type {
  GenerateMenuOptions,
  IngredientSnapshot,
  MealType,
  MemberSnapshot,
  RecipeSnapshot,
} from './types.js'
import type { SlotSpec } from './slots.js'

export type FilterContext = {
  member: MemberSnapshot
  options: GenerateMenuOptions | undefined
  ingredientAllergensById: Map<string, ReadonlySet<string>>
}

const buildAllergenMap = ({
  ingredients,
}: {
  ingredients: IngredientSnapshot[]
}): Map<string, ReadonlySet<string>> => {
  const map = new Map<string, ReadonlySet<string>>()
  for (const ingredient of ingredients) {
    map.set(ingredient.id, new Set(ingredient.allergens))
  }
  return map
}

// v2.1: build the member's EFFECTIVE hard allergen set — profile + overlay
// additions, minus any per-generation relaxed values. Subtraction happens last
// so a relaxed value lifts the restriction even if it was also added via overlay.
const effectiveAllergies = (ctx: FilterContext): Set<string> => {
  const set = new Set([...ctx.member.allergies, ...(ctx.options?.additionalAllergies ?? [])])
  for (const relaxed of ctx.options?.relaxedAllergies ?? []) set.delete(relaxed)
  return set
}

// v2.1: build the member's EFFECTIVE hard dietary-restriction set — profile +
// overlay additions, minus any per-generation relaxed values.
const effectiveDietaryRestrictions = (ctx: FilterContext): Set<string> => {
  const set = new Set([
    ...ctx.member.dietaryRestrictions,
    ...(ctx.options?.additionalDietaryRestrictions ?? []),
  ])
  for (const relaxed of ctx.options?.relaxedDietaryRestrictions ?? []) set.delete(relaxed)
  return set
}

const recipeViolatesAllergies = ({
  recipe,
  ctx,
}: {
  recipe: RecipeSnapshot
  ctx: FilterContext
}): boolean => {
  const memberAllergies = effectiveAllergies(ctx)
  if (memberAllergies.size === 0) return false
  for (const ri of recipe.ingredients) {
    const allergens = ctx.ingredientAllergensById.get(ri.ingredientId) ?? new Set<string>()
    for (const allergen of allergens) {
      if (memberAllergies.has(allergen)) return true
    }
  }
  return false
}

const recipeMissesDietaryTag = ({
  recipe,
  ctx,
}: {
  recipe: RecipeSnapshot
  ctx: FilterContext
}): boolean => {
  const requiredTags = effectiveDietaryRestrictions(ctx)
  if (requiredTags.size === 0) return false
  const recipeTags = new Set(recipe.dietaryTags)
  for (const tag of requiredTags) {
    if (!recipeTags.has(tag)) return true
  }
  return false
}

const recipeHasExcludedIngredient = ({
  recipe,
  ctx,
}: {
  recipe: RecipeSnapshot
  ctx: FilterContext
}): boolean => {
  const exclusions = new Set(ctx.options?.ingredientExclusions ?? [])
  if (exclusions.size === 0) return false
  for (const ri of recipe.ingredients) {
    if (exclusions.has(ri.ingredientId)) return true
  }
  return false
}

export const createFilterContext = ({
  member,
  options,
  ingredients,
}: {
  member: MemberSnapshot
  options: GenerateMenuOptions | undefined
  ingredients: IngredientSnapshot[]
}): FilterContext => ({
  member,
  options,
  ingredientAllergensById: buildAllergenMap({ ingredients }),
})

export const isRecipeValidForSlot = ({
  recipe,
  slot,
  ctx,
}: {
  recipe: RecipeSnapshot
  slot: SlotSpec
  ctx: FilterContext
}): boolean => {
  if (!recipe.mealTypes.includes(slot.mealType)) return false
  if (recipeMissesDietaryTag({ recipe, ctx })) return false
  if (recipeHasExcludedIngredient({ recipe, ctx })) return false
  if (recipeViolatesAllergies({ recipe, ctx })) return false
  return true
}

export type EligibilityBlocker =
  // v2.1: `actual` is now the recipe's full eligible meal-type SET; the slot's
  // `expected` meal type was not a member of it.
  | { kind: 'meal_type_mismatch'; expected: MealType; actual: MealType[] }
  | { kind: 'missing_dietary_tag'; tag: string }
  | { kind: 'excluded_ingredient'; ingredientId: string }
  | { kind: 'allergen_present'; allergen: string; viaIngredientId: string }

export type RecipeEligibilityResult = {
  eligible: boolean
  blockedBy: EligibilityBlocker[]
}

export const describeRecipeEligibility = ({
  recipe,
  ctx,
  forMealType,
}: {
  recipe: RecipeSnapshot
  ctx: FilterContext
  forMealType?: MealType
}): RecipeEligibilityResult => {
  const blockedBy: EligibilityBlocker[] = []

  // Meal-type check — only when forMealType is explicitly provided.
  // v2.1: set membership instead of scalar equality.
  if (forMealType !== undefined && !recipe.mealTypes.includes(forMealType)) {
    blockedBy.push({ kind: 'meal_type_mismatch', expected: forMealType, actual: recipe.mealTypes })
  }

  // Dietary-tag check — collect every missing tag (do not short-circuit).
  // v2.1: honour relaxedDietaryRestrictions (subtract from the effective set).
  const requiredTags = [...effectiveDietaryRestrictions(ctx)]
  if (requiredTags.length > 0) {
    const recipeTags = new Set(recipe.dietaryTags)
    for (const tag of requiredTags) {
      if (!recipeTags.has(tag)) {
        blockedBy.push({ kind: 'missing_dietary_tag', tag })
      }
    }
  }

  // Excluded-ingredient check — dedup by ingredientId
  const exclusions = new Set(ctx.options?.ingredientExclusions ?? [])
  if (exclusions.size > 0) {
    const seenExcluded = new Set<string>()
    for (const ri of recipe.ingredients) {
      if (exclusions.has(ri.ingredientId) && !seenExcluded.has(ri.ingredientId)) {
        seenExcluded.add(ri.ingredientId)
        blockedBy.push({ kind: 'excluded_ingredient', ingredientId: ri.ingredientId })
      }
    }
  }

  // Allergen check — every ingredient × every allergen; multiple triggers each get their own entry.
  // v2.1: honour relaxedAllergies (subtract from the effective set).
  const memberAllergies = effectiveAllergies(ctx)
  if (memberAllergies.size > 0) {
    for (const ri of recipe.ingredients) {
      const allergens = ctx.ingredientAllergensById.get(ri.ingredientId) ?? new Set<string>()
      for (const allergen of allergens) {
        if (memberAllergies.has(allergen)) {
          blockedBy.push({ kind: 'allergen_present', allergen, viaIngredientId: ri.ingredientId })
        }
      }
    }
  }

  return { eligible: blockedBy.length === 0, blockedBy }
}
