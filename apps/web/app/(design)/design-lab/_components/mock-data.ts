// Static seed data for the design-lab mocks — no DB, no network mutations.
// Recipe/avatar `image` URLs are real photos so the image-forward layouts can be
// judged; `emoji` stays as the offline fallback (see MockImage). Photo URLs use
// loremflickr with a locked seed so each card is stable across reloads — swap for
// curated Unsplash URLs anytime; the emoji fallback covers any load failure.

import type { CSSProperties } from 'react'

const photo = (keywords: string, lock: number) =>
  `https://loremflickr.com/640/480/${keywords}?lock=${lock}`

// Per-user accent keys — mirror the six in docs/design/user-accent-colors.md.
// Each member carries one; the design uses it ONLY on member-tied surfaces
// (selector buttons, role badges, a dot) so switching members reads visually
// without flooding the UI. Strawberry tracks the new brand hue (351).
export type AccentKey = 'strawberry' | 'moss' | 'teal' | 'amber' | 'ocean' | 'plum'

// Solid, mid-lightness HSL triplet per accent. Mid-lightness reads on both light
// AND dark, so per-member tints/rings derive from opacity here instead of
// shipping separate light/dark values (the global --user-accent-* vars handle the
// logged-in user; these are for *other* members shown inline).
export const ACCENT_SOLID: Record<AccentKey, string> = {
  strawberry: '351 79% 56%',
  moss: '114 38% 45%',
  teal: '159 35% 40%',
  amber: '38 80% 44%',
  ocean: '205 75% 43%',
  plum: '285 45% 48%',
}

// Inline style for a "selected member" chip/button: soft accent fill + matching
// text + hairline ring, all from the member's own accent.
export const memberAccentStyle = (accent: AccentKey): CSSProperties => {
  const c = ACCENT_SOLID[accent]
  return {
    backgroundColor: `hsl(${c} / 0.14)`,
    color: `hsl(${c})`,
    boxShadow: `inset 0 0 0 1px hsl(${c} / 0.4)`,
  }
}

// A small solid dot in the member's accent (the lightest-touch distinction).
export const memberDotStyle = (accent: AccentKey): CSSProperties => ({
  backgroundColor: `hsl(${ACCENT_SOLID[accent]})`,
})

// A very light accent ring for member cards (#11) — layered over the cozy shadow.
export const memberRingStyle = (accent: AccentKey): CSSProperties => ({
  boxShadow: `0 0 0 1.5px hsl(${ACCENT_SOLID[accent]} / 0.35)`,
})

// A single recipe ingredient used by the cook-time reconciliation sheet.
export type MockRecipeIngredient = {
  id: string
  name: string
  plannedQty: number
  unit: string
}

export type MockRecipe = {
  id: string
  name: string
  // Optional explicit icon override. When omitted, the image fallback is derived
  // from name/cuisine/tag/meal via resolveRecipeIcon (recipe-icon.ts).
  emoji?: string
  image: string
  cuisine: string
  meal: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack'
  minutes: number
  difficulty: 'Easy' | 'Medium' | 'Hard'
  tags: string[]
  // Cook-time reconciliation: the recipe's ingredients with planned quantities.
  // Present on recipes where we want to demo the Phase-4 reconciliation sheet.
  ingredients?: MockRecipeIngredient[]
}

export const MOCK_RECIPES: MockRecipe[] = [
  {
    id: 'r1',
    name: 'Chicken Tinga Tostadas',
    image: photo('tostada,mexican,food', 11),
    cuisine: 'Mexican',
    meal: 'Lunch',
    minutes: 35,
    difficulty: 'Easy',
    tags: ['High protein'],
    // Phase-4 mock ingredients for cook-time reconciliation demo
    ingredients: [
      { id: 'ri1', name: 'Tomato',          plannedQty: 5, unit: 'pcs' },
      { id: 'ri2', name: 'Onion',           plannedQty: 2, unit: 'pcs' },
      { id: 'ri3', name: 'Chicken breast',  plannedQty: 1, unit: 'kg'  },
    ],
  },
  { id: 'r2', name: 'Creamy Chipotle Pasta', image: photo('pasta,food', 12), cuisine: 'Fusion', meal: 'Dinner', minutes: 30, difficulty: 'Easy', tags: ['Comfort'] },
  { id: 'r3', name: 'Green Pozole', image: photo('soup,mexican,food', 13), cuisine: 'Mexican', meal: 'Dinner', minutes: 60, difficulty: 'Medium', tags: ['Soup'] },
  { id: 'r4', name: 'Avocado Breakfast Toast', image: photo('avocado,toast', 14), cuisine: 'Cafe', meal: 'Breakfast', minutes: 10, difficulty: 'Easy', tags: ['Vegetarian'] },
  { id: 'r5', name: 'Strawberry Oat Bowl', image: photo('oatmeal,strawberry', 15), cuisine: 'Cafe', meal: 'Breakfast', minutes: 8, difficulty: 'Easy', tags: ['Vegetarian', 'Quick'] },
  { id: 'r6', name: 'Sopa de Fideo', image: photo('noodle,soup', 16), cuisine: 'Mexican', meal: 'Lunch', minutes: 25, difficulty: 'Easy', tags: ['Kid friendly'] },
  { id: 'r7', name: 'Grilled Veggie Bowl', image: photo('salad,bowl,food', 17), cuisine: 'Mediterranean', meal: 'Lunch', minutes: 20, difficulty: 'Easy', tags: ['Vegan'] },
  { id: 'r8', name: 'Citrus Salmon', image: photo('salmon,food', 18), cuisine: 'Coastal', meal: 'Dinner', minutes: 28, difficulty: 'Medium', tags: ['Omega-3'] },
]

export type MockMember = {
  id: string
  name: string
  initials: string
  avatar: string
  role: 'Creator' | 'Admin' | 'Member'
  accent: AccentKey
  // Mirrors the live member record: age_category drives default meal frequency;
  // dietary restrictions and allergies are distinct enums (see members module).
  ageCategory: 'Infant' | 'Toddler' | 'Child' | 'Teen' | 'Adult' | 'Senior'
  dietary: string[]
  allergies: string[]
}

export const MOCK_MEMBERS: MockMember[] = [
  { id: 'm1', name: 'Jorge Zapata', initials: 'JZ', avatar: 'https://i.pravatar.cc/150?img=12', role: 'Creator', accent: 'strawberry', ageCategory: 'Adult', dietary: ['Vegetarian', 'Low dairy'], allergies: ['Peanuts'] },
  { id: 'm2', name: 'Ana Zapata', initials: 'AZ', avatar: 'https://i.pravatar.cc/150?img=47', role: 'Admin', accent: 'plum', ageCategory: 'Adult', dietary: ['Vegetarian', 'High protein'], allergies: [] },
  { id: 'm3', name: 'Mateo', initials: 'M', avatar: 'https://i.pravatar.cc/150?img=33', role: 'Member', accent: 'ocean', ageCategory: 'Child', dietary: ['Kid friendly'], allergies: ['Shellfish'] },
  { id: 'm4', name: 'Lucía', initials: 'L', avatar: 'https://i.pravatar.cc/150?img=5', role: 'Member', accent: 'amber', ageCategory: 'Child', dietary: ['Low spice'], allergies: [] },
]

export const MOCK_INGREDIENTS = [
  '190 g cream cheese',
  '3 chipotle chiles in adobo',
  '2 roma tomatoes',
  '1/2 cup media crema',
  '700 g chicken breast, cubed',
  '1 tbsp oil',
  'Salt & pepper',
]

export const MOCK_STEPS = [
  'Blend cream cheese, tomatoes, chipotles and crema into a smooth sauce.',
  'Heat the oil in a large skillet over medium heat.',
  'Add the cubed chicken and season with salt, pepper, garlic and onion powder.',
  'Cook until the chicken changes color.',
  'Pour the chipotle sauce over the chicken and stir.',
  'Simmer 10–15 minutes, stirring occasionally. Serve with rice or tortillas.',
]

export const MOCK_DAYS = [
  { day: 'Mon', recipe: MOCK_RECIPES[1]! },
  { day: 'Tue', recipe: MOCK_RECIPES[5]! },
  { day: 'Wed', recipe: MOCK_RECIPES[7]! },
  { day: 'Thu', recipe: MOCK_RECIPES[2]! },
  { day: 'Fri', recipe: MOCK_RECIPES[0]! },
  { day: 'Sat', recipe: MOCK_RECIPES[6]! },
  { day: 'Sun', recipe: MOCK_RECIPES[3]! },
]

// Full weekly grid: each day carries MULTIPLE meals (the live menu is day ×
// meal_key slots, not one-recipe-per-day). The menu mock renders this as a
// day-row × meal-column grid.
// CHANGE #2: A slot now holds an ARRAY of recipe entries so one timeframe can
// contain recipes for different members (e.g. Mon Lunch: Jorge→Chicken Tinga +
// Ana→Tofu Bowl). `null` entries array = nobody eats that meal that day.
export const MEALS = ['Breakfast', 'Lunch', 'Dinner'] as const
export type MealKey = (typeof MEALS)[number]

export type MockSlotEntry = {
  recipe: MockRecipe
  // undefined = shared / everyone
  targetMemberId?: string
}

export type MockDayMeals = {
  day: string
  meals: Record<MealKey, { entries: MockSlotEntry[] }>
}

// Tofu Bowl recipe — added for the multi-recipe Mon Lunch slot (#2)
const TOFU_BOWL: MockRecipe = {
  id: 'r9',
  name: 'Tofu Bowl',
  image: photo('tofu,bowl,food', 19),
  cuisine: 'Asian',
  meal: 'Lunch',
  minutes: 20,
  difficulty: 'Easy',
  tags: ['Vegan', 'High protein'],
}

const R = MOCK_RECIPES
// Member assignments: m1=Jorge, m2=Ana, m3=Mateo, m4=Lucía, undefined=shared.
// Mon Lunch intentionally has 2 entries to demo the multi-recipe slot layout (#2).
export const MOCK_WEEK: MockDayMeals[] = [
  {
    day: 'Mon',
    meals: {
      Breakfast: { entries: [{ recipe: R[4]! }] },
      // Multi-recipe slot: Jorge → Chicken Tinga, Ana → Tofu Bowl
      Lunch:     { entries: [{ recipe: R[0]!, targetMemberId: 'm1' }, { recipe: TOFU_BOWL, targetMemberId: 'm2' }] },
      Dinner:    { entries: [{ recipe: R[1]! }] },
    },
  },
  {
    day: 'Tue',
    meals: {
      Breakfast: { entries: [{ recipe: R[3]!, targetMemberId: 'm1' }] },
      Lunch:     { entries: [{ recipe: R[5]!, targetMemberId: 'm3' }] },
      Dinner:    { entries: [{ recipe: R[7]! }] },
    },
  },
  {
    day: 'Wed',
    meals: {
      Breakfast: { entries: [{ recipe: R[4]! }] },
      Lunch:     { entries: [{ recipe: R[6]!, targetMemberId: 'm2' }] },
      Dinner:    { entries: [{ recipe: R[2]! }] },
    },
  },
  {
    day: 'Thu',
    meals: {
      Breakfast: { entries: [{ recipe: R[3]!, targetMemberId: 'm1' }] },
      Lunch:     { entries: [{ recipe: R[0]! }] },
      Dinner:    { entries: [{ recipe: R[1]!, targetMemberId: 'm4' }] },
    },
  },
  {
    day: 'Fri',
    meals: {
      Breakfast: { entries: [{ recipe: R[4]! }] },
      Lunch:     { entries: [{ recipe: R[5]!, targetMemberId: 'm3' }] },
      Dinner:    { entries: [{ recipe: R[7]! }] },
    },
  },
  {
    day: 'Sat',
    meals: {
      Breakfast: { entries: [{ recipe: R[3]! }] },
      Lunch:     { entries: [{ recipe: R[6]! }] },
      Dinner:    { entries: [{ recipe: R[2]! }] },
    },
  },
  {
    day: 'Sun',
    meals: {
      Breakfast: { entries: [{ recipe: R[4]!, targetMemberId: 'm2' }] },
      Lunch:     { entries: [{ recipe: R[0]! }] },
      Dinner:    { entries: [] },
    },
  },
]

// Workspace shared meal schedule (Settings → Meal schedule). Mirrors the live
// shared_meal_frequency rows: title + meal type + default hour.
export type MockMealSlot = { title: string; mealType: MealKey; hour: string }
export const MOCK_MEAL_SCHEDULE: MockMealSlot[] = [
  { title: 'Breakfast', mealType: 'Breakfast', hour: '08:00' },
  { title: 'Lunch', mealType: 'Lunch', hour: '13:30' },
  { title: 'Dinner', mealType: 'Dinner', hour: '19:30' },
]

// `note` is the free-text comment / substitution the user can jot on a line —
// no metadata, just a hint to self ("get the oat-based one", a brand, etc.).
// New functionality (mock only); see v1.8-ui-mockups.md.
export type MockGroceryItem = { name: string; qty: string; done: boolean; note?: string }
export type MockGroceryGroup = { category: string; items: MockGroceryItem[] }

// Grouped by aisle/category (Todoist-style sections inside cozy cards).
export const MOCK_GROCERY_GROUPS: MockGroceryGroup[] = [
  {
    category: 'Produce',
    items: [
      { name: 'Roma tomatoes', qty: '6 pcs', done: false },
      { name: 'Strawberries', qty: '500 g', done: true },
      { name: 'Avocados', qty: '3 pcs', done: false },
    ],
  },
  {
    category: 'Dairy',
    items: [
      { name: 'Cream cheese', qty: '380 g', done: false },
      { name: 'Media crema', qty: '1 cup', done: false, note: 'Replace with oat-based crema' },
    ],
  },
  {
    category: 'Meat & fish',
    items: [{ name: 'Chicken breast', qty: '1.4 kg', done: true }],
  },
  {
    category: 'Pantry',
    items: [
      { name: 'Chipotle in adobo', qty: '1 can', done: false },
      { name: 'Rolled oats', qty: '1 bag', done: false },
    ],
  },
]

// ─── v2.0 Mock Data ──────────────────────────────────────────────────────────

// Inventory items — each carries a source, optional expiry, and consumed flag.
// `cook_remainder` is the Phase-5 raw-ingredient leftover from the cook-time
// reconciliation (distinct from `leftover` which is a cooked-food surplus).
export type InventorySource = 'manual' | 'purchase' | 'leftover' | 'cook_remainder'

// CHANGE #5: Display labels for source. Internal values stay unchanged so the
// DB/engine layer is unaffected. UI renders these labels, not the raw keys.
// `cook_remainder` renders as 'Pantry' (raw stock) but carries cook provenance.
export const SOURCE_DISPLAY_LABEL: Record<InventorySource, string> = {
  manual:         'Pantry',
  purchase:       'Menu',
  leftover:       'Leftover',
  cook_remainder: 'Pantry',
}

export type MockInventoryItem = {
  id: string
  ingredient: string
  quantity: number
  unit: string
  source: InventorySource
  // ISO date string — undefined means no expiry set
  expirationDate?: string
  // true = item expires within 3 days from today (2026-06-10)
  nearExpiry?: boolean
  label?: string
  isConsumed: boolean
  // back-references for purchase/leftover items
  sourceMealName?: string
  // Phase-5 cook-remainder provenance line shown under the ingredient name.
  // e.g. "From: Chicken Tinga — unused"
  provenanceNote?: string
  // Phase-1 Menu→Pantry lifecycle: when a purchase item's week has ended,
  // it graduates to Pantry. `graduatedNote` holds the display hint.
  // e.g. "From last week's menu"
  graduatedNote?: string
}

// Today = 2026-06-10 for mock purposes
export const MOCK_INVENTORY: MockInventoryItem[] = [
  { id: 'inv1', ingredient: 'Roma tomatoes',      quantity: 4,   unit: 'pcs',  source: 'manual',    expirationDate: '2026-06-14', isConsumed: false },
  { id: 'inv2', ingredient: 'Avocados',            quantity: 1,   unit: 'pcs',  source: 'purchase',  expirationDate: '2026-06-11', nearExpiry: true, isConsumed: false, sourceMealName: 'Avocado Breakfast Toast' },
  { id: 'inv3', ingredient: 'Rolled oats',         quantity: 300, unit: 'g',    source: 'manual',    isConsumed: false },
  { id: 'inv4', ingredient: 'Cream cheese',        quantity: 190, unit: 'g',    source: 'purchase',  expirationDate: '2026-06-20', isConsumed: false, sourceMealName: 'Creamy Chipotle Pasta' },
  { id: 'inv5', ingredient: 'Leftover pozole',     quantity: 2,   unit: 'servings', source: 'leftover', expirationDate: '2026-06-12', nearExpiry: true, isConsumed: false, sourceMealName: 'Green Pozole' },
  { id: 'inv6', ingredient: 'Cooked chicken',      quantity: 150, unit: 'g',    source: 'leftover',  expirationDate: '2026-06-11', nearExpiry: true, isConsumed: false, sourceMealName: 'Chicken Tinga Tostadas' },
  { id: 'inv7', ingredient: 'Chipotle in adobo',   quantity: 1,   unit: 'can',  source: 'manual',    expirationDate: '2027-01-01', isConsumed: false },
  // Phase-5: raw-ingredient leftover from cook-time reconciliation (1 tomato
  // left after using 4 of 5 planned). source='cook_remainder' → displays as
  // 'Pantry' tag; provenanceNote surfaces the cook origin.
  {
    id: 'inv8',
    ingredient: 'Tomato',
    quantity: 1,
    unit: 'pcs',
    source: 'cook_remainder',
    expirationDate: '2026-06-13',
    nearExpiry: true,
    isConsumed: false,
    sourceMealName: 'Chicken Tinga Tostadas',
    provenanceNote: 'From: Chicken Tinga Tostadas — unused',
  },
  // Phase-1 Menu→Pantry lifecycle: chicken breast purchased for last week's
  // menu. Week has ended → displays as 'Pantry' (graduated from Menu).
  // source remains 'purchase' internally; graduatedNote drives the UI hint.
  {
    id: 'inv9',
    ingredient: 'Chicken breast',
    quantity: 300,
    unit: 'g',
    source: 'purchase',
    expirationDate: '2026-06-12',
    nearExpiry: true,
    isConsumed: false,
    sourceMealName: 'Citrus Salmon',
    graduatedNote: 'From last week\'s menu',
  },
]

// Shopping session — one per accepted menu; items grouped by food group.
export type AcquiredStatus = 'pending' | 'acquired' | 'partial' | 'skipped'

export type MockShoppingItem = {
  id: string
  name: string
  requiredQty: string
  acquiredQty: string
  status: AcquiredStatus
  foodGroup: string
}

export type MockShoppingGroup = {
  foodGroup: string
  items: MockShoppingItem[]
}

// Completeness: sum(acquired) / sum(required). Computed from mock values.
// In-progress state: ~62% (incomplete band 30–90)
export const MOCK_SHOPPING_GROUPS: MockShoppingGroup[] = [
  {
    foodGroup: 'Produce',
    items: [
      { id: 'si1', name: 'Roma tomatoes', requiredQty: '6 pcs',  acquiredQty: '4 pcs',  status: 'partial',  foodGroup: 'Produce' },
      { id: 'si2', name: 'Avocados',      requiredQty: '3 pcs',  acquiredQty: '3 pcs',  status: 'acquired', foodGroup: 'Produce' },
      { id: 'si3', name: 'Strawberries',  requiredQty: '500 g',  acquiredQty: '0 g',    status: 'skipped',  foodGroup: 'Produce' },
    ],
  },
  {
    foodGroup: 'Dairy',
    items: [
      { id: 'si4', name: 'Cream cheese',  requiredQty: '380 g',  acquiredQty: '190 g',  status: 'partial',  foodGroup: 'Dairy' },
      { id: 'si5', name: 'Media crema',   requiredQty: '1 cup',  acquiredQty: '1 cup',  status: 'acquired', foodGroup: 'Dairy' },
    ],
  },
  {
    foodGroup: 'Protein',
    items: [
      { id: 'si6', name: 'Chicken breast', requiredQty: '1.4 kg', acquiredQty: '1.4 kg', status: 'acquired', foodGroup: 'Protein' },
    ],
  },
  {
    foodGroup: 'Grains & Pantry',
    items: [
      { id: 'si7', name: 'Chipotle in adobo', requiredQty: '1 can', acquiredQty: '0', status: 'pending',  foodGroup: 'Grains & Pantry' },
      { id: 'si8', name: 'Rolled oats',       requiredQty: '1 bag', acquiredQty: '0', status: 'pending',  foodGroup: 'Grains & Pantry' },
    ],
  },
]

// Near-complete state: ~91% (complete band ≥90)
export const MOCK_SHOPPING_GROUPS_NEAR_COMPLETE: MockShoppingGroup[] = [
  {
    foodGroup: 'Produce',
    items: [
      { id: 'nc1', name: 'Roma tomatoes', requiredQty: '6 pcs',  acquiredQty: '6 pcs',  status: 'acquired', foodGroup: 'Produce' },
      { id: 'nc2', name: 'Avocados',      requiredQty: '3 pcs',  acquiredQty: '3 pcs',  status: 'acquired', foodGroup: 'Produce' },
      { id: 'nc3', name: 'Strawberries',  requiredQty: '500 g',  acquiredQty: '400 g',  status: 'partial',  foodGroup: 'Produce' },
    ],
  },
  {
    foodGroup: 'Dairy',
    items: [
      { id: 'nc4', name: 'Cream cheese',  requiredQty: '380 g',  acquiredQty: '380 g',  status: 'acquired', foodGroup: 'Dairy' },
      { id: 'nc5', name: 'Media crema',   requiredQty: '1 cup',  acquiredQty: '1 cup',  status: 'acquired', foodGroup: 'Dairy' },
    ],
  },
  {
    foodGroup: 'Protein',
    items: [
      { id: 'nc6', name: 'Chicken breast', requiredQty: '1.4 kg', acquiredQty: '1.4 kg', status: 'acquired', foodGroup: 'Protein' },
    ],
  },
  {
    foodGroup: 'Grains & Pantry',
    items: [
      { id: 'nc7', name: 'Chipotle in adobo', requiredQty: '1 can', acquiredQty: '1 can', status: 'acquired', foodGroup: 'Grains & Pantry' },
      { id: 'nc8', name: 'Rolled oats',       requiredQty: '1 bag', acquiredQty: '0',     status: 'skipped',  foodGroup: 'Grains & Pantry' },
    ],
  },
]

// Cook-status per menu slot (day × meal). Absent = planned.
export type CookStatus = 'planned' | 'cooked' | 'skipped'

export type MockSlotStatus = {
  day: string
  meal: MealKey
  cookStatus: CookStatus
  // true = some required ingredient was not acquired (derived alert)
  hasShoppingAlert?: boolean
}

export const MOCK_SLOT_STATUSES: MockSlotStatus[] = [
  { day: 'Mon', meal: 'Breakfast', cookStatus: 'cooked' },
  { day: 'Mon', meal: 'Lunch',     cookStatus: 'cooked' },
  { day: 'Mon', meal: 'Dinner',    cookStatus: 'cooked' },
  { day: 'Tue', meal: 'Breakfast', cookStatus: 'cooked' },
  { day: 'Tue', meal: 'Lunch',     cookStatus: 'skipped' },
  { day: 'Tue', meal: 'Dinner',    cookStatus: 'cooked' },
  { day: 'Wed', meal: 'Breakfast', cookStatus: 'planned' },
  { day: 'Wed', meal: 'Lunch',     cookStatus: 'planned' },
  { day: 'Wed', meal: 'Dinner',    cookStatus: 'planned', hasShoppingAlert: true },
  { day: 'Thu', meal: 'Breakfast', cookStatus: 'planned' },
  { day: 'Thu', meal: 'Lunch',     cookStatus: 'planned', hasShoppingAlert: true },
  { day: 'Thu', meal: 'Dinner',    cookStatus: 'planned' },
  { day: 'Fri', meal: 'Breakfast', cookStatus: 'planned' },
  { day: 'Fri', meal: 'Lunch',     cookStatus: 'planned' },
  { day: 'Fri', meal: 'Dinner',    cookStatus: 'planned' },
  { day: 'Sat', meal: 'Breakfast', cookStatus: 'planned' },
  { day: 'Sat', meal: 'Lunch',     cookStatus: 'planned' },
  { day: 'Sat', meal: 'Dinner',    cookStatus: 'planned' },
  { day: 'Sun', meal: 'Breakfast', cookStatus: 'planned' },
  { day: 'Sun', meal: 'Lunch',     cookStatus: 'planned' },
]

// Ingredient substitution example — Wed Dinner: swap roma tomatoes → tomatillos
export type MockIngredientOverride = {
  day: string
  meal: MealKey
  originalIngredient: string
  substituteIngredient: string
  originalQty: string
  substituteQty: string
  note?: string
}

export const MOCK_INGREDIENT_OVERRIDE: MockIngredientOverride = {
  day: 'Wed',
  meal: 'Dinner',
  originalIngredient: 'Roma tomatoes',
  substituteIngredient: 'Tomatillos',
  originalQty: '2 pcs',
  substituteQty: '3 pcs',
  note: 'Green pozole variant — tomatillos preferred this week',
}

// Suggested substitutes for the substitution UI
export const MOCK_SUGGESTED_SUBSTITUTES = [
  { id: 'sub1', name: 'Tomatillos',       note: 'Common substitute for green sauces' },
  { id: 'sub2', name: 'Cherry tomatoes',  note: 'Sweeter, adjust qty' },
  { id: 'sub3', name: 'Canned tomatoes',  note: '1 can ≈ 3 fresh roma' },
]

// Pantry-annotated grocery lines — full required qty + on-hand annotation.
// annotateWithInventory shape (pure read-side, grocery_items never mutated).
export type MockAnnotatedGroceryItem = {
  id: string
  name: string
  requiredQty: number
  unit: string
  onHandQty: number
  suggestedToBuy: number
  foodGroup: string
  // true = on-hand fully covers required (candidate for collapse)
  fullyCovered: boolean
}

export type MockAnnotatedGroceryGroup = {
  foodGroup: string
  items: MockAnnotatedGroceryItem[]
}

export const MOCK_ANNOTATED_GROCERY: MockAnnotatedGroceryGroup[] = [
  {
    foodGroup: 'Produce',
    items: [
      { id: 'ag1', name: 'Roma tomatoes', requiredQty: 6,   unit: 'pcs', onHandQty: 4,   suggestedToBuy: 2,   foodGroup: 'Produce',        fullyCovered: false },
      { id: 'ag2', name: 'Avocados',      requiredQty: 3,   unit: 'pcs', onHandQty: 1,   suggestedToBuy: 2,   foodGroup: 'Produce',        fullyCovered: false },
      { id: 'ag3', name: 'Strawberries',  requiredQty: 500, unit: 'g',   onHandQty: 500, suggestedToBuy: 0,   foodGroup: 'Produce',        fullyCovered: true  },
    ],
  },
  {
    foodGroup: 'Dairy',
    items: [
      { id: 'ag4', name: 'Cream cheese',  requiredQty: 380, unit: 'g',   onHandQty: 190, suggestedToBuy: 190, foodGroup: 'Dairy',          fullyCovered: false },
      { id: 'ag5', name: 'Media crema',   requiredQty: 240, unit: 'ml',  onHandQty: 0,   suggestedToBuy: 240, foodGroup: 'Dairy',          fullyCovered: false },
    ],
  },
  {
    foodGroup: 'Protein',
    items: [
      { id: 'ag6', name: 'Chicken breast', requiredQty: 1400, unit: 'g', onHandQty: 150, suggestedToBuy: 1250, foodGroup: 'Protein',       fullyCovered: false },
    ],
  },
  {
    foodGroup: 'Grains & Pantry',
    items: [
      { id: 'ag7', name: 'Chipotle in adobo', requiredQty: 1, unit: 'can', onHandQty: 1, suggestedToBuy: 0, foodGroup: 'Grains & Pantry', fullyCovered: true  },
      { id: 'ag8', name: 'Rolled oats',       requiredQty: 1, unit: 'bag', onHandQty: 0, suggestedToBuy: 1, foodGroup: 'Grains & Pantry', fullyCovered: false },
    ],
  },
]

// Per-member grocery breakdown (for the Everyone / By member picker)
export type MockMemberGroceryRow = {
  memberId: string
  memberName: string
  accent: AccentKey
  items: MockAnnotatedGroceryItem[]
}

export const MOCK_MEMBER_GROCERY: MockMemberGroceryRow[] = [
  {
    memberId: 'm1',
    memberName: 'Jorge',
    accent: 'strawberry',
    items: [
      { id: 'mg1', name: 'Rolled oats',   requiredQty: 200, unit: 'g',   onHandQty: 0, suggestedToBuy: 200, foodGroup: 'Grains & Pantry', fullyCovered: false },
      { id: 'mg2', name: 'Strawberries',  requiredQty: 250, unit: 'g',   onHandQty: 250, suggestedToBuy: 0, foodGroup: 'Produce',        fullyCovered: true  },
    ],
  },
  {
    memberId: 'm3',
    memberName: 'Mateo',
    accent: 'ocean',
    items: [
      { id: 'mg3', name: 'Rolled oats',   requiredQty: 100, unit: 'g',   onHandQty: 0, suggestedToBuy: 100, foodGroup: 'Grains & Pantry', fullyCovered: false },
      { id: 'mg4', name: 'Strawberries',  requiredQty: 150, unit: 'g',   onHandQty: 150, suggestedToBuy: 0, foodGroup: 'Produce',        fullyCovered: true  },
      { id: 'mg5', name: 'Chicken breast', requiredQty: 400, unit: 'g',  onHandQty: 0, suggestedToBuy: 400, foodGroup: 'Protein',        fullyCovered: false },
    ],
  },
]
