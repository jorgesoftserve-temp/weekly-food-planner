---
name: feature-folder-scaffold
description: Scaffold a new CRUD feature folder under apps/web/app/(app)/<feature>/ matching the repo's canonical shape — client-side list page + create/edit dialog (with shared form component) + soft-delete confirm dialog + Zod schema + colocated integration test. Pulls list/mutation hooks from the @weekly-food-planner/supabase/react package; never generates new hooks at the app level. Invoke when adding a new authenticated CRUD page (e.g. tags, shopping templates, recipe collections). Do NOT use this skill for read-only pages, full-page-form features (where create lives at /<feature>/new, like recipes), public auth pages, or features that don't have a corresponding packages/supabase/src/module/<table>.ts module yet.
---

# feature-folder-scaffold

The repo's authenticated CRUD pages follow a consistent shape (see [`members`](../../../apps/web/app/(app)/members/) for the canonical example). This skill emits that shape end-to-end for a new feature so the engineer doesn't re-derive the layout, the hook usage, the role gating, or the dialog wiring each time. Output is the file set, ready to drop into `apps/web/app/(app)/<feature>/`.

## When to invoke

- Adding a new CRUD page where the user lists rows, creates new rows via a dialog, edits via a dialog, and soft-deletes with a confirm.
- The underlying table already exists AND has a `packages/supabase/src/module/<table>.ts` module with at least: `list<Things>`, `create<Thing>`, `update<Thing>`, `softDelete<Thing>`, plus the matching `<table>.react.ts` hooks.
- The user is creator or admin to mutate; members can at least view.

## When NOT to invoke

- The underlying table or module doesn't exist → run `supabase-add-column` (or the `supabase-migration-author` agent) and the module-creation step first.
- Read-only pages (e.g. `/menu/history`) — they don't need the dialog scaffold; build inline.
- Full-page create flows (the user navigates to `/recipes/new` rather than opening a dialog) — those use a different layout. See [`apps/web/app/(app)/recipes/new/page.tsx`](../../../apps/web/app/(app)/recipes/new/page.tsx).
- Public auth pages (`/login`, `/signup`) — different layout group `(auth)/`.
- Features that need server-side prefetching for SEO or initial-paint reasons (most authenticated app pages don't; the canonical shape is client-side). If prefetch is genuinely needed, scaffold manually following the [query-patterns.md](../../../.cursor/rules/query-patterns.md) hydration pattern.

## Input

The user supplies (or the skill asks for, one round of clarification only):

```yaml
feature: snake_case_plural           # URL slug + folder name, e.g. "shopping-templates" or "tags"
                                     # use kebab-case for the URL; folder name matches
title: "Shopping templates"          # PageHeader title
description: "Reusable grocery lists for one-off events"  # PageHeader description
icon: lucide-icon-name               # default "List"; from lucide-react

# The underlying table/module
module: snake_case                   # module file basename, e.g. "shopping_templates" → packages/supabase/src/module/shopping-templates.ts
record: PascalCase                   # the Record type, e.g. ShoppingTemplateRecord
keys: camelCase                      # the keys object, e.g. shoppingTemplateKeys
hooks:                               # the React Query hook names from <module>.react.ts
  list: useShoppingTemplatesList
  create: useCreateShoppingTemplate
  update: useUpdateShoppingTemplate
  softDelete: useSoftDeleteShoppingTemplate
mutationPayloadType: CreateShoppingTemplatePayload
patchType: UpdateShoppingTemplatePatch

# Form schema
formFields:                          # the fields the create/edit form exposes
  - name: name
    label: "Name"
    type: text                       # text | textarea | number | select | combobox | switch
    required: true
    minLength: 1
    maxLength: 80
  - name: description
    label: "Description"
    type: textarea
    required: false
    maxLength: 500
  - name: visibility
    label: "Visibility"
    type: select
    required: true
    options:
      - { value: workspace, label: "Workspace" }
      - { value: personal,  label: "Just me" }

# Row display in the list
listColumns:                         # which fields to show as table columns
  - { field: name,        label: "Name" }
  - { field: visibility,  label: "Visibility" }
  - { field: created_at,  label: "Created", format: "date" }

# Optional Zustand store
zustand: false                       # set true ONLY if multi-step form drafts or cross-component transient state are needed
```

If the user describes the feature in prose, ask **once** for: (a) the feature slug + title, (b) which module backs it (must already exist), (c) the form fields with types, (d) which columns appear in the list. Then proceed.

## Authoritative repo references

Read before generating; if shape has changed since this skill was written, follow the live file.

| Reference | Why |
|---|---|
| [`apps/web/app/(app)/members/page.tsx`](../../../apps/web/app/(app)/members/page.tsx) | Canonical list page — `'use client'`, hooks pattern, table layout, dropdown actions, dialog state via `useState`. |
| [`apps/web/app/(app)/members/_components/member-form.tsx`](../../../apps/web/app/(app)/members/_components/member-form.tsx) | Form pattern — react-hook-form + Zod + shadcn `Form`. |
| [`apps/web/app/(app)/members/_components/member-form-dialog.tsx`](../../../apps/web/app/(app)/members/_components/member-form-dialog.tsx) | Dialog wrapper that hosts the form. Handles create vs edit via mode prop. |
| [`apps/web/app/(app)/members/_components/delete-member-dialog.tsx`](../../../apps/web/app/(app)/members/_components/delete-member-dialog.tsx) | Destructive confirm dialog pattern. |
| [`apps/web/components/empty-state.tsx`](../../../apps/web/components/empty-state.tsx) | Zero-data state component. |
| [`apps/web/components/page-header.tsx`](../../../apps/web/components/page-header.tsx) | Title + description + primary action button. |
| [`apps/web/components/workspace-provider.tsx`](../../../apps/web/components/workspace-provider.tsx) | `useActiveWorkspace` for workspace context + role. |
| [`apps/web/lib/hooks/use-supabase.ts`](../../../apps/web/lib/hooks/use-supabase.ts) | `useSupabase` client hook. |
| [`packages/supabase/src/module/members.react.ts`](../../../packages/supabase/src/module/members.react.ts) | Reference hook shape — list, detail, create, update, soft-delete. |
| [`apps/web/CLAUDE.md`](../../../apps/web/CLAUDE.md) | App-wide conventions. |

## Steps

1. **Confirm prerequisites** — `Glob` for the module file (`packages/supabase/src/module/<module>.{ts,react.ts}`). If missing, abort with a clear message and recommend creating the module first. Read the module file to confirm the hook names and types match the input spec; correct the spec from the file if there's a mismatch.
2. **Confirm role gating** — does the feature require `creator` / `admin` for mutations? Default yes; expose as a flag in the input only if the user explicitly says otherwise.
3. **Emit `page.tsx`** at `apps/web/app/(app)/<feature>/page.tsx`. Follow the members page structure:
   - `'use client'`
   - Imports from `@weekly-food-planner/supabase/react` (for hooks) and `@weekly-food-planner/supabase` (for types).
   - Local imports: `Button`, `DropdownMenu*`, `Skeleton`, `Table*`, `EmptyState`, `PageHeader`, `useActiveWorkspace`, `useSupabase`.
   - Component imports from `./_components/*`.
   - `EditTarget` union type (`{ mode: 'create' } | { mode: 'edit'; <thing>Id: string }`).
   - `<Feature>Page` function: derive `canManage` from workspace role; call the list hook; render `PageHeader`, loading skeleton, empty state, or table.
   - Row actions: edit (opens dialog) + delete (opens confirm). Hidden when `!canManage`.
4. **Emit `_components/<feature>-form.tsx`** — the actual form.
   - `'use client'`
   - react-hook-form + Zod resolver.
   - Zod schema defined inline (or in a sibling `<feature>.schema.ts` if the spec is large).
   - shadcn `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage` per field.
   - Field types map: `text` → `Input`, `textarea` → `Textarea`, `number` → `Input type="number"`, `select` → shadcn `Select`, `combobox` → `multi-label-combobox` or `ingredient-picker` if applicable, `switch` → shadcn `Switch`.
   - RO-RO `onSubmit({ values })` callback prop.
   - Layout: `flex flex-col gap-4` (per the project's flex-over-space rule).
5. **Emit `_components/<feature>-form-dialog.tsx`** — the dialog wrapper.
   - `'use client'`
   - shadcn `Sheet` (right-side drawer) — match the recipes/members feel.
   - Mode-aware: `mode === 'create'` → calls the create hook; `mode === 'edit'` → fetches detail (if needed) and calls update.
   - Toast via `sonner` on success/failure (the package CRUD layer already toasts in some places — check the module's existing behaviour and don't double-toast).
   - `onOpenChange` clears the parent's `editTarget` state.
6. **Emit `_components/delete-<feature>-dialog.tsx`** — destructive confirm.
   - `'use client'`
   - shadcn `Dialog` (modal feel matches the destructive intent).
   - Shows the row's name + a confirm button.
   - Calls the soft-delete hook.
   - Toast on success/failure.
7. **Emit a Zustand store** at `apps/web/app/(app)/<feature>/_store.ts` ONLY if `zustand: true` in the input. Default is no store — local `useState` in `page.tsx` is enough for "which row is being edited".
8. **Emit an integration test** at `apps/web/integration/<feature>/<feature>.integration.test.ts` covering:
   - Happy-path list: workspace member sees the list.
   - Role matrix: members can read but cannot mutate (the mutate UI is hidden); creator/admin can mutate.
   - Soft-delete visibility: deleted rows don't appear in the list.
   - At least one form-field validation: missing required field returns 422.
9. **Surface protection routes** — append `/<feature>` to the protected-prefix list in [`apps/web/middleware.ts`](../../../apps/web/middleware.ts) so unauthenticated visitors get redirected to `/login?next=/<feature>`.
10. **Surface sidebar nav** — add the feature to [`apps/web/components/app-shell/app-sidebar.tsx`](../../../apps/web/components/app-shell/app-sidebar.tsx) with the chosen lucide icon and the route URL. Order follows existing nav: dashboard → members → recipes → menu → grocery → new feature (or rearrange per the user's intent).
11. **Report** in the structure below.

## Report structure

```markdown
## Scaffold feature `<feature>` (CRUD, list + dialog + soft delete)

### Files emitted

```
apps/web/app/(app)/<feature>/page.tsx
apps/web/app/(app)/<feature>/_components/<feature>-form.tsx
apps/web/app/(app)/<feature>/_components/<feature>-form-dialog.tsx
apps/web/app/(app)/<feature>/_components/delete-<feature>-dialog.tsx
apps/web/app/(app)/<feature>/_store.ts                                # only if zustand: true
apps/web/integration/<feature>/<feature>.integration.test.ts
```

Plus inline patches:
- `apps/web/middleware.ts` — add `/<feature>` to protected prefixes.
- `apps/web/components/app-shell/app-sidebar.tsx` — add nav entry.

### Confirmed module dependencies

- `packages/supabase/src/module/<module>.ts` provides `<Record>`, `<CreatePayload>`, `<UpdatePatch>`, `list<Things>`, `create<Thing>`, `update<Thing>`, `softDelete<Thing>`, `<keys>` ✅
- `packages/supabase/src/module/<module>.react.ts` provides `use<Things>List`, `useCreate<Thing>`, `useUpdate<Thing>`, `useSoftDelete<Thing>` ✅

### Commands

```sh
# 1. Typecheck the new files
pnpm typecheck

# 2. Run the new integration test (requires Supabase local + env vars)
INTEGRATION_ENABLED=1 SUPABASE_TEST_URL=... SUPABASE_TEST_SERVICE_KEY=... pnpm --filter @weekly-food-planner/web test -- <feature>

# 3. Browser test
pnpm --filter @weekly-food-planner/supabase db:start && pnpm dev
# Visit http://127.0.0.1:3000/<feature> (after login as creator/admin)
```

### Things you may need to follow up on

- Form fields with `combobox` type need a values source (e.g. an enum_metadata fetch) — wire that up if it isn't already imported.
- If the feature should appear on the dashboard's primary cards, edit `apps/web/app/(app)/dashboard/page.tsx`.
- If the feature needs an entry in the React Query devtools panel during dev, no action needed — the existing devtools setup auto-shows all queries.

### Hand-offs

- UI polish (icons, spacing, copy) → `ui-component-builder` agent.
- A11y review pass → `accessibility-auditor` agent.
- Product UX review pass → `ux-reviewer` agent.
- Additional integration tests beyond the canonical four → `vitest-integration-author` agent.
```

## Non-negotiables

- **Never generate new app-level React Query hooks.** Hooks live in `packages/supabase/src/module/<table>.react.ts`. If the spec calls for a hook that doesn't exist, abort with a clear message and recommend extending the module first.
- **Never create a `lib/hooks/<feature>/` directory.** This repo's React Query keys + hooks live in the supabase package, not in the app.
- **Always include role gating in the UI.** `canManage = workspace?.role === 'creator' || workspace?.role === 'admin'` is the canonical check. Hide mutation controls when false. The server is still authoritative.
- **Default to no Zustand.** Add a store only when the user explicitly needs cross-component ephemeral state (a multi-step form draft, a long-lived drawer that survives navigation). Single-page `useState` is the default.
- **`flex` + `gap-*`, never `space-*` or `mt-*`.** Per [global-rules.md](../../../.cursor/rules/global-rules.md).
- **Toasts at the CRUD layer or in the dialog, not both.** Read `<module>.ts` / `<module>.react.ts` before adding a toast — if the package already toasts on mutation, don't duplicate.
- **One export per file.** Fat-arrow component declarations. Kebab-case filenames.
- **Server-side prefetch is opt-in.** The default scaffold is fully client-side per the members page. If the user explicitly asks for prefetch, scaffold manually using the hydration pattern.

## What to flag in the report

- **Missing module functions.** If the module exists but lacks `softDelete<Thing>` (some tables don't have soft delete), the scaffold emits the delete dialog wired to a hard-delete or omits it. Either way, surface the choice.
- **Form fields that need a values fetch.** Combobox / select fields whose options come from `enum_metadata` need an additional hook call. Name the hook (or recommend `useLabelsList` if it's an extensible label).
- **Sidebar ordering ambiguity.** If the user didn't specify ordering, pick a sensible default and surface it in the report so the user can rearrange.
- **Middleware coverage gap.** If the user wants the page accessible to unauthenticated viewers (rare), do NOT add the prefix to middleware — flag it explicitly.
- **Test gating.** Remind the user the integration test won't run in CI without `INTEGRATION_ENABLED` + Supabase test env vars. If they want CI coverage, recommend converting to a unit test of pure form-validation logic and reserving the integration test for local runs.

## Example

See [`docs/examples/shopping-templates.md`](./docs/examples/shopping-templates.md) for a worked output on scaffolding a hypothetical `shopping-templates` CRUD feature. Use it as the template for the report shape.
