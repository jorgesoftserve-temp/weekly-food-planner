import { describe, expect, it } from 'vitest'
import { assignGreedy } from '../assign.js'
import { createRng } from '../random.js'
import { makeMember, makeRecipe, makeRecipeIngredient } from '../test-utils/index.js'
import type { GenerateMenuOptions, RecipeSnapshot } from '../types.js'
import type { SlotSpec } from '../slots.js'

const member = makeMember({ id: 'm1', role: 'creator' })

const dinnerSlot: SlotSpec = {
  dayOfWeek: 'monday',
  mealKey: 'dinner',
  mealType: 'dinner',
  targetMemberId: 'm1',
}

// Four hard-valid dinner recipes, all with no allergens/restrictions so they all
// pass the hard filter. Stable ids so the id-sort is deterministic.
const recipes: RecipeSnapshot[] = [
  makeRecipe({ id: 'r-a', mealType: 'dinner', dietaryTags: ['comfort'] }),
  makeRecipe({ id: 'r-b', mealType: 'dinner', dietaryTags: ['pescatarian'] }),
  makeRecipe({
    id: 'r-c',
    mealType: 'dinner',
    ingredients: [makeRecipeIngredient({ ingredientId: 'i-salmon' })],
  }),
  makeRecipe({ id: 'r-d', mealType: 'dinner', dietaryTags: ['spicy'] }),
]

const run = ({ options }: { options?: GenerateMenuOptions }) =>
  assignGreedy({
    slots: [dinnerSlot],
    recipes,
    members: [member],
    ingredients: [],
    options,
    rng: createRng({ seed: 7 }),
  })

describe('assignGreedy soft-bias (v2.1 inclusive preferences)', () => {
  it('is deterministic for a fixed seed', () => {
    const a = run({ options: undefined })
    const b = run({ options: undefined })
    expect(a).toEqual(b)
  })

  it('with no preferences picks from the full hard-valid set (byte-identical RNG draw)', () => {
    // Reconstruct the pre-v2.1 behaviour: draw rng.nextInt over the id-sorted
    // full candidate list with a fresh RNG of the same seed.
    const rng = createRng({ seed: 7 })
    const sorted = [...recipes].sort((x, y) => x.id.localeCompare(y.id))
    const expectedId = sorted[rng.nextInt(sorted.length)]!.id

    const result = run({ options: undefined })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.assignments[0]!.recipeId).toBe(expectedId)
  })

  it('biases toward a recipe matching an inclusive dietary tag', () => {
    const prefMember = makeMember({
      id: 'm1',
      role: 'creator',
      dietaryPreferences: { tags: ['pescatarian'], ingredients: [] },
    })
    const result = assignGreedy({
      slots: [dinnerSlot],
      recipes,
      members: [prefMember],
      ingredients: [],
      options: undefined,
      rng: createRng({ seed: 7 }),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // Only r-b matches 'pescatarian' → it is the sole preferred candidate.
    expect(result.assignments[0]!.recipeId).toBe('r-b')
  })

  it('biases toward a recipe matching an inclusive ingredient', () => {
    const prefMember = makeMember({
      id: 'm1',
      role: 'creator',
      dietaryPreferences: { tags: [], ingredients: ['i-salmon'] },
    })
    const result = assignGreedy({
      slots: [dinnerSlot],
      recipes,
      members: [prefMember],
      ingredients: [],
      options: undefined,
      rng: createRng({ seed: 7 }),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // Only r-c contains i-salmon.
    expect(result.assignments[0]!.recipeId).toBe('r-c')
  })

  it('honours generation-time additionalDietaryPreferences in the partition', () => {
    const result = run({
      options: { additionalDietaryPreferences: { tags: ['spicy'] } },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // Only r-d carries the 'spicy' tag.
    expect(result.assignments[0]!.recipeId).toBe('r-d')
  })

  it('unions profile and generation-time preferences', () => {
    const prefMember = makeMember({
      id: 'm1',
      role: 'creator',
      dietaryPreferences: { tags: ['pescatarian'], ingredients: [] },
    })
    // Preferred = {r-b (pescatarian, profile), r-d (spicy, generation)} — picked
    // recipe must be one of those, never r-a/r-c.
    const rng = createRng({ seed: 7 })
    const result = assignGreedy({
      slots: [dinnerSlot],
      recipes,
      members: [prefMember],
      ingredients: [],
      options: { additionalDietaryPreferences: { tags: ['spicy'] } },
      rng,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(['r-b', 'r-d']).toContain(result.assignments[0]!.recipeId)
  })

  it('falls back to the full set when preferences match nothing — identical RNG draw to the no-pref path', () => {
    // A preference that matches no candidate must degrade to the pre-v2.1 path
    // AND consume the RNG identically (preferred-empty → pickFrom === sorted).
    const noMatch = run({
      options: { additionalDietaryPreferences: { tags: ['nonexistent'], ingredients: ['i-none'] } },
    })
    const noPref = run({ options: undefined })
    expect(noMatch).toEqual(noPref)
  })

  it('never picks a hard-excluded recipe even when it matches a preference', () => {
    // r-c matches the i-salmon preference but is hard-excluded via ingredient
    // exclusion. The remaining preferred set is empty → falls back to the rest.
    const prefMember = makeMember({
      id: 'm1',
      role: 'creator',
      dietaryPreferences: { tags: [], ingredients: ['i-salmon'] },
    })
    const result = assignGreedy({
      slots: [dinnerSlot],
      recipes,
      members: [prefMember],
      ingredients: [],
      options: { ingredientExclusions: ['i-salmon'] },
      rng: createRng({ seed: 7 }),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.assignments[0]!.recipeId).not.toBe('r-c')
  })
})
