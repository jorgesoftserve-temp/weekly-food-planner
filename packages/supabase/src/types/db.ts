// Local DB-shaped types. Will be replaced by `pnpm db:gen:types` output once the
// local stack is up and `supabase gen types typescript` writes
// `src/database.types.ts`. Until then these mirror DATABASE_PRD enums.

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type AgeCategory = 'infant' | 'toddler' | 'child' | 'teen' | 'adult' | 'senior'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type WorkspaceRole = 'creator' | 'admin' | 'member'
export type WorkspaceType = 'individual' | 'group'
export type FoodGroupSource = 'seed' | 'ai' | 'unset'
/** (v2.0) How an inventory item entered the workspace pantry. DATABASE_PRD §5.1 */
export type InventorySource =
  | 'manual'
  | 'purchase'
  | 'leftover'
  | 'cook_remainder'
/** (v2.0) Overall lifecycle of a shopping session. DATABASE_PRD §5.1 */
export type ShoppingStatus = 'in_progress' | 'complete' | 'incomplete'
/** (v2.0) Per-grocery-line acquisition state within a shopping session. DATABASE_PRD §5.1 */
export type AcquiredStatus = 'pending' | 'acquired' | 'partial' | 'skipped'
/** (v2.0 Phase 4) Execution state of an accepted-menu slot. Absent row = planned. DATABASE_PRD §6.21 */
export type SlotCookStatus = 'planned' | 'cooked' | 'skipped'
/** (v2.1) Partitions recipes into engine-eligible meals vs accompaniment addons. DATABASE_PRD §5.1, §6.7 */
export type RecipeKind = 'meal' | 'addon'
/** (v2.1) Source of a grocery line: meal slot, attached addon, or extra (dormant until v2.2). DATABASE_PRD §5.1, §6.14 */
export type GrocerySource = 'meal' | 'addon' | 'extra'
/** (v2.1) Discriminates rows in member_dietary_preferences. DATABASE_PRD §5.1, §6.22 */
export type PreferenceKind = 'dietary_tag' | 'ingredient'

export type AccentColor =
  | 'strawberry'
  | 'moss'
  | 'teal'
  | 'amber'
  | 'ocean'
  | 'plum'
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

export type WorkspaceRow = {
  id: string
  type: WorkspaceType
  name: string
  shared_meal_frequency: unknown
  owner_id: string
  /** (v2.0) Workspace-level fallback for leftover expiry in days. DATABASE_PRD §6.1 */
  leftover_max_days: number
  is_deleted: boolean
  created_at: string
  updated_at: string
}

export type WorkspaceMemberRow = {
  id: string
  workspace_id: string
  user_id: string | null
  name: string
  role: WorkspaceRole
  age_category: AgeCategory
  daily_calorie_target: number | null
  meal_frequency: unknown
  is_deleted: boolean
}

export type RecipeRow = {
  id: string
  workspace_id: string
  name: string
  description: string | null
  image_url: string | null
  /** (v2.1) Replaced scalar meal_type; timeframes now live in recipe_meal_types junction. DATABASE_PRD §6.7 */
  recipe_kind: RecipeKind
  cuisine: string | null
  difficulty: Difficulty
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  servings: number
  calories_per_serving: number | null
  is_deleted: boolean
}

export type RecipeIngredientRow = {
  id: string
  recipe_id: string
  ingredient_id: string
  quantity: string | number
  unit: Unit
  substitutions: unknown
  is_perishable_override: boolean | null
}

export type RecipeInstructionRow = {
  id: string
  recipe_id: string
  step_order: number
  description: string
  notes: string | null
  duration_minutes: number | null
}

export type IngredientRow = {
  id: string
  name: string
  is_perishable: boolean
  max_storage_days: number | null
  requires_fresh: boolean
  same_day_cook: boolean
  image_url: string | null
  /** Extensible label from the food_group set. NULL until classified. See DATABASE_PRD §5.2 (v2.0). */
  food_group: string | null
  /** Tracks how the food_group value was assigned. See DATABASE_PRD §5.1 (v2.0). */
  food_group_source: FoodGroupSource
}

export type MenuRow = {
  id: string
  workspace_id: string
  week_start_date: string
  seed: number
  inputs_hash: string
  is_deleted: boolean
  created_at: string
}

export type MenuSlotRow = {
  id: string
  menu_id: string
  day_of_week: string
  meal_key: string
  meal_type: MealType
  recipe_id: string
  target_member_id: string | null
}

export type GroceryListRow = {
  id: string
  menu_id: string
  target_member_id: string | null
}

export type GroceryItemRow = {
  id: string
  /** FK to grocery_lists.id. Column name in DB is list_id. */
  list_id: string
  ingredient_id: string
  quantity: number
  unit: Unit
  scheduled_purchase_day: string | null
  /** (v2.1) Which pass emitted this line: meal slot, addon, or extra (dormant). DATABASE_PRD §6.14 */
  source: GrocerySource
}

export type ProfileRow = {
  id: string
  accent_color: AccentColor
  created_at: string
  updated_at: string
}

export type EnumMetadataRow = {
  id: string
  enum_type: string
  value: string
  is_official: boolean
  usage_count: number
}

// ---------------------------------------------------------------------------
// inventory_items (v2.0) — DATABASE_PRD §6.18
// ---------------------------------------------------------------------------

/** Full row shape returned from SELECT on inventory_items. */
export type InventoryItemRow = {
  id: string
  workspace_id: string
  ingredient_id: string
  source: InventorySource
  quantity: number
  unit: Unit
  expiration_date: string | null
  source_menu_id: string | null
  source_slot_id: string | null
  label: string | null
  is_consumed: boolean
  /** workspace_members.id of the creator, or null if the member was deleted */
  created_by: string | null
  created_at: string
  updated_at: string
}

/** Payload for inserting a new inventory item. id/created_at/updated_at are DB-generated. */
export type CreateInventoryItemPayload = {
  workspace_id: string
  ingredient_id: string
  source?: InventorySource
  quantity: number
  unit: Unit
  expiration_date?: string | null
  source_menu_id?: string | null
  source_slot_id?: string | null
  label?: string | null
  is_consumed?: boolean
  created_by?: string | null
}

/** Patch shape for PATCH / UPDATE on inventory_items. All fields optional. */
export type UpdateInventoryItemPatch = {
  quantity?: number
  unit?: Unit
  expiration_date?: string | null
  label?: string | null
  is_consumed?: boolean
}

// ---------------------------------------------------------------------------
// shopping_sessions (v2.0) — DATABASE_PRD §6.19
// ---------------------------------------------------------------------------

/** Full row shape returned from SELECT on shopping_sessions. */
export type ShoppingSessionRow = {
  id: string
  menu_id: string
  workspace_id: string
  status: ShoppingStatus
  /** Quantity-weighted completeness [0, 100]. NULL while in_progress. */
  completeness: number | null
  /** workspace_members.id of the creator, or null if the member was deleted. */
  created_by: string | null
  created_at: string
  updated_at: string
}

/** Payload for inserting a new shopping session. id/created_at/updated_at are DB-generated. */
export type CreateShoppingSessionPayload = {
  menu_id: string
  workspace_id: string
  status?: ShoppingStatus
  completeness?: number | null
  created_by?: string | null
}

/** Patch shape for PATCH / UPDATE on shopping_sessions. All fields optional. */
export type UpdateShoppingSessionPatch = {
  status?: ShoppingStatus
  completeness?: number | null
}

// ---------------------------------------------------------------------------
// shopping_item_status (v2.0) — DATABASE_PRD §6.20
// ---------------------------------------------------------------------------

/** Full row shape returned from SELECT on shopping_item_status. */
export type ShoppingItemStatusRow = {
  id: string
  session_id: string
  grocery_item_id: string
  acquired_quantity: number
  status: AcquiredStatus
  created_at: string
  updated_at: string
}

/** Payload for inserting a new shopping item status row. id/created_at/updated_at are DB-generated. */
export type CreateShoppingItemStatusPayload = {
  session_id: string
  grocery_item_id: string
  acquired_quantity?: number
  status?: AcquiredStatus
}

/** Patch shape for PATCH / UPDATE on shopping_item_status. All fields optional. */
export type UpdateShoppingItemStatusPatch = {
  acquired_quantity?: number
  status?: AcquiredStatus
}

// ---------------------------------------------------------------------------
// slot_completions (v2.0 Phase 4) — DATABASE_PRD §6.21
// ---------------------------------------------------------------------------

/** Full row shape returned from SELECT on slot_completions. */
export type SlotCompletionRow = {
  id: string
  menu_slot_id: string
  workspace_id: string
  status: SlotCookStatus
  /** Server-clock timestamp set when status flips to 'cooked'; NULL otherwise. */
  cooked_at: string | null
  notes: string | null
  /** workspace_members.id of who recorded the status, or null if that member was deleted. */
  created_by: string | null
  created_at: string
  updated_at: string
}

/** Payload for inserting a slot completion. id/created_at/updated_at are DB-generated. */
export type CreateSlotCompletionPayload = {
  menu_slot_id: string
  workspace_id: string
  status?: SlotCookStatus
  cooked_at?: string | null
  notes?: string | null
  created_by?: string | null
}

/** Patch shape for PATCH / UPDATE on slot_completions. All fields optional. */
export type UpdateSlotCompletionPatch = {
  status?: SlotCookStatus
  cooked_at?: string | null
  notes?: string | null
}

/**
 * (v2.0 Phase 6) Menu-level ingredient substitution. Keyed by menu_slot_id so it
 * is structurally unreachable from accepted_seed and the engine — overrides are
 * post-accept menu state consumed ONLY by grocery recompute. DATABASE_PRD §6.22.
 */
export type MenuSlotIngredientOverrideRow = {
  id: string
  menu_slot_id: string
  workspace_id: string
  original_ingredient_id: string
  substitute_ingredient_id: string
  /** Optional qty adjustment; NULL = keep the recipe's planned quantity. */
  quantity: number | null
  /** Optional unit adjustment; NULL = keep the recipe's planned unit. */
  unit: Unit | null
  note: string | null
  /** workspace_members.id of who created the override, or null if that member was deleted. */
  created_by: string | null
  created_at: string
  updated_at: string
}

/** Payload for upserting an override. id/created_at/updated_at are DB-generated. */
export type CreateMenuSlotIngredientOverridePayload = {
  menu_slot_id: string
  workspace_id: string
  original_ingredient_id: string
  substitute_ingredient_id: string
  quantity?: number | null
  unit?: Unit | null
  note?: string | null
  created_by?: string | null
}

// ---------------------------------------------------------------------------
// member_dietary_preferences (v2.1 Track C) — DATABASE_PRD §6.22
// ---------------------------------------------------------------------------

/**
 * (v2.1) Inclusive (soft-bias) preference for a member: liked dietary tags or
 * ingredients. Does NOT hard-exclude; used as a soft-bias at generation time.
 * Database has an additional workspace_id column (for RLS) not present in the
 * sibling hard-constraint tables.
 */
export type MemberDietaryPreferenceRow = {
  id: string
  member_id: string
  workspace_id: string
  kind: PreferenceKind
  value: string
  created_at: string
}

/** Payload for inserting a new inclusive dietary preference. id/created_at are DB-generated. */
export type CreateMemberDietaryPreferencePayload = {
  member_id: string
  workspace_id: string
  kind: PreferenceKind
  value: string
}

// ---------------------------------------------------------------------------
// recipe_meal_types (v2.1 Phase 8) — DATABASE_PRD §6.23
// ---------------------------------------------------------------------------

/**
 * (v2.1) Pure junction: one row per (recipe_id, meal_type) declaring which
 * meal timeframes a recipe is eligible for. No timestamps; mirrors
 * recipe_dietary_tags. ≥1 row required for recipe_kind='meal'.
 */
export type RecipeMealTypeRow = {
  recipe_id: string
  meal_type: MealType
}

// ---------------------------------------------------------------------------
// menu_addons (v2.1 Track D) — DATABASE_PRD §6.24
// ---------------------------------------------------------------------------

/**
 * (v2.1) Addon attachment to an accepted menu. target_slot_id=NULL means
 * whole-week; set = tied to a specific slot. Keyed by menu_id so it is
 * structurally invisible to accepted_seed. DATABASE_PRD §6.24.
 */
export type MenuAddonRow = {
  id: string
  menu_id: string
  workspace_id: string
  addon_recipe_id: string
  target_slot_id: string | null
  servings: number | null
  note: string | null
  /** workspace_members.id of the attacher, or null if that member was deleted. */
  created_by: string | null
  created_at: string
  updated_at: string
}

/** Payload for inserting a menu_addons row. id/created_at/updated_at are DB-generated. */
export type CreateMenuAddonPayload = {
  menu_id: string
  workspace_id: string
  addon_recipe_id: string
  target_slot_id?: string | null
  servings?: number | null
  note?: string | null
  created_by?: string | null
}

/** Patch shape for PATCH / UPDATE on menu_addons. All fields optional. */
export type UpdateMenuAddonPatch = {
  servings?: number | null
  note?: string | null
  target_slot_id?: string | null
}
