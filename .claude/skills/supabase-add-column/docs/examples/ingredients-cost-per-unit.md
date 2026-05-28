# Worked example — add `cost_per_unit` + `cost_currency` to `ingredients`

Input spec:

```yaml
table: ingredients
columns:
  - name: cost_per_unit
    type: numeric
    nullable: true
    default: null
    comment: "Estimated cost per unit-of-measure for this ingredient. Used by the (post-MVP) max-budget soft constraint. NULL = unknown."
  - name: cost_currency
    type: text
    nullable: true
    default: "'usd'"
    comment: "Three-letter currency code for cost_per_unit. Informational only; no FX conversion in MVP."
backfill:
  description: "Seed median cost values for ingredients the catalog already knows about; leave unknowns NULL."
  sql: |
    UPDATE public.ingredients SET cost_per_unit = 0.35 WHERE name = 'oats';
    UPDATE public.ingredients SET cost_per_unit = 0.50 WHERE name = 'milk';
    -- ... (one row per seeded ingredient; full list in the migration body)
extensibleLabel: null
```

---

## Add column(s) `cost_per_unit, cost_currency` to `ingredients`

### Migration
File: `packages/supabase/supabase/migrations/<timestamp>_tbl_ingredients_add_cost_with_backfill.sql`

```sql
-- Add cost data to ingredients.
--
-- Motivation: enables the (post-MVP) max-budget soft constraint in the
-- constraint engine. The engine multiplies grocery quantities by
-- cost_per_unit and penalises selections whose projected total exceeds the
-- user-supplied budget.
--
-- Currency: cost_currency is informational. MVP assumes one currency per
-- workspace; there is no FX conversion. Document this in PRODUCT_PRD §4
-- when the feature lands.
--
-- Backfill: seeded ingredients receive a median value from a public price
-- dataset; non-seeded rows stay NULL. The engine treats NULL as "unknown
-- cost — skip from budget projection" rather than zero.

ALTER TABLE public.ingredients
  ADD COLUMN cost_per_unit NUMERIC;

COMMENT ON COLUMN public.ingredients.cost_per_unit IS
  'Estimated cost per unit-of-measure for this ingredient. Used by the (post-MVP) max-budget soft constraint. NULL = unknown.';

ALTER TABLE public.ingredients
  ADD COLUMN cost_currency TEXT DEFAULT 'usd';

COMMENT ON COLUMN public.ingredients.cost_currency IS
  'Three-letter currency code for cost_per_unit. Informational only; no FX conversion in MVP.';

-- Backfill: seed median costs for known catalog rows. Idempotent: the
-- WHERE clause matches by canonical name, so re-running is safe.
UPDATE public.ingredients SET cost_per_unit = 0.35 WHERE name = 'oats';
UPDATE public.ingredients SET cost_per_unit = 0.50 WHERE name = 'milk';
UPDATE public.ingredients SET cost_per_unit = 0.25 WHERE name = 'tomato';
UPDATE public.ingredients SET cost_per_unit = 0.15 WHERE name = 'bread';
UPDATE public.ingredients SET cost_per_unit = 0.20 WHERE name = 'pasta';
UPDATE public.ingredients SET cost_per_unit = 0.10 WHERE name = 'carrot';
UPDATE public.ingredients SET cost_per_unit = 1.20 WHERE name = 'beef';
UPDATE public.ingredients SET cost_per_unit = 0.35 WHERE name = 'peanut_butter';
-- (extend with the full seeded list as the catalog evolves)
```

No index changes — `cost_per_unit` is read inline during grocery recompute, not via a hot-path query that needs its own index. If future profiling shows otherwise, add `idx_ingredients_cost_not_null ON public.ingredients(cost_per_unit) WHERE cost_per_unit IS NOT NULL` in a follow-up.

No partial-unique-index changes — `ingredients` has `UNIQUE (name)` (full table) and no soft-delete-aware partial indexes (it's a global catalog with service-role writes only).

### Commands to run

```sh
# 1. Generate the migration file
pnpm --filter @weekly-food-planner/supabase db:migration:new tbl_ingredients_add_cost_with_backfill
# (paste the SQL above into the generated file)

# 2. Apply locally and regenerate types
pnpm --filter @weekly-food-planner/supabase db:start
supabase migration up                        # from packages/supabase
# OR, for a clean slate:
pnpm --filter @weekly-food-planner/supabase db:reset

pnpm --filter @weekly-food-planner/supabase db:gen:types
```

### TypeScript files to update (deterministic patches)

#### `packages/supabase/src/module/ingredients.ts`

- Add to `IngredientRecord`:
  ```ts
  cost_per_unit: number | null
  cost_currency: string | null
  ```
- Append `cost_per_unit, cost_currency` to the `INGREDIENT_SELECT` string.
- Add to `CreateIngredientPayload` (if it exists; ingredients are service-role-seeded, so this may not apply):
  ```ts
  cost_per_unit?: number | null
  cost_currency?: string | null
  ```
- Add to `UpdateIngredientPatch` (same shape).
- Update `createIngredient` / `updateIngredient` to map the new fields onto the insert/update payload.

#### `packages/supabase/src/module/ingredients.react.ts`

No changes — existing hooks pass through the full record.

### Route handlers to update (agent hand-off)

Service-role-only endpoints under `apps/web/app/api/admin/`. Files to revise via `route-handler-engineer`:

- `apps/web/app/api/admin/seed-ingredients/route.ts` — seeded array gains `cost_per_unit` + `cost_currency` per row.

User-facing endpoints (`/api/ingredients` GET) auto-pick-up the new columns via the updated `INGREDIENT_SELECT` — no handler changes needed beyond confirming the response shape includes them.

### Integration tests to add or update

- `apps/web/integration/ingredients/cost-fields.integration.test.ts` (new):
  - Happy path: seeded ingredient returns `cost_per_unit` and `cost_currency`.
  - Nullable handling: a non-seeded ingredient returns `null` cost without error.
  - Default: a row inserted without `cost_currency` ends up with `'usd'`.
- No RLS test change — the `ingredients` policies don't gate on cost.

### PRD update

- `docs/PRD/DATABASE_PRD.md` §6.6 (`ingredients` table) — add two rows:

  ```
  | `cost_per_unit` | numeric NULL | Estimated cost per unit-of-measure. Used by max-budget soft constraint. NULL = unknown |
  | `cost_currency` | text DEFAULT `'usd'` | Three-letter currency code. Informational; no FX in MVP |
  ```

- `docs/PRD/DATABASE_PRD.md` §12 (Indexes) — no entry needed; no new index.

### Hand-offs

- Route handler updates (`/api/admin/seed-ingredients`) → `route-handler-engineer` agent.
- Integration test → `vitest-integration-author` agent.
- UI surface for displaying cost in the grocery view → `ui-component-builder` agent (deferred until the budget feature lands).
- The budget feature itself → run [`menu-generation-impact-review`](../../../menu-generation-impact-review/SKILL.md) first; that planning skill bundles the engine, route handler, UI, and PRD walk into a single review.

### Flags

- **Cost data quality.** Seeded values are placeholder medians. The feature consuming them (max-budget soft constraint) should treat NULL as "skip from projection" rather than "$0", to avoid misleading the user.
- **Currency normalization is out of scope.** Document this explicitly in PRODUCT_PRD when the budget feature lands; the column exists for future FX work but MVP assumes one currency.
- **`/api/admin/seed-ingredients` couples to this migration.** If the seeded list grows after this migration ships, follow-up `UPDATE` statements in future migrations should match by `name` (already idempotent) to keep the dataset coherent.
