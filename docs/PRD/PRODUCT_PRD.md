# Product PRD

# 1. Authentication & Authorization

## User Authentication

The application must support:

- Email/password registration
- Email verification (required before first sign-in)
- Login / Logout
- Password reset via email
- Session persistence
- Protected routes (server-side check that the user is authenticated and email-verified)

### Email verification flow

1. User submits email + password on signup.
2. Supabase sends a verification email containing a one-time link.
3. The UI lands the user on a "Check your email" screen.
4. After clicking the link the email is marked verified; the user can sign in.
5. Until verification is complete, sign-in attempts are rejected with a clear message and an option to resend the verification email.

---

## Account types

### Individual workspace
Single-user environment.

### Group workspace
Shared household environment.

A group contains:
- Creator
- Members (admins and members)
- Shared recipes
- Shared menus
- Shared grocery lists

Role definitions live in [§2.1](#21-roles).

---

# 2. Group members

## 2.1 Roles

Within a group workspace, every member holds exactly one role:

- **Creator** — the user who created the workspace. Holds all admin powers. Can transfer ownership and delete the workspace. Cannot be removed unless ownership is transferred. Exactly one creator per workspace.
- **Admin** — can invite or remove members, edit shared recipes, generate menus, and edit the shared meal schedule and shared dietary defaults.
- **Member** — can be a meal recipient with their own dietary profile. Can view recipes and menus. Can edit their own profile fields (allergies, ingredient dislikes, calorie target, meal frequency override). Cannot manage other members or workspace settings.

Members who are recipients only (e.g. a child) do not need an authenticated user account; they exist in the workspace as a recipient profile without login.

---

## 2.2 Member profile fields

### Required
- Name
- Age category
- Role (defaults to `member` for invited users)

### Optional
- Dietary restrictions (from the `dietary_restriction` set — see [DATABASE_PRD.md §5.2](./DATABASE_PRD.md))
- Allergies (from the `food_allergy` set — see [DATABASE_PRD.md §5.2](./DATABASE_PRD.md))
- Ingredient dislikes
- Daily calorie target
- Meal frequency

---

## 2.3 Meal frequency

A list of meals the member eats per day. Each entry has:

- `key` — stable identifier unique within the member's list (e.g. `morning_snack`)
- `title` — human-readable label for the UI
- `meal_type` — one of `breakfast`, `lunch`, `dinner`, `snack`; used by the constraint engine
- `default_hour` — integer 0–23, local time

Example for a child:

```json
[
  { "key": "breakfast",     "title": "Breakfast",     "meal_type": "breakfast", "default_hour": 6  },
  { "key": "morning_snack", "title": "Morning Snack", "meal_type": "snack",     "default_hour": 9  },
  { "key": "lunch",         "title": "Lunch",         "meal_type": "lunch",     "default_hour": 12 }
]
```

Sensible defaults per `age_category` ship with the system; members may override individually.

---

# 3. Recipe Management

Recipes are workspace-scoped: every member of a workspace can view its recipes; create/edit/delete is restricted to `creator` and `admin` roles. Recipes are **not** shared across workspaces in MVP.

## Recipe CRUD
Users with the right role must be able to:
- Create recipes
- Edit recipes
- Delete recipes
- View recipes

---

## Recipe fields

### Basic information
- Name
- Description
- Meal type
- Cuisine type
- Difficulty
- Prep time
- Cook time
- Servings
- Calories per serving
- Image (optional; uploaded to Supabase Storage)

---

### Ingredients
Each ingredient contains:
- Name
- Quantity
- Unit
- Optional substitutions
- Perishable flag
- Freshness data
- Image (on the ingredient catalog entry; optional)

---

### Recipe Instructions
Recipes contain ordered steps:
- Description
- Optional notes
- Estimated duration

---

### Dietary data
Recipes may include:
- Vegetarian
- Vegan
- Gluten-free
- Dairy-free
- Nut-free
- High-protein
- Low-carb

---

# 4. Menu generation

## Objective
Build a meal plan for any 1–7 day window. Two production paths exist:

- **Weekly (auto)** — engine-generated, deterministic, honours member profiles. Editable per slot.
- **Custom (manual)** — user-built, non-deterministic, free-form slots (any meal at any time, including multiple of the same meal type on one day). Editable per slot.

Both modes produce a **draft** the user reviews, edits, and accepts before it becomes the workspace's active menu for the week.

---

## 4.0 Pre-conditions

- The caller has a role of `creator` or `admin`.
- For `weekly` mode: the workspace contains at least one recipe. UI disables "Generate menu" and surfaces a "Create your first recipe" CTA when the pool is empty. The API enforces this server-side and returns a structured `empty_workspace` error.
- For `custom` mode: the user must add at least one slot before submitting. No engine pool requirement — the user can create recipes inline while building the menu.

---

## 4.1 Draft / accept lifecycle

Every menu lives in one of three states: **draft → accepted → superseded**.

1. **Generating creates a DRAFT.** Drafts are not the active menu; the previous accepted menu (if any) is untouched. At most one outstanding draft per `(workspace, week)`. Generating again while a draft exists replaces it.
2. **The user reviews the draft.** They can replace any slot's recipe; the server re-validates hard constraints and rejects violations. A "Modified" badge surfaces overridden slots; the engine's original recipe is preserved in `menu_slots.original_recipe_id` for audit.
3. **Acceptance** promotes the draft. The accepted menu drives the grocery list. The previously accepted menu (if any) is soft-deleted into history. A deterministic `accepted_seed` (SHA-256 over inputs + slot recipes) is stamped onto the accepted row so history rows can be uniquely identified — pristine acceptances effectively equal `inputs_hash`; modified acceptances diverge.
4. **Discard** removes a draft. Accepted menus cannot be discarded — they're superseded by a new acceptance and live on in history.
5. **Clone from history** copies a historical accepted menu into a fresh draft for any target week, preserving the source's seed and engine inputs (audit link via `cloned_from_menu_id`). User edits before accepting like any other draft.

Regeneration that fails (no valid solution) leaves any prior draft untouched and writes a failed `generation_runs` row.

### 4.1.1 Duration and start day

Weekly menus cover **1–7 consecutive days** starting from any calendar date. The engine derives the start day-of-week from `week_start_date` and walks forward, wrapping past Sunday → Monday when the duration exceeds the remaining week. The duration is part of the canonical input hash, so two regenerations with the same seed but different durations produce different menus.

### 4.1.3 Per-menu meal-frequency override + menu participants

A menu generation request can carry **two related per-menu inputs** that shape who the menu is for and how often they eat that week:

- **`participantMemberIds`** — the subset of household members this menu is for. Omitted/undefined means "every active member" (the household). An explicit empty array is rejected — pick at least one. The participant snapshot is persisted in a dedicated `menu_participants` junction so grocery scaling and history views read it as a structural fact, not a derived blob. Cloning a menu copies its participants verbatim.
- **`memberFrequencyOverrides`** — a list of `{ memberId, mealFrequency }` entries that replace the matching member's resolved frequency for this menu only. Members not in the list keep their profile cascade (member > workspace). An override with an empty `mealFrequency` array means "no slots for this member this menu" — that's the path for guests staying overnight or a kid skipping a dinner party.

The engine's frequency cascade is now: **override → member.mealFrequency → workspace.sharedMealFrequency → empty**. Overrides for member ids that aren't in `participantMemberIds` are silently dropped before persistence — non-participants can't sneak in via override entries.

### 4.1.2 Custom menus

- Slots are user-defined: any (day, meal_type, recipe) combination, including multiple of the same meal type on the same day (e.g. 2 breakfasts on Monday). `menu_key` is auto-derived from `meal_type` + occurrence to satisfy the slot unique constraint.
- The engine isn't invoked. The server only validates that each recipe belongs to the workspace and matches the slot's meal type.
- "Create new recipe" is available inline; the new recipe persists to the workspace catalog and is immediately selectable for any slot.
- Acceptance and history work identically to weekly menus. `seed` and `inputs_hash` are NULL on the persisted row; `accepted_seed` is still computed from the final slot state.

---

## 4.2 Per-menu constraint overlay

A menu generation request can carry **additional hard constraints** that apply to the whole week, layered on top of member profiles:

- **Additional dietary restrictions** — labels from the `dietary_restriction` set that should apply to every slot for this menu (e.g. make the whole week vegan because a vegan guest is visiting).
- **Additional food allergies** — extra allergen labels filtered from every recipe (e.g. one-off avoidance for a houseguest).
- **Ingredient exclusions** — recipes containing any of these ingredients are excluded (e.g. an out-of-season ingredient).

The overlay applies to every member's slots and every shared slot. The effective hard-constraint set for a slot is the **union** of the relevant member's profile constraints and the overlay.

### Silent dedup of overlay values

The overlay is intentionally non-strict. The server **silently drops** any value in `additional dietary restrictions` or `additional food allergies` that is already present on any member's matching profile field, then invokes the engine. The persisted `menus.generation_options` records the **effective overlay** (post-dedup), so the menu's audit trail reflects what actually shaped the result.

This keeps the UX friendly: a user adding "peanut" at the overlay level isn't blocked just because one member happens to already carry that allergy on their profile — the overlay just has no extra effect for that member and applies to everyone else.

Helpful UI nudge (not blocking): as the user types into the overlay's combobox, each value that duplicates a member-profile entry shows an inline note — *"Already on Alice — will be skipped"* — so the user understands why some entries won't influence the result. Submission proceeds regardless.

Ingredient exclusions have no member-profile equivalent (members carry only soft *dislikes*, never hard *exclusions*), so dedup does not apply to them — they always take effect as-is.

---

## Menu generator inputs

### Required (weekly mode)
- Group or user
- Available recipes
- Week start date (any calendar date — engine derives day-of-week)
- Duration (1–7 days, default 7)

### Required (custom mode)
- Group or user
- Week start date + duration
- At least one user-defined slot `{ day, meal_type, recipe_id }`

---

### Optional (both modes)
- Calorie targets
- Recipe repetition limits
- Preferred cuisines
- Ingredient exclusions
- Additional dietary restrictions — see [§4.2](#42-per-menu-constraint-overlay)
- Additional food allergies — see [§4.2](#42-per-menu-constraint-overlay)
- **Participant subset** — `participantMemberIds`; see [§4.1.3](#413-per-menu-meal-frequency-override--menu-participants)
- **Per-member meal-frequency override** — `memberFrequencyOverrides`; see [§4.1.3](#413-per-menu-meal-frequency-override--menu-participants)
- Random seed (weekly mode only — custom menus have no engine seed)
- Source menu id to clone from (clone mode only)

---

## Constraint Rules

### Hard constraints
Must never be violated:
- Allergies (member profile + per-menu overlay)
- Dietary restrictions (member profile + per-menu overlay)
- Ingredient exclusions (per-menu overlay)
- Invalid meal type assignment

---

### Soft Constraints
Should be optimized:
- Recipe variety
- Calorie balancing (uses `recipes.calories_per_serving`)
- Cuisine diversity
- Ingredient reuse
- Grocery simplification

---

# 5. Deterministic Output

The same:
- recipes
- restrictions
- inputs (including the *effective* per-menu overlay, after silent dedup)
- seed

must always generate:
- identical weekly menu
- identical grocery list

---

# 6. Failure handling

If generation fails:
- Return a structured error
- Explain the failed constraint
- Identify the affected member and meal

Example:
- *No valid dinner recipe found for gluten-free member.*

---

# 7. Grocery List Generation

## Shared Grocery List
Aggregated ingredients shared across the workspace's meals.

---

## Member-specific grocery lists
Separate ingredients required by a single member due to:
- Allergies forcing a substitution
- Dietary substitutions for that member
- A member-specific meal slot (the engine assigned a different recipe to this member because the shared recipe violated their hard constraints)

---

# 8. Grocery Freshness Rules

Ingredients may define:
- Max storage days
- Requires fresh purchase
- Same-day cooking requirement

Examples:
- Fresh fish
- Avocados
- Fresh herbs

---

# 9. Freshness-aware planning

The system should support:
- Splitting purchases during the week
- Freshness warnings
- Multi-purchase scheduling

---

# 10. Menu & grocery list viewing

The in-app menu and grocery list pages are first-class deliverables in MVP.

## Menu view
- Displays all 7 days of the generated week.
- Shows every meal slot per member, with recipe titles and images.
- Visually distinguishes shared slots from member-specific slots.
- Surfaces the **effective** per-menu overlay used (if any) so users can see what extra constraints shaped this week.

## Grocery list view
- Shared grocery list plus one section per member with member-specific items.
- Items grouped by `scheduled_purchase_day` so the user can shop in freshness-aware batches.

## PDF-ready layout
Both views are designed with a print/PDF-friendly layout and typography. PDF export is **out of MVP scope** but is planned for the next MVP — when it lands it will reuse the same templates without redesign.

---

# 11. Label suggestions and corrections

Several user-facing fields use extensible label sets backed by autocomplete: `cuisine` on recipes, dietary restrictions and allergies on members, dietary tags on recipes. All four follow the same suggestion UX — see [DATABASE_PRD.md §5.2](./DATABASE_PRD.md).

## 11.1 Suggestion behavior

- Suggestions appear on **debounced** user input (~300 ms).
- The input field is **never auto-filled or rewritten**; the user's typed value is preserved exactly as typed.
- The user can pick a suggestion (which replaces the input) or ignore the suggestions and save the value they typed — including a value not in the suggestion list.
- A saved value that wasn't already known becomes a **pending suggestion** visible (marked as "suggested") to other users in the workspace.

This gives users room to add legitimately new labels without being blocked, and to correct typos themselves before clicking save.

## 11.2 Correcting after save

- A user who saved a typoed (or otherwise unwanted) pending value can delete it from a **"My label suggestions"** view.
- Deleting a pending suggestion sets affected fields on the user's content to NULL. Before the deletion confirms, the UI shows how many items are affected ("Used by 3 recipes — continue?").
- Official (seeded) values cannot be deleted by regular users.

## 11.3 Allergies and the engine-matching caveat

Allergies use exactly the same suggestion UX as the other extensible labels: the user can pick from the standard list (peanut, tree nut, dairy, …) or type and save a value of their own.

**Safety bound to understand:** the constraint engine filters allergy-unsafe recipes by string-matching each member's allergy label against a catalog table (`ingredient_allergens`) that pairs ingredients with the allergens they contain. A *brand-new* pending allergen has no ingredient mappings yet, so the engine cannot exclude recipes based on it until someone — admin or another user — tags the relevant ingredients with that label.

To make this visible to users:

- When the user types an allergy that isn't an official value, the save form displays an inline note: *"This allergen isn't yet tagged on any ingredient. Recipes won't be filtered for it until ingredients are tagged."*
- The save still proceeds — the user owns their content. The note exists so the user understands the engine's matching boundary.
