---
name: new-table-migration
description: Emit the full ordered migration set for creating a NEW table in this repo — any new enums it needs, the table itself (with soft-delete column, COMMENT ON TABLE/COLUMN, indexes, partial-unique-on-is_deleted-false, updated_at trigger), the RLS enable + policies (workspace-scoped or self-scoped), the types-regen command, and the data-layer + PRD hand-offs. Invoke when a feature needs a brand-new base table or junction table. Do NOT use this skill to ADD COLUMNS to an existing table (use supabase-add-column), to author a standalone RPC/function with no new table (hand to supabase-migration-author), or to write the data-layer module that reads the new table (that is add-module-and-hooks, emitted as a hand-off here). This skill emits SQL following the migration ritual; the supabase-migration-author agent owns anything beyond a straightforward new table.
---

# new-table-migration

Creating a table in this repo is the single most common — and most ritual-heavy — schema operation. Done by hand it's easy to miss one of: the dependency order (functions → enums → tables → RLS), the soft-delete column + partial unique indexes that filter `is_deleted = false`, the `updated_at` trigger wired to the shared trigger function, `COMMENT ON TABLE`/`COMMENT ON COLUMN`, the RLS *enable* line (a table with policies but RLS not enabled is wide open), workspace-scoped read/write policies using `fn_user_workspace_role`, the types regen, and the downstream module + PRD updates. This skill walks the creation in order and emits every artifact, ordered so it applies cleanly.

## When to invoke

- A feature needs a **new base table** (e.g. `inventory_items`, `shopping_sessions`, `slot_completions`).
- A feature needs a **new junction table** (e.g. `recipe_meal_types`, `member_dietary_preferences`).
- The new table needs a **new enum** as one of its columns — this skill emits the enum file too.

## When NOT to invoke

- Adding a column to an existing table → use [`supabase-add-column`](../supabase-add-column/SKILL.md).
- A standalone RPC / stored function with no new table → [`supabase-migration-author`](../../agents/supabase-migration-author.md) agent.
- Writing the `module/<table>.ts` + `.react.ts` data layer for the new table → [`add-module-and-hooks`](../add-module-and-hooks/SKILL.md) (this skill emits it as a hand-off, it does not generate the module).
- Anything non-trivial beyond a straightforward table (multi-table transactional reshape, data migration of existing rows into the new table, partitioning) → `supabase-migration-author` agent.

## Input

The user supplies (or the skill asks once, one round of clarification):

```yaml
table: snake_case_plural            # e.g. inventory_items
purpose: "one-line — what this table holds and why"
scope: workspace | self | global    # RLS shape: workspace-membership-scoped (most),
                                     # self-only (id = auth.uid(), like profiles),
                                     # or global read (like enum_metadata)
softDelete: true | false            # true (default for workspaces/recipes/menus-like
                                     # domain tables) adds is_deleted + partial indexes
columns:
  - name: snake_case
    type: text | int | numeric | boolean | timestamptz | jsonb | uuid | <enum_name>
    nullable: true | false
    default: <SQL literal or null>
    references?:                     # FK
      table: snake_case_plural
      column: id
      onDelete: CASCADE | SET NULL | RESTRICT
    comment: "one-line column comment"
newEnums?:                           # enums this table introduces
  - name: snake_case                 # e.g. inventory_source
    values: [manual, purchase, leftover]
    comment: "what the enum represents"
uniqueness?:                         # natural keys → partial unique (WHERE is_deleted = false when soft-deleted)
  - columns: [workspace_id, name]
    note: "why this is unique"
trigger: true | false               # updated_at trigger (true whenever the table has updated_at)
```

If the user describes the change in prose, ask **once** for: (a) the table name + purpose, (b) the RLS scope (workspace / self / global), (c) whether it's soft-deletable, (d) the columns with types + nullability, (e) any new enums, (f) natural-key uniqueness. Then proceed.

## Authoritative repo references

Read before generating; if a file's shape has changed since this skill was written, follow the live file.

| Reference | Why |
|---|---|
| [`packages/supabase/supabase/migrations/20260523000207_tbl_create_recipes_with_trigger.sql`](../../../packages/supabase/supabase/migrations/20260523000207_tbl_create_recipes_with_trigger.sql) | Canonical **workspace-scoped soft-delete** table: `is_deleted`, partial unique indexes, `updated_at` trigger, COMMENTs. |
| [`packages/supabase/supabase/migrations/20260608195246_tbl_create_profiles_with_trigger.sql`](../../../packages/supabase/supabase/migrations/20260608195246_tbl_create_profiles_with_trigger.sql) | Canonical **self-scoped** table (`id = auth.uid()`) with RLS **co-located in the same file** — the preferred pattern for new tables. |
| [`packages/supabase/supabase/migrations/20260523000602_rls_create_recipe_policies.sql`](../../../packages/supabase/supabase/migrations/20260523000602_rls_create_recipe_policies.sql) | Canonical workspace-scoped RLS policy set (read filters `is_deleted = false`; write gated by role). |
| [`packages/supabase/supabase/migrations/20260523000000_fn_create_updated_at_trigger.sql`](../../../packages/supabase/supabase/migrations/20260523000000_fn_create_updated_at_trigger.sql) | The shared `updated_at` trigger function every `_with_trigger` table wires to. Do not redefine it. |
| [`packages/supabase/supabase/migrations/20260523000300_fn_user_workspace_role.sql`](../../../packages/supabase/supabase/migrations/20260523000300_fn_user_workspace_role.sql) | The helper RLS policies call to resolve a caller's role in a workspace. |
| [`packages/supabase/supabase/migrations/20260523000100_enum_create_workspace_type.sql`](../../../packages/supabase/supabase/migrations/20260523000100_enum_create_workspace_type.sql) | Canonical enum-create file shape. |
| [`packages/supabase/package.json`](../../../packages/supabase/package.json) | Confirm script names: `db:migration:new`, `db:gen:types`, `db:reset`, `db:start`. |
| [`docs/PRD/DATABASE_PRD.md`](../../../docs/PRD/DATABASE_PRD.md) §6.x | Where the new table's sketch + RLS + index notes must land. |
| [`.cursor/rules/global-rules.md`](../../../.cursor/rules/global-rules.md) — SQL Migration Style Guide | File-naming prefixes (`fn_`/`enum_`/`tbl_`/`rls_`/`trg_`/`idx_`/`sys_`) and dependency order. |

## Steps

1. **Confirm the table does NOT already exist** — `Glob` for `*tbl_create_<table>*.sql`. If found, abort ("Table `<x>` already exists; use `supabase-add-column` to extend it").
2. **Plan the file set in dependency order.** One migration file per concern, timestamp-ordered so dependencies apply first:
   - `enum_create_<name>.sql` — one per new enum (must precede the table that uses it).
   - `tbl_create_<table>[_with_trigger].sql` — the table, its indexes, COMMENTs, the `updated_at` trigger (if `trigger: true`), **and** its RLS enable + policies co-located (preferred — matches the profiles precedent). Use `_with_trigger` suffix only when an `updated_at` trigger is present.
   - `sys_<...>.sql` — only if a signup/bootstrap function must also insert into the new table (rare).
   Generate each filename via the `db:migration:new` script — never hand-write the timestamp.
3. **Emit each enum migration** (if any): `CREATE TYPE public.<name> AS ENUM ( ... );` + a `COMMENT ON TYPE`. Match the canonical enum file.
4. **Emit the table migration**, sections in this order:
   - Header comment block: what the table holds, its RLS scope, soft-delete behaviour, FK relationships.
   - `CREATE TABLE public.<table> ( ... )` — `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, the columns, FK constraints with the right `ON DELETE`, `is_deleted boolean NOT NULL DEFAULT false` (if soft-delete), `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()` (if `trigger: true`).
   - `COMMENT ON TABLE` + one `COMMENT ON COLUMN` per non-obvious column.
   - Indexes: FK columns get a plain index; natural keys become **partial unique** `CREATE UNIQUE INDEX ... WHERE is_deleted = false` (so a soft-deleted row doesn't block re-insert). Name them `uq_<table>_<cols>` / `idx_<table>_<col>`.
   - `updated_at` trigger (if applicable): `CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.<table> FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();` — wire to the existing shared function, do not redefine it.
   - `ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;` — **mandatory**; a table with policies but RLS disabled is fully open.
   - RLS policies for the chosen `scope`:
     - **workspace**: SELECT `USING (is_deleted = false AND public.fn_user_workspace_role(workspace_id) IS NOT NULL)`; INSERT/UPDATE/DELETE gated by role (`... IN ('owner','admin', ...)`) — mirror the recipe policy file. Soft-delete = an UPDATE setting `is_deleted = true`, not a DELETE.
     - **self**: `USING (id = auth.uid())` for read + update — mirror profiles.
     - **global**: authenticated read `USING (true)`; writes restricted (often service-role only) — mirror enum_metadata.
5. **Emit the types-regen command** — `pnpm --filter @weekly-food-planner/supabase db:gen:types` (dev DB must be running). Note it runs *before* any TypeScript edits.
6. **Hand off the data layer** — the `module/<table>.ts` + `.react.ts` + barrel pair is emitted by [`add-module-and-hooks`](../add-module-and-hooks/SKILL.md), not this skill. List it as the next step.
7. **PRD update** — emit the suggested patch for [`DATABASE_PRD.md`](../../../docs/PRD/DATABASE_PRD.md) §6.x: the new table sketch (columns + types + RLS summary + indexes). If the table changes the menu pipeline or introduces a new policy shape, note the ARCHITECTURE_PRD section to update too (hand to `prd-author`).
8. **Report** in the structure below.

## Report structure

```markdown
## Create table `<table>` (`<scope>`-scoped[, soft-delete])

### Migrations (apply in this order)

#### 1. `<timestamp>_enum_create_<name>.sql`   (only if new enums)
```sql
CREATE TYPE public.<name> AS ENUM ('a', 'b', 'c');
COMMENT ON TYPE public.<name> IS '...';
```

#### 2. `<timestamp>_tbl_create_<table>[_with_trigger].sql`
```sql
-- <header: purpose, RLS scope, soft-delete, FKs>
CREATE TABLE public.<table> ( ... );
COMMENT ON TABLE public.<table> IS '...';
COMMENT ON COLUMN public.<table>.<col> IS '...';
-- indexes (FK + partial-unique-on-is_deleted-false)
-- updated_at trigger (if applicable)
ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;
-- policies (read filters is_deleted = false; writes role-gated)
```

### Commands to run
```sh
pnpm --filter @weekly-food-planner/supabase db:migration:new enum_create_<name>   # if needed
pnpm --filter @weekly-food-planner/supabase db:migration:new tbl_create_<table>_with_trigger
# (paste the SQL above into each generated file)
pnpm --filter @weekly-food-planner/supabase db:reset        # or db:start && supabase migration up
pnpm --filter @weekly-food-planner/supabase db:gen:types
```

### Hand-offs
- Data-layer module + hooks → `add-module-and-hooks` skill (`module/<table>.ts` + `.react.ts` + barrel).
- Route handlers that read/write the table → `route-handler-engineer` agent.
- Integration test (CRUD + RLS role matrix + soft-delete visibility) → `vitest-integration-author` agent.
- PRD sketch → `prd-author` agent (DATABASE_PRD §6.x [+ ARCHITECTURE_PRD if pipeline/RLS shape changed]).

### PRD update
- `docs/PRD/DATABASE_PRD.md` §6.<n> — new `<table>` sketch (columns, RLS, indexes).
- `docs/PRD/DATABASE_PRD.md` §12 (Indexes) — list new partial-unique / FK indexes.
```

## Non-negotiables

- **Always use `db:migration:new`.** Never hand-write a migration filename or timestamp; collisions and ordering bugs follow.
- **Dependency order is law.** Enums before the table that uses them; the shared `updated_at` function already exists (don't redefine it); RLS enable before / alongside policies. Timestamp the files so they apply in order.
- **`ENABLE ROW LEVEL SECURITY` is mandatory.** Emitting policies without enabling RLS leaves the table fully readable/writable. The enable line is not optional.
- **Soft-delete = partial unique.** Any natural-key uniqueness on a soft-deletable table must be `WHERE is_deleted = false`, or a deleted row permanently blocks re-creating an equivalent one.
- **Workspace-scoped reads filter `is_deleted = false`.** The read policy hides soft-deleted rows; soft delete is an UPDATE, never a hard `DELETE`.
- **`COMMENT ON TABLE` + COMMENTs on non-obvious columns** are required — the PRD and future agents rely on them.
- **No data-layer code here.** This skill stops at SQL + regen + hand-offs. Module/hook generation is `add-module-and-hooks`; don't inline it.
- **No drive-by changes.** If creating the table surfaces an unrelated issue, note it in the report; don't fold it into the migration.

## What to flag in the report

- **`NOT NULL` columns with no default on a table that will receive backfilled rows** — fine for a brand-new empty table, but call it out if the feature implies pre-existing data.
- **RLS scope ambiguity** — if "who can read/write this" isn't obvious from the input, state the assumption (e.g. "assumed member-writable; if admin-only, the write policy's role list must narrow") and recommend the `vitest-integration-author` role-matrix test.
- **Engine-input tables vs. post-accept state** — if the new table feeds the constraint engine, its columns must JSON-round-trip and the determinism contract applies; if it's post-accept state (cook status, inventory, addons, provenance), say so explicitly so a reader knows it's invisible to `accepted_seed`.
- **FK `ON DELETE` choice** — flag when `CASCADE` vs `SET NULL` vs `RESTRICT` is load-bearing (e.g. a provenance FK that must survive deletion should be `SET NULL` or not a FK at all).
- **Junction tables** — usually need a composite PK (`PRIMARY KEY (a_id, b_id)`) rather than a surrogate `id`, and often no soft-delete. Confirm which the table is.

## Example

See [`docs/examples/inventory-items.md`](./docs/examples/inventory-items.md) for a worked output: creating the workspace-scoped, soft-deletable `inventory_items` table with a new `inventory_source` enum, used as the v2.0 pantry table.
