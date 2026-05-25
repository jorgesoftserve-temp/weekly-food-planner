import type { IngredientSnapshot } from '../types.js'

export const makeIngredient = ({
  id = 'i-1',
  name = 'Ingredient',
  isPerishable = false,
  maxStorageDays = null,
  requiresFresh = false,
  sameDayCook = false,
  allergens = [],
}: Partial<IngredientSnapshot> = {}): IngredientSnapshot => ({
  id,
  name,
  isPerishable,
  maxStorageDays,
  requiresFresh,
  sameDayCook,
  allergens,
})
