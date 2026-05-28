# packages/supabase CLAUDE.md

Owns migrations, generated DB types, and per-table modules. Load when editing anything under [`src/`](./src/) or [`supabase/`](./supabase/).

## Layout

```
packages/supabase/
  src/
    index.ts              barrel — the single allowed import surface
    react.ts              QueryClient + helpers re-exports for the app
    module/               per-table CRUD + React Query hooks (e.g. recipes.ts + recipes.react.ts)
    types/                generated database.types.ts + database-functions.types.ts
  supabase/
    config.toml           Supabase CLI config
    migrations/           timestamped SQL files
    snippets/             reusable SQL fragments
    seed.sql              dev seed
```

## The migration ritual

```sh
cd packages/supabase
npx supabase migration new <file_name>          # always use the CLI — never hand-create a file
```

File names follow `[timestamp]_[type]_[action]_[subject]_[modifier].sql`:

| Prefix | Meaning |
|---|---|
| `sys_` | System RPCs / functions (`sys_create_user`, `sys_save_label`) |
| `enum_` | Enumerations (`enum_create_workspace_role`) |
| `tbl_` | Tables (`tbl_create_recipes_with_trigger`) |
| `trg_` | Standalone triggers (`trg_workspace_single_creator`) |
| `rls_` | RLS policy groups (`rls_create_workspace_policies`) |
| `fn_` | Utility functions (`fn_create_updated_at_trigger`) |
| `idx_` | Standalone indexes (`idx_add_recipes_cuisine`) |

Modifiers: `_with_trigger`, `_with_index`, `_with_policy`.

## Order of operations

Within a single migration file, and across files:

1. Functions / RPCs (may be called by triggers).
2. Enums (may be referenced by tables).
3. Tables with their indexes and triggers (`_with_trigger`).
4. RLS enablement (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).
5. RLS policies — **unless** the policy is function-scoped, in which case it lives in the same file as the function.

## Function/RPC migrations — required co-location

RPC, GRANT, and any RPC-specific RLS policies live in the **same file**. Example skeleton:

```sql
CREATE OR REPLACE FUNCTION sys_save_label(p_enum_type text, p_value text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
...
$$;

GRANT EXECUTE ON FUNCTION sys_save_label TO authenticated;

CREATE POLICY "Users can insert pending enum_metadata via sys_save_label"
  ON enum_metadata FOR INSERT TO authenticated
  WITH CHECK (...);
```

`SECURITY DEFINER` requires `SET search_path = public` (or whatever schema). Always.

## Table style

```sql
CREATE TABLE recipes (
  -- Primary key first
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Required fields
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  meal_type meal_type NOT NULL,
  -- Optional fields
  description TEXT,
  cuisine TEXT,
  -- Soft delete (where applicable)
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  -- Timestamps last
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Then in the same file: `CREATE INDEX idx_recipes_workspace ON recipes(workspace_id) WHERE is_deleted = false;` and the `updated_at` trigger via `fn_create_updated_at_trigger()`.

## Soft delete

`workspaces`, `workspace_members`, `recipes`, `menus` carry `is_deleted boolean NOT NULL DEFAULT false`. Rules:

- RLS read policies filter `is_deleted = false`. Service-role can read deleted rows for audit.
- Unique constraints become **partial**: `UNIQUE (workspace_id, week_start_date) WHERE is_deleted = false AND accepted_at IS NOT NULL`.
- Child tables (`menu_slots`, `recipe_ingredients`, `grocery_lists`) don't carry their own `is_deleted` — they cascade-hide through the parent.
- Junction tables (`member_dietary_restrictions`, `recipe_dietary_tags`, etc.) use direct DELETE — soft delete buys nothing there.

## RLS conventions

- Use the `fn_user_workspace_role(user_id, workspace_id) RETURNS workspace_role` helper for membership checks.
- Read policies always include `is_deleted = false` for soft-deletable tables.
- Mutations re-check role in the route handler too — RLS gives the safety net, server code gives the clear 403.

## Generated types

`database.types.ts` and `database-functions.types.ts` are generated from the live DB schema. Regenerate after any migration:

```sh
cd packages/supabase
pnpm run gen:types     # see package.json scripts
```

Import only from the package barrel:

```ts
// ✅
import type { Database, Tables } from "@weekly-food-planner/supabase"

// ❌
import { recipesKeys } from "@weekly-food-planner/supabase/src/module/recipes.react"
```

## Module hooks

Each table has a paired module:

- `<table>.ts` — pure CRUD against Supabase (`getRecipes`, `createRecipe`, …). Toasts at this layer if appropriate. Returns plain promises.
- `<table>.react.ts` — TanStack Query wrappers (`useRecipes`, `useCreateRecipe`). Return the full query/mutation object. Use the static-key catalogue for server prefetching.

Detailed pattern: [`.cursor/rules/query-patterns.md`](../../.cursor/rules/query-patterns.md).

## Delegate to

- `supabase-migration-author` — anything that creates, modifies, or drops a schema object.
- `route-handler-engineer` — anything that consumes these modules from a route handler.
