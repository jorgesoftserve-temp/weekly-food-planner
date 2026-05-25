# Step 17 — UI basic-flow build: foundation, app shell, recipe CRUD, menu, grocery, export

## Prompt used

See [/prompts/17-start-ui-basic-flow.txt](../prompts/17-start-ui-basic-flow.txt).

Summary: the user gave the go-ahead to start building the UI laid out in step 16, with the four scope cuts (overlay UI, member management, password reset, multi-workspace switcher) deferred. Two decisions were promised "when we reach them" — layout pattern and CRUD form pattern. This cycle hits both, resolves them inline via AskUserQuestion, and lands the basic flow as four commits.

## Context files provided

- Everything in the repo at the end of step 16: Next.js shell, auth pages, TanStack Query provider, shadcn init (no primitives installed yet), constraint engine + CRUD modules + API + tests + CI.
- [.cursor/rules/query-patterns.md](../.cursor/rules/query-patterns.md) — the `xxx.ts` + `xxx.react.ts` CRUD/hook pairing convention; the hooks file was deferred in step 12 and built here.
- [.cursor/rules/global-rules.md](../.cursor/rules/global-rules.md) — shadcn CLI usage, Tailwind+shadcn primitives, RO-RO named-object params.
- The four scope cuts from [agent-log/16](./16-ui-outline-and-scope-decisions.md).

## Expected output

Four commits land in this cycle. Each phase ran the full `pnpm turbo run typecheck test` gate (76 passing, 8 skipped — unchanged from step 15) before committing.

### Phase 0 — Foundation (commit c4e1801)

- **shadcn primitives** installed via the CLI: `button`, `input`, `label`, `form`, `dialog`, `dropdown-menu`, `table`, `card`, `select`, `popover`, `command`, `textarea`, `calendar`, `sonner`, `skeleton`. One incompatibility with `react-day-picker@10` (the `table` className was removed from `Partial<ClassNames>` in v10) patched inline in [components/ui/calendar.tsx](../apps/web/components/ui/calendar.tsx).
- **Client deps** pulled in by the shadcn install: `react-hook-form`, `zod`, `@hookform/resolvers`, `sonner`, `cmdk`, `react-day-picker`, `next-themes`, plus the Radix peers each primitive needs. `date-fns` added separately.
- **`.react.ts` companions** in [packages/supabase/src/module/](../packages/supabase/src/module/): hooks for `workspaces`, `recipes`, `ingredients`, `labels`, `menus`, `grocery`. Each wraps the existing CRUD function from `xxx.ts` and invalidates the right query keys on mutation success. New `./react` subpath export added so server-only callers don't pull in React Query.
- **App-side hooks** in [apps/web/lib/hooks/](../apps/web/lib/hooks/):
  - `use-supabase.ts` — memoised wrapper over the cached browser client.
  - `use-auth-user.ts` — subscribes to `supabase.auth.onAuthStateChange` and mirrors the user into React Query so login/logout flows through without manual invalidation.
  - `use-generate-menu.ts` — `useMutation` that POSTs to `/api/workspaces/[id]/menus`, handles the 200/422/4xx split (422 is engine-failure-but-audited, 4xx is pre-engine), invalidates menu + grocery cache on success.
  - `export-menu.ts` — anchor-click download helper for markdown + CSV (the route handler already sets `content-disposition: attachment`).
- **UI primitives**: [components/empty-state.tsx](../apps/web/components/empty-state.tsx), [components/page-header.tsx](../apps/web/components/page-header.tsx), [lib/toast.ts](../apps/web/lib/toast.ts) (`notifySuccess` / `notifyError` / `notifyInfo` wrappers).
- **Toaster** mounted in [app/layout.tsx](../apps/web/app/layout.tsx) so any page can call the toast helpers without local plumbing.
- **WorkspaceProvider** in [components/workspace-provider.tsx](../apps/web/components/workspace-provider.tsx): pulls `useAuthUser` → `useWorkspacesForUser`, exposes the first workspace via `useActiveWorkspace()`. Multi-workspace switching is deferred per scope cuts; the wiring already supports it.

### Phase 1 — App shell + auth polish (commit fcee272)

**Decision resolved (layout pattern)**: header + sidebar (over header-only with top tabs). Per the user's AskUserQuestion answer. Collapses to a sheet on mobile via shadcn `Sidebar collapsible="icon"`.

- **More shadcn primitives** for the shell: `sidebar`, `sheet`, `separator`, `avatar`, `tooltip`, `breadcrumb`. The CLI also created `hooks/use-mobile.tsx` (used internally by `Sidebar`) and appended sidebar CSS vars to globals + tailwind config.
- **Route protection** in [middleware.ts](../apps/web/middleware.ts): `PROTECTED_PREFIXES` (`/dashboard`, `/recipes`, `/menu`, `/grocery`) redirect unauth users to `/login?next=<path>`. `AUTH_PUBLIC_PATHS` (`/login`, `/signup`, `/verify-email`) bounce auth'd users to `/dashboard` so signed-in users can't re-enter the login form. `sanitizeNext()` allows only same-origin relative paths to defend against open-redirect attacks.
- **`/` redirects to `/dashboard`** ([app/page.tsx](../apps/web/app/page.tsx)). The middleware catches unauth from there and bounces to `/login`.
- **`(app)` route group** at [app/(app)/layout.tsx](../apps/web/app/(app)/layout.tsx): wraps children in `WorkspaceProvider` → `SidebarProvider` → `AppSidebar` + `SidebarInset(AppHeader + main)`. Server component; the providers inside are `'use client'`.
- **Shell components** in [components/app-shell/](../apps/web/components/app-shell/):
  - `AppSidebar` — branded header with workspace name, four nav links (Dashboard / Recipes / Weekly menu / Grocery list), active-state highlight, tooltip when collapsed.
  - `AppHeader` — `SidebarTrigger` + `Breadcrumb` showing "workspace › page" + `UserMenu` on the right. Sticky on scroll with `backdrop-blur`.
  - `UserMenu` — avatar with email-derived initials, dropdown with "Signed in as <email>" + sign-out item routed through `supabase.auth.signOut()` and a toast on failure.
- **Login post-signin redirect** in [login-form.tsx](../apps/web/app/(auth)/login/login-form.tsx) now honours `?next=<path>` (sanitised) and defaults to `/dashboard`.
- **Dashboard + stub pages** so the nav links don't 404: [dashboard](../apps/web/app/(app)/dashboard/page.tsx) (welcome + quick-link cards + determinism callout), and [recipes](../apps/web/app/(app)/recipes/page.tsx), [menu](../apps/web/app/(app)/menu/page.tsx), [grocery](../apps/web/app/(app)/grocery/page.tsx) stubs that became real pages in later phases.

### Phase 2 — Recipe CRUD (commit 95cee7b)

**Decision resolved (CRUD form pattern)**: full-page routes (`/recipes/new`, `/recipes/[id]/edit`) over modal dialogs. Per the user's AskUserQuestion answer — the form has 6+ field groups including arrays of ingredients and instructions; full-page gives the arrays room to breathe and makes the cancel-with-back-button behaviour natural.

- **Form primitives** in [components/forms/](../apps/web/components/forms/):
  - `MultiLabelCombobox` — shadcn `Command` + `Popover` backed by `useLabelSearch`. Pick from existing suggestions or type a new value and press Enter — new values flow through `createRecipe` → `sys_save_label` per the extensible-label pattern from [step 06](./06-allergy-extensible-and-shadcn.md). Custom-label chips shown with a "custom" badge.
  - `IngredientPicker` — single-select combobox over `useIngredients` (global catalog). Perishable items get a badge in the dropdown.
- **`RecipeForm`** at [_components/recipe-form.tsx](../apps/web/app/(app)/recipes/_components/recipe-form.tsx): the workhorse. `react-hook-form` + `zodResolver`. Shared by create + edit. Fields: name, description, meal_type, difficulty, servings, cuisine, prep_time, cook_time, dietary_tags (MultiLabelCombobox), ingredients[] (IngredientPicker + qty + unit, `useFieldArray`, min 1), instructions[] (textarea per step, `useFieldArray`). Submits via `useCreateRecipe` / `useUpdateRecipe` and toasts on success or failure.
- **`DeleteRecipeDialog`** at [_components/delete-recipe-dialog.tsx](../apps/web/app/(app)/recipes/_components/delete-recipe-dialog.tsx): confirmation dialog wired to `useSoftDeleteRecipe`. Explains the soft-delete semantics (prior menus still render).
- **Pages**:
  - `/recipes` — Table with row dropdown (Edit / Delete), Skeleton on load, EmptyState with a CTA when no recipes.
  - `/recipes/new` — hosts `RecipeForm mode="create"`. Cancel returns to `/recipes`.
  - `/recipes/[id]/edit` — hosts `RecipeForm mode="edit"`, hydrated from `useRecipeDetail`. `params` unwrapped via React's `use()` per Next 15's promise-typed params contract.

### Phases 3 + 4 + 5 — Menu, grocery, export (commit lands after this log)

- **`GenerateMenuDialog`** at [menu/_components/generate-menu-dialog.tsx](../apps/web/app/(app)/menu/_components/generate-menu-dialog.tsx): one-field form (`week_start_date`, defaulting to next Monday since the engine treats `day_of_week` as Monday-first). Submits through `useGenerateMenu`. Renders the failure reason inline (covering `no_valid_recipe` with `affectedMemberId` + `affectedMeal`, `no_slots`, `empty_workspace`). Toast on success.
- **`ActiveMenuView`** at [menu/_components/active-menu-view.tsx](../apps/web/app/(app)/menu/_components/active-menu-view.tsx): metadata header (week, seed, inputs_hash) + day cards (Mon → Sun) showing each slot's meal_key + recipe name. Recipe names resolved client-side from `useRecipesList`.
- **`/menu`** page wires it all together: `useActiveMenu`, Generate/Regenerate button (mode switches based on whether a menu exists), Export dropdown (Markdown / CSV) anchored on the page header. Both export actions go through `downloadMenuExport` from the Phase 0 hook.
- **`/grocery`** page: `useActiveGroceryLists` + `useIngredients` for ingredient names + `useWorkspaceWithMembers` for member names. Renders sorted lists (shared first, then per-member alphabetical) with a Table per list, items sorted alphabetically by ingredient name. Null `scheduled_purchase_day` shown as `—` matching the markdown exporter.

## Observed issue

- **zod transforms collide with shadcn's `FormField` generic constraint.** First pass at `RecipeForm` used `z.preprocess(...)` and `.transform(...)` for empty-string → undefined / string → number coercion. This makes `z.input<T>` ≠ `z.output<T>`, and shadcn's `FormField` expects `Control<TFieldValues, any, TFieldValues>` — so the third generic parameter mismatches. Resolved by holding all form values as strings (matching what the HTML inputs actually produce), validating with `z.string().refine(...)`, and doing the type conversion once in `toCreatePayload` before calling the mutation. Documented in the form file so the next agent doesn't re-introduce the transforms.
- **`DropdownMenuItem.variant` prop doesn't exist in this shadcn version.** The newer "destructive" variant from the shadcn docs hadn't been ported into the generated file. Replaced with `className="text-destructive focus:bg-destructive/10 focus:text-destructive"` so the styling lives next to the call site.
- **`react-day-picker@10` API change.** shadcn's `calendar.tsx` set a `table:` key in `classNames`; v10 removed `table` from `Partial<ClassNames>` because DayPicker now renders as flex. One-line delete in the generated file. Captured here so a future `shadcn add calendar` re-overwrite knows to re-apply.
- **Hooks live in `packages/supabase` per the documented convention** ([query-patterns.md](../.cursor/rules/query-patterns.md): "Each postgres table has custom hooks within the packages/supabase/module folder"). This adds `@tanstack/react-query` as a direct dep on what was otherwise a server-friendly package. Mitigated by a `./react` subpath export so server-only callers (route handlers, integration tests) keep importing from `@weekly-food-planner/supabase` and don't pull React Query through their bundle. Documented in [packages/supabase/src/react.ts](../packages/supabase/src/react.ts).
- **All form values held as strings** ↑ doc'd above. The convention sacrifices a little type expressiveness for compatibility with `FormField`. The submit handler is the one canonical place where strings become numbers/undefined.
- **`useGenerateMenu` is HTTP-only**, not a Supabase CRUD call, because the route handler does orchestration the supabase package doesn't (overlay dedup, pre-engine validation, engine call, audit-run insert in one transaction). Lives in `apps/web/lib/hooks/` rather than `packages/supabase/src/module/` so the supabase package stays focused on direct-DB calls. Documented inline.
- **Edit mode only saves scalar columns.** The PATCH `/api/workspaces/[id]/recipes/[recipeId]` route only covers `recipes` table columns — there is no "replace ingredients" endpoint yet. UI surfaces this as a callout above the submit row so the user knows to delete-and-recreate for array changes. Carried as a follow-up.
- **The (app) layout is a server component, providers are client.** `WorkspaceProvider`, `SidebarProvider` etc. are `'use client'`, so the layout file itself stays a server component and Next can statically optimise it. Children render-tree client/server boundary is at the `<WorkspaceProvider>` line.

## Follow-up fixes

- Phase 6 (verify + document + ship) is the natural next step: walk the flow in a real browser via the `/verify` skill (signup → recipe ×3 → generate menu → view grocery → export both formats); update [README.md](../README.md) + [docs/LOCAL_DEV.md](../docs/LOCAL_DEV.md) with the UI walkthrough.
- "Replace ingredients" endpoint for the recipe PATCH route, so edit mode can update arrays.
- Re-enable the four scope cuts when their stakeholders show up: overlay UI (engine + route handler already support it), member-management screens, password reset, multi-workspace switcher (`useWorkspacesForUser` already returns the full list — only the picker UI is missing).
- Still-deferred from step 14 and earlier (all engine-side, none block UI):
  - Soft-constraint scoring + local-search refinement per [ARCHITECTURE_PRD §6.1](../docs/PRD/ARCHITECTURE_PRD.md).
  - Per-member grocery splits + freshness-aware `scheduled_purchase_day`.
  - "Untagged allergen is silently skipped" engine test branch (from log 06).
  - `(raw_input_with_duplicates, deduped_equivalent)` overlay fixture pair (from log 08).
  - Wire `pnpm test:integration` into CI behind a Supabase-secrets job guard.
