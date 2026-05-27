# Database PRD

# 1. Purpose & scope

Defines the persistent data model, naming conventions, RLS rules, and migration practices for the Weekly Food Planner. Companion to [ARCHITECTURE_PRD.md](./ARCHITECTURE_PRD.md) and [PRODUCT_PRD.md](./PRODUCT_PRD.md).

---

# 2. Technology

- **PostgreSQL** via **Supabase**.
- Migrations managed with the Supabase CLI from `packages/supabase`:

  ```sh
  cd packages/supabase
  npx supabase migration new <file_name>
  ```

- Migration filenames follow the cursor-rule SQL style guide (prefixes `tbl_`, `enum_`, `rls_`, `fn_`, `sys_`, `trg_`, `idx_`).

---

# 3. Conventions

Per the cursor SQL style guide:

- `snake_case` for tables and columns.
- Tables: plural nouns (`recipes`, `workspaces`).
- Primary keys: `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`.
- Timestamps last: `created_at TIMESTAMPTZ DEFAULT now()`, `updated_at TIMESTAMPTZ DEFAULT now()` with a trigger.
- Migration order: functions → enums → tables (+ indexes + triggers) → RLS enable → RLS policies (unless function-scoped).

---

# 4. Entity overview

```
auth.users (Supabase)
    └── workspaces (1—N)
            ├── workspace_members (1—N)               // includes the creator
            │       ├── member_dietary_restrictions   (M—N → dietary_restriction label)
            │       ├── member_allergies              (M—N → food_allergy label)
            │       └── member_ingredient_dislikes    (M—N → ingredients)
            ├── recipes (1—N)                         // workspace-shared; no per-member ownership
            │       ├── recipe_ingredients   (M—N → ingredients)
            │       ├── recipe_instructions  (1—N)
            │       └── recipe_dietary_tags  (M—N → dietary_tag label)
            ├── menus (1—N)                           // carries generation_options for audit
            │       ├── menu_slots       (1—N → recipes)
            │       ├── grocery_lists    (1—N)
            │       │       └── grocery_items (1—N → ingredients)
            │       └── generation_runs  (1—N)        // audit trail
            └── ingredients (global catalog; see §6.6)
                    └── ingredient_allergens (M—N → food_allergy label; see §6.6.1)

enum_metadata (cross-cuts all enums and extensible labels; see §10)
```

---

# 5. Enumerations

Two kinds. The split is structural and follows from the user-facing UX described in [PRODUCT_PRD.md §11](./PRODUCT_PRD.md).

## 5.1 System enums (strict)

Backed by native Postgres enums. Values can only be added via migration. Used where the value is structural and never user-extensible in MVP.

| Enum | Values |
|---|---|
| `workspace_type` | `individual`, `group` |
| `workspace_role` | `creator`, `admin`, `member` |
| `age_category` | `infant`, `toddler`, `child`, `teen`, `adult`, `senior` |
| `meal_type` | `breakfast`, `lunch`, `dinner`, `snack` |
| `difficulty` | `easy`, `medium`, `hard` |
| `generation_status` | `pending`, `running`, `success`, `failed` |
| `day_of_week` | `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`, `sunday` |
| `unit` | `g`, `kg`, `ml`, `l`, `tsp`, `tbsp`, `cup`, `piece`, `slice`, `pinch`, `clove`, `can`, `pack` |
| `menu_type` | `weekly`, `custom` |

No user-suggestion path for these in MVP — a new value requires a migration.

## 5.2 Extensible labels (user-suggestable)

Stored as `text` columns. Allowed values are sourced from `enum_metadata` (§10). The application accepts user-typed values immediately by auto-creating an `enum_metadata` row (`is_pending=true`) so users never get blocked by a missing label. Users can later delete their own pending entries.

| Label set | Examples (official seed values) |
|---|---|
| `cuisine_type` | `italian`, `mexican`, `chinese`, `japanese`, `indian`, `mediterranean`, `american`, `french`, `thai`, `korean`, `vietnamese`, `middle_eastern`, `spanish`, `greek`, `brazilian`, `peruvian`, `caribbean`, `african`, `fusion`, `other` |
| `dietary_restriction` | `vegetarian`, `vegan`, `gluten_free`, `dairy_free`, `nut_free`, `egg_free`, `soy_free`, `pescatarian`, `halal`, `kosher`, `low_sodium`, `diabetic_friendly` |
| `dietary_tag` | all `dietary_restriction` values plus `high_protein`, `low_carb`, `keto`, `paleo`, `whole30` |
| `food_allergy` | `peanut`, `tree_nut`, `dairy`, `egg`, `soy`, `gluten`, `fish`, `shellfish`, `sesame`, `mustard`, `celery`, `lupin`, `mollusk`, `sulfite` |

Each column referencing an extensible label is `text` and validated by the application through a single RPC, `sys_save_label(enum_type, value)`, that ensures the value exists in `enum_metadata` (inserting a pending row if needed) before the dependent write proceeds. See §10 for the full lifecycle and §11 (UX) in PRODUCT_PRD for the corresponding behavior.

### Engine-matching note for `food_allergy`

The constraint engine filters allergy-unsafe recipes by string-matching a member's allergy labels against rows in `ingredient_allergens` (§6.6.1). A *brand-new* pending allergen has no ingredient mappings yet, so the engine cannot exclude recipes based on it until the catalog is tagged. The UI surfaces this caveat at save time — see [PRODUCT_PRD.md §11.3](./PRODUCT_PRD.md). This is the safety bound the user explicitly accepted when treating allergies as extensible.

---

# 6. Tables

Sketches only — exact SQL lives in migration files. Every mutable table receives an `updated_at` trigger from `fn_create_updated_at_trigger`. Tables that support soft delete carry an `is_deleted boolean NOT NULL DEFAULT false` column (see §6.16).

## 6.1 `workspaces`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `owner_id` | uuid NOT NULL | FK → `auth.users.id` |
| `type` | `workspace_type` NOT NULL | `individual` or `group` |
| `name` | text NOT NULL | |
| `shared_meal_frequency` | jsonb NULL | Optional shared schedule for group workspaces (see §7) |
| `is_deleted` | boolean NOT NULL DEFAULT false | Soft delete flag (§6.16) |
| `created_at`, `updated_at` | timestamptz | |

## 6.2 `workspace_members`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `workspace_id` | uuid NOT NULL | FK → `workspaces.id` ON DELETE CASCADE |
| `user_id` | uuid NULL | FK → `auth.users.id`. NULL for recipient-only members (e.g. a child without their own login) |
| `name` | text NOT NULL | display name within the workspace |
| `role` | `workspace_role` NOT NULL | |
| `age_category` | `age_category` NOT NULL | |
| `daily_calorie_target` | int NULL | |
| `meal_frequency` | jsonb NULL | Per-member override; see §7 |
| `is_deleted` | boolean NOT NULL DEFAULT false | Soft delete flag (§6.16) |
| `created_at`, `updated_at` | timestamptz | |

Constraints:

- UNIQUE `(workspace_id, user_id) WHERE user_id IS NOT NULL AND is_deleted = false`.
- Partial unique index on `(workspace_id) WHERE role='creator' AND is_deleted = false` — exactly one active creator per workspace.

## 6.3 `member_dietary_restrictions`

| Column | Type | Notes |
|---|---|---|
| `member_id` | uuid NOT NULL | FK → `workspace_members.id` ON DELETE CASCADE |
| `restriction` | text NOT NULL | Label from the `dietary_restriction` set; validated against `enum_metadata` (any state) |

Composite PK `(member_id, restriction)`.

## 6.4 `member_allergies`

| Column | Type | Notes |
|---|---|---|
| `member_id` | uuid NOT NULL | FK → `workspace_members.id` ON DELETE CASCADE |
| `allergy` | text NOT NULL | Label from the `food_allergy` set; validated against `enum_metadata` |

Composite PK `(member_id, allergy)`.

The engine consults `ingredient_allergens` (§6.6.1) to map a member's allergy labels to disallowed ingredients during hard-constraint filtering — by exact string match.

## 6.5 `member_ingredient_dislikes`

| Column | Type | Notes |
|---|---|---|
| `member_id` | uuid NOT NULL | FK → `workspace_members.id` ON DELETE CASCADE |
| `ingredient_id` | uuid NOT NULL | FK → `ingredients.id` |

Composite PK `(member_id, ingredient_id)`. Kept separate from allergies so the engine can treat dislikes as soft and allergies as hard.

## 6.6 `ingredients`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text NOT NULL UNIQUE | |
| `image_url` | text NULL | Supabase Storage URL |
| `is_perishable` | bool DEFAULT false | |
| `max_storage_days` | int NULL | |
| `requires_fresh` | bool DEFAULT false | |
| `same_day_cook` | bool DEFAULT false | |
| `created_at`, `updated_at` | timestamptz | |

Global catalog (not workspace-scoped). See §8 for RLS implications. No soft delete — catalog rows are service-role managed.

## 6.6.1 `ingredient_allergens`

| Column | Type | Notes |
|---|---|---|
| `ingredient_id` | uuid NOT NULL | FK → `ingredients.id` ON DELETE CASCADE |
| `allergy` | text NOT NULL | Label from the `food_allergy` set; validated against `enum_metadata` |

Composite PK `(ingredient_id, allergy)`.

Maps ingredients to the food allergens they contain. The engine joins this table with `member_allergies` (string-matching on `allergy`) to drop unsafe recipes during hard-constraint filtering. Seeded with sensible defaults during the ingredients catalog migration (e.g. `peanut → peanut`, `milk → dairy`).

## 6.7 `recipes`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `workspace_id` | uuid NOT NULL | FK → `workspaces.id`. Recipes are workspace-scoped; visible to all workspace members |
| `name` | text NOT NULL | |
| `description` | text | |
| `image_url` | text NULL | Supabase Storage URL |
| `meal_type` | `meal_type` NOT NULL | |
| `cuisine` | text NULL | Label from the `cuisine_type` set; validated against `enum_metadata` |
| `difficulty` | `difficulty` NOT NULL | |
| `prep_time_minutes` | int | |
| `cook_time_minutes` | int | |
| `servings` | int NOT NULL CHECK (`servings > 0`) | |
| `calories_per_serving` | int NULL | Used by the soft calorie-balancing constraint |
| `is_deleted` | boolean NOT NULL DEFAULT false | Soft delete flag (§6.16) |
| `created_at`, `updated_at` | timestamptz | |

No per-member recipe ownership. The engine handles per-member divergence at the slot layer via `menu_slots.target_member_id`.

## 6.8 `recipe_ingredients`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `recipe_id` | uuid NOT NULL | FK ON DELETE CASCADE |
| `ingredient_id` | uuid NOT NULL | FK → `ingredients.id` |
| `quantity` | numeric NOT NULL | |
| `unit` | `unit` NOT NULL | |
| `substitutions` | jsonb DEFAULT `'[]'::jsonb` | array of `{ ingredient_id, note }` |
| `is_perishable_override` | bool NULL | optional per-recipe override |

## 6.9 `recipe_instructions`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `recipe_id` | uuid NOT NULL | FK ON DELETE CASCADE |
| `step_order` | int NOT NULL | UNIQUE `(recipe_id, step_order)` |
| `description` | text NOT NULL | |
| `notes` | text | |
| `duration_minutes` | int | |

## 6.10 `recipe_dietary_tags`

| Column | Type | Notes |
|---|---|---|
| `recipe_id` | uuid NOT NULL | FK ON DELETE CASCADE |
| `tag` | text NOT NULL | Label from the `dietary_tag` set; validated against `enum_metadata` |

Composite PK `(recipe_id, tag)`.

## 6.11 `menus`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `workspace_id` | uuid NOT NULL | FK |
| `week_start_date` | date NOT NULL | First day of the menu (any calendar date — not required to be Monday). Naming is historical |
| `menu_type` | `menu_type` NOT NULL DEFAULT `'weekly'` | `weekly` = engine-generated deterministic menu. `custom` = user-built menu (no engine seed). See §6.11.2 |
| `duration_days` | int NOT NULL DEFAULT 7 CHECK (1..7) | Number of consecutive days the menu covers. Walks from `start_day_of_week`, wraps past Sunday → Monday if needed |
| `start_day_of_week` | `day_of_week` NOT NULL DEFAULT `'monday'` | Day-of-week implied by `week_start_date`. Cached to avoid recomputing from the date in queries |
| `seed` | bigint NULL | Engine RNG seed. NULL for `menu_type = 'custom'` |
| `inputs_hash` | text NULL | sha256 of canonical engine input JSON. NULL for `menu_type = 'custom'` |
| `generation_options` | jsonb NULL | Audit snapshot of the **effective** (post-dedup) per-menu overlay and other options used to produce this menu (see §6.11.1) |
| `cloned_from_menu_id` | uuid NULL | FK → `menus.id` ON DELETE SET NULL. Set when this menu was created via "Clone as draft" from a historical accepted menu. Pure audit link |
| `generated_at` | timestamptz NOT NULL DEFAULT NOW() | |
| `accepted_at` | timestamptz NULL | Set when a draft menu is accepted (§6.17). NULL while draft. The accepted menu is the workspace's active menu for the week and drives the grocery list |
| `accepted_seed` | text NULL | Hash of the final accepted state (engine output + any user overrides). NULL while draft. Distinct from `seed` so modified menus get a stable history identifier even though regenerating the engine wouldn't reproduce them |
| `is_deleted` | boolean NOT NULL DEFAULT false | Soft delete flag (§6.16); set true when superseded by acceptance, replaced by a newer draft, or explicitly discarded |

Partial unique indexes:

- UNIQUE `(workspace_id, week_start_date) WHERE is_deleted = false AND accepted_at IS NOT NULL` — only one accepted menu per (workspace, week).
- UNIQUE `(workspace_id, week_start_date) WHERE is_deleted = false AND accepted_at IS NULL` — only one outstanding draft per (workspace, week).

Historical (superseded) menus remain in the table for audit. See §6.17 for the draft → accept lifecycle.

### 6.11.2 Menu types

- **`weekly`** — produced by the constraint engine. Honours member `meal_frequency`, the per-menu dietary/allergy overlay, and the `duration_days` / `start_day_of_week` shape. Carries non-NULL `seed` and `inputs_hash`. Editable per slot during draft review.
- **`custom`** — user-built. Slots are supplied directly by the caller; the engine isn't invoked. `seed` and `inputs_hash` are NULL. Multiple slots can share `(day_of_week, meal_type)` (different `meal_key`s — e.g. `breakfast`, `breakfast_2`). Same draft / accept lifecycle as weekly. The user is responsible for the constraint set; the server only validates that each `recipe_id` belongs to the workspace and its `meal_type` matches the slot's `meal_type`.

### 6.11.1 `generation_options` shape

A copy of the **effective** (post-dedup) options block passed to the constraint engine, persisted for audit and for surfacing the per-menu overlay in the menu view. `additionalDietaryRestrictions` and `additionalAllergies` contain only the values that actually took effect — anything the user typed that already existed on a member profile is silently dropped before this snapshot is taken. `memberFrequencyOverrides` contains only entries whose `memberId` belongs to the menu's participant set (see §6.11a). Example:

```json
{
  "calorieTolerance": 100,
  "repetitionLimit": 3,
  "preferredCuisines": ["italian", "mediterranean"],
  "ingredientExclusions": ["mushroom"],
  "additionalDietaryRestrictions": ["vegan"],
  "additionalAllergies": ["sesame"],
  "memberFrequencyOverrides": [
    {
      "memberId": "uuid-of-alice",
      "mealFrequency": [
        { "key": "dinner", "title": "Dinner", "mealType": "dinner", "defaultHour": 19 }
      ]
    }
  ]
}
```

All keys are optional. An empty/absent `generation_options` means "no overlay; no extra options were supplied". See [PRODUCT_PRD.md §4.2](./PRODUCT_PRD.md) and [§4.1.3](./PRODUCT_PRD.md) for user-facing semantics.

## 6.11a `menu_participants`

| Column | Type | Notes |
|---|---|---|
| `menu_id` | uuid NOT NULL | FK → `menus.id` ON DELETE CASCADE |
| `member_id` | uuid NOT NULL | FK → `workspace_members.id` ON DELETE CASCADE |

Composite PK `(menu_id, member_id)`. Index on `(member_id)` for the reverse lookup ("which menus is this member in?"). No `is_deleted` — visibility follows the parent menu (see §6.16).

Snapshots the subset of household members the menu was generated for. Phase 4's grocery scaling formula (`eaters_for_shared = participant_count`, `eaters_for_member_targeted = 1`) uses `COUNT(*)` here as the household-eaters denominator. Cloning a menu copies the participant set verbatim. RLS read mirrors `menu_slots_read` (workspace-membership through the parent menu). See [PRODUCT_PRD.md §4.1.3](./PRODUCT_PRD.md).

Backfill: every pre-existing menu gets one row per active workspace member, so legacy menus behave as "for the whole household" without special-casing.

## 6.12 `menu_slots`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `menu_id` | uuid NOT NULL | FK ON DELETE CASCADE |
| `day_of_week` | `day_of_week` NOT NULL | |
| `meal_key` | text NOT NULL | For `weekly` menus, matches a key in the relevant `meal_frequency` (see §7). For `custom` menus, derived from meal_type + occurrence (`breakfast`, `breakfast_2`, …) to keep multiple meals of the same type on the same day unique |
| `meal_type` | `meal_type` NOT NULL | denormalized for engine queries |
| `recipe_id` | uuid NOT NULL | FK → `recipes.id` |
| `target_member_id` | uuid NULL | FK → `workspace_members.id`. NULL = shared |
| `is_overridden` | boolean NOT NULL DEFAULT false | TRUE when the user replaced the engine's pick during draft review. `recipe_id` holds the user-chosen recipe; `original_recipe_id` holds the engine's. Always FALSE for `custom` menus (user picked everything from the start, so "override" is not meaningful) |
| `original_recipe_id` | uuid NULL | FK → `recipes.id`. Engine's original pick before any user override. NULL on pristine slots and on `custom` menus |

UNIQUE NULLS NOT DISTINCT `(menu_id, day_of_week, meal_key, target_member_id)`. No own `is_deleted` — visibility follows the parent menu.

## 6.13 `grocery_lists`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `menu_id` | uuid NOT NULL | FK ON DELETE CASCADE |
| `target_member_id` | uuid NULL | NULL = shared |

UNIQUE `(menu_id, target_member_id)`.

## 6.14 `grocery_items`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `list_id` | uuid NOT NULL | FK ON DELETE CASCADE |
| `ingredient_id` | uuid NOT NULL | FK |
| `quantity` | numeric NOT NULL | |
| `unit` | `unit` NOT NULL | |
| `scheduled_purchase_day` | `day_of_week` NULL | engine output for freshness scheduling |

## 6.15 `generation_runs`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `menu_id` | uuid NULL | NULL while pending or on failure that produced no menu |
| `workspace_id` | uuid NOT NULL | FK |
| `seed` | bigint NOT NULL | |
| `inputs_hash` | text NOT NULL | |
| `status` | `generation_status` NOT NULL | |
| `error_payload` | jsonb NULL | See §11 |
| `started_at` | timestamptz NOT NULL DEFAULT now() | |
| `finished_at` | timestamptz NULL | |

`generation_runs` are append-only: a failed regeneration and a subsequent successful one both leave permanent rows. No soft delete. Pre-engine validation failures (`empty_workspace`) do not produce a `generation_runs` row — the engine was never invoked.

## 6.16 Soft delete model

The following tables carry `is_deleted boolean NOT NULL DEFAULT false`:

- `workspaces`
- `workspace_members`
- `recipes`
- `menus`

Rules:

- A soft-deleted row stays in the table; only its visibility changes.
- RLS read policies filter `is_deleted = false` by default. A service-role admin path can read soft-deleted rows for support and audit.
- Unique constraints become partial: e.g. `UNIQUE (workspace_id, week_start_date) WHERE is_deleted = false` so that a new menu can occupy the same slot after the previous one is soft-deleted.
- Child tables that cascade from a soft-deleted parent do NOT receive their own `is_deleted` column (e.g. `menu_slots`, `recipe_ingredients`, `grocery_lists`). They become unreachable through the soft-deleted parent and that is sufficient.
- Junction tables (`member_dietary_restrictions`, `member_allergies`, `member_ingredient_dislikes`, `recipe_dietary_tags`, `ingredient_allergens`) use direct delete — soft delete has no value there.
- A future maintenance job may hard-delete soft-deleted rows older than a configurable threshold (currently undefined; see §13).

## 6.17 Menu lifecycle (draft → accept)

Every menu — `weekly` or `custom` — moves through a three-state lifecycle: **draft → accepted → superseded**.

1. **Generation creates a DRAFT.** `POST /api/workspaces/[id]/menus` (any mode: `weekly`, `custom`, `clone`) inserts a new `menus` row with `accepted_at = NULL`. If an outstanding draft already exists for the same `(workspace_id, week_start_date)`, it is soft-deleted (`is_deleted = true`) before the new draft is inserted. The accepted menu (if any) is untouched.
2. **User reviews the draft.** They may replace any slot via `PATCH /api/workspaces/[id]/menus/[menuId]/slots/[slotId]` — server re-runs the engine's hard-constraint filter and rejects the change with 422 if it violates a hard constraint. Replaced slots set `is_overridden = true` and preserve the engine's original pick in `original_recipe_id`. Custom menus aren't validated this way because they were already user-picked.
3. **Acceptance promotes the draft.** `POST /api/workspaces/[id]/menus/[menuId]/accept`:
   - Computes `accepted_seed` = SHA-256 over `(inputs_hash, sorted slot tuples)`. Pristine acceptances effectively equal `inputs_hash`; modified acceptances diverge.
   - Soft-deletes the previously accepted menu for the same `(workspace_id, week_start_date)`.
   - Sets `accepted_at = NOW()` and `accepted_seed = <hash>` on the draft.
   - The accepted menu becomes the workspace's active menu for the week and drives the grocery list.
4. **Discard** (`DELETE /api/workspaces/[id]/menus/[menuId]`) soft-deletes a draft. Accepted menus cannot be discarded — they go to history when superseded by a new acceptance.
5. **Clone from history** (`POST /api/workspaces/[id]/menus` with `mode: 'clone'`) copies a historical accepted menu's slots into a new draft for any target week. The new draft inherits `seed`, `inputs_hash`, `generation_options`, `menu_type`, and `duration_days` from the source; `cloned_from_menu_id` records the source for audit. Same draft / accept flow afterwards.

Historical (soft-deleted) menus and their children remain queryable by service-role for audit. The partial unique indexes from §6.11 enforce one accepted + one draft maximum per `(workspace_id, week_start_date)`.

---

# 7. `meal_frequency` JSONB shape

Stored on `workspace_members.meal_frequency` (per-member) and on `workspaces.shared_meal_frequency` (workspace-wide shared schedule for group workspaces).

Each entry has a stable `key`, a display `title`, the `meal_type` used by the constraint engine, and a `default_hour` (0–23).

```json
[
  { "key": "breakfast",       "title": "Breakfast",       "meal_type": "breakfast", "default_hour": 6  },
  { "key": "morning_snack",   "title": "Morning Snack",   "meal_type": "snack",     "default_hour": 9  },
  { "key": "lunch",           "title": "Lunch",           "meal_type": "lunch",     "default_hour": 12 },
  { "key": "afternoon_snack", "title": "Afternoon Snack", "meal_type": "snack",     "default_hour": 15 },
  { "key": "dinner",          "title": "Dinner",          "meal_type": "dinner",    "default_hour": 19 }
]
```

Rules:

- `key` is unique within the array; it aligns with `menu_slots.meal_key`.
- The engine treats each entry as one slot per day × 7 days.
- A child profile with three entries produces 21 slots per week for that member.
- If a member sets `meal_frequency`, it overrides the workspace's `shared_meal_frequency` for slot assignment.

### `default_hour` semantics

`default_hour` is **informational** — it represents the hour at which the member is expected to eat that meal in their own local time. No timezone is stored or enforced. The current MVP does not schedule notifications, alarms, or any time-aware features off this value.

Its purpose is to:

1. Let a single member express multiple meals per day (e.g. breakfast at 6, morning snack at 9, lunch at 12) with stable identifiers.
2. Display the schedule in the UI so users understand when each slot is meant to be eaten.
3. Provide the substrate for a future MVP feature that links recipes to specific times of day.

Default `meal_frequency` per `age_category` is applied automatically by a `BEFORE INSERT` trigger on `workspace_members` (function `fn_default_meal_frequency_for_age`). Adults / teens / seniors default to breakfast + lunch + dinner; toddlers + children pick up an additional snack; infants are left NULL (deferring to whoever feeds them, which means the engine falls back to `workspaces.shared_meal_frequency`). Callers can pass an explicit `meal_frequency` to the insert to override the default, or `UPDATE` the row to `NULL` after creation to revert to workspace-level fallback (the "Inherit from workspace" toggle in the member form does this).

---

# 8. Row-Level Security

All tables enabled. Read policies on soft-deletable tables filter `is_deleted = false` by default; a separate service-role path can read all rows for support and audit.

Policy summary:

| Table | Read | Write |
|---|---|---|
| `workspaces` | any member of the workspace (active rows) | `creator` or `admin` |
| `workspace_members` | any member of the workspace (active rows) | `creator`/`admin` for other members; self can edit own profile fields |
| `member_dietary_restrictions`, `member_allergies`, `member_ingredient_dislikes` | any member of the workspace | self, or `creator`/`admin` |
| `recipes`, `recipe_ingredients`, `recipe_instructions`, `recipe_dietary_tags` | any member of the workspace (active recipes) | `creator` or `admin` |
| `ingredients`, `ingredient_allergens` | any authenticated user (global catalog) | service-role only |
| `menus`, `menu_slots`, `grocery_lists`, `grocery_items`, `generation_runs` | any member of the workspace (active menus for the read; runs are always visible) | service-role (engine pipeline) |
| `enum_metadata` | any authenticated user | service-role for official rows; users may insert pending rows via `sys_save_label` and delete their own pending rows via `sys_delete_enum_suggestion` (§10) |

A helper SQL function `fn_user_workspace_role(user_id, workspace_id) RETURNS workspace_role` centralizes role lookups so policies stay simple.

---

# 9. Triggers & functions

- `fn_create_updated_at_trigger()` — generic; attached to every mutable table.
- `sys_create_workspace_on_signup()` — on `auth.users` insert, creates an `individual` workspace and a `workspace_members` row with `role='creator'`. The workspace is functional once the user verifies their email.
- `trg_workspace_single_creator` — partial unique index on `(workspace_id) WHERE role='creator' AND is_deleted = false`.
- `sys_save_label(enum_type text, value text)` — RPC. Ensures an `enum_metadata` row exists for `(enum_type, value)`; inserts an `is_official=false, is_pending=true, suggested_by=auth.uid()` row if missing. Used by the application before any insert/update of an extensible-label column (cuisine, dietary_restriction, dietary_tag, food_allergy). Returns the canonical label.
- `sys_delete_enum_suggestion(enum_type text, value text)` — RPC. A user may delete an `enum_metadata` row where `is_official=false AND suggested_by = auth.uid()`. The function sets any references to that value to NULL within the caller's accessible scope, returning a count for the UI to show in the confirmation. Official rows are never deletable through this RPC.
- `fn_increment_enum_metadata_usage(enum_type text, value text)` — called by application code when an enum value is used, to drive popularity-sorted autocomplete.

---

# 10. `enum_metadata` and user suggestions

A single generic table backs autocomplete, search, and user-suggestion flows. It exists for every enum and label set — including the strict system enums (for display names and search) and the extensible labels (which it also gates).

## 10.1 `enum_metadata`

| Column | Type | Notes |
|---|---|---|
| `enum_type` | text NOT NULL | e.g. `dietary_restriction`, `cuisine_type`, `food_allergy`, `meal_type` |
| `value` | text NOT NULL | e.g. `vegan`, `italian`, `peanut`, `breakfast` |
| `display_name` | text NOT NULL | shown in UI |
| `description` | text | |
| `is_official` | bool NOT NULL | `true` = canonical / promoted |
| `is_pending` | bool NOT NULL DEFAULT false | `true` = user suggestion |
| `suggested_by` | uuid NULL | FK → `auth.users.id` for pending entries |
| `usage_count` | int NOT NULL DEFAULT 0 | popularity signal |
| `created_at`, `updated_at` | timestamptz | |

PK `(enum_type, value)`.

## 10.2 Lifecycle

Two lifecycles, by enum kind:

### System enums (strict — §5.1)
1. Every official value ships with a corresponding `enum_metadata` row (`is_official=true`) in the same migration that creates the enum.
2. No user-suggestion path in MVP. A new value requires a migration that both `ALTER TYPE`s the enum and inserts the metadata row.

### Extensible labels (§5.2 — cuisine_type, dietary_restriction, dietary_tag, food_allergy)
1. Every official seed value ships in `enum_metadata` (`is_official=true`).
2. When the user submits a value not present in `enum_metadata` for the relevant `enum_type`, the application calls `sys_save_label`. That RPC:
   - Inserts an `is_official=false, is_pending=true, suggested_by=<user>` row if missing.
   - Returns the canonical label string.
3. The caller then writes the value into the dependent column immediately — no migration required.
4. An admin (or, in a future MVP, a popularity threshold) may promote a pending value to `is_official=true`. Promotion is a metadata update only — no schema change because the column is already `text`.

## 10.3 Suggestion UX rules

- Suggestions appear in autocomplete on debounced input (~300 ms).
- Autocomplete **never** replaces the user's typed text; it only offers options.
- The user may save any value, including one not in the suggestion list. The value persists immediately as a pending entry.
- A user who created a pending entry may delete it via `sys_delete_enum_suggestion`. The RPC sets affected dependent columns to NULL after the UI surfaces an "X items will be affected" confirmation.
- Official (seeded) values cannot be deleted by regular users.
- For `food_allergy` specifically, the UI also surfaces a safety note when a typed allergen has no `ingredient_allergens` mappings — the engine cannot filter recipes for an untagged allergen. The save still proceeds (see §5.2 engine-matching note and [PRODUCT_PRD.md §11.3](./PRODUCT_PRD.md)).

See [PRODUCT_PRD.md §11](./PRODUCT_PRD.md) for the matching user-visible UX.

## 10.4 Why both an enum and a table (when applicable)

- For system enums: the native Postgres enum gives type safety, validated columns, and clean generated TypeScript types. The metadata table mirrors display names and search.
- For extensible labels: the column is `text`; the metadata table is the authoritative list. The schema cost (no enum-level type safety) is the deliberate trade-off for runtime extensibility.

---

# 11. Failure payload schema

`generation_runs.error_payload` JSON. The exact shape varies by `failed_constraint`; fields not relevant to a given failure are omitted.

Engine-side failure (during generation):

```json
{
  "failed_constraint": "no_valid_recipe",
  "scope": "member",
  "affected_member_id": "uuid",
  "affected_meal": { "day": "tuesday", "meal_key": "dinner" },
  "reason_code": "DIETARY_FILTERED_OUT_ALL_CANDIDATES",
  "human_message": "No valid dinner recipe found for gluten-free member."
}
```

`failed_constraint` is one of:
- `empty_workspace` — pre-engine; no recipes in the workspace. Returned synchronously to the API caller; no `generation_runs` row is written.
- `no_valid_recipe` — engine; the hard-constraint filter eliminated every candidate for some slot.
- `calorie_target_unreachable` — engine; no combination satisfies the calorie target within tolerance.
- `repetition_limit_exceeded` — engine; no combination respects the repetition limit.
- `internal_error` — engine; unexpected failure (logged for triage).

The per-menu overlay never produces a failure — duplicate values are silently dropped (see [PRODUCT_PRD.md §4.2](./PRODUCT_PRD.md) and [ARCHITECTURE_PRD.md §5 step 2](./ARCHITECTURE_PRD.md)).

---

# 12. Indexes

- `workspaces (owner_id) WHERE is_deleted = false`
- `workspace_members (workspace_id) WHERE is_deleted = false`, `(user_id) WHERE user_id IS NOT NULL AND is_deleted = false`
- `recipes (workspace_id) WHERE is_deleted = false`, `(workspace_id, meal_type) WHERE is_deleted = false`
- `recipes (cuisine) WHERE is_deleted = false` — supports filter/group by extensible label
- `recipe_ingredients (recipe_id)`, `(ingredient_id)`
- `recipe_dietary_tags (tag)` — supports filter by extensible label
- `member_allergies (allergy)` — supports engine join with `ingredient_allergens`
- `ingredient_allergens (allergy)` — supports engine join with `member_allergies`
- `menus (workspace_id, week_start_date) UNIQUE WHERE is_deleted = false`
- `menu_slots (menu_id)`
- `grocery_items (list_id)`
- `generation_runs (workspace_id, started_at DESC)`
- `enum_metadata (enum_type, usage_count DESC)`
- `enum_metadata (enum_type) WHERE is_pending = true` — moderation queue
- `ingredients (name)` text-search-friendly (`pg_trgm`)

---

# 13. Open data-model questions

- **Soft-delete cleanup** — when (if ever) should a maintenance job hard-delete rows where `is_deleted = true`?

---

# 14. Migration ordering example

Per the cursor SQL guide, in dependency order with timestamped filenames:

```
20260101000000_fn_create_updated_at_trigger.sql
20260101000100_enum_create_workspace_type.sql
20260101000101_enum_create_workspace_role.sql
20260101000102_enum_create_age_category.sql
20260101000103_enum_create_meal_type.sql
...                                              (one file per system enum — §5.1)
20260101000200_tbl_create_workspaces_with_trigger.sql
20260101000201_tbl_create_workspace_members_with_trigger.sql
20260101000202_tbl_create_ingredients_with_trigger.sql
20260101000203_tbl_create_ingredient_allergens.sql
20260101000204_tbl_create_recipes_with_trigger.sql
...                                              (remaining tables)
20260101000300_tbl_create_enum_metadata_with_seed.sql
20260101000301_sys_save_label.sql
20260101000302_sys_delete_enum_suggestion.sql
20260101000400_sys_create_workspace_on_signup.sql
20260101000500_rls_enable_tables.sql
20260101000600_rls_create_workspace_policies.sql
...                                              (one file per RLS group)
```
