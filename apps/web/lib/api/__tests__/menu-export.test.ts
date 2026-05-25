import { describe, expect, it } from 'vitest'
import {
  type ExportInput,
  renderMenuExportMarkdown,
} from '../menu-export'

const baseInput: ExportInput = {
  workspace: { name: 'Home', type: 'individual' },
  menu: {
    weekStartDate: '2026-06-01',
    seed: 42,
    inputsHash: 'deadbeef'.repeat(8),
    generatedAt: '2026-05-25T10:00:00.000Z',
    slots: [
      {
        dayOfWeek: 'monday',
        mealKey: 'breakfast',
        mealType: 'breakfast',
        recipeId: 'r-oats',
        targetMemberId: 'm-alice',
      },
      {
        dayOfWeek: 'monday',
        mealKey: 'dinner',
        mealType: 'dinner',
        recipeId: 'r-pasta',
        targetMemberId: 'm-alice',
      },
    ],
  },
  groceryLists: [
    {
      targetMemberId: null,
      items: [
        {
          ingredientId: 'i-tomato',
          quantity: 4,
          unit: 'piece',
          scheduledPurchaseDay: null,
        },
        {
          ingredientId: 'i-oats',
          quantity: 3.5,
          unit: 'cup',
          scheduledPurchaseDay: 'monday',
        },
      ],
    },
  ],
  recipes: {
    'r-oats': { name: 'Oatmeal' },
    'r-pasta': { name: 'Tomato pasta' },
  },
  ingredients: {
    'i-oats': { name: 'Oats' },
    'i-tomato': { name: 'Tomato' },
  },
  members: {
    'm-alice': { name: 'Alice' },
  },
}

describe('renderMenuExportMarkdown', () => {
  it('includes the header with workspace name, week, seed, and hash', () => {
    const md = renderMenuExportMarkdown(baseInput)
    expect(md).toContain('# Weekly Menu — Home')
    expect(md).toContain('**Week starting:** 2026-06-01')
    expect(md).toContain('**Seed:** 42')
    expect(md).toContain('`deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef`')
  })

  it('renders the menu as a sorted table (day → mealKey)', () => {
    const md = renderMenuExportMarkdown(baseInput)
    const menuStart = md.indexOf('## Menu')
    const grocStart = md.indexOf('## Grocery list')
    const block = md.slice(menuStart, grocStart)
    const lines = block.split('\n')
    const breakfastIdx = lines.findIndex((l) => l.includes('breakfast'))
    const dinnerIdx = lines.findIndex((l) => l.includes('dinner'))
    expect(breakfastIdx).toBeLessThan(dinnerIdx)
    expect(block).toContain('| Monday | breakfast | Oatmeal | Alice |')
    expect(block).toContain('| Monday | dinner | Tomato pasta | Alice |')
  })

  it('sorts grocery items by ingredient name (alphabetical)', () => {
    const md = renderMenuExportMarkdown(baseInput)
    const grocSection = md.slice(md.indexOf('## Grocery list'))
    const oatsIdx = grocSection.indexOf('| Oats |')
    const tomatoIdx = grocSection.indexOf('| Tomato |')
    expect(oatsIdx).toBeGreaterThan(-1)
    expect(tomatoIdx).toBeGreaterThan(-1)
    expect(oatsIdx).toBeLessThan(tomatoIdx)
  })

  it('renders a "—" placeholder for null scheduled_purchase_day', () => {
    const md = renderMenuExportMarkdown(baseInput)
    expect(md).toContain('| Tomato | 4 | piece | — |')
  })

  it('capitalizes scheduled day when present', () => {
    const md = renderMenuExportMarkdown(baseInput)
    expect(md).toContain('| Oats | 3.5 | cup | Monday |')
  })

  it('is deterministic — identical input produces identical output', () => {
    const a = renderMenuExportMarkdown(baseInput)
    const b = renderMenuExportMarkdown(baseInput)
    expect(a).toBe(b)
  })

  it('is stable under slot input reordering (sort-driven, not insertion-driven)', () => {
    const shuffled: ExportInput = {
      ...baseInput,
      menu: {
        ...baseInput.menu,
        slots: [...baseInput.menu.slots].reverse(),
      },
      groceryLists: baseInput.groceryLists.map((l) => ({
        ...l,
        items: [...l.items].reverse(),
      })),
    }
    expect(renderMenuExportMarkdown(shuffled)).toBe(renderMenuExportMarkdown(baseInput))
  })

  it('falls back to [unknown:id] when a name is missing', () => {
    const md = renderMenuExportMarkdown({
      ...baseInput,
      recipes: {},
    })
    expect(md).toContain('[unknown:r-oats]')
  })

  it('renders an _(empty)_ marker when no grocery lists exist', () => {
    const md = renderMenuExportMarkdown({ ...baseInput, groceryLists: [] })
    expect(md).toContain('## Grocery list')
    expect(md).toContain('_(empty)_')
  })

  it('lists shared grocery section before per-member sections', () => {
    const md = renderMenuExportMarkdown({
      ...baseInput,
      groceryLists: [
        {
          targetMemberId: 'm-alice',
          items: [
            {
              ingredientId: 'i-oats',
              quantity: 1,
              unit: 'cup',
              scheduledPurchaseDay: null,
            },
          ],
        },
        ...baseInput.groceryLists,
      ],
    })
    const sharedIdx = md.indexOf('### Shared')
    const perMemberIdx = md.indexOf('### Per member: Alice')
    expect(sharedIdx).toBeGreaterThan(-1)
    expect(perMemberIdx).toBeGreaterThan(-1)
    expect(sharedIdx).toBeLessThan(perMemberIdx)
  })
})
