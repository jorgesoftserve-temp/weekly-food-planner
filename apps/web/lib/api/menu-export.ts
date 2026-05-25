// Pure markdown formatter for the menu + grocery export.
// All inputs are pre-resolved (recipe/ingredient/member names are looked up by
// the loader so the formatter stays deterministic and trivially testable).

export type ExportSlot = {
  dayOfWeek: string
  mealKey: string
  mealType: string
  recipeId: string
  targetMemberId: string | null
}

export type ExportGroceryItem = {
  ingredientId: string
  quantity: number
  unit: string
  scheduledPurchaseDay: string | null
}

export type ExportGroceryList = {
  targetMemberId: string | null
  items: ExportGroceryItem[]
}

export type ExportMenu = {
  weekStartDate: string
  seed: number
  inputsHash: string
  generatedAt: string
  slots: ExportSlot[]
}

export type ExportInput = {
  workspace: { name: string; type: string }
  menu: ExportMenu
  groceryLists: ExportGroceryList[]
  recipes: Record<string, { name: string }>
  ingredients: Record<string, { name: string }>
  members: Record<string, { name: string }>
}

const DAY_ORDER: Record<string, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
}

const capitalize = (s: string): string =>
  s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)

const formatQuantity = (n: number): string => {
  // Strip trailing zeros for clean output; keep up to 3 fractional digits.
  const rounded = Math.round(n * 1000) / 1000
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toString()
}

const renderHeader = ({
  workspace,
  menu,
}: {
  workspace: ExportInput['workspace']
  menu: ExportMenu
}): string => {
  return [
    `# Weekly Menu — ${workspace.name}`,
    '',
    `- **Week starting:** ${menu.weekStartDate}`,
    `- **Generated:** ${menu.generatedAt}`,
    `- **Seed:** ${menu.seed}`,
    `- **Inputs hash:** \`${menu.inputsHash}\``,
    '',
  ].join('\n')
}

const renderMenuSection = ({
  menu,
  recipes,
  members,
}: {
  menu: ExportMenu
  recipes: Record<string, { name: string }>
  members: Record<string, { name: string }>
}): string => {
  const sorted = [...menu.slots].sort((a, b) => {
    const da = DAY_ORDER[a.dayOfWeek] ?? 99
    const db = DAY_ORDER[b.dayOfWeek] ?? 99
    if (da !== db) return da - db
    if (a.mealKey !== b.mealKey) return a.mealKey.localeCompare(b.mealKey)
    const ta = a.targetMemberId ?? ''
    const tb = b.targetMemberId ?? ''
    return ta.localeCompare(tb)
  })
  const lines = [
    '## Menu',
    '',
    '| Day | Meal | Recipe | Target |',
    '| --- | --- | --- | --- |',
  ]
  for (const slot of sorted) {
    const recipeName = recipes[slot.recipeId]?.name ?? `[unknown:${slot.recipeId}]`
    const memberName = slot.targetMemberId
      ? members[slot.targetMemberId]?.name ?? `[unknown:${slot.targetMemberId}]`
      : 'shared'
    lines.push(
      `| ${capitalize(slot.dayOfWeek)} | ${slot.mealKey} | ${recipeName} | ${memberName} |`,
    )
  }
  lines.push('')
  return lines.join('\n')
}

const renderGroceryListSection = ({
  list,
  ingredients,
  members,
}: {
  list: ExportGroceryList
  ingredients: Record<string, { name: string }>
  members: Record<string, { name: string }>
}): string => {
  const heading = list.targetMemberId
    ? `### Per member: ${members[list.targetMemberId]?.name ?? `[unknown:${list.targetMemberId}]`}`
    : '### Shared'
  const sorted = [...list.items].sort((a, b) => {
    const na = ingredients[a.ingredientId]?.name ?? a.ingredientId
    const nb = ingredients[b.ingredientId]?.name ?? b.ingredientId
    return na.localeCompare(nb)
  })
  const lines = [
    heading,
    '',
    '| Ingredient | Quantity | Unit | Scheduled day |',
    '| --- | --- | --- | --- |',
  ]
  for (const item of sorted) {
    const name = ingredients[item.ingredientId]?.name ?? `[unknown:${item.ingredientId}]`
    const day = item.scheduledPurchaseDay ? capitalize(item.scheduledPurchaseDay) : '—'
    lines.push(`| ${name} | ${formatQuantity(item.quantity)} | ${item.unit} | ${day} |`)
  }
  lines.push('')
  return lines.join('\n')
}

const renderGrocerySection = ({
  groceryLists,
  ingredients,
  members,
}: {
  groceryLists: ExportGroceryList[]
  ingredients: Record<string, { name: string }>
  members: Record<string, { name: string }>
}): string => {
  if (groceryLists.length === 0) {
    return ['## Grocery list', '', '_(empty)_', ''].join('\n')
  }
  // Shared list first, then per-member sorted by member name.
  const ordered = [...groceryLists].sort((a, b) => {
    if (a.targetMemberId === null && b.targetMemberId !== null) return -1
    if (a.targetMemberId !== null && b.targetMemberId === null) return 1
    const na = a.targetMemberId ? members[a.targetMemberId]?.name ?? '' : ''
    const nb = b.targetMemberId ? members[b.targetMemberId]?.name ?? '' : ''
    return na.localeCompare(nb)
  })
  const parts = ['## Grocery list', '']
  for (const list of ordered) {
    parts.push(renderGroceryListSection({ list, ingredients, members }))
  }
  return parts.join('\n')
}

export const renderMenuExportMarkdown = (input: ExportInput): string => {
  return [
    renderHeader({ workspace: input.workspace, menu: input.menu }),
    renderMenuSection({
      menu: input.menu,
      recipes: input.recipes,
      members: input.members,
    }),
    renderGrocerySection({
      groceryLists: input.groceryLists,
      ingredients: input.ingredients,
      members: input.members,
    }),
  ].join('\n')
}
