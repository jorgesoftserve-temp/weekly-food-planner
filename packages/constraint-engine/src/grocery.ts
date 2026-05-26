import type {
  GroceryItemSnapshot,
  GroceryListSnapshot,
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

// Add `delta` to the bucket entry for (ingredientId, unit), creating it if
// missing. Centralised so `shared` + per-member maps share the same insert
// semantics, including the initial NULL scheduledPurchaseDay default (engine
// doesn't compute freshness; the server recompute does on acceptance).
const addToBucket = ({
  bucket,
  ingredientId,
  unit,
  delta,
}: {
  bucket: Map<string, GroceryItemSnapshot>
  ingredientId: string
  unit: Unit
  delta: number
}): void => {
  const key = buildItemKey({ ingredientId, unit })
  const existing = bucket.get(key)
  if (existing) {
    bucket.set(key, { ...existing, quantity: existing.quantity + delta })
    return
  }
  bucket.set(key, {
    ingredientId,
    quantity: delta,
    unit,
    scheduledPurchaseDay: null,
  })
}

// Aggregate grocery items from a set of assignments into shared + per-member
// buckets, applying the cook-once servings scaling rule (PRODUCT_PRD §7):
//
//   contribution_per_slot = recipe_ingredient.quantity / recipe.servings
//
// The engine emits per-member slots only (every SlotSpec.targetMemberId is
// set), so each slot represents a single eater. Summing over slots gives:
//   - shared bucket: total household need (sum over every slot)
//   - per-member bucket: that member's individual allocation
//
// recipe.servings is validated > 0 at the DB layer (CHECK constraint) but
// we guard against 0/missing here too — falling back to 1 yields raw
// quantities, which is the right "do no harm" behaviour for bad data.
export const aggregateGroceryLists = ({
  assignments,
  recipes,
}: {
  assignments: SlotAssignment[]
  recipes: RecipeSnapshot[]
}): GroceryLists => {
  const recipesById = new Map(recipes.map((r) => [r.id, r]))
  const sharedBucket = new Map<string, GroceryItemSnapshot>()
  const memberBuckets = new Map<string, Map<string, GroceryItemSnapshot>>()
  for (const a of assignments) {
    const recipe = recipesById.get(a.recipeId)
    if (!recipe) continue
    const servings = recipe.servings > 0 ? recipe.servings : 1
    const memberId = a.slot.targetMemberId
    let memberBucket = memberBuckets.get(memberId)
    if (!memberBucket) {
      memberBucket = new Map()
      memberBuckets.set(memberId, memberBucket)
    }
    for (const ri of recipe.ingredients) {
      const scaledQty = ri.quantity / servings
      addToBucket({
        bucket: sharedBucket,
        ingredientId: ri.ingredientId,
        unit: ri.unit,
        delta: scaledQty,
      })
      addToBucket({
        bucket: memberBucket,
        ingredientId: ri.ingredientId,
        unit: ri.unit,
        delta: scaledQty,
      })
    }
  }
  const perMember: Record<string, GroceryListSnapshot> = {}
  for (const [memberId, bucket] of memberBuckets) {
    perMember[memberId] = {
      targetMemberId: memberId,
      items: Array.from(bucket.values()),
    }
  }
  return {
    shared: { targetMemberId: null, items: Array.from(sharedBucket.values()) },
    perMember,
  }
}
