import type {
  MealType,
  RecipeIngredientSnapshot,
  RecipeSnapshot,
} from '../types.js'

// v2.1: recipes carry a SET of meal timeframes (mealTypes). For test ergonomics
// the factory still accepts a scalar `mealType` convenience which is wrapped into
// a one-element `mealTypes` array — proving the backfill is a no-op. Passing
// `mealTypes` directly takes precedence.
export const makeRecipe = ({
  id = 'r-1',
  name,
  mealType,
  mealTypes,
  difficulty = 'easy',
  servings = 2,
  ingredients = [],
  dietaryTags = [],
  ...rest
}: Partial<Omit<RecipeSnapshot, 'mealTypes'>> & {
  mealType?: MealType
  mealTypes?: MealType[]
} = {}): RecipeSnapshot => ({
  id,
  name: name ?? `Recipe ${id}`,
  mealTypes: mealTypes ?? [mealType ?? 'dinner'],
  difficulty,
  servings,
  ingredients,
  dietaryTags,
  ...rest,
})

export const makeRecipeIngredient = ({
  ingredientId = 'i-1',
  quantity = 1,
  unit = 'cup',
  substitutions = [],
  isPerishableOverride = null,
}: Partial<RecipeIngredientSnapshot> = {}): RecipeIngredientSnapshot => ({
  ingredientId,
  quantity,
  unit,
  substitutions,
  isPerishableOverride,
})
