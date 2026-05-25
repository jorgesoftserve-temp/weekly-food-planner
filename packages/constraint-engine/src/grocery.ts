import type {
  GroceryItemSnapshot,
  GroceryLists,
  RecipeSnapshot,
  Unit,
} from './types.js'
import type { SlotAssignment } from './assign.js'

const buildItemKey = ({
  ingredientId,
  unit,
}: {
  ingredientId: string
  unit: Unit
}): string => `${ingredientId}|${unit}`

// MVP simplification: every grocery item lands on the shared list. A future
// iteration can split per-member items when the engine assigns a different
// recipe to a member because of constraint divergence (PRODUCT_PRD §7).
export const aggregateGroceryLists = ({
  assignments,
  recipes,
}: {
  assignments: SlotAssignment[]
  recipes: RecipeSnapshot[]
}): GroceryLists => {
  const recipesById = new Map(recipes.map((r) => [r.id, r]))
  const items = new Map<string, GroceryItemSnapshot>()
  for (const a of assignments) {
    const recipe = recipesById.get(a.recipeId)
    if (!recipe) continue
    for (const ri of recipe.ingredients) {
      const key = buildItemKey({ ingredientId: ri.ingredientId, unit: ri.unit })
      const existing = items.get(key)
      if (existing) {
        items.set(key, { ...existing, quantity: existing.quantity + ri.quantity })
      } else {
        items.set(key, {
          ingredientId: ri.ingredientId,
          quantity: ri.quantity,
          unit: ri.unit,
          scheduledPurchaseDay: null,
        })
      }
    }
  }
  return {
    shared: { targetMemberId: null, items: Array.from(items.values()) },
    perMember: {},
  }
}
