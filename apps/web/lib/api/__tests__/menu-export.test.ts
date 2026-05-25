import { describe, expect, it } from 'vitest'
import {
  type ExportInput,
  renderMenuExportCsv,
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

describe('renderMenuExportCsv', () => {
  it('emits the document header as comment rows carrying workspace metadata', () => {
    const csv = renderMenuExportCsv(baseInput)
    expect(csv).toContain('# Weekly Menu — Home')
    expect(csv).toContain('# Workspace,Home')
    expect(csv).toContain('# Week starting,2026-06-01')
    expect(csv).toContain('# Seed,42')
    expect(csv).toContain(
      '# Inputs hash,deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    )
  })

  it('emits the menu section header + sorted rows', () => {
    const csv = renderMenuExportCsv(baseInput)
    const menuStart = csv.indexOf('## Menu')
    const grocStart = csv.indexOf('## Grocery list')
    const block = csv.slice(menuStart, grocStart)
    expect(block).toContain('Day,Meal,Recipe,Target')
    expect(block).toContain('Monday,breakfast,Oatmeal,Alice')
    expect(block).toContain('Monday,dinner,Tomato pasta,Alice')
    const breakfastIdx = block.indexOf('Monday,breakfast,')
    const dinnerIdx = block.indexOf('Monday,dinner,')
    expect(breakfastIdx).toBeLessThan(dinnerIdx)
  })

  it('uses a single Section column for grocery rows and sorts items alphabetically by ingredient name', () => {
    const csv = renderMenuExportCsv(baseInput)
    const grocSection = csv.slice(csv.indexOf('## Grocery list'))
    expect(grocSection).toContain('Section,Ingredient,Quantity,Unit,Scheduled day')
    const oatsIdx = grocSection.indexOf('Shared,Oats,')
    const tomatoIdx = grocSection.indexOf('Shared,Tomato,')
    expect(oatsIdx).toBeGreaterThan(-1)
    expect(tomatoIdx).toBeGreaterThan(-1)
    expect(oatsIdx).toBeLessThan(tomatoIdx)
  })

  it('emits an empty cell for null scheduled_purchase_day and a capitalised day when present', () => {
    const csv = renderMenuExportCsv(baseInput)
    expect(csv).toContain('Shared,Tomato,4,piece,\n')
    expect(csv).toContain('Shared,Oats,3.5,cup,Monday')
  })

  it('is deterministic — identical input produces identical output', () => {
    expect(renderMenuExportCsv(baseInput)).toBe(renderMenuExportCsv(baseInput))
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
    expect(renderMenuExportCsv(shuffled)).toBe(renderMenuExportCsv(baseInput))
  })

  it('falls back to [unknown:id] when a name is missing', () => {
    const csv = renderMenuExportCsv({ ...baseInput, recipes: {} })
    expect(csv).toContain('[unknown:r-oats]')
  })

  it('emits only the grocery header row when no grocery lists exist', () => {
    const csv = renderMenuExportCsv({ ...baseInput, groceryLists: [] })
    const grocSection = csv.slice(csv.indexOf('## Grocery list'))
    expect(grocSection).toContain('Section,Ingredient,Quantity,Unit,Scheduled day')
    expect(grocSection).not.toMatch(/^Shared,/m)
    expect(grocSection).not.toMatch(/^Per member:/m)
  })

  it('lists shared rows before per-member rows', () => {
    const csv = renderMenuExportCsv({
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
    const sharedIdx = csv.indexOf('Shared,')
    const perMemberIdx = csv.indexOf('Per member: Alice,')
    expect(sharedIdx).toBeGreaterThan(-1)
    expect(perMemberIdx).toBeGreaterThan(-1)
    expect(sharedIdx).toBeLessThan(perMemberIdx)
  })

  it('escapes commas, double-quotes, and newlines per RFC 4180', () => {
    const csv = renderMenuExportCsv({
      ...baseInput,
      workspace: { name: 'House, "Beach"', type: 'individual' },
      recipes: {
        'r-oats': { name: 'Oatmeal, "deluxe"' },
        'r-pasta': { name: 'Tomato\npasta' },
      },
      ingredients: {
        'i-oats': { name: 'Oats, rolled' },
        'i-tomato': { name: 'Tomato "fresh"' },
      },
    })
    expect(csv).toContain('# Workspace,"House, ""Beach"""')
    expect(csv).toContain('Monday,breakfast,"Oatmeal, ""deluxe""",Alice')
    expect(csv).toContain('Monday,dinner,"Tomato\npasta",Alice')
    expect(csv).toContain('Shared,"Oats, rolled",3.5,cup,Monday')
    expect(csv).toContain('Shared,"Tomato ""fresh""",4,piece,')
  })

  it('declines to render an # Inputs hash line containing a comma without quoting', () => {
    const csv = renderMenuExportCsv({
      ...baseInput,
      menu: { ...baseInput.menu, inputsHash: 'a,b' },
    })
    expect(csv).toContain('# Inputs hash,"a,b"')
  })
})
