import type {
  GenerateMenuOptions,
  IngredientSnapshot,
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
