import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createIntegrationFixture,
  INTEGRATION_ENABLED,
  type IntegrationFixture,
} from '@weekly-food-planner/test-utils'
import {
  createRecipe,
  type IngredientRecord,
} from '@weekly-food-planner/supabase'
import {
  generateMenu,
  type GenerateMenuInput,
} from '@weekly-food-planner/constraint-engine'
import { loadEngineSnapshot } from '@/lib/api/menu-loader'
import { acceptDraftMenu } from '@/lib/api/menu-accept'
import { persistGeneratedMenu } from '@/lib/api/menu-persistence'
import { loadMenuExport } from '@/lib/api/menu-export-loader'
import { renderMenuExportMarkdown } from '@/lib/api/menu-export'

const WEEK_START = '2026-06-01'
const SEED = 12345

const seedIngredients = async ({
  fixture,
}: {
  fixture: IntegrationFixture
}): Promise<Pick<IngredientRecord, 'id' | 'name'>[]> => {
  const inserts = [
    { name: 'Rolled oats', is_perishable: false, max_storage_days: null },
    { name: 'Milk', is_perishable: true, max_storage_days: 7 },
    { name: 'Tomato', is_perishable: true, max_storage_days: 7 },
    { name: 'Pasta', is_perishable: false, max_storage_days: null },
  ]
  const { data, error } = await fixture.supabase
    .from('ingredients')
    .insert(inserts)
    .select('id, name')
  if (error || !data) throw new Error(`seed ingredients failed: ${error?.message ?? 'no data'}`)
  return data as Array<{ id: string; name: string }>
}

const runPipeline = async ({
  fixture,
  seed,
}: {
  fixture: IntegrationFixture
  seed: number
}): Promise<string> => {
  const loaded = await loadEngineSnapshot({
    supabase: fixture.supabase,
    workspaceId: fixture.workspaceId,
  })
  if (!loaded.ok) throw new Error(`loadEngineSnapshot failed: ${loaded.reason}`)
  const input: GenerateMenuInput = {
    workspace: loaded.workspace,
    members: loaded.members,
    recipes: loaded.recipes,
    ingredients: loaded.ingredients,
    weekStartDate: WEEK_START,
    seed,
  }
  const result = await generateMenu(input)
  if (!result.ok) throw new Error(`generateMenu failed: ${result.error.reasonCode}`)
  const persisted = await persistGeneratedMenu({
    admin: fixture.supabase,
    workspaceId: fixture.workspaceId,
    weekStartDate: WEEK_START,
    input,
    result,
    participantMemberIds: loaded.members.map((m) => m.id),
  })
  if (!persisted.ok) throw new Error(`persist failed: ${persisted.detail}`)
  // Step 29 — generation now produces a DRAFT. Accept it so the export
  // loader (which filters by accepted_at IS NOT NULL) can see it. This
  // mirrors what the menu page does on the user's behalf after they click
  // "Accept menu".
  if (persisted.menuId) {
    const accepted = await acceptDraftMenu({
      admin: fixture.supabase,
      workspaceId: fixture.workspaceId,
      menuId: persisted.menuId,
    })
    if (!accepted.ok) {
      throw new Error(`acceptDraftMenu failed: ${accepted.detail}`)
    }
  }
  const exported = await loadMenuExport({
    supabase: fixture.supabase,
    workspaceId: fixture.workspaceId,
    weekStartDate: WEEK_START,
  })
  if (!exported.ok) throw new Error(`loadMenuExport failed: ${exported.reason}`)
  return renderMenuExportMarkdown(exported.export)
}

const stripVolatileLines = (markdown: string): string =>
  markdown
    .split('\n')
    .filter((line) => !line.startsWith('- **Generated:**'))
    .join('\n')

describe.skipIf(!INTEGRATION_ENABLED)('end-to-end determinism (integration)', () => {
  let fixture: IntegrationFixture

  beforeAll(async () => {
    fixture = await createIntegrationFixture()
    // Override the creator's auto-defaulted meal_frequency (3 meals/day
    // from the age-category trigger) to match the recipes we seed below
    // (breakfast + dinner only). Without this the engine asks for lunch
    // recipes and bails with no_valid_recipe.
    const TWO_MEAL_FREQ = [
      { key: 'breakfast', title: 'Breakfast', mealType: 'breakfast', defaultHour: 8 },
      { key: 'dinner', title: 'Dinner', mealType: 'dinner', defaultHour: 19 },
    ]
    const { error: freqErr } = await fixture.supabase
      .from('workspace_members')
      .update({ meal_frequency: TWO_MEAL_FREQ })
      .eq('workspace_id', fixture.workspaceId)
      .eq('role', 'creator')
    if (freqErr) throw new Error(`set creator meal_frequency: ${freqErr.message}`)
    const ingredients = await seedIngredients({ fixture })
    const oats = ingredients.find((i) => i.name === 'Rolled oats')
    const milk = ingredients.find((i) => i.name === 'Milk')
    const tomato = ingredients.find((i) => i.name === 'Tomato')
    const pasta = ingredients.find((i) => i.name === 'Pasta')
    if (!oats || !milk || !tomato || !pasta) throw new Error('missing seeded ingredient')

    await createRecipe({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      payload: {
        name: 'Oatmeal',
        meal_types: ['breakfast'],
        difficulty: 'easy',
        servings: 1,
        ingredients: [
          { ingredient_id: oats.id, quantity: 0.5, unit: 'cup' },
          { ingredient_id: milk.id, quantity: 1, unit: 'cup' },
        ],
      },
    })
    await createRecipe({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      payload: {
        name: 'Buttered toast',
        meal_types: ['breakfast'],
        difficulty: 'easy',
        servings: 1,
        ingredients: [{ ingredient_id: milk.id, quantity: 0.25, unit: 'cup' }],
      },
    })
    await createRecipe({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      payload: {
        name: 'Tomato pasta',
        meal_types: ['dinner'],
        difficulty: 'easy',
        servings: 2,
        ingredients: [
          { ingredient_id: pasta.id, quantity: 200, unit: 'g' },
          { ingredient_id: tomato.id, quantity: 3, unit: 'piece' },
        ],
      },
    })
    await createRecipe({
      supabase: fixture.supabase,
      workspaceId: fixture.workspaceId,
      payload: {
        name: 'Simple stew',
        meal_types: ['dinner'],
        difficulty: 'medium',
        servings: 2,
        ingredients: [{ ingredient_id: tomato.id, quantity: 2, unit: 'piece' }],
      },
    })
  })

  afterAll(async () => {
    await fixture?.cleanup()
  })

  it('runs recipe → generate → grocery → export and produces a markdown document', async () => {
    const markdown = await runPipeline({ fixture, seed: SEED })
    expect(markdown).toContain('# Weekly Menu —')
    expect(markdown).toContain('## Menu')
    expect(markdown).toContain('## Grocery list')
    expect(markdown).toMatch(/Oatmeal|Buttered toast/)
    expect(markdown).toMatch(/Tomato pasta|Simple stew/)
    expect(markdown).toMatch(/\| Rolled oats \|.+\| cup \|/)
  })

  it('produces byte-identical output across two runs with the same seed (ignoring generation timestamp)', async () => {
    const first = await runPipeline({ fixture, seed: SEED })
    const second = await runPipeline({ fixture, seed: SEED })
    expect(stripVolatileLines(second)).toBe(stripVolatileLines(first))
  })

  it('produces a different inputs hash + different output when the seed changes', async () => {
    const a = await runPipeline({ fixture, seed: SEED })
    const b = await runPipeline({ fixture, seed: SEED + 1 })
    expect(stripVolatileLines(a)).not.toBe(stripVolatileLines(b))
  })
})
