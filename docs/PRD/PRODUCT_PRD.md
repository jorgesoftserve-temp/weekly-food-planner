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

**Note (v2.0):** Per-menu ingredient substitution ([§20](#20-menu-level-ingredient-substitution-v20)) allows swapping an ingredient on an accepted menu for that menu only. The stored recipe is never altered by a substitution.

**Notes (v2.1):**

- A recipe carries a **kind** (`meal` | `addon`): `meal` recipes fill menu slots; `addon` recipes (salsa, guacamole, dessert) accompany meals but are never constraint-engine candidates — they are excluded at the input-builder boundary and are invisible to `accepted_seed` and the engine. See [§27](#27-addons--on-the-fly-cook-mode-v21).
- A `meal` recipe is eligible for one **or more** meal timeframes (breakfast, lunch, dinner, snack). The recipe form's single meal-type Select becomes a multi-select (≥1 required for `kind='meal'`). Existing recipes keep their current meal type as a one-element set. See [§26](#26-multi-timeframe-recipes-v21).
- Recipes can be created in **bulk** — many recipes plus their ingredients/instructions/dietary tags/meal-types saved in one transaction. The v2.1 primitive is the shared insert path for [v3](../../.claude/plans/v3.md) AI import and [v4.0](../../.claude/plans/v4.0.md) community import. See [§28](#28-bulk-recipe-creation-v21). Publish/import is documented in the community epic, [v4.0](../../.claude/plans/v4.0.md).

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
- **(v1.8) Day × meal grid + member selector.** On wide screens the week renders as a grid — one row per day, one column per meal slot (Breakfast / Lunch / Dinner / snacks) — so every meal of every day is visible at once, matching the underlying day × `meal_key` model (not one dish per day). A **member selector** ("Everyone" + a chip per member, tinted with that member's accent — see [§12.2](#122-per-member-accent-color)) scopes the grid to whose plan you're viewing. Empty slots offer an inline "Add meal"; a filled slot opens [Cook mode](#13-cook-mode--cooking-progress-v19).

## Grocery list view
- Shared grocery list plus one section per member with member-specific items.
- Items grouped by `scheduled_purchase_day` so the user can shop in freshness-aware batches.

## PDF-ready layout
Both views are designed with a print/PDF-friendly layout and typography. PDF export is **out of MVP scope** but is planned for the next MVP — when it lands it will reuse the same templates without redesign.

---

# 11. Label suggestions and corrections

Several user-facing fields use extensible label sets backed by autocomplete: `cuisine` on recipes, dietary restrictions and allergies on members, dietary tags on recipes, and **(v2.0)** `food_group` on ingredients. All five follow the same suggestion UX — see [DATABASE_PRD.md §5.2](./DATABASE_PRD.md).

**(v2.1)** Inclusive-preference tags (see [§25](#25-inclusive-vs-exclusive-dietary-restrictions-v21)) draw from the **same `dietary_tag` and ingredient label sets** as exclusive restrictions and dietary tags. No new label set is needed for inclusive preferences.

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

# 13. Cook mode & cooking progress (v1.9)

A recipe now has two distinct views: the **detail** view (read-only reference — ingredients and steps shown for reading) and a **Cook mode** view (the hands-on cooking checklist). Cook mode opens as a **full-screen Sheet from a filled slot in the weekly menu** (the SlotCard's "Cook" action). _Deferred:_ a "Cook" entry point on the recipe detail view.

## 13.1 Cook mode view
- Both **ingredients and instructions are checkable** (unlike the read-only detail view), with an "N of M steps done" progress header, so a cook can track where they are while cooking. The checklist is an ephemeral per-cook aid — it is not persisted.
- **"Mark as cooked"** is always available (it does not require checking every step first); it completes the dish for that slot and closes the Sheet. An already-cooked slot can be un-marked ("Mark as not cooked").
- Cook mode is a **presentation of existing recipe data** — it adds no recipe fields and has no engine impact.

## 13.2 Cooking progress ("Mark as cooked")
"Mark as cooked" records that a specific **menu slot** (a meal occurrence on a given day) was cooked.

- Recorded as a timestamp on the slot — `menu_slots.cooked_at` (and `cooked_by`) — set when the slot is completed and cleared if the user un-marks it. See [DATABASE_PRD.md §6.12](./DATABASE_PRD.md).
- **Any workspace member** may mark a slot cooked (it's a shared household action, not admin-gated), which requires a member-scoped write path on the otherwise service-role-managed `menu_slots` table — see [DATABASE_PRD.md §8](./DATABASE_PRD.md).
- It is **progress tracking only** — it never edits the recipe, the menu plan, or the grocery list, and has no effect on the engine or determinism.

## 13.3 "Meals cooked" dashboard stat
The dashboard gains an actionable **"N of M — Meals cooked"** stat: across the **active menu's** slots, how many are marked cooked (`cooked_at != null`) out of the total slot count. It reads directly from `menu_slots.cooked_at` over the active menu — no new aggregate storage. _Deferred:_ scoping the count to today's day-of-week or to the selected member.

---

# 14. Global search (v1.9)

A dedicated **`/search` route** delivers **recipes-first** search, with the surface built to extend to the other modules later. Search is **read-only** over existing workspace data; it adds no new entities and respects RLS / workspace scoping.

## 14.1 Shipped (v1.9) — recipes search screen
- One **segmented module bar** (Recipes / Weekly menu / Grocery / Members). **Recipes is active**; the other three render as **disabled "Soon" tabs** so the cross-module shape is visible without promising behaviour.
- **Recipe facets:** keyword + meal + difficulty + cuisine + dietary tag (cuisine/dietary options derived from the loaded recipes). Matching is **client-side over the existing recipes query** — no new search endpoint or cross-entity query layer. Results reuse the recipe card + the recipes detail/edit/delete overlays.
- Reached from a **sidebar nav entry**; `/search` is an authenticated route (middleware-protected).

## 14.2 Deferred (post-v1.9)
- **Topbar instant search** (a header keyword field with grouped inline results on every screen) — the `design-lab/_components/topbar-search.tsx` mock is the reference.
- **Cross-module search** over Weekly menu / Grocery / Members (the "Soon" tabs), which would introduce a workspace-scoped search endpoint — see [ARCHITECTURE_PRD.md §9](./ARCHITECTURE_PRD.md).

No AI / semantic search — this is deterministic keyword + filter matching over existing tables. AI-assisted features remain out of scope until v3.0.

---

# 15. Inventory **(v2.0)**

> Status: planned (v2.0). Implementation: [ARCHITECTURE_PRD.md §17](./ARCHITECTURE_PRD.md).

The workspace maintains a shared pantry (`inventory_items`) tracking ingredients on hand.

## 15.1 Item shape

Each inventory entry records:

- `ingredient_id` — reference to the ingredient catalog.
- `quantity` — numeric (≥ 0); decremented on partial-spoilage or consumption.
- `unit` — matches the unit enum from [DATABASE_PRD.md §5.1](./DATABASE_PRD.md).
- `expiration_date` — optional; may be set manually or defaulted on inflow (see §19 — Leftovers).
- `source` — how the item entered inventory: `manual` (user-entered), `purchase` (spilled over from a finalized shopping session), `leftover` (emitted when a slot is marked cooked — the prepared dish surplus), or `cook_remainder` (raw-ingredient shortfall from cook reconciliation — see §18.3 and §19). Display tags are derived from `source` at read time; see §15.4.
- `source_menu_id` / `source_slot_id` — optional back-references when `source` is `purchase`, `leftover`, or `cook_remainder`.
- `label` — optional free-text annotation (e.g. "organic", "freezer").
- `is_consumed` — soft-consume flag; a consumed item stays in the table for audit but is excluded from on-hand calculations.

## 15.2 Partial-spoilage decrement

When some of a batch has spoiled before the rest is used ("I have 2 rotten of 5 tomatoes"), the user decrements the `quantity` field directly — no event log in v2.0. The row's quantity reaches 0 when everything is consumed or has spoiled; at that point the item can be marked `is_consumed = true` or deleted.

## 15.3 Inflow sources

- **Manual** — user creates an entry from the inventory page.
- **Purchase** — when a shopping session is finalized (see §16), purchased quantities that exceed the week's requirements are spilled into `inventory_items(source='purchase')`.
- **Leftover** — when a slot is marked `cooked`, the system may emit leftover entries (see §19).

## 15.4 Display tags (derived from `source`) **(v2.0)**

The internal `inventory_source` enum is never shown to users directly. Display labels are **derived at read time**:

| Internal `source` | Normal display tag | Notes |
|---|---|---|
| `manual` | **Pantry** | User-entered stock |
| `purchase` | **Menu** (while menu week is current) | See transition rule below |
| `purchase` | **Pantry** (once menu week has ended) | General stock after the linked week passes |
| `leftover` | **Leftover** | Prepared-dish surplus from a cooked slot |
| `cook_remainder` | **Pantry** | Raw-ingredient remainder from cook reconciliation (see §19) |

**Menu→Pantry transition rule:** a `purchase` item (`source='purchase'`, `source_menu_id` set) displays as **Menu** only while its linked menu's week is current (i.e. `menus.week_start_date + menus.duration_days > today`). Once that week has ended, the same row displays as **Pantry** — the purchased ingredient is now general household stock. This is a **read-side / lazy derivation**: no background cron job, no column update on the `inventory_items` row. The derivation is analogous to the lazy `expireLeftovers` pass — it evaluates against `menus.week_start_date` + `menus.duration_days` at the time inventory is loaded. An optional `released_to_pantry_at` timestamp column is **deferred** as a persistence option (useful if persistence is needed later for audit or query performance); it is **not required** for v2.0 correctness, which relies purely on the linked menu's date fields. See [DATABASE_PRD.md §6.18](./DATABASE_PRD.md) and [ARCHITECTURE_PRD.md §17](./ARCHITECTURE_PRD.md).

---

# 16. Shopping confirmation & completeness **(v2.0)**

> Status: planned (v2.0). Schema: [DATABASE_PRD.md §6.18](./DATABASE_PRD.md).

Each accepted menu can have at most one **active shopping session**. The session tracks how much of the grocery list was actually acquired.

## 16.1 Session lifecycle

1. User opens the shopping session for the active menu — creates a `shopping_sessions` row (`status = in_progress`).
2. For each grocery item, the user marks an `acquired_quantity` and sets a per-item `status` (`pending` → `acquired` / `partial` / `skipped`). Recorded in `shopping_item_status`.
3. Grouping by `food_group` is available as an optional view mode (read-side `GROUP BY ingredients.food_group` — no recompute change).
4. **Finalize** — the user closes the session. The server:
   - Computes `completeness` (quantity-weighted: sum of acquired quantities / sum of required quantities, clamped 0–1).
   - Sets `status` to `complete` (completeness ≥ 0.90), `incomplete` (0.30–0.89), or a bare record when < 0.30 (barely-shopped).
   - Spills purchased-but-unused quantities (acquired > required for a given item) as `inventory_items(source='purchase')`.

## 16.2 Completeness thresholds

| Completeness | Label |
|---|---|
| ≥ 90% | Complete |
| 30%–89% | Incomplete |
| < 30% | Barely shopped |

---

# 17. Incomplete-shopping alerts **(v2.0)**

> Status: planned (v2.0). No table — derived state. See [ARCHITECTURE_PRD.md §17](./ARCHITECTURE_PRD.md).

When shopping is `incomplete`, the system surfaces **in-app alerts** identifying which recipes of the current week are at risk because of missing ingredients.

- Alerts are **derived, not persisted** — computed on read by `deriveShoppingAlertsForMenu` from the session's `shopping_item_status` and a reverse `ingredient → menu_slot` map (via `recipe_ingredients`, after applying any ingredient overrides from §23).
- Only slots that are **not yet marked cooked** are included in the at-risk set — cooked slots have already consumed their ingredients.
- **Degrades gracefully**: when `slot_completions` data is absent (cook-status feature not yet used), all slots are treated as `planned`.
- Surfaced as badges on the menu/slot view; see [ARCHITECTURE_PRD.md §17](./ARCHITECTURE_PRD.md) for the derivation logic.

---

# 18. Cook-status on ongoing menus **(v2.0)**

> Status: planned (v2.0). Schema: [DATABASE_PRD.md §6.20](./DATABASE_PRD.md).

**Distinct from the v1.9 Cook mode quick-toggle** (`menu_slots.cooked_at`/`cooked_by`): Cook mode is the hands-on recipe checklist with a "Mark as cooked" stamp on the slot row. `slot_completions` (v2.0) is the richer execution record for the post-accept lifecycle — it drives leftovers and incomplete-shopping alerts, and has a three-state machine.

## 18.1 States

Each slot's execution state is one of:

| State | Meaning |
|---|---|
| `planned` | Not yet acted on (default — absent row means `planned`) |
| `cooked` | Slot was cooked; ingredients consumed; may emit leftover entries |
| `skipped` | Slot was not cooked; ingredients are NOT consumed |

A skipped slot's ingredients remain available in inventory; they do not flow into leftovers.

## 18.2 Determinism invariant

Cook-status is stored in a **separate `slot_completions` table** (keyed by `menu_slot_id`), not as a column on `menu_slots`. This structural separation makes cook-status **invisible to `accepted_seed`** — the seed hashes only slot recipe-tuples; a change to `slot_completions` cannot alter it. The engine never reads `slot_completions`.

## 18.3 Cook-time ingredient reconciliation **(v2.0)**

When a slot transitions to `cooked`, an optional **reconciliation step** opens over the slot's recipe ingredients:

- The slot recipe's `recipe_ingredients` are listed with their **planned quantity** as the baseline.
- The user adjusts the **actually used** quantity per ingredient.
- Any **shortfall** (`planned − used > 0`) is offered as a raw-ingredient **Pantry** leftover row — the ingredient the user still has on hand (e.g. "used 4 of 5 tomatoes → 1 tomato to pantry"). See §19.
- **Default: used == planned** (nothing left over). The user can skip reconciliation entirely; no rows are emitted.

This step is entirely **post-accept**: it only writes `inventory_items` rows. It **never** reads or writes the constraint engine, `accepted_seed`, or `recomputeGroceryListsForMenu`. The determinism contract is fully preserved. See [ARCHITECTURE_PRD.md §17](./ARCHITECTURE_PRD.md) for the isolation guarantee.

---

# 19. Leftovers **(v2.0)**

> Status: planned (v2.0). Depends on §15 (Inventory) and §18 (Cook-status).

Two distinct kinds of leftover both flow into `inventory_items` when a slot is marked `cooked`. They share per-row expiry and consumption mechanics but differ in origin and display.

## 19.1 Two kinds of leftovers

### 19.1.1 Cooked-food surplus (`source = 'leftover'`)

When a slot is marked `cooked`, the user may record **leftover portions of the prepared dish** — the food that was cooked but not eaten. These rows carry `source = 'leftover'`, an optional `label` (e.g. "pasta Bolognese — freezer"), `source_slot_id`, and `source_menu_id`, and are displayed under the **Leftover** tag.

### 19.1.2 Raw-ingredient remainders (`source = 'cook_remainder'`) **(v2.0)**

From the cook-time reconciliation step (§18.3), when `used < planned` for a recipe ingredient, the shortfall row is a **raw-ingredient Pantry leftover** — the physical ingredient still on the shelf (e.g. "1 tomato remaining after using 4 of 5"). These rows are displayed under the **Pantry** tag (not Leftover) because they are uncooked stock.

**Recommended implementation:** a dedicated `inventory_source` value `cook_remainder` (see [DATABASE_PRD.md §5.1](./DATABASE_PRD.md)) so the origin is always queryable without inspecting provenance columns. The alternative — reusing `source = 'manual'` with `source_slot_id` set — is feasible but makes the origin ambiguous at a glance; `cook_remainder` is preferred. Both options share the same provenance columns (`source_slot_id`, `source_menu_id`) already present on `inventory_items`.

## 19.2 Per-leftover expiry

Each leftover row (either kind) carries its own `expiration_date`, computed per item at creation:

```
expiration_date = cooked_at::date + COALESCE(ingredients.max_storage_days, workspaces.leftover_max_days)
```

- `ingredients.max_storage_days` is the ingredient-level default (already on the catalog).
- `workspaces.leftover_max_days` is the workspace fallback (new column, default 3 days — see [DATABASE_PRD.md §6.1](./DATABASE_PRD.md)).
- `leftover_max_days` is **only the default**; each leftover row's `expiration_date` is **independently editable** by any workspace member after creation.

## 19.3 Consumption and expiry

- **Manual**: a member marks a leftover `is_consumed = true` (eaten) or decrements its `quantity` (partial use).
- **Auto-expire on read**: when inventory is loaded, `expireLeftovers` evaluates each leftover row against its own `expiration_date` and marks expired rows consumed. No background cron in v2.0 — expiry is lazily evaluated.

---

# 20. Pantry-aware grocery view **(v2.0)**

> Status: planned (v2.0). Pure read-side — `grocery_items` are never mutated.

The grocery list view gains an **inventory annotation layer**. For each grocery line:

- The **full required quantity** is always shown (never hidden or reduced).
- An **on-hand annotation** is appended when the inventory contains matching items: *"you have N in inventory"*.
- A **suggested-to-buy** quantity is derived: `max(0, required - onHand)`.
- Example: **"5 tomato — you have 2 in inventory · suggested to buy 3"**.

The user may choose to buy all 5 or just the suggested 3; the choice is theirs. The annotation is a shopping aid, not a decision.

An optional **collapse-fully-covered** toggle can hide lines where the on-hand quantity meets or exceeds the requirement. The default shows all lines with both numbers visible.

`grocery_items` rows are **never written** by this feature. The annotation is produced by `annotateWithInventory` in `apps/web/lib/grocery-filter.ts`, which composes after `applyShopForFilter` — both are pure presentation transforms. See [ARCHITECTURE_PRD.md §17](./ARCHITECTURE_PRD.md).

---

> **§21 — Community recipes** moved to the [v4 community epic](../../.claude/plans/v4.md). v2.1 feature sections (inclusive preferences, multi-timeframe, addons, bulk-create) are documented in [§25](#25-inclusive-vs-exclusive-dietary-restrictions-v21) – [§28](#28-bulk-recipe-creation-v21) below.

---

# 22. Consolidated all-members grocery view **(v2.0)**

> Status: planned (v2.0). Pure read-side aggregation — no schema change.

In addition to the existing shared + per-member lists and the shop-for subset picker, the grocery view gains a **"Everyone / whole household"** mode that unions the shared list with every per-member list into one consolidated list of totals the household would actually buy.

- Keyed by `(ingredient_id, unit)`; quantities summed across all buckets; `scheduled_purchase_day` folded to the earliest occurrence.
- Surfaces as a view mode in the shop-for picker: **"Everyone"** (consolidated) / **"By member"** (the existing subset picker).
- Implemented by `aggregateHouseholdGrocery` in `apps/web/lib/grocery-filter.ts` — a pure transform that composes cleanly with `applyShopForFilter` and `annotateWithInventory`.
- No recompute or grocery table change; entirely read-side.

---

# 23. Menu-level ingredient substitution **(v2.0)**

> Status: planned (v2.0). Schema: [DATABASE_PRD.md §6.21](./DATABASE_PRD.md). Architecture: [ARCHITECTURE_PRD.md §19](./ARCHITECTURE_PRD.md).

On an accepted menu, any ingredient on any slot may be substituted **for that menu only** (e.g. swap red tomatoes → green tomatoes for this week's accepted plan).

## 23.1 Rules

- The **stored recipe is not changed** — the substitution is a per-slot override on the menu.
- The **grocery list reflects the substitution** (after recompute).
- The **menu's `accepted_seed` and engine inputs are unchanged** — substitutions are menu state, not recipe state, and are structurally invisible to the seed.
- Suggested substitutes are sourced from the recipe's existing `recipe_ingredients.substitutions` JSONB catalog (currently unused by the engine); free substitution from the ingredient catalog is also allowed.
- A substitute is **validated against the slot eaters' allergies and exclusive restrictions** before being accepted — reuses the engine's allergen/exclusion check (`recipeViolatesAllergies` / `recipeHasExcludedIngredient`) at the route layer. A substitute that introduces an allergen or violates a restriction for any eater of that slot returns 422.
- Quantity and unit may optionally be adjusted alongside the ingredient swap.

## 23.2 Grocery recompute

After a successful override write, `recomputeGroceryListsForMenu` is re-run. The recompute applies the per-slot override map after loading `recipe_ingredients` — replacing `(ingredient_id, quantity?, unit?)` per slot before aggregation. This is the one change to recompute's inputs for v2.0; the recompute remains inventory-agnostic and engine-agnostic (overrides are menu state, not inventory state).

---

# 24. Per-member menu view **(v2.0)**

> Status: planned (v2.0). Pure read-side filter — no schema change.

The weekly menu screen gains a **member/household toggle** mirroring the grocery shop-for picker: a member selector that filters the rendered slots to those targeting the selected member (or "Everyone" / whole household for all slots).

- Filters rendered slots by `target_member_id`; household = all slots.
- URL-param driven (`?menu_for=uuid` or absent for household), analogous to `?shop_for=` on the grocery page.
- Implemented as a new `menu-member-picker.tsx` component under `apps/web/app/(app)/menu/_components/`, composed alongside the existing `menu-view.tsx`.
- Pure read-side; no mutation of menu data.

---

# 25. Inclusive vs exclusive dietary restrictions **(v2.1)**

> Status: planned (v2.1). Architecture: [ARCHITECTURE_PRD.md §20](./ARCHITECTURE_PRD.md). Schema: [DATABASE_PRD.md §6.22](./DATABASE_PRD.md).

Two distinct modes govern how a member's dietary preferences shape the menu:

- **Exclusive (hard restriction)** — the current behavior. A recipe violating an exclusive restriction or allergy is **never** assigned to that member's slot. Stored in `member_dietary_restrictions` and `member_allergies` (existing tables). These are the values the engine has always filtered on.
- **Inclusive (soft preference)** — new in v2.1. A soft bias toward a liked tag or ingredient (e.g. "prefers fish", "likes Mediterranean"). Inclusive preferences do **not** exclude any recipe — a slot can still be filled by a recipe that doesn't match the preference. Stored in a new `member_dietary_preferences` table (see [DATABASE_PRD.md §6.22](./DATABASE_PRD.md)).

## 25.1 Member profile

A member profile holds **both**:

- Exclusive restrictions: `member_dietary_restrictions` + `member_allergies` (unchanged, already persisted).
- Inclusive preferences: one row per liked `dietary_tag` or `ingredient` in `member_dietary_preferences`.

## 25.2 Generation-time overrides

At menu-generation time the user can provide **per-generation overrides** that apply only to the current generation request and are captured in `inputs_hash`. Three kinds:

| Override kind | Effect |
|---|---|
| **Add inclusive preference** | Adds an extra liked tag/ingredient for this generation (stacks with profile inclusive prefs) |
| **Add extra exclusive restriction** | Adds an extra hard restriction beyond the member's profile (same as the existing `additionalDietaryRestrictions` overlay) |
| **Relax a profile exclusive restriction** | *Subtracts* one of the member's profile exclusive restrictions for this generation only — useful for a one-off exception (e.g. "make the whole week have the cheese the lactose-intolerant member usually avoids, just for this party week") |

All three are part of `GenerateMenuOptions` and flow into `inputs_hash`. A generation with relaxed/added preferences is a **legitimately different generation** — determinism is fully preserved; the same inputs + seed always produce the same output.

## 25.3 Engine behavior

- Inclusive preferences never produce a hard filter. The engine's `filter.ts` is **unchanged** for inclusive prefs.
- `filter.ts` **does** apply `relaxedDietaryRestrictions` / `relaxedAllergies` by removing those values from the member's effective hard set **before** filtering.
- The soft bias is applied in `assign.ts` during greedy assignment: among the **hard-valid** candidates for a slot, the engine partitions into "preferred" (matches an inclusive tag/ingredient) vs "rest"; the seeded RNG picks from "preferred" when non-empty, else "rest". Never excludes a valid recipe. Fully deterministic.

## 25.4 UI

- Inclusive preferences are surfaced on the member profile editor (alongside existing hard restrictions), using the same label pickers.
- A per-generation override panel on the menu-generation form lets the user add inclusive prefs, add extra exclusive restrictions, and relax specific profile exclusive restrictions for the current run.

---

# 26. Multi-timeframe recipes **(v2.1)**

> Status: planned (v2.1). Architecture: [ARCHITECTURE_PRD.md §21](./ARCHITECTURE_PRD.md). Schema: [DATABASE_PRD.md §6.7](./DATABASE_PRD.md) + [§6.23](./DATABASE_PRD.md).

A recipe declares the **set** of meal timeframes it can fill instead of a single `meal_type`. A sandwich, for example, can be breakfast, snack, **and** dinner.

## 26.1 Recipe form

The single meal-type Select on the recipe form becomes a **multi-select** (checkbox group or `MultiLabelCombobox`-style). At least one timeframe is required for `kind='meal'` recipes (addons have no meal-type requirement — see [§27](#27-addons--on-the-fly-cook-mode-v21)).

## 26.2 Engine behavior

The engine's `filter.ts` meal-type check broadens from scalar equality to **set membership**: a recipe is a candidate for a slot when the slot's `mealType` is **in** the recipe's eligible set (`recipe.mealTypes.includes(slot.mealType)`). This is the **only** engine logic change for multi-timeframe; slot enumeration (`slots.ts`, driven by member `meal_frequency`) is untouched.

## 26.3 Existing recipes

All existing recipes are backfilled to a **one-element set** (their current `meal_type`). No behavior change until a recipe is broadened by an admin. A backfilled recipe with a one-element set produces byte-identical engine output to the pre-change snapshots — the determinism contract is preserved. See [ARCHITECTURE_PRD.md §21](./ARCHITECTURE_PRD.md) for the snapshot-regen implication.

## 26.4 Substitution / cook-status / inventory

Multi-timeframe affects only candidate selection. `menu_slots.meal_type` (the denormalized value on the placed slot) is unchanged — it still records the slot's `mealType`, not the recipe's full set. Cook-status, inventory, substitution, and grocery recompute are unaffected.

---

# 27. Addons & on-the-fly cook mode **(v2.1)**

> Status: planned (v2.1). Architecture: [ARCHITECTURE_PRD.md §23](./ARCHITECTURE_PRD.md). Schema: [DATABASE_PRD.md §6.24](./DATABASE_PRD.md).

## 27.1 Addon recipe kind

An **addon** is a recipe whose `recipe_kind = 'addon'` (salsa, guacamole, a dessert). It has the same structure and cook-mode as a `meal` recipe, with two behavioral differences:

- **Never a constraint-engine candidate.** Addons are filtered out in `menu-input-builder.ts` before the engine sees any recipes. They never enter a `RecipeSnapshot[]`, never touch `inputs_hash`, and never appear in a golden snapshot. This is an input-selection boundary, not an engine code change.
- **No meal-type requirement.** The ≥1 `recipe_meal_types` rule (see [§26](#26-multi-timeframe-recipes-v21)) applies only to `kind='meal'` recipes (≥1 required for meals, zero allowed for addons).

The recipe form gains a `kind` toggle (Meal / Addon) that hides the meal-type multi-select when `addon` is selected.

## 27.2 Attaching addons to an accepted menu

A user can **attach an addon** to an accepted menu in two scopes:

- **Week-wide** — the addon accompanies the whole menu (e.g. guacamole to serve all week).
- **Slot-specific** — the addon is tied to a particular slot (e.g. "guac with Tuesday lunch"). Stored as `menu_addons.target_slot_id` (NULL = week-wide; set = slot-specific).

Attaching or detaching an addon via `menu_addons` **never changes the menu's identity or `accepted_seed`**. The seed hashes only slot recipe-tuples; `menu_addons` is post-accept menu state structurally invisible to the seed, exactly like `menu_slot_ingredient_overrides` (see [§23](#23-menu-level-ingredient-substitution-v20)).

Endpoints: `POST|DELETE /api/workspaces/:id/menus/:menuId/addons`. An addon picker (read `GET /api/workspaces/:id/recipes?kind=addon`) surfaces workspace addon recipes for selection.

## 27.3 Addons in the grocery list

Attached addon ingredients appear in a dedicated **"Addons" section** of the grocery list — separate from the meal-derived lines. After an addon write on an accepted menu, `recomputeGroceryListsForMenu` is re-run; its new addon pass loads `menu_addons` → their `recipe_ingredients` → emits grocery lines tagged `grocery_items.source='addon'`. Meal lines stay `source='meal'`. The grocery UI groups by `source`. Meal-line totals are **unchanged** by addon attachment.

## 27.4 On-the-fly cook mode

A **"Cook now"** affordance on the recipe detail page opens Cook mode for **any** recipe — meal or addon — **standalone**, without the recipe needing to be on the active menu and **without affecting** the active menu or any slot.

- The Cook Sheet UI (v1.9) is reused over the arbitrary recipe.
- The flow is **ephemeral**: the checkable ingredient/step checklist is local state; no `menu_slots.cooked_at` write is made (distinct from v1.9 slot-based Cook mode, which does write `cooked_at`).
- Optionally at the end, the user may save leftover entries into `inventory_items(source='leftover')`, reusing the v2.0 §16 (Leftovers) flow. This is the only write path; it does not trigger a grocery recompute.

---

# 28. Bulk recipe creation **(v2.1)**

> Status: planned (v2.1). Architecture: [ARCHITECTURE_PRD.md §24](./ARCHITECTURE_PRD.md).

A single operation creates **N recipes plus their ingredients, instructions, dietary tags, and meal-types in one transaction**, returning the created recipe ids. This is the substrate downstream features build on — it is not a user-facing bulk-import UI by itself.

## 28.1 Behavior

- Accepts an array of recipe payloads, each validated by the **same Zod schema** as the single-create form.
- The entire array is wrapped in **one transaction**: if any payload is invalid or any insert fails, **nothing is written** (all-or-nothing rollback).
- Returns the created recipe ids in the same order as the input array.
- Engine-invisible: new recipes are ordinary catalog rows. Nothing here touches `inputs_hash`, the engine, or a golden snapshot.

## 28.2 Consumers (later releases — not built in v2.1)

- **[v3](../../.claude/plans/v3.md) — AI menu & recipe import:** AI-parsed recipe payloads are materialized into the catalog through this primitive.
- **[v4.0](../../.claude/plans/v4.0.md) — Community deep-copy import:** community import = bulk-create + provenance metadata copy on top.

The v2.1 bulk-create contract is owned here so both downstream consumers call a stable, tested endpoint rather than each inventing their own insert path.
