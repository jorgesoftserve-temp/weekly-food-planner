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
Generate a valid 7-day meal plan.

---

## 4.0 Pre-conditions

Menu generation requires:

- The caller has a role of `creator` or `admin`.
- The workspace contains at least one recipe.

When a workspace has zero recipes the UI **must** disable the "Generate Menu" action and surface a "Create your first recipe" call-to-action as the primary path. The API also enforces this server-side and returns a structured "empty workspace" error if called with no recipes.

---

## 4.1 Regeneration

A workspace can have only one active menu per `(workspace, week_start_date)`. Regenerating the same week:

- Soft-deletes the previous menu (preserved in history with `is_deleted = true` — see [DATABASE_PRD.md §6.16](./DATABASE_PRD.md)).
- Creates a new menu as the active one for that week.
- Leaves both the prior `generation_runs` row and the new one in the audit trail.

Regeneration is the only mechanism for "editing" a generated menu in MVP — there is no in-place edit. A regeneration that fails (no valid solution) leaves the prior active menu untouched.

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

### Required
- Group or user
- Available recipes
- Week start date

---

### Optional
- Calorie targets
- Recipe repetition limits
- Preferred cuisines
- Ingredient exclusions
- Additional dietary restrictions — see [§4.2](#42-per-menu-constraint-overlay)
- Additional food allergies — see [§4.2](#42-per-menu-constraint-overlay)
- Random seed

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
