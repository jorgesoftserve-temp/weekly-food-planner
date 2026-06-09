---
name: add-module-and-hooks
description: Emit the full data-layer module pair for a table that already exists in the DB and in the generated types — the pure-CRUD `module/<table>.ts` (with `*_SELECT` constant, `<Table>Record`/`Create*Payload`/`Update*Patch` types, soft-delete-aware fat-arrow CRUD), the TanStack Query `module/<table>.react.ts` (dual query-key catalogue + use/useCreate/useUpdate/useDelete hooks), and the barrel re-exports in `src/index.ts` and `src/react.ts`. Invoke when a migrated table is present in `database.types.ts` but has no `module/<table>.ts`/`.react.ts` yet, or when scaffolding a brand-new module pair. Do NOT invoke when the table still needs creating (→ `supabase-migration-author` agent), when adding a column to a module that already exists (→ `supabase-add-column` skill), for judgement-heavy or unusual module reshaping (→ `supabase-module-author` agent), or for route handlers (→ `route-handler-engineer` agent).
---

# add-module-and-hooks

Creating the TypeScript data layer for a table is a multi-file change that has to stay aligned: the `module/<table>.ts` declares an explicit `*_SELECT` constant (never `select('*')`), a `<Table>Record` type that matches the select, `Create<Table>Payload` / `Update<Table>Patch` types, and soft-delete-aware fat-arrow CRUD functions; the `module/<table>.react.ts` declares the dual query-key catalogue (a static-array form for server prefetch and a function form for client invalidation) plus the `use*` / `useCreate*` / `useUpdate*` / `useSoftDelete*` hooks; and both have to be re-exported through the package barrels (`src/index.ts` and `src/react.ts`). This skill walks the pair in order and emits every artifact so a freshly-migrated table gets a complete, convention-correct data layer in one pass. It is the "create a NEW module" counterpart to [`supabase-add-column`](../supabase-add-column/SKILL.md), which only ADDS A COLUMN to a module that already exists.

## When to invoke

- A table's migration has landed and the table is present in [`packages/supabase/src/database.types.ts`](../../../packages/supabase/src/database.types.ts), but there is no `packages/supabase/src/module/<table>.ts` / `.react.ts` yet.
- You need to scaffold a brand-new module pair for an existing table (e.g. `tags`, `recipe_collections`, `shopping_templates`).
- A table that was previously read ad-hoc needs to be promoted to a proper module + hooks.

## When NOT to invoke

- The table doesn't exist yet (no migration, or not in `database.types.ts`) → use the [`supabase-migration-author`](../../agents/supabase-migration-author.md) agent to create it first, then come back.
- Adding a column to a module that already exists → use the [`supabase-add-column`](../supabase-add-column/SKILL.md) skill.
- Judgement-heavy or unusual module reshaping (multi-table joins, bespoke RPC orchestration, denormalised read models, anything that doesn't fit the members/recipes/profiles shape) → use the [`supabase-module-author`](../../agents/supabase-module-author.md) agent.
- Writing or revising a route handler that consumes the module → use the [`route-handler-engineer`](../../agents/route-handler-engineer.md) agent.
- The feature folder / UI that consumes the hooks → use the [`feature-folder-scaffold`](../feature-folder-scaffold/SKILL.md) skill (it pulls hooks from this package; it never generates them).

If the request mixes a new module with one of the above, this skill emits the module pair and hands the rest off in the report.

## Input

The user supplies (or the skill asks for, one round of clarification only):

```yaml
table: snake_case_plural          # e.g. tags, recipe_collections — must already exist in database.types.ts
scope: workspace | user           # workspace-scoped (filter by workspace_id, like members/recipes)
                                  #   or user-scoped (filter by id = userId via RLS, like profiles)
softDelete: true | false          # does the table carry is_deleted? (workspaces/recipes/menus/members do)
columns:                          # the scalar columns the module should read/write (omit timestamps + is_deleted)
  - name: snake_case
    type: text | int | numeric | boolean | timestamptz | jsonb | uuid | <enum_name>
    nullable: true | false
    inCreate: true | false         # part of the create payload?
    inUpdate: true | false         # part of the update patch?
children?:                        # one-to-many junctions read into <Table>Record (like member_dietary_restrictions)
  - relation: snake_case_plural    # e.g. recipe_dietary_tags
    columns: [col, ...]            # selected columns from the child
    extensibleLabel?: cuisine_type | dietary_restriction | dietary_tag | food_allergy   # route writes through sys_save_label
extraInvalidations?:              # other query keys to invalidate on mutation (e.g. workspaceKeys.detail)
  - workspaceKeys.detail
```

If the user just describes the table in prose, ask **once** for: (a) the table name, (b) workspace- or user-scoped, (c) whether it soft-deletes, (d) the scalar columns to read/write, (e) any child relations to fold into the record. Then proceed.

## Authoritative repo references

Read before generating; if the shape has changed since this skill was written, follow the live file.

| Reference | Why |
|---|---|
| [`packages/supabase/src/module/members.ts`](../../../packages/supabase/src/module/members.ts) | Canonical workspace-scoped, soft-deletable module: `MEMBER_SELECT`, `MemberRecord`, `CreateMemberPayload`, `UpdateMemberPatch`, `listMembers`/`getMember`/`createMember`/`updateMember`/`softDeleteMember`, plus child-relation `set*` helpers routing through `sys_save_label`. |
| [`packages/supabase/src/module/members.react.ts`](../../../packages/supabase/src/module/members.react.ts) | Canonical hook file: `useMembersList` / `useMemberDetail` / `useCreateMember` / `useUpdateMember` / `useSoftDeleteMember`, the shared `invalidateMemberCaches` helper, and the cross-key invalidation of `workspaceKeys.detail`. |
| [`packages/supabase/src/module/recipes.ts`](../../../packages/supabase/src/module/recipes.ts) | Reference for the dual query-key catalogue (`recipeQueryKeys` static + `recipeKeys` function) and a multi-child `RECIPE_SELECT`. |
| [`packages/supabase/src/module/profiles.ts`](../../../packages/supabase/src/module/profiles.ts) + [`profiles.react.ts`](../../../packages/supabase/src/module/profiles.react.ts) | Canonical user-scoped module (filter by `id = userId`, RLS as the trust boundary, no soft delete) — the minimal end of the spectrum. |
| [`packages/supabase/src/index.ts`](../../../packages/supabase/src/index.ts) | The non-react barrel. Every new `module/<table>.ts` gets a `export * from './module/<table>.js'` line here. |
| [`packages/supabase/src/react.ts`](../../../packages/supabase/src/react.ts) | The react barrel. Every new `module/<table>.react.ts` gets a `export * from './module/<table>.react.js'` line here. |
| [`packages/supabase/src/database.types.ts`](../../../packages/supabase/src/database.types.ts) | The generated types file. The target table **must** be present here before this skill runs. If it isn't, STOP and hand to the migration author. |
| [`packages/supabase/package.json`](../../../packages/supabase/package.json) | Confirm the types-regen script name: `db:gen:types`. |
| [`.cursor/rules/query-patterns.md`](../../../.cursor/rules/query-patterns.md) | The dual query-key contract: static array for server prefetch, function form for client invalidation. Both must produce the same array. |
| [`packages/supabase/CLAUDE.md`](../../../packages/supabase/CLAUDE.md) — Module hooks | Module-pair conventions: `<table>.ts` pure CRUD returning plain promises, `<table>.react.ts` TanStack wrappers returning the full query/mutation object. |

## Steps

1. **Confirm the table exists in the generated types.** `Grep` for the table name in [`packages/supabase/src/database.types.ts`](../../../packages/supabase/src/database.types.ts) (under `Tables`). If absent, **abort**: "Table `<x>` is not in `database.types.ts`; create + migrate it via the `supabase-migration-author` agent and regenerate types before running this skill." Do not guess the column shape.
2. **Confirm no module already exists.** `Glob` for `packages/supabase/src/module/<table>.ts`. If it exists, this is a column add, not a new module → redirect to [`supabase-add-column`](../supabase-add-column/SKILL.md).
3. **Read the live `Row` / `Insert` / `Update` types** for the table from `database.types.ts` to derive the exact column names, TS types, and nullability. The `<Table>Record` field types must match the generated `Row` type.
4. **Pick the scope template.** Workspace-scoped → mirror `members.ts` (filter `workspace_id` + `is_deleted = false` on reads). User-scoped → mirror `profiles.ts` (filter `id = userId`; RLS is the trust boundary).
5. **Emit `packages/supabase/src/module/<table>.ts`** in this order (mirror `members.ts`):
   - Imports: `type { SupabaseClient } from '@supabase/supabase-js'`, plus any enum types from `../types/db.js`.
   - `<Table>Record` type — fields from the select, child relations as `Array<{ ... }>`.
   - `Create<Table>Payload` type — required-on-insert fields, optional ones with `?`.
   - `Update<Table>Patch` type — `Partial<{ ... }>`.
   - The **dual query-key catalogue**: `<table>QueryKeys` (static-array form for server prefetch) **and** `<table>Keys` (function form for client invalidation) — both producing the same array shape. (Both appear in `members.ts`/`recipes.ts`.)
   - `const <TABLE>_SELECT = '...'` — explicit column list, plus nested `child (col, ...)` for each child relation. **Never `select('*')`.**
   - `list<Table>` / `get<Table>` — soft-delete-aware (`.eq('is_deleted', false)` when `softDelete`), ordered by `created_at` for lists.
   - `create<Table>` — insert mapped payload, `.select('id').single()`, then child `set*` helpers if any.
   - `update<Table>` — guard empty patch, scoped `.eq('id', ...)` (+ `.eq('workspace_id', ...)` when workspace-scoped).
   - `softDelete<Table>` — `update({ is_deleted: true })` when `softDelete`; otherwise emit a `delete<Table>` doing a hard `.delete()` and say so in the report.
   - For each child relation: a `set<Table><Child>` helper (delete-then-insert), routing user-typed values through `supabase.rpc('sys_save_label', { p_enum_type, p_value })` when `extensibleLabel` is set. Mirror `setMemberDietaryRestrictions`.
6. **Emit `packages/supabase/src/module/<table>.react.ts`** (mirror `members.react.ts`):
   - Imports from `@tanstack/react-query` (`useMutation`, `useQuery`, `useQueryClient`, `type UseMutationResult`, `type UseQueryResult`), `type SupabaseClient`, and the CRUD fns + types + `<table>Keys` from `./<table>.js`.
   - `use<Table>List` / `use<Table>Detail` — `useQuery`, keyed via the **function** form, with an `enabled` guard on the required ids.
   - A shared `invalidate<Table>Caches` helper invalidating the list key, the detail key (when an id is passed), and any `extraInvalidations`.
   - `useCreate<Table>` / `useUpdate<Table>` / `useSoftDelete<Table>` — `useMutation` calling the CRUD fn, `onSuccess` → `invalidate<Table>Caches`.
   - One `useSet<Table><Child>` per child relation, mirroring `useSetMemberDietaryRestrictions`.
7. **Emit the barrel edits.** Add `export * from './module/<table>.js'` to [`src/index.ts`](../../../packages/supabase/src/index.ts) and `export * from './module/<table>.react.js'` to [`src/react.ts`](../../../packages/supabase/src/react.ts). Keep them grouped with sibling modules.
8. **Note types regen.** Only required if the types are not already current. If step 1 found the table, types are current — say "no regen needed". If a column the user named is missing from the live `Row`, **stop** and hand to the migration author + `supabase-add-column`.
9. **Report** in the structure below.

## Report structure

```markdown
## New data-layer module pair for `<table>`

### Preconditions verified
- `<table>` present in `database.types.ts`: yes (under `Tables`).
- No existing `module/<table>.ts`: confirmed.
- Scope: <workspace | user>; soft-delete: <true | false>.

### `packages/supabase/src/module/<table>.ts` (new)
```ts
// full module body
```

### `packages/supabase/src/module/<table>.react.ts` (new)
```ts
// full hooks body
```

### Barrel edits
- `packages/supabase/src/index.ts` — add `export * from './module/<table>.js'`.
- `packages/supabase/src/react.ts` — add `export * from './module/<table>.react.js'`.

### Commands to run
```sh
# Types are already current (table is in database.types.ts) — no regen needed.
# If you changed the schema, regenerate first:
pnpm --filter @weekly-food-planner/supabase db:gen:types
pnpm --filter @weekly-food-planner/supabase typecheck
```

### Hand-offs
- Route handler that consumes these fns → `route-handler-engineer` agent.
- CRUD feature folder consuming the hooks → `feature-folder-scaffold` skill.
- Integration test (CRUD + RLS + role matrix) → `vitest-integration-author` agent.

### Flags
- ... (see "What to flag")
```

## Non-negotiables

- **Never `select('*')`.** Every read uses an explicit `<TABLE>_SELECT` constant, and `<Table>Record` matches it field-for-field.
- **RO-RO on every function and hook.** Receive a single typed object, return a typed value/object. Named params throughout — no positional args, including in `onSuccess`/`mutationFn` callbacks.
- **Soft-delete-aware reads.** When the table carries `is_deleted`, every list/get filters `.eq('is_deleted', false)`, and deletion is `update({ is_deleted: true })` — never a hard `DELETE`. If the table is not soft-deletable, emit a hard-delete fn and call it out in the report.
- **Dual query-key catalogue.** Emit both `<table>QueryKeys` (static array, for server prefetch) and `<table>Keys` (function form, for client invalidation). They must produce identical array shapes. See [query-patterns.md](../../../packages/supabase/src/module/recipes.ts).
- **Export through the barrel only.** New modules are re-exported from `src/index.ts` (CRUD) and `src/react.ts` (hooks). Never let app code reach into `packages/supabase/src/module/...` directly.
- **Types must already be regenerated.** The table (and every column the module reads/writes) must be present in `database.types.ts` before this skill emits TS. If a column is missing, STOP and hand to the `supabase-migration-author` agent (and `supabase-add-column` for the column).
- **One primary export per file, fat-arrow functions, kebab-case file names.** `module/recipe-collections.ts`, not `RecipeCollections.ts`.
- **`.js` import specifiers.** Internal imports use the `.js` extension (`from './<table>.js'`, `from '../types/db.js'`) — the package is ESM/NodeNext. Match the existing modules.
- **Extensible-label child writes go through `sys_save_label`.** Any child column storing a `cuisine_type` / `dietary_restriction` / `dietary_tag` / `food_allergy` value funnels each value through the `sys_save_label` RPC before the junction insert. Mirror `setMemberDietaryRestrictions`.

## What to flag in the report

- **Toasts.** The CRUD layer is where toasts belong per [query-patterns.md](../../../.cursor/rules/query-patterns.md), but the current modules (`members.ts`, `recipes.ts`, `profiles.ts`) do **not** import `sonner` at this layer — they throw `Error` and let the consuming component toast. Follow the live convention (throw, don't toast) unless the user explicitly asks for CRUD-layer toasts; flag the choice either way.
- **Cross-key invalidation.** If the table feeds a dashboard card that reads through another module (the way members feed `useWorkspaceWithMembers`), the mutation hooks must also invalidate that module's key. List the `extraInvalidations` you wired and why.
- **Child relations + `sys_save_label`.** When a child stores an extensible label, the junction insert is only safe after the label is persisted via the RPC. Flag any child relation you routed (or chose not to route) through `sys_save_label`.
- **Scope ambiguity.** If it's unclear whether the table is workspace- or user-scoped from the `Row` type (e.g. it has both `workspace_id` and `user_id`), say which you assumed and why — the RLS read filter depends on it.
- **Missing columns.** If the user asked for a field that isn't in the live `Row` type, do not invent it — report that it's missing and route the column add to `supabase-add-column`.
- **No drive-by changes.** This skill emits exactly the module pair + barrel edits. If you spot an unrelated issue (a sibling module using `select('*')`, a missing index), surface it in the report but do not touch it.

## Example

See [`docs/examples/tags-module.md`](./docs/examples/tags-module.md) for a worked output: a workspace-scoped, soft-deletable `tags` table promoted to a full `tags.ts` + `tags.react.ts` + barrel edits. Use it as the template for the report shape.
