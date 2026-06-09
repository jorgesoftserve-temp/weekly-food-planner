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
- Accent color (v1.8) — a per-member visual identity used wherever the member is named in a shared workspace; see [§12.2](#122-per-member-accent-color)

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

## 4.0.1 Add a slot to an existing draft

Beyond the existing "Replace recipe" affordance on each slot, draft review now exposes an **Add meal** action on every day card. Use cases:

- Add a special dinner for one member (e.g. an adult's late-night meal the engine didn't plan).
- Add a meal on a day the engine left empty (e.g. when a member's frequency override only covered breakfasts).

Rules:
- Caller must be creator/admin.
- The menu must still be a draft (not accepted).
- For **weekly** menus the server re-runs the engine's hard-constraint filter against the target member (or the first participant for shared slots); a violation returns 422 (allergy, dietary restriction, ingredient exclusion, or meal-type mismatch).
- For **custom** menus the engine check is skipped, matching the existing custom-menu "user owns the constraint set" stance.
- `target_member_id` must be one of the menu's participants. Targeting a non-participant returns 422.
- The server auto-derives a unique `meal_key` for the new slot within the same (day, target_member_id) bucket — `{meal_type}` for the first occurrence, `{meal_type}_2`, `_3`, … up to 7. The DB constraint on `(menu_id, day_of_week, meal_key, target_member_id)` is `NULLS NOT DISTINCT`, so the bucket boundary respects null/non-null `target_member_id` separately.

Created slots set `is_overridden = false` and leave `original_recipe_id` NULL — they're user-added from scratch, not modifications of an engine pick.

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

## Servings-aware scaling

Every ingredient contribution to the grocery list is scaled by `eaters / recipe.servings` — the cook-once model. A 4-serving recipe used for 2 eaters needs half its ingredients.

- **Per-member slot** (engine output; `target_member_id` is set): `eaters = 1`. The slot is cooked for one person.
- **Shared slot** (custom mode only; `target_member_id` is null): `eaters = participantCount`. The slot represents one cook event that feeds the menu's whole participant set.
- **Shared bucket** sums every slot's scaled contribution. For an engine-only menu (every slot per-member), that naturally totals to `participantCount × per-person`.
- **Per-member bucket** only counts member-targeted slots; null-target shared slots don't belong to any one person's per-member breakdown.

Combined with the shop-for-subset filter (§7.1): the shared bucket scales further by `selectedCount / participantCount` at view time. The two transforms compose: the persisted shared bucket is the full household total, and the picker rescales it to whatever subset the user is shopping for right now.

## Shared Grocery List
Aggregated ingredients shared across the workspace's meals.

---

## Member-specific grocery lists
Separate ingredients required by a single member due to:
- Allergies forcing a substitution
- Dietary substitutions for that member
- A member-specific meal slot (the engine assigned a different recipe to this member because the shared recipe violated their hard constraints)

## 7.1 Shop-for-subset filter

Once a menu is accepted and the grocery list is on the page, the user can narrow the household down to a subset they're shopping for **right now** (e.g. shopping for me + the kid this week, not the whole family).

- **Pure read-side** — the filter never mutates the accepted menu or the persisted grocery items. It's a presentation-only rescaling.
- **Shared bucket**: every quantity is multiplied by `selectedCount / participantCount`, where `participantCount` is the menu's persisted `menu_participants` count (the head-count denominator the menu was built for).
- **Per-member buckets**: only buckets belonging to selected members are shown. Quantities are untouched because a per-member slot was already produced for a single eater.
- **State lives in the URL** (`?shop_for=uuid,uuid`) so refreshing or sharing the link keeps the same scope. Absent param = "whole household".
- **Exports honour the filter.** Markdown and CSV downloads pick up the picker's current selection via the same `?shop_for=` query param on the export endpoint — the downloaded file reflects whatever the user is looking at on screen. Absent param = full unfiltered household list.

## 7.2 Per-item notes & substitutions (v1.8)

Every grocery line carries an optional **free-text note** — a no-metadata field where the shopper jots a substitution, a brand preference, or a reminder (e.g. *"Replace with oat-based crema"*, *"the big bag is cheaper"*). It is shown as a small comment on a half-width row under the item, with a **Replace** affordance that focuses the same field.

Rules:
- The note is **purely presentational text** — it never feeds the engine, never changes quantities/units, and never affects determinism. It is a human annotation on an already-computed list.
- Notes are **workspace-shared**, attached to the accepted menu's grocery line, so the whole household sees the same annotation.
- **Notes survive a grocery recompute.** The grocery list is regenerated from the accepted menu (slot edits, shop-for changes upstream). A recompute that rebuilds `grocery_items` rows must **re-apply** any existing note keyed by `(list scope, ingredient)` so a user's annotation isn't silently lost when the list is rebuilt. A note whose ingredient no longer appears on the recomputed list is dropped. See [DATABASE_PRD.md §6.14](./DATABASE_PRD.md) and [ARCHITECTURE_PRD.md §7](./ARCHITECTURE_PRD.md).
- Any workspace member may add/edit/clear a note (it's a shopping aid, not an admin-gated mutation).

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
- Displays all days of the generated window.
- Shows every meal slot per member, with recipe titles and images.
- Visually distinguishes shared slots from member-specific slots.
- Surfaces the **effective** per-menu overlay used (if any) so users can see what extra constraints shaped this week.
- **(v1.8) Day × meal grid + member selector.** On wide screens the week renders as a grid — one row per day, one column per meal slot (Breakfast / Lunch / Dinner / snacks) — so every meal of every day is visible at once, matching the underlying day × `meal_key` model (not one dish per day). A **member selector** ("Everyone" + a chip per member, tinted with that member's accent — see [§12.2](#122-per-member-accent-color)) scopes the grid to whose plan you're viewing. Empty slots offer an inline "Add meal"; a filled slot opens [Cook mode](#13-cook-mode--cooking-progress-v18).

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

---

# 12. Personalization & appearance (v1.8)

v1.8 introduces a warm strawberry-branded visual system with light/dark theming and two distinct accent mechanisms. None of these touch the engine, the menu/grocery contracts, or determinism — they are presentation + per-account/per-member preference only. Visual language is owned by the `design-system-architect`; tokens live in [`docs/design/color-palette.md`](../design/color-palette.md) and [`docs/design/user-accent-colors.md`](../design/user-accent-colors.md).

## 12.1 Per-user accent color (already shipped in v1.8 Phase 1)

Each **authenticated account** picks an accent color that **follows the user across every workspace** (Google-Drive / Monday style). It recolors a constrained, safe surface set — active nav item, focus rings, selected chips, links, the avatar, and the header gradient wash — and **never** recolors primary CTAs (stay brand strawberry) or destructive actions (stay crimson), so brand and safety stay consistent.

- Curated set: `strawberry` (default), `moss`, `teal`, `amber`, `ocean`, `plum`. Adding a color is a migration, not a free-text label.
- Persisted on the `profiles` table (one row per `auth.users` id), self-only RLS, created at signup. See [DATABASE_PRD.md §6.0](./DATABASE_PRD.md).
- Set SSR via `data-accent` on the shell (no FOUC), with optimistic client preview from the Appearance card in Settings.

## 12.2 Per-member accent color (v1.8)

Distinct from the per-user accent: every **workspace member** (including recipient-only members who have no login) carries an accent used as a **visual identity wherever that member is named in a shared workspace** — the member selector chips on the dashboard and menu grid, role/identity badges on the Members page, and a small dot/ring by their name. It answers *"whose plan / whose meal is this?"* at a glance without flooding the UI with color.

- Used **only** on member-tied surfaces (selectors, badges, dots, the active member's chip). It is not the user's global accent and does not recolor the chrome.
- Stored on `workspace_members.accent_color` (nullable). When null, the UI derives a stable accent deterministically from the member id so existing members look intentional without a backfill; an admin (or the member) can set an explicit one. See [DATABASE_PRD.md §6.2](./DATABASE_PRD.md).

## 12.3 Light / dark / system theme

A theme toggle (Light / Dark / System) is available in the app header and in Settings. Every brand token, gradient, and accent has a dark-tuned variant. Theme is class-based (`next-themes`) and respects the OS preference under "System"; reduced-motion is honored for any hover/transition affordances.

---

# 13. Cook mode & cooking progress (v1.8)

A recipe now has two distinct views: the **detail** view (read-only reference — ingredients and steps shown for reading) and a **Cook mode** view (the hands-on cooking checklist). Cook mode is opened from a filled slot in the weekly menu or from the recipe detail's **Cook** button.

## 13.1 Cook mode view
- Both **ingredients and instructions are checkable** (unlike the read-only detail view), with an "N of M checked" progress header, so a cook can track where they are while cooking.
- Checking off **every instruction step** reveals an enabled **"Mark as cooked"** action that completes the dish for that slot and returns to the menu. Before all steps are checked the action is disabled with an explanatory label.
- Cook mode is a **presentation of existing recipe data** — it adds no recipe fields and has no engine impact.

## 13.2 Cooking progress ("Mark as cooked")
"Mark as cooked" records that a specific **menu slot** (a meal occurrence on a given day) was cooked.

- Recorded as a timestamp on the slot — `menu_slots.cooked_at` (and `cooked_by`) — set when the slot is completed and cleared if the user un-marks it. See [DATABASE_PRD.md §6.12](./DATABASE_PRD.md).
- **Any workspace member** may mark a slot cooked (it's a shared household action, not admin-gated), which requires a member-scoped write path on the otherwise service-role-managed `menu_slots` table — see [DATABASE_PRD.md §8](./DATABASE_PRD.md).
- It is **progress tracking only** — it never edits the recipe, the menu plan, or the grocery list, and has no effect on the engine or determinism.

## 13.3 "Meals cooked today" dashboard stat
The dashboard's old "recipes in your pool" tile (inventory trivia) is replaced with an actionable **"X / N meals cooked today"** stat: of the meal slots scheduled for today across the active menu (optionally scoped to the selected member), how many are marked cooked. It reads directly from `menu_slots.cooked_at` against today's day-of-week for the active menu — no new aggregate storage.

---

# 14. Global search (v1.8)

Cross-module search delivered in **two tiers** so the common case is one keystroke and power users still get precision. Search is **read-only** over existing workspace data (recipes, members, menus); it adds no new entities and respects RLS / workspace scoping.

## 14.1 Tier 1 — topbar instant search
- A keyword field in the app-shell header, available on every screen.
- Typing shows **grouped results inline** (Recipes / People / Menus …), each a thumbnail + name + meta, with a **"See all results"** footer that hands off to Tier 2.
- Results render **only once the user types** — an empty field shows a short hint, never a dump of everything.
- **Mobile-first:** under `sm` the header shows a search *icon* that opens a full-width top sheet with a large input (not a shrunken desktop pill).

## 14.2 Tier 2 — advanced search screen
- One bar split into dropdown segments: **which module** (Recipes / Weekly menu / Grocery / Members) + **per-module filters** (recipes: meal, cuisine, difficulty, dietary) + a **keyword**, for fine-tuning a query (cf. Airbnb's segmented query builder).
- Backed by a workspace-scoped search endpoint — see [ARCHITECTURE_PRD.md §9](./ARCHITECTURE_PRD.md).

No AI / semantic search — this is deterministic keyword + filter matching over existing tables. AI-assisted features remain out of scope until v3.0.
