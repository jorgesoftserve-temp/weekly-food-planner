# Worked example — `inventory_items` (v2.0 pantry table)

**Input** (the v2.0 Execution & Pantry plan, Phase 1):

```yaml
table: inventory_items
purpose: "What the household currently has on hand — the pantry the grocery list reconciles against"
scope: workspace
softDelete: true
columns:
  - name: workspace_id
    type: uuid
    nullable: false
    references: { table: workspaces, column: id, onDelete: CASCADE }
    comment: "Owning workspace"
  - name: ingredient_id
    type: uuid
    nullable: false
    references: { table: ingredients, column: id, onDelete: RESTRICT }
    comment: "Which catalog ingredient is in the pantry"
  - name: quantity
    type: numeric
    nullable: false
    default: 0
    comment: "Amount on hand, in the ingredient's canonical unit"
  - name: source
    type: inventory_source
    nullable: false
    default: "'manual'"
    comment: "How this stock arrived: manually entered, bought, or leftover from a cooked meal"
  - name: expiration_date
    type: timestamptz
    nullable: true
    comment: "Optional per-item expiry; drives the freshness/leftover alerts in Phase 3/5"
newEnums:
  - name: inventory_source
    values: [manual, purchase, leftover]
    comment: "Provenance of a pantry item"
uniqueness:
  - columns: [workspace_id, ingredient_id]
    note: "One live row per ingredient per workspace; re-stocking updates quantity"
trigger: true
```

---

## Create table `inventory_items` (`workspace`-scoped, soft-delete)

### Migrations (apply in this order)

#### 1. `<timestamp>_enum_create_inventory_source.sql`

```sql
-- Provenance of a pantry item: hand-entered, bought via a shopping session, or
-- carried over as a leftover from a cooked meal. Drives Phase-1 inventory + Phase-5 leftovers.
CREATE TYPE public.inventory_source AS ENUM ('manual', 'purchase', 'leftover');

COMMENT ON TYPE public.inventory_source IS 'How a pantry item arrived: manual | purchase | leftover.';
```

#### 2. `<timestamp>_tbl_create_inventory_items_with_trigger.sql`

```sql
-- inventory_items — the household pantry. Workspace-scoped, soft-deletable.
-- One LIVE row per (workspace, ingredient): re-stocking updates quantity rather than inserting.
-- Post-accept state: NEVER an engine input — the grocery recompute reconciles against it,
-- but the constraint engine and accepted_seed are blind to it.
CREATE TABLE public.inventory_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  ingredient_id   uuid NOT NULL REFERENCES public.ingredients (id) ON DELETE RESTRICT,
  quantity        numeric NOT NULL DEFAULT 0,
  source          public.inventory_source NOT NULL DEFAULT 'manual',
  expiration_date timestamptz,
  is_deleted      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.inventory_items IS 'Household pantry; what is on hand, reconciled against the grocery list. Post-accept state, never an engine input.';
COMMENT ON COLUMN public.inventory_items.quantity IS 'Amount on hand in the ingredient''s canonical unit.';
COMMENT ON COLUMN public.inventory_items.source IS 'How this stock arrived (manual | purchase | leftover).';
COMMENT ON COLUMN public.inventory_items.expiration_date IS 'Optional per-item expiry; drives freshness/leftover alerts.';

-- FK lookup index
CREATE INDEX idx_inventory_items_workspace ON public.inventory_items (workspace_id);

-- One live row per (workspace, ingredient) — partial so a soft-deleted row never blocks re-stocking.
CREATE UNIQUE INDEX uq_inventory_items_workspace_ingredient
  ON public.inventory_items (workspace_id, ingredient_id)
  WHERE is_deleted = false;

-- updated_at trigger (shared function, do not redefine)
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS (co-located, profiles-style)
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- Read: any workspace member; soft-deleted rows hidden.
CREATE POLICY inventory_items_read ON public.inventory_items
  FOR SELECT
  USING (is_deleted = false AND public.fn_user_workspace_role(workspace_id) IS NOT NULL);

-- Write: any workspace member may manage the pantry (member-writable domain table).
CREATE POLICY inventory_items_insert ON public.inventory_items
  FOR INSERT
  WITH CHECK (public.fn_user_workspace_role(workspace_id) IS NOT NULL);

CREATE POLICY inventory_items_update ON public.inventory_items
  FOR UPDATE
  USING (public.fn_user_workspace_role(workspace_id) IS NOT NULL)
  WITH CHECK (public.fn_user_workspace_role(workspace_id) IS NOT NULL);
-- (Soft delete = UPDATE is_deleted = true; no hard-DELETE policy.)
```

### Commands to run

```sh
pnpm --filter @weekly-food-planner/supabase db:migration:new enum_create_inventory_source
pnpm --filter @weekly-food-planner/supabase db:migration:new tbl_create_inventory_items_with_trigger
# (paste the SQL above into each generated file, in order)
pnpm --filter @weekly-food-planner/supabase db:reset
pnpm --filter @weekly-food-planner/supabase db:gen:types
```

### Hand-offs

- Data-layer module + hooks → **`add-module-and-hooks`** (`module/inventory-items.ts` + `.react.ts` + barrel).
- Route handlers (`GET/POST/PATCH/DELETE .../workspaces/[id]/inventory`) → **`route-handler-engineer`**.
- Integration test (CRUD + RLS role matrix + soft-delete visibility + the `(workspace, ingredient)` partial-unique re-stock path) → **`vitest-integration-author`**.
- PRD sketch → **`prd-author`** (DATABASE_PRD §6.x new `inventory_items` table; ARCHITECTURE_PRD if the grocery recompute reconciliation is documented there).

### PRD update

- `docs/PRD/DATABASE_PRD.md` §6.<n> — new `inventory_items` sketch (columns, `inventory_source` enum, workspace RLS, partial-unique index). **Mark as planned (v2.0).**
- `docs/PRD/DATABASE_PRD.md` §12 (Indexes) — add `idx_inventory_items_workspace` + `uq_inventory_items_workspace_ingredient`.

### Flagged

- **Post-accept state, not engine input** — `inventory_items` is read by the grocery recompute (reconcile on-hand vs. needed) but is invisible to the constraint engine and `accepted_seed`. The recompute must stay inventory-aware *only* at the grocery layer, never in `recomputeGroceryListsForMenu`'s engine call path.
- **Member-writable** — assumed any member can edit the pantry (not admin-only). If the household wants it admin-gated, narrow the insert/update policies to a role list and update the role-matrix test.
- **`ingredient_id` is `ON DELETE RESTRICT`** — a catalog ingredient that's in someone's pantry can't be hard-deleted; that's intentional (ingredients are soft-deleted anyway).
