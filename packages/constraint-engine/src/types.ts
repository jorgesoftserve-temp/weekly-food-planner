// Public types for the constraint engine.
// Every value crossing the package boundary MUST round-trip losslessly through
// JSON.stringify / JSON.parse. See ARCHITECTURE_PRD.md §4.2.

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

export type Unit =
  | 'g'
  | 'kg'
  | 'ml'
  | 'l'
  | 'tsp'
  | 'tbsp'
  | 'cup'
  | 'piece'
  | 'slice'
  | 'pinch'
  | 'clove'
  | 'can'
  | 'pack'

export type AgeCategory = 'infant' | 'toddler' | 'child' | 'teen' | 'adult' | 'senior'

export type Difficulty = 'easy' | 'medium' | 'hard'

export type WorkspaceRole = 'creator' | 'admin' | 'member'

export type WorkspaceType = 'individual' | 'group'

export type MealFrequencyEntry = {
  key: string
  title: string
  mealType: MealType
  defaultHour: number
}

export type WorkspaceSnapshot = {
  id: string
  type: WorkspaceType
  name: string
  sharedMealFrequency?: MealFrequencyEntry[]
}

export type MemberSnapshot = {
  id: string
  name: string
  role: WorkspaceRole
  ageCategory: AgeCategory
  dailyCalorieTarget?: number
  mealFrequency?: MealFrequencyEntry[]
  dietaryRestrictions: string[]
  allergies: string[]
  ingredientDislikes: string[]
}

export type IngredientSubstitution = {
  ingredientId: string
  note?: string
}

export type RecipeIngredientSnapshot = {
  ingredientId: string
  quantity: number
  unit: Unit
  substitutions: IngredientSubstitution[]
  isPerishableOverride: boolean | null
}

export type IngredientSnapshot = {
  id: string
  name: string
  isPerishable: boolean
  maxStorageDays: number | null
  requiresFresh: boolean
  sameDayCook: boolean
  allergens: string[]
}

export type RecipeSnapshot = {
  id: string
  name: string
  description?: string
  mealType: MealType
  cuisine?: string
  difficulty: Difficulty
  prepTimeMinutes?: number
  cookTimeMinutes?: number
  servings: number
  caloriesPerServing?: number
  ingredients: RecipeIngredientSnapshot[]
  dietaryTags: string[]
}

export type GenerateMenuOptions = {
  // soft constraints
  calorieTolerance?: number
  repetitionLimit?: number
  preferredCuisines?: string[]
  // hard constraints — per-menu overlay; applied via union with each member's profile
  // additionalDietaryRestrictions and additionalAllergies are the EFFECTIVE overlay
  // (post-dedup). The caller removes values already on any member's matching profile
  // field before invoking the engine. See ARCHITECTURE_PRD §5 step 2.
  ingredientExclusions?: string[]
  additionalDietaryRestrictions?: string[]
  additionalAllergies?: string[]
}

export type GenerateMenuInput = {
  workspace: WorkspaceSnapshot
  members: MemberSnapshot[]
  recipes: RecipeSnapshot[]
  ingredients: IngredientSnapshot[]
  weekStartDate: string
  seed: number
  options?: GenerateMenuOptions
  // Number of consecutive days the menu should cover (1..7). Defaults to 7
  // when omitted, preserving the original full-week behaviour. The first day
  // is the day-of-week implied by weekStartDate; subsequent days walk forward
  // through Monday→Sunday and wrap if needed. durationDays IS part of the
  // canonical input, so two runs with different durationDays produce
  // different inputs_hash values even with the same seed.
  durationDays?: number
  // ISO timestamp ("now"). When provided, buildSlots filters out any meal slot
  // whose (day, defaultHour) is before this moment. Required for the ongoing-week
  // UX: if today is Wed 2pm, the engine should not try to fill Mon/Tue or
  // Wed breakfast. Omit in unit tests to keep the deterministic 14-slot shape.
  // Including `now` in the hashed input means same-second regenerations remain
  // deterministic; later regenerations correctly produce different menus.
  now?: string
}

export type GeneratedSlot = {
  dayOfWeek: DayOfWeek
  mealKey: string
  mealType: MealType
  recipeId: string
  targetMemberId: string | null
}

export type GeneratedMenu = {
  weekStartDate: string
  seed: number
  slots: GeneratedSlot[]
}

export type GroceryItemSnapshot = {
  ingredientId: string
  quantity: number
  unit: Unit
  scheduledPurchaseDay: DayOfWeek | null
}

export type GroceryListSnapshot = {
  targetMemberId: string | null
  items: GroceryItemSnapshot[]
}

export type GroceryLists = {
  shared: GroceryListSnapshot
  perMember: Record<string, GroceryListSnapshot>
}

export type GenerationFailedConstraint =
  | 'empty_workspace'
  | 'no_valid_recipe'
  | 'calorie_target_unreachable'
  | 'repetition_limit_exceeded'
  | 'internal_error'

export type GenerationErrorScope = 'input' | 'member' | 'menu'

export type GenerationError = {
  failedConstraint: GenerationFailedConstraint
  scope: GenerationErrorScope
  affectedMemberId?: string
  // Set whenever affectedMemberId is set AND the engine has the member snapshot
  // in hand (i.e. not the MEMBER_NOT_FOUND case). Lets the UI render a name
  // instead of a UUID without re-querying.
  affectedMemberName?: string
  affectedMeal?: { day: DayOfWeek; mealKey: string }
  reasonCode: string
  humanMessage: string
}

export type GenerateMenuResult =
  | { ok: true; menu: GeneratedMenu; groceryLists: GroceryLists; inputsHash: string }
  | { ok: false; error: GenerationError }
