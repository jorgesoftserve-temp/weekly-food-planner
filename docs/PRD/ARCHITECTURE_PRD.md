# Architecture PRD

# 1. Purpose & scope

This document defines *how* the Weekly Food Planner is built. The *what* lives in [PRODUCT_PRD.md](./PRODUCT_PRD.md), the *why* in [OVERVIEW_PRD.md](./OVERVIEW_PRD.md), and stack choices in [TECHNICAL_PRD.md](./TECHNICAL_PRD.md). The persistent data model lives in [DATABASE_PRD.md](./DATABASE_PRD.md).

---

# 2. Architectural drivers

| Driver | Forces |
|---|---|
| Deterministic behavior | Seedable RNG, no clock or `Math.random` inside the engine, persisted seed + inputs hash |
| Testability | Pure constraint engine, no I/O at the engine layer, Supabase local for integration tests |
| Modularity | `constraint-engine` is a package with no app dependencies; the web app depends on it, not the reverse |
| Easy local setup | One `docker compose up` brings up Postgres + Supabase services + the Next.js app |

---

# 3. High-level topology

```
┌────────────────────────────────────────────────────────────────┐
│                         apps/web (Next.js)                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │  Server          │  │  Route Handlers  │  │  Server      │  │
│  │  Components      │  │  app/api/**      │  │  Actions     │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────┬───────┘  │
│           │                     │                    │         │
│           └─────────────────────┴────────────────────┘         │
│                          │                                     │
│             uses packages/constraint-engine                    │
│             uses packages/supabase (clients + types)           │
│             UI primitives in components/ui/ (shadcn-generated) │
└────────────────────────────────────────────────────────────────┘
                          │
                          ▼
            ┌─────────────────────────────┐
            │   Supabase (local + cloud)  │
            │   • PostgreSQL              │
            │   • Auth                    │
            │   • RLS                     │
            │   • Storage (images)        │
            └─────────────────────────────┘
```

Backend logic lives entirely inside the Next.js app — there is no separate Express service.

Turborepo monorepo:

- `apps/web` — Next.js App Router app (UI + server components + route handlers + server actions). shadcn/ui components live under `apps/web/components/ui/`.
- `packages/constraint-engine` — pure TypeScript, deterministic menu generator
- `packages/supabase` — migrations, generated `database.types.ts` and `database-functions.types.ts`, shared DB utilities
- `packages/test-utils` — fixtures, factories, seeded RNG helpers
- `infrastructure/docker` — `docker-compose.yml` for the local stack
- `docs/` — these PRDs
- `prompts/`, `agent-log/` — agent collaboration artefacts (see [/.cursor/rules/agentic-rules.md](../.cursor/rules/agentic-rules.md))

---

# 4. Component responsibilities & contracts

## 4.1 `apps/web`

Owns: UI, request handling, auth flows, orchestration of recipe CRUD, menu generation, grocery list generation, role checks, image uploads to Supabase Storage, per-menu overlay dedup.

Must NOT: contain core constraint-solving logic (lives in `constraint-engine`); reach into the database via raw SQL outside `packages/supabase`.

Supabase usage follows the cursor rule exactly:

- `supabaseClient` — browser / client components → `apps/web/utils/supabase/client.ts`
- `supabaseServerClient` — server components, server actions, route handlers → `apps/web/utils/supabase/server.ts`
- `supabaseAdminClient` — privileged server-only operations (workspace bootstrapping, generation persistence, soft-delete overrides) → `apps/web/utils/supabase/admin.ts`

Types are imported from `@repo/supabase` only — never from deeper internal paths.

## 4.2 `packages/constraint-engine`

Owns: deterministic menu generation, hard-constraint validation (including the per-menu overlay), soft-constraint optimization, grocery aggregation, freshness-aware purchase-day scheduling.

Must NOT:

- Read or write the database
- Call `Date.now()`, `new Date()`, `Math.random()`, or anything else non-deterministic
- Depend on any app package

### Public API: TypeScript-first domain, JSON-serializable DTO

The domain is **TypeScript-first** — types are authored in TS and consumed by TS callers (the Next.js app, the engine itself, tests). The package is not aiming for language-agnostic source distribution.

Crossing the package boundary, however, the inputs and outputs MUST be **JSON-serializable plain values**. No `Date`, `Map`, `Set`, `BigInt`, `Function`, class instances, or circular references — use ISO 8601 strings, plain objects, arrays, numbers, and booleans. This preserves the option of moving the engine across a process boundary (worker thread, edge function, separate service) without redesigning the contract.

Convention enforced in tests:

```ts
const roundTripped = JSON.parse(JSON.stringify(input))
expect(roundTripped).toEqual(input)
// Same for GenerateMenuResult.
```

```ts
export type GenerateMenuInput = {
  workspace: WorkspaceSnapshot
  members: MemberSnapshot[]
  recipes: RecipeSnapshot[]
  weekStartDate: string   // ISO 8601 date, caller-provided
  seed: number            // caller-provided, persisted
  options?: {
    // soft constraints
    calorieTolerance?: number
    repetitionLimit?: number
    preferredCuisines?: string[]
    // hard constraints — per-menu overlay; applied via union with each member's profile
    // additionalDietaryRestrictions and additionalAllergies are the EFFECTIVE overlay
    // (post-dedup); the route handler removes values already on any member's matching
    // profile field before invoking the engine.
    ingredientExclusions?: string[]
    additionalDietaryRestrictions?: string[]
    additionalAllergies?: string[]
  }
}

export type GenerateMenuResult =
  | { ok: true;  menu: GeneratedMenu; groceryLists: GroceryLists; inputsHash: string }
  | { ok: false; error: GenerationError }
```

Cuisine, dietary, and allergy labels are typed as `string` on the boundary rather than as imported enum types, matching the extensible-label model in DATABASE_PRD §5.2.

The engine reads `additionalDietaryRestrictions` and `additionalAllergies` directly — it does NOT receive pre-merged member snapshots. The route handler performs the silent dedup (see §5 step 2) before invoking the engine, then passes the original member snapshots and the effective overlay options to the engine. The engine applies the union per slot during hard-constraint filtering.

## 4.3 `packages/supabase`

Owns: SQL migrations (`npx supabase migration new <name>` per the cursor rule), generated types, the three Supabase clients re-exported via a single barrel.

## 4.4 `packages/test-utils`

Owns: factories for engine snapshots, deterministic fixture seeds, Supabase-local test helpers, snapshot-comparison helpers for the determinism regression suite.

---

# 5. Menu generation pipeline

Three modes share a single `POST /api/workspaces/[id]/menus` route, distinguished by the `mode` field: `weekly` (default, engine-generated), `custom` (user-built), and `clone` (copy from history). All three produce a DRAFT — promotion to active happens via the separate `accept` endpoint. See [DATABASE_PRD.md §6.17](./DATABASE_PRD.md) for the lifecycle.

## 5.1 Weekly mode (engine-generated)

1. **Authorize and validate pre-conditions** — verify the caller holds a role permitted to generate menus (`creator` or `admin`), and that the workspace contains at least one non-deleted recipe (else 412 `empty_workspace`). This is the only pre-engine validation path: on failure the engine is not invoked and no `generation_runs` row is written. The UI mirrors the check inline so users hit it before submitting.
2. **Input assembly with overlay dedup + participant filter** — load workspace, members (with role, dietary restrictions, allergies, dislikes, calorie target, meal frequency), available recipes (`is_deleted = false`), ingredient catalog with allergen labels. **Resolve participants**: `participantMemberIds` from the request, falling back to every active member when omitted (an explicit empty array is rejected). Filter `members` down to that set before the engine sees them. Compute the **effective** per-menu overlay against the participant set: filter `additionalDietaryRestrictions` and `additionalAllergies` to drop any value already present on any participating member's matching profile field (silent dedup; see [PRODUCT_PRD.md §4.2](./PRODUCT_PRD.md)); filter `memberFrequencyOverrides` to drop any entry whose `memberId` isn't a participant. `ingredientExclusions` passes through unchanged (no member equivalent). Build a canonical `GenerateMenuInput` with the effective overlay in `options`, the requested `durationDays` (1..7, default 7), and compute its `inputsHash` (SHA-256 of canonical JSON — participants and duration are both part of the hash, so changing either reshapes the result).
3. **Slot enumeration** (engine) — derive the start day-of-week from `weekStartDate` and walk `durationDays` consecutive days (wrapping past Sunday → Monday if needed). For each (day, member, mealFrequency entry) produce one slot. `members` is already filtered to the menu's **participants** at the route layer; the engine never sees non-participating members. The mealFrequency cascade is **override → member > workspace > empty**, where the override comes from `options.memberFrequencyOverrides` (see [PRODUCT_PRD.md §4.1.3](./PRODUCT_PRD.md)).
4. **Hard-constraint filtering** (engine) — drop any recipe that violates allergies, dietary restrictions, ingredient exclusions, or meal-type assignment. The effective hard-constraint set for each slot is the **union** of the relevant member's profile constraints and the per-menu overlay (`options.additionalDietaryRestrictions`, `options.additionalAllergies`, `options.ingredientExclusions`). Allergy checks join `member_allergies` with `ingredient_allergens` by exact string match. An allergen label not present in `ingredient_allergens` is silently skipped during filtering — see [PRODUCT_PRD.md §11.3](./PRODUCT_PRD.md) for the user-facing implication.
5. **Greedy slot assignment** (engine) — walk slots in deterministic order; for each slot pick the highest-scoring recipe among those passing hard constraints, breaking ties with the seeded RNG. See §6.1.
6. **Local-search refinement** (engine) — run deterministic improvement passes (swap a slot's recipe with an alternative; pairwise-swap two slots) and keep any move that strictly improves the soft-constraint score. Stop when no improving move exists or a step budget is reached. Uses `recipes.calories_per_serving` for calorie balancing.
7. **Grocery aggregation** (engine) — produce a shared list and per-member lists; assign `scheduled_purchase_day` for perishable items using ingredient freshness flags.
8. **Persist as DRAFT** — within a single transaction:
   1. If an outstanding draft already exists for `(workspace_id, week_start_date)` (`accepted_at IS NULL AND is_deleted = false`), set its `is_deleted = true`. The accepted menu for the same week (if any) is untouched.
   2. Insert the new `menus` row with `menu_type = 'weekly'`, `duration_days`, `start_day_of_week`, `seed`, `inputs_hash`, `generation_options` (effective overlay), `accepted_at = NULL`. Insert `menu_slots`, `menu_participants` (one row per resolved participant id), an empty `grocery_lists` row, `grocery_items` from the engine output, and a `generation_runs` audit row (status=`success`).
9. **Failure path** — engine returns a structured `GenerationError`; persisted as `generation_runs` with status=`failed` and the full error payload. Failed runs leave any prior draft untouched. UI renders the message in the format defined in [PRODUCT_PRD.md](./PRODUCT_PRD.md) §6.

## 5.2 Custom mode

User-built menus skip steps 1–7 entirely. The route handler:

1. Authorizes the caller (creator or admin).
2. Validates the request body: at least one slot, each `recipe_id` belongs to the workspace, each slot's `meal_type` matches its recipe's `meal_type`.
3. Soft-deletes any outstanding draft for `(workspace, week)`.
4. Inserts a `menus` row with `menu_type = 'custom'`, `seed = NULL`, `inputs_hash = NULL`, the supplied `duration_days`, and an empty `grocery_lists` row.
5. Inserts the user-supplied `menu_slots` rows. `meal_key` is auto-derived as `{meal_type}` or `{meal_type}_{N}` to keep the slot unique constraint happy when the user has two of the same meal type on one day.

No `generation_runs` row is written — there's no engine run to audit.

## 5.3 Clone mode

Cloning copies a historical accepted menu's slots into a fresh draft. The route handler:

1. Authorizes the caller.
2. Loads the source menu; verifies it belongs to the workspace and `accepted_at IS NOT NULL` (only accepted menus are cloneable). 422 `source_not_accepted` otherwise.
3. Soft-deletes any outstanding draft for the target `(workspace, week)`.
4. Inserts a new `menus` row inheriting the source's `seed`, `inputs_hash`, `generation_options`, `menu_type`, and `duration_days`; sets `cloned_from_menu_id` to the source id for audit; `accepted_at = NULL`.
5. Copies every `menu_slots` row from the source into the new draft, plus every `menu_participants` row — a clone is the same household intent on a new week.

## 5.4 Acceptance + slot replacement

After a draft exists, the user can:

- `POST /api/workspaces/[id]/menus/[menuId]/slots` — add a brand-new slot to a draft. Server validates the recipe belongs to the workspace, the `target_member_id` (when non-null) is a participant of the menu, and — for `weekly` drafts — that the engine's hard-constraint filter passes. Auto-derives a unique `meal_key` in the (day, target_member_id) bucket. Created slots have `is_overridden = false` and `original_recipe_id = NULL`. See [PRODUCT_PRD.md §4.0.1](./PRODUCT_PRD.md).
- `PATCH /api/workspaces/[id]/menus/[menuId]/slots/[slotId]` — replace a slot's recipe. Server re-runs the engine's `isRecipeValidForSlot` filter for `weekly` drafts. Sets `is_overridden = true` and preserves the engine's original pick in `original_recipe_id`.
- `POST /api/workspaces/[id]/menus/[menuId]/accept` — promote the draft. Computes `accepted_seed` (SHA-256 over `inputs_hash` + canonical slot list). Soft-deletes the previously accepted menu for the same week. Sets `accepted_at` and `accepted_seed`.
- `DELETE /api/workspaces/[id]/menus/[menuId]` — discard a draft (only drafts; accepted menus are immutable).

---

# 6. Determinism architecture

- Single seed entry point; RNG instance injected, never imported globally.
- Forbidden inside `constraint-engine`: `Math.random`, `Date.now`, `new Date()`, `crypto.randomUUID()` without a seed-derived alternative.
- `inputs_hash` + `seed` persisted on every `generation_runs` row. Because the **effective** (post-dedup) overlay is part of `options`, and `durationDays` is part of the canonical input, two regeneration attempts with the same seed, overlay, and duration produce the same `inputs_hash` and the same menu — even if the user typed the overlay slightly differently each time. Custom menus (`menu_type = 'custom'`) are deliberately non-deterministic; they carry no `seed` or `inputs_hash`.
- Acceptance produces a separate `accepted_seed` (SHA-256 over `inputs_hash` + canonical slot tuples). It identifies the final accepted state (engine output + any user overrides) — distinct from `seed` so modified menus still get a stable history identifier. See [DATABASE_PRD.md §6.17](./DATABASE_PRD.md).
- Regression suite: golden snapshots of `(input, seed) → output` enforce that the engine never drifts.

## 6.1 Algorithm: greedy + local search

For MVP the engine uses a **greedy initial assignment followed by deterministic local-search refinement**.

### Greedy assignment

1. Enumerate every slot to fill: for each member's `meal_frequency` entry × 7 days, plus shared slots from the workspace schedule. Walk slots in a fixed order (week-first, then day-of-week, then `meal_key` order, then member-id order).
2. For each slot, build the candidate set: recipes passing all hard constraints for the slot — that is, the union of the relevant member's profile constraints and the per-menu overlay (meal_type match, allergen-safe, dietary-restriction-compatible, not excluded).
3. Score each candidate by the soft-constraint composite (variety vs. recent slots, distance from the calorie target, cuisine diversity, ingredient reuse, grocery simplification).
4. Pick the highest-scoring candidate. Resolve ties with the seeded RNG so the choice is reproducible.
5. If the candidate set is empty, emit a structured `no_valid_recipe` error referencing the affected member and meal.

### Local-search refinement

Repeat up to a fixed step budget (configured per `options.repetitionLimit` and a hard cap):

- For each slot, try alternative recipes from its hard-constraint-valid set; keep any swap that strictly improves the score.
- Try pairwise slot swaps (swap recipes between two slots) where both swaps remain hard-constraint-valid; keep improving moves.
- Stop when a full pass yields no improvement.

The order of moves within a pass is deterministic; tie-breaking is RNG-driven. Two runs with the same `(input, seed)` produce identical greedy seeds and identical refined outputs.

### Trade-offs

Greedy + local search is fast, deterministic, and easy to reason about. It does not guarantee a globally optimal solution. The MVP accepts that — the regression suite locks output stability, and a later iteration can swap in a stronger search (simulated annealing, CSP solver) behind the same boundary contract.

---

# 7. Grocery list & freshness pipeline

- **Cook-once servings scaling**: every ingredient contribution is multiplied by `eaters / recipe.servings`. Per-member slots use `eaters = 1`; null-target shared slots (custom mode) use `eaters = participantCount` derived from `menu_participants`. The engine emits per-member slots only, so its `aggregateGroceryLists` simply divides every contribution by `recipe.servings` — summing across all members yields the household total naturally. The server recompute path mirrors the formula but reads `recipe.servings` and `COUNT(menu_participants)` from the DB. See [PRODUCT_PRD.md §7](./PRODUCT_PRD.md).
- **Single recompute path** for persistence: every code path that produces grocery lists in the DB — engine-generated drafts (`persistGeneratedMenu`), custom drafts (`persistCustomMenu`), cloned drafts (`cloneMenuAsDraft`), and acceptance (`acceptDraftMenu`) — delegates to one function: `recomputeGroceryListsForMenu` in `apps/web/lib/api/menu-grocery.ts`. It reads slots + recipe ingredients + participant count + ingredient perishability from the DB and produces shared + per-member buckets with freshness-aware `scheduled_purchase_day`. Drafts and accepted menus therefore share the exact same grocery shape; accept just re-runs the recompute to incorporate any draft-time slot overrides. The engine still returns its own `groceryLists` on `GenerateMenuResult` for in-memory callers, but it is **not** the source of persisted data.
- **Shared list**: union of ingredients across all shared recipes in the menu, scaled per the rule above.
- **Member lists**: ingredients unique to a member-specific slot (engine picked a different recipe for that member due to constraint divergence) plus substitutions required by that member's restrictions, scaled per the rule above.
- **Scheduling**: each `grocery_item` carries a `scheduled_purchase_day`. The engine assigns days based on:
  - `ingredients.max_storage_days` (purchase no earlier than `meal_day - max_storage_days`)
  - `ingredients.requires_fresh` (forces a same-week purchase)
  - `ingredients.same_day_cook` (purchase day == cook day)
- Outputs are deterministic given the same seed.
- **(v1.8) Note preservation across recompute.** `grocery_items.note` (the free-text shopper annotation, [PRODUCT_PRD.md §7.2](./PRODUCT_PRD.md)) is user-entered, not engine-derived. Since `recomputeGroceryListsForMenu` deletes-and-reinserts rows, it must snapshot existing notes keyed by `(grocery_list scope, ingredient_id)` before the rebuild and re-apply them to matching rows afterward; notes for ingredients that drop off the recomputed list are discarded. The note is never an engine input and never affects scaling, scheduling, or determinism.

---

# 8. Authentication & authorization

## 8.1 Identity

Supabase Auth (email/password for MVP).

- Signup form collects email + password.
- Supabase sends a verification email immediately on signup.
- The user must click the verification link before they can sign in (Supabase `EMAIL_CONFIRM` enabled).
- Until verification, the user lands on a "Check your email" screen on any sign-in attempt.
- `auth.users.email_confirmed_at` is the source of truth that a user is verified.
- Password reset is handled by Supabase's built-in `resetPasswordForEmail` flow.
- Sessions managed by Supabase and validated server-side via `supabaseServerClient`.

The `sys_create_workspace_on_signup` trigger fires when `auth.users` is inserted; the individual workspace is created in an unusable state until the user verifies. This avoids dead workspaces for users who never confirm.

## 8.2 Workspace model

Every authenticated user has at least one workspace:

- **Individual workspace** — auto-created on signup. Owner only.
- **Group workspace** — created explicitly; supports multiple `workspace_members` with roles.

## 8.3 Roles

Defined in [PRODUCT_PRD.md §2.1](./PRODUCT_PRD.md):

| Role | Permissions |
|---|---|
| `creator` | Everything: transfer ownership, delete workspace, manage admins, plus all admin powers |
| `admin` | Invite/remove members, edit recipes, generate menus, edit shared schedule |
| `member` | View recipes and menus, edit own profile (allergies, dislikes, calorie target, meal frequency override) |

Exactly one active `creator` per workspace. The creator's row in `workspace_members` is created by the same trigger that creates the workspace.

## 8.4 Authorization layering

- **RLS first**: every table policy checks workspace membership and (where relevant) role. Read policies on soft-deletable tables filter `is_deleted = false`.
- **Server-side checks second**: route handlers and server actions re-check role for mutations before persisting, producing clear 403 responses rather than opaque RLS denials.
- **No client-only authorization** — UI hides controls based on role but never relies on the client for security.

---

# 9. API surface (Next.js route handlers)

Resource-oriented under `app/api/`:

```
/api/auth/...                       → Supabase Auth callbacks (incl. email verification)
/api/workspaces                     → GET, POST
/api/workspaces/:id                 → GET, PATCH, DELETE (soft delete)
/api/workspaces/:id/members         → GET, POST, PATCH, DELETE (soft delete)
/api/workspaces/:id/recipes         → CRUD (delete is soft)
/api/workspaces/:id/menus           → POST (mode = weekly | custom | clone — all produce a DRAFT)
/api/workspaces/:id/menus/active    → GET (the workspace's accepted menu)
/api/workspaces/:id/menus/draft     → GET (the outstanding draft, if any)
/api/workspaces/:id/menus/history   → GET (accepted menus, newest first, with is_modified)
/api/workspaces/:id/menus/:menuId           → DELETE (discard a draft)
/api/workspaces/:id/menus/:menuId/accept    → POST (promote draft → accepted)
/api/workspaces/:id/menus/:menuId/slots     → POST (add a new slot to a draft; server validates hard constraints + participant membership)
/api/workspaces/:id/menus/:menuId/slots/:slotId → PATCH (replace a slot's recipe in a draft; server re-validates hard constraints)
/api/workspaces/:id/grocery         → GET (derived from the workspace's accepted menu)
/api/workspaces/:id/grocery/items/:itemId  → PATCH (v1.8 — set/clear a grocery item's free-text note; any workspace member)
/api/workspaces/:id/menus/:menuId/slots/:slotId/cook → POST (v1.9 — mark/un-mark a slot cooked, body {cooked:boolean}; any workspace member; accepted menus only; sets cooked_at/cooked_by server-side)
# (deferred) /api/workspaces/:id/search → GET — a workspace-scoped cross-module search endpoint. NOT shipped in v1.9: global search ships recipes-first and client-side (filters the existing recipes query, no endpoint). This endpoint would back the deferred topbar instant search + cross-module (menu/grocery/members) tiers — see PRODUCT_PRD §14.2
/api/uploads/images                 → POST (signed-URL flow to Supabase Storage)
/api/labels/search                  → GET (debounced autocomplete over enum_metadata)
/api/labels/suggestions             → DELETE (a user removes their own pending label)
/api/profile                        → GET, PATCH (v1.8 — the caller's own profile; PATCH sets accent_color. Self-scoped, see DATABASE_PRD §6.0)
```

> The per-member accent (`workspace_members.accent_color`) is set through the existing `PATCH /api/workspaces/:id/members` path (it's a member field), not a new endpoint. The two member-writable menu/grocery mutations above are the only deviations from the otherwise service-role-managed menu pipeline — each re-checks workspace membership server-side and writes only its narrow column set.

Server actions are used for form-driven mutations where the App Router idiom favours them.

Images for recipes and ingredients are uploaded to Supabase Storage; the public/signed URL is persisted in `recipes.image_url` / `ingredients.image_url`.

---

# 10. Frontend architecture

- Next.js App Router conventions; `params` and `cookies()` always awaited (per cursor rule).
- **React Query** for client-side cache of server data; custom hooks return full query results.
- **Zustand** for ephemeral UI state — modal/drawer open state, multi-step form drafts, transient flags. Never used for server data (that's React Query's job). One slim store per feature; avoid a single global store.
- **Styling**: Tailwind CSS with **shadcn/ui** component primitives copied into the codebase via the official CLI. Components live at `apps/web/components/ui/`. Initialize once per app (`npx shadcn@latest init`); add components individually (`npx shadcn@latest add <component>`). Per the cursor rule, layouts favour `flex` and `gap` over `margin` / `space-*` utilities.
- Components: controlled where state is shared; single-purpose; composition over inheritance.
- Folder layout per feature under `app/(feature)/`; tests co-located.

## 10.1 Menu & grocery list views

In-app menu and grocery list pages are first-class deliverables in MVP:

- The week menu view shows all 7 days, every meal slot, with recipe titles, images, and visual cues distinguishing shared vs member-specific slots. Only the active (non-deleted) menu for the week is shown.
- The menu header surfaces the **effective** per-menu overlay used (if any) — sourced from `menus.generation_options` — so users can see what extra constraints shaped this week.
- Grocery list views (shared + per-member) are organized by `scheduled_purchase_day` so users can shop in freshness-aware batches.
- A "Shop for" picker scopes the page to a subset of the menu's participants. Selecting fewer than all participants rescales the shared list by `selectedCount / participantCount` and hides per-member buckets for non-selected members. State is URL-synced via `?shop_for=uuid,uuid`. The transform is presentation-only — `grocery_items` rows are never mutated. The same filter is honoured by the export endpoint (`/api/workspaces/:id/export?shop_for=…`) — the loader runs the loaded lists through `applyShopForFilter` before reshaping into the export schema, so downloaded markdown/CSV files match what the user sees on screen. See [PRODUCT_PRD.md §7.1](./PRODUCT_PRD.md).
- Both views are designed with a layout and typography optimized for paper / PDF rendering. The post-MVP PDF export will reuse the same template without rework.
- PDF export itself is **out of MVP** — see [OVERVIEW_PRD.md §6](./OVERVIEW_PRD.md).

## 10.2 Empty-state UX

When a workspace contains zero non-deleted recipes:

- The "Generate Menu" action is disabled (greyed out with a tooltip explaining why).
- The dashboard's primary CTA is "Create your first recipe".
- This guardrail prevents an obvious engine failure mode (no candidate recipes) at the UI layer rather than the API layer.

See [PRODUCT_PRD.md §4.0](./PRODUCT_PRD.md).

## 10.3 Label autocomplete (extensible labels)

A shared `<LabelCombobox>` primitive — built on the shadcn/ui `Command` component — backs every user-suggestable label field: `cuisine`, dietary restrictions, dietary tags, and food allergies.

- Debounced (~300 ms) query to `/api/labels/search?enum_type=...&q=...`.
- Renders suggestions in a dropdown; **does not** rewrite the user's input.
- On save, if the typed value is not in `enum_metadata`, the server calls `sys_save_label` to record a pending entry, then writes the dependent row.
- A dedicated "My label suggestions" view lets a user delete their own pending entries via `/api/labels/suggestions`. The UI shows the affected-row count before confirming.
- For `food_allergy`, the combobox additionally renders an inline note when the typed value has no matching rows in `ingredient_allergens` — the engine cannot filter recipes for an untagged allergen, so the user understands the safety bound. The save still proceeds; see [PRODUCT_PRD.md §11.3](./PRODUCT_PRD.md).

## 10.4 Per-menu overlay form

The menu generation form includes an "additional constraints for this week only" panel:

- Reuses `<LabelCombobox>` for dietary restrictions and allergies; ingredient exclusions reuse the ingredient picker.
- As the user types or pastes a value into the dietary/allergy fields, the form annotates any entry that duplicates a member-profile constraint with an inline note — *"Already on Alice — will be skipped"*. The note is informational only; the field stays editable and submission proceeds either way.
- On submit, the route handler performs **silent dedup** server-side (drops values already on any member's matching profile) before invoking the engine. Defense in depth: even if the client misses an annotation, the server still produces the correct effective overlay.
- The persisted `menus.generation_options` reflects only the values that actually took effect (post-dedup), so the menu view shows the effective overlay rather than the user's raw input.

## 10.5 v1.8 presentation features

All additive and presentation-scoped — none change the engine, the determinism boundary, or the menu/grocery contracts.

- **Theme + accents.** Class-based light/dark via `next-themes` (toggle in the header + Settings). The per-user accent is applied SSR through `data-accent` on the `(app)` shell (no FOUC) with an optimistic client `AccentProvider`; the per-member accent is applied inline only on member-tied surfaces (selector chips, badges, dots) and is theme-safe in both modes. Tokens are owned by `design-system-architect` in `globals.css` + the Tailwind theme; **no hex literals in components**. See [PRODUCT_PRD.md §12](./PRODUCT_PRD.md).
- **Menu day × meal grid.** The week view renders day-rows × meal-columns with a member selector, reading the existing `menu_slots` (day × `meal_key`) shape — no data change, a presentation of what the engine already emits. See [PRODUCT_PRD.md §10](./PRODUCT_PRD.md).
- **Cook mode (v1.9).** A full-screen **Sheet** opened from a filled menu SlotCard, presenting the accepted slot's recipe as a checkable ingredient + step list with an "N of M steps done" header; the "Mark as cooked" action calls `POST …/slots/:slotId/cook` (`{cooked}`). React Query invalidates the active menu (so `MenuView` cooked badges + the dashboard "Meals cooked" stat re-render) on success. Cook-state is server data (React Query), not Zustand. The ephemeral checklist is local state. See [PRODUCT_PRD.md §13](./PRODUCT_PRD.md).
- **Global search (v1.9).** A `/search` route ships **recipes-first**: a segmented module bar (Recipes active; menu/grocery/members "Soon") + recipe facets, **filtered client-side over the existing recipes query** — no search endpoint. The topbar instant tier + cross-module tiers (and the `GET /api/workspaces/:id/search` endpoint that would back them) are **deferred**. See [PRODUCT_PRD.md §14](./PRODUCT_PRD.md).
- **Single-overlay rule.** Recipes (detail vs edit) and the menu page (generate / replace / add) render at most one overlay at a time via `useExclusiveOverlay`; dialogs become bottom-sheets under `md`. (Shipped in v1.8 Phase 1.)

---

# 11. Testing strategy

Aligned with the cursor-rule 60/40 split:

| Layer | Test type | Coverage focus |
|---|---|---|
| `constraint-engine` | Unit (≈100%) | Pure determinism + regression snapshots + JSON round-trip of inputs/outputs + overlay-applied-as-union |
| Route handlers / server actions | Integration | Real Supabase local, RLS on, role matrix covered, soft-delete visibility covered, overlay silent-dedup covered (input with duplicates → effective overlay persisted, same final menu as the deduped input) |
| Components | Unit + integration | Unit for isolated logic; `.integration.tsx` with real Supabase for data-fetching flows |
| Critical user journeys | E2E (optional) | Playwright |

All tests run under **Vitest** (per cursor rule alignment). The determinism regression suite is a fixture set of `(input, seed)` pairs whose output is snapshotted; any drift fails CI.

---

# 12. Local development & infrastructure

- `docker compose up` brings up:
  - Supabase services (Postgres, GoTrue, Realtime, Storage, Studio, Kong)
  - The Next.js app in dev mode
- Migrations applied automatically on startup via the Supabase CLI.
- Environment variables loaded from `.env.local` (not committed); template in `.env.example`.

---

# 13. CI gates (MVP)

1. Type check (`tsc --noEmit` across the workspace)
2. Lint
3. Unit tests (Vitest)
4. Integration tests (Vitest + Supabase local boots in CI)
5. Build

The determinism regression suite runs as part of step 3.

---

# 14. Observability (MVP-minimal)

- Structured logging in route handlers and server actions; request IDs propagated.
- Every menu generation persists a `generation_runs` row regardless of outcome.
- A full metrics stack (Prometheus + Grafana per cursor rule) is deferred past MVP.

---

# 15. Out of scope

Per [OVERVIEW_PRD.md §6](./OVERVIEW_PRD.md):

- AI recipe suggestions
- Nutrition APIs
- Real-time collaboration
- Budget optimization
- Shopping integrations
- Inventory tracking
- Calendar synchronization
- **PDF export of menus and grocery lists** (planned for next MVP; in-app views are designed PDF-ready)

---

# 16. Open architectural questions

- Soft-delete cleanup policy: when (if ever) should a maintenance job hard-delete rows where `is_deleted = true`?
