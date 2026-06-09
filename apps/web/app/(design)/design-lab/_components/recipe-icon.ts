// Deterministic recipe-icon resolver for the image fallback (NO AI — pure lookup
// tables; AI-based inference is out until v3.0). When a cover photo fails to load,
// MockImage shows this icon instead of a blank box. Priority, most → least
// specific:
//   1. explicit `emoji` override on the recipe (if an author pinned one)
//   2. keyword match on the recipe NAME (cheap "read the text" — substring lookup)
//   3. cuisine
//   4. a recognized tag
//   5. meal timeframe (breakfast / lunch / dinner / snack)
//   6. generic plate
// Name beats cuisine on purpose: a Mexican "Citrus Salmon" should read as 🐟, not 🌮.

type RecipeIconInput = {
  emoji?: string
  name?: string
  cuisine?: string
  tags?: string[]
  meal?: string
}

// Ordered: earlier entries win, so put specific proteins/dishes before generic words.
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
