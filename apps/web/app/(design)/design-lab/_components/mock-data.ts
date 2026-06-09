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
}

export const MOCK_RECIPES: MockRecipe[] = [
  { id: 'r1', name: 'Chicken Tinga Tostadas', image: photo('tostada,mexican,food', 11), cuisine: 'Mexican', meal: 'Lunch', minutes: 35, difficulty: 'Easy', tags: ['High protein'] },
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
// day-row × meal-column grid. `null` = nobody eats that meal that day.
export const MEALS = ['Breakfast', 'Lunch', 'Dinner'] as const
export type MealKey = (typeof MEALS)[number]
export type MockDayMeals = { day: string; meals: Record<MealKey, MockRecipe | null> }

const R = MOCK_RECIPES
export const MOCK_WEEK: MockDayMeals[] = [
  { day: 'Mon', meals: { Breakfast: R[4]!, Lunch: R[0]!, Dinner: R[1]! } },
  { day: 'Tue', meals: { Breakfast: R[3]!, Lunch: R[5]!, Dinner: R[7]! } },
  { day: 'Wed', meals: { Breakfast: R[4]!, Lunch: R[6]!, Dinner: R[2]! } },
  { day: 'Thu', meals: { Breakfast: R[3]!, Lunch: R[0]!, Dinner: R[1]! } },
  { day: 'Fri', meals: { Breakfast: R[4]!, Lunch: R[5]!, Dinner: R[7]! } },
  { day: 'Sat', meals: { Breakfast: R[3]!, Lunch: R[6]!, Dinner: R[2]! } },
  { day: 'Sun', meals: { Breakfast: R[4]!, Lunch: R[0]!, Dinner: null } },
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
