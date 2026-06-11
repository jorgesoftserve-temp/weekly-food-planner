import { describe, expect, it } from 'vitest'
import {
  computeIngredientShortfalls,
  deriveSlotAlerts,
  type MissingIngredient,
} from '../menu-alerts'

// ── computeIngredientShortfalls ─────────────────────────────────────────────

describe('computeIngredientShortfalls', () => {
  const names = { tomato: 'Tomato', onion: 'Onion', rice: 'Rice' }

  it('returns nothing when every line is fully acquired', () => {
    const short = computeIngredientShortfalls({
      groceryItems: [{ id: 'g1', ingredient_id: 'tomato', unit: 'piece', quantity: 5 }],
      statuses: [{ grocery_item_id: 'g1', acquired_quantity: 5, status: 'acquired' }],
      inventory: [],
      ingredientNames: names,
    })
    expect(short.size).toBe(0)
  })

  it('reports a shortfall for a partially-acquired line', () => {
    const short = computeIngredientShortfalls({
      groceryItems: [{ id: 'g1', ingredient_id: 'tomato', unit: 'piece', quantity: 5 }],
      statuses: [{ grocery_item_id: 'g1', acquired_quantity: 2, status: 'partial' }],
      inventory: [],
      ingredientNames: names,
    })
    expect(short.get('tomato')).toEqual<MissingIngredient>({
      ingredientId: 'tomato',
      name: 'Tomato',
      shortfall: 3,
      unit: 'piece',
    })
  })

  it('treats skipped and pending lines as fully missing', () => {
    const short = computeIngredientShortfalls({
      groceryItems: [
        { id: 'g1', ingredient_id: 'onion', unit: 'piece', quantity: 4 },
        { id: 'g2', ingredient_id: 'rice', unit: 'gram', quantity: 200 },
      ],
      statuses: [
        { grocery_item_id: 'g1', acquired_quantity: 0, status: 'skipped' },
        { grocery_item_id: 'g2', acquired_quantity: 0, status: 'pending' },
      ],
      inventory: [],
      ingredientNames: names,
    })
    expect(short.get('onion')?.shortfall).toBe(4)
    expect(short.get('rice')?.shortfall).toBe(200)
  })

  it('treats a line with no status row as fully missing', () => {
    const short = computeIngredientShortfalls({
      groceryItems: [{ id: 'g1', ingredient_id: 'tomato', unit: 'piece', quantity: 5 }],
      statuses: [],
      inventory: [],
      ingredientNames: names,
    })
    expect(short.get('tomato')?.shortfall).toBe(5)
  })

  it('offsets shortfall with matching-unit on-hand inventory', () => {
    const short = computeIngredientShortfalls({
      groceryItems: [{ id: 'g1', ingredient_id: 'tomato', unit: 'piece', quantity: 5 }],
      statuses: [{ grocery_item_id: 'g1', acquired_quantity: 1, status: 'partial' }],
      inventory: [{ ingredient_id: 'tomato', unit: 'piece', quantity: 2 }],
      ingredientNames: names,
    })
    // required 5 − acquired 1 = 4 short, − 2 on-hand = 2 net.
    expect(short.get('tomato')?.shortfall).toBe(2)
  })

  it('drops an ingredient fully covered by inventory', () => {
    const short = computeIngredientShortfalls({
      groceryItems: [{ id: 'g1', ingredient_id: 'tomato', unit: 'piece', quantity: 5 }],
      statuses: [{ grocery_item_id: 'g1', acquired_quantity: 0, status: 'skipped' }],
      inventory: [{ ingredient_id: 'tomato', unit: 'piece', quantity: 5 }],
      ingredientNames: names,
    })
    expect(short.size).toBe(0)
  })

  it('does NOT offset across mismatched units', () => {
    const short = computeIngredientShortfalls({
      groceryItems: [{ id: 'g1', ingredient_id: 'rice', unit: 'gram', quantity: 200 }],
      statuses: [{ grocery_item_id: 'g1', acquired_quantity: 0, status: 'skipped' }],
      inventory: [{ ingredient_id: 'rice', unit: 'cup', quantity: 3 }],
      ingredientNames: names,
    })
    expect(short.get('rice')?.shortfall).toBe(200)
  })

  it('caps acquired to required so an over-buy never creates negative shortfall', () => {
    const short = computeIngredientShortfalls({
      groceryItems: [{ id: 'g1', ingredient_id: 'tomato', unit: 'piece', quantity: 5 }],
      statuses: [{ grocery_item_id: 'g1', acquired_quantity: 99, status: 'acquired' }],
      inventory: [],
      ingredientNames: names,
    })
    expect(short.size).toBe(0)
  })

  it('falls back to the ingredient id when no name is known', () => {
    const short = computeIngredientShortfalls({
      groceryItems: [{ id: 'g1', ingredient_id: 'mystery', unit: 'piece', quantity: 2 }],
      statuses: [],
      inventory: [],
      ingredientNames: {},
    })
    expect(short.get('mystery')?.name).toBe('mystery')
  })
})

// ── deriveSlotAlerts ────────────────────────────────────────────────────────

describe('deriveSlotAlerts', () => {
  const tomatoShort: MissingIngredient = {
    ingredientId: 'tomato',
    name: 'Tomato',
    shortfall: 3,
    unit: 'piece',
  }
  const shortByIngredient = new Map<string, MissingIngredient>([['tomato', tomatoShort]])
  const recipeIngredientIds = new Map<string, string[]>([
    ['r-salad', ['tomato', 'onion']],
    ['r-rice', ['rice']],
  ])
  const recipeNames = { 'r-salad': 'Tomato Salad', 'r-rice': 'Steamed Rice' }

  const slot = (over: Partial<Parameters<typeof deriveSlotAlerts>[0]['slots'][number]> = {}) => ({
    id: 's1',
    recipe_id: 'r-salad',
    day_of_week: 'monday',
    meal_key: 'dinner',
    target_member_id: null,
    cookStatus: 'planned' as const,
    ...over,
  })

  it('alerts a not-yet-cooked slot whose recipe uses a short ingredient', () => {
    const alerts = deriveSlotAlerts({
      slots: [slot()],
      recipeIngredientIds,
      shortByIngredient,
      recipeNames,
    })
    expect(alerts).toHaveLength(1)
    expect(alerts[0]?.slotId).toBe('s1')
    expect(alerts[0]?.recipeName).toBe('Tomato Salad')
    expect(alerts[0]?.missingIngredients).toEqual([tomatoShort])
  })

  it('does NOT alert a cooked slot even if its ingredient is short', () => {
    const alerts = deriveSlotAlerts({
      slots: [slot({ cookStatus: 'cooked' })],
      recipeIngredientIds,
      shortByIngredient,
      recipeNames,
    })
    expect(alerts).toHaveLength(0)
  })

  it('does NOT alert a skipped slot even if its ingredient is short', () => {
    const alerts = deriveSlotAlerts({
      slots: [slot({ cookStatus: 'skipped' })],
      recipeIngredientIds,
      shortByIngredient,
      recipeNames,
    })
    expect(alerts).toHaveLength(0)
  })

  it('does NOT alert a slot whose ingredients are all acquired', () => {
    const alerts = deriveSlotAlerts({
      slots: [slot({ id: 's2', recipe_id: 'r-rice' })],
      recipeIngredientIds,
      shortByIngredient,
      recipeNames,
    })
    expect(alerts).toHaveLength(0)
  })

  it('returns one alert per affected slot', () => {
    const alerts = deriveSlotAlerts({
      slots: [
        slot({ id: 's1' }),
        slot({ id: 's2', day_of_week: 'tuesday' }),
        slot({ id: 's3', recipe_id: 'r-rice' }),
      ],
      recipeIngredientIds,
      shortByIngredient,
      recipeNames,
    })
    expect(alerts.map((a) => a.slotId).sort()).toEqual(['s1', 's2'])
  })

  it('dedupes a repeated ingredient within one recipe', () => {
    const alerts = deriveSlotAlerts({
      slots: [slot({ recipe_id: 'r-dup' })],
      recipeIngredientIds: new Map([['r-dup', ['tomato', 'tomato']]]),
      shortByIngredient,
      recipeNames: { 'r-dup': 'Double Tomato' },
    })
    expect(alerts[0]?.missingIngredients).toHaveLength(1)
  })
})
