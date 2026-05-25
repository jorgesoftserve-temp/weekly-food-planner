import type {
  RecipeIngredientSnapshot,
  RecipeSnapshot,
} from '../types.js'

export const makeRecipe = ({
  id = 'r-1',
  name,
  mealType = 'dinner',
  difficulty = 'easy',
  servings = 2,
  ingredients = [],
  dietaryTags = [],
  ...rest
}: Partial<RecipeSnapshot> = {}): RecipeSnapshot => ({
  id,
  name: name ?? `Recipe ${id}`,
  mealType,
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
