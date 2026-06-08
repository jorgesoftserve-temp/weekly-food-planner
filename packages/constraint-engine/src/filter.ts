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

const recipeViolatesAllergies = ({
  recipe,
  ctx,
}: {
  recipe: RecipeSnapshot
  ctx: FilterContext
}): boolean => {
  const memberAllergies = new Set([
    ...ctx.member.allergies,
    ...(ctx.options?.additionalAllergies ?? []),
  ])
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
  const requiredTags = new Set([
    ...ctx.member.dietaryRestrictions,
    ...(ctx.options?.additionalDietaryRestrictions ?? []),
  ])
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
  if (recipe.mealType !== slot.mealType) return false
  if (recipeMissesDietaryTag({ recipe, ctx })) return false
  if (recipeHasExcludedIngredient({ recipe, ctx })) return false
  if (recipeViolatesAllergies({ recipe, ctx })) return false
  return true
}

export type EligibilityBlocker =
  | { kind: 'meal_type_mismatch'; expected: MealType; actual: MealType }
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

  // Meal-type check — only when forMealType is explicitly provided
  if (forMealType !== undefined && recipe.mealType !== forMealType) {
    blockedBy.push({ kind: 'meal_type_mismatch', expected: forMealType, actual: recipe.mealType })
  }

  // Dietary-tag check — collect every missing tag (do not short-circuit)
  const requiredTags = [
    ...ctx.member.dietaryRestrictions,
    ...(ctx.options?.additionalDietaryRestrictions ?? []),
  ]
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

  // Allergen check — every ingredient × every allergen; multiple triggers each get their own entry
  const memberAllergies = new Set([
    ...ctx.member.allergies,
    ...(ctx.options?.additionalAllergies ?? []),
  ])
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
