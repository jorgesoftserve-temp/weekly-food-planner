// Deterministic recipe-icon resolver — pure lookup tables, no AI/network.
// Priority: explicit emoji override → name keywords → cuisine → tag → meal → generic plate.
// Ported from apps/web/app/(design)/design-lab/_components/recipe-icon.ts and kept in sync.

type RecipeIconInput = {
  emoji?: string | null
  name?: string | null
  cuisine?: string | null
  tags?: string[] | null
  meal?: string | null
}

const NAME_KEYWORDS: ReadonlyArray<readonly [string, string]> = [
  ['pasta', '🍝'],
  ['spaghetti', '🍝'],
  ['lasagna', '🍝'],
  ['noodle', '🍜'],
  ['fideo', '🍜'],
  ['ramen', '🍜'],
  ['salmon', '🐟'],
  ['fish', '🐟'],
  ['tuna', '🐟'],
  ['shrimp', '🦐'],
  ['taco', '🌮'],
  ['tostada', '🌮'],
  ['burrito', '🌯'],
  ['quesadilla', '🫓'],
  ['pozole', '🍲'],
  ['sopa', '🍲'],
  ['soup', '🍲'],
  ['stew', '🍲'],
  ['avocado', '🥑'],
  ['toast', '🍞'],
  ['sandwich', '🥪'],
  ['strawberry', '🍓'],
  ['berry', '🫐'],
  ['oat', '🥣'],
  ['cereal', '🥣'],
  ['yogurt', '🥣'],
  ['pancake', '🥞'],
  ['waffle', '🧇'],
  ['egg', '🍳'],
  ['chicken', '🍗'],
  ['beef', '🥩'],
  ['steak', '🥩'],
  ['pork', '🥓'],
  ['rice', '🍚'],
  ['curry', '🍛'],
  ['pizza', '🍕'],
  ['burger', '🍔'],
  ['salad', '🥗'],
  ['bowl', '🥗'],
  ['veggie', '🥦'],
  ['vegetable', '🥦'],
]

const CUISINE_ICON: Record<string, string> = {
  mexican: '🌮',
  mediterranean: '🥗',
  italian: '🍝',
  coastal: '🐟',
  asian: '🍜',
  cafe: '☕',
  american: '🍔',
  fusion: '🍽️',
}

const TAG_ICON: Record<string, string> = {
  soup: '🍲',
  vegan: '🥗',
  vegetarian: '🥗',
  'high protein': '🍗',
  'omega-3': '🐟',
  comfort: '🍲',
  dessert: '🍰',
  quick: '⚡',
}

const MEAL_ICON: Record<string, string> = {
  breakfast: '🍳',
  lunch: '🥗',
  dinner: '🍽️',
  snack: '🍪',
}

export const resolveRecipeIcon = ({
  emoji,
  name,
  cuisine,
  tags,
  meal,
}: RecipeIconInput): string => {
  if (emoji) return emoji

  const lowerName = (name ?? '').toLowerCase()
  for (const [keyword, icon] of NAME_KEYWORDS) {
    if (lowerName.includes(keyword)) return icon
  }

  if (cuisine) {
    const byCuisine = CUISINE_ICON[cuisine.toLowerCase()]
    if (byCuisine) return byCuisine
  }

  for (const tag of tags ?? []) {
    const byTag = TAG_ICON[tag.toLowerCase()]
    if (byTag) return byTag
  }

  if (meal) {
    const byMeal = MEAL_ICON[meal.toLowerCase()]
    if (byMeal) return byMeal
  }

  return '🍽️'
}
