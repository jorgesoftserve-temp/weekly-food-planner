import { describe, expect, it } from 'vitest'
import type {
  IngredientSnapshot,
  MemberSnapshot,
} from '@weekly-food-planner/constraint-engine'
import { validateSubstituteForSlot } from '../ingredient-substitution'

// (v2.0 Phase 6) Route-layer substitution validation — reuses the engine's
// eligibility logic to reject allergen-introducing / excluded substitutes.

const member = (over: Partial<MemberSnapshot> = {}): MemberSnapshot => ({
  id: 'm1',
  name: 'Alex',
  role: 'member',
  ageCategory: 'adult',
  dietaryRestrictions: [],
  allergies: [],
  ingredientDislikes: [],
  ...over,
})

const ingredient = (over: Partial<IngredientSnapshot> & { id: string }): IngredientSnapshot => ({
  name: over.id,
  isPerishable: false,
  maxStorageDays: null,
  requiresFresh: false,
  sameDayCook: false,
  allergens: [],
  ...over,
})

const ingredients: IngredientSnapshot[] = [
  ingredient({ id: 'peanut', allergens: ['peanut'] }),
  ingredient({ id: 'almond', allergens: ['tree_nut'] }),
  ingredient({ id: 'rice', allergens: [] }),
]

describe('validateSubstituteForSlot', () => {
  it('accepts a safe substitute', () => {
    const result = validateSubstituteForSlot({
      substituteIngredientId: 'rice',
      eaters: [member({ allergies: ['peanut'] })],
      ingredients,
      overlay: undefined,
    })
    expect(result.ok).toBe(true)
  })

  it("rejects a substitute that introduces the member's allergen", () => {
    const result = validateSubstituteForSlot({
      substituteIngredientId: 'peanut',
      eaters: [member({ allergies: ['peanut'] })],
      ingredients,
      overlay: undefined,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.blockers[0]).toMatchObject({
        kind: 'allergen_present',
        allergen: 'peanut',
        memberName: 'Alex',
      })
    }
  })

  it('respects an allergy added via the per-menu overlay', () => {
    const result = validateSubstituteForSlot({
      substituteIngredientId: 'almond',
      eaters: [member()],
      ingredients,
      overlay: { additionalAllergies: ['tree_nut'] },
    })
    expect(result.ok).toBe(false)
  })

  it('rejects a substitute excluded by the overlay', () => {
    const result = validateSubstituteForSlot({
      substituteIngredientId: 'rice',
      eaters: [member()],
      ingredients,
      overlay: { ingredientExclusions: ['rice'] },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.blockers[0]?.kind).toBe('excluded_ingredient')
    }
  })

  it('rejects when ANY eater of a shared slot reacts (household validation)', () => {
    const result = validateSubstituteForSlot({
      substituteIngredientId: 'peanut',
      eaters: [member({ id: 'm1', name: 'Alex' }), member({ id: 'm2', name: 'Sam', allergies: ['peanut'] })],
      ingredients,
      overlay: undefined,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.blockers.some((b) => b.memberName === 'Sam')).toBe(true)
    }
  })

  it('treats an unknown substitute (no allergen data) as safe — matches the engine', () => {
    const result = validateSubstituteForSlot({
      substituteIngredientId: 'mystery',
      eaters: [member({ allergies: ['peanut'] })],
      ingredients,
      overlay: undefined,
    })
    expect(result.ok).toBe(true)
  })
})
