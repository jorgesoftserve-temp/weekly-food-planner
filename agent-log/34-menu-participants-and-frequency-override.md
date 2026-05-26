# Step 34 — Per-menu meal-frequency override + menu participants (MVP 1.5 Phase 2)

## What I changed

Two related but separable features land together because they share a UI
surface (the generate-menu dialog) and the same downstream consumer
(grocery scaling in Phase 4).

### 1. `menu_participants` junction table

New migration `20260527000100_tbl_create_menu_participants.sql`:

- Composite PK `(menu_id, member_id)` with ON DELETE CASCADE both ways.
- Reverse-lookup index on `(member_id)` so future "which menus is this
  member in?" queries don't full-scan.
- RLS read mirrors `menu_slots_read` — workspace membership through the
  parent menu. No write policy: the route handlers persist through the
  service-role admin client (same pattern as `menu_slots`).
- **Backfill**: for every pre-existing non-soft-deleted menu, insert one
  row per active workspace member. Legacy menus behave as "for the whole
  household" without any null-vs-empty special-casing downstream.

Applied via `supabase migration up --local` followed by
`NOTIFY pgrst, 'reload schema'`. Verified: schema present, RLS attached,
3 backfill rows from the 3 legacy menus on the local DB.

### 2. Engine: `memberFrequencyOverrides`

`packages/constraint-engine/src/types.ts` gains a new optional field on
`GenerateMenuOptions`:

```ts
memberFrequencyOverrides?: Array<{
  memberId: string
  mealFrequency: MealFrequencyEntry[]
}>
```

`slots.ts` `resolveFrequency` now does **override → member > workspace > empty**.
An override with an empty array IS honoured at step 1 — meaning "skip this
member entirely for this menu", which is the path PRODUCT_PRD §4.1.3 calls
out (overnight guests, kid skipping a dinner party, etc.). Overrides whose
memberId isn't in `input.members` are silently ignored (defensive — the
route layer already filters them upstream).

The engine continues to operate on whatever member list is passed in. The
route layer is now responsible for filtering `members` to participants
before the engine sees them — this keeps the engine's contract simple and
puts the participant-aware logic where the DB lives.

### 3. Server: participant resolution + persistence

`apps/web/app/api/workspaces/[id]/menus/route.ts`:

- Both `weekly` and `custom` modes accept a new `participantMemberIds?: string[]`
  in the body. `null`/`undefined` = "every active member" (loaded from
  `workspace_members`). An explicit empty array is rejected with 400 —
  it's a UX error, not a valid intent.
- Weekly mode filters `loaded.members` to participants before calling
  `computeEffectiveOverlay` and `generateMenu`. The engine and the overlay
  both see the same filtered set, so non-participants can't sneak in via
  override entries.
- `computeEffectiveOverlay` (in `apps/web/lib/api/menu-overlay.ts`) now
  also dedups `memberFrequencyOverrides` against the participant set —
  unknown ids are dropped before persistence.
- `persistGeneratedMenu` and `persistCustomMenu` both take
  `participantMemberIds: string[]` and insert one `menu_participants` row
  per id (deduped via `Set` before insert).
- `cloneMenuAsDraft` copies `menu_participants` from the source verbatim —
  a clone is the same household intent on a new week.

### 4. Supabase module + types

- `MenuRecord` gains `menu_participants: { member_id: string }[]`.
- `MENU_SELECT` includes the joined table so every consumer
  (`getActiveMenu`, `getDraftMenu`, `listUpcomingAcceptedMenus`) returns it
  automatically. History rows still use a slimmer select that doesn't need
  participants — that surface only needs `is_overridden` for the
  modified-badge derivation.

### 5. UI: generate-menu dialog

New file `apps/web/app/(app)/menu/_components/participants-frequency-panel.tsx`:

- "Cooking for" — button-toggle pills, one per active member. `null` state
  means "everyone" and submits as `undefined` so the server's default
  kicks in. Toggling a member off also drops any frequency override they
  had.
- "Per-member meal schedule" — for each participating member, an inline
  card with their resolved baseline (member > workspace > sensible 3-meal
  default), a "Customize" button that opens the inline editor, and a
  "Reset" that clears the override. Reuses the `MealFrequencyFields`
  component shipped in Phase 1.

Wired into `generate-menu-dialog.tsx` as a collapsible `<details>` panel.
The submit handlers pass `participantMemberIds` (only when the user
actually customized — otherwise omit so the server picks "everyone")
and merge `memberFrequencyOverrides` into the `options` blob.

### 6. UI: menu-view header

`menu-view.tsx` gains two new pills in the metadata header:

- **Cooking for: N members** — sourced from `menu.menu_participants.length`.
  Renders for every menu now that the backfill seeded legacy rows.
- **Schedule customized (N)** — when `generation_options.memberFrequencyOverrides`
  is a non-empty array. Same amber accent as the slot-override pill.

### 7. Tests

- `packages/constraint-engine/src/__tests__/slots-frequency-override.test.ts`
  (new) — 4 tests on the override cascade:
  - Override beats member's own frequency.
  - Empty-array override → no slots for that member.
  - Non-overridden members keep their member-profile cascade in the same
    menu.
  - Unknown memberId in an override is silently ignored.
- `apps/web/lib/api/__tests__/menu-overlay.test.ts` — 2 new tests:
  - Override for a participant is kept.
  - Override for a non-participant is dropped (and if it was the only
    overlay value, the whole overlay returns undefined).
- Updated `apps/web/integration/end-to-end.integration.test.ts` to pass
  `participantMemberIds` to `persistGeneratedMenu`.

## PRD updates

- **PRODUCT_PRD.md** §4.1.3 — new section "Per-menu meal-frequency
  override + menu participants" covering both fields together; §4.1's
  "Optional (both modes)" inputs list cross-links to the new section.
- **DATABASE_PRD.md** §6.11.1 — `generation_options` example extended
  with `memberFrequencyOverrides`; new §6.11a documents `menu_participants`
  (columns, PK, index, RLS, backfill semantics).
- **ARCHITECTURE_PRD.md** §5.1 step 2 — input assembly now resolves
  participants + filters members + dedups overrides; step 3 documents
  the new override→member→workspace cascade; step 8.2 lists
  `menu_participants` in the persistence transaction; §5.3 step 5
  documents the clone copies participants.

## Verification

```
pnpm -r typecheck                            → 4/4 packages green
pnpm -r test                                 → 119 passed, 8 skipped (was 113)
pnpm -F web lint                             → 0 errors, 2 pre-existing warnings
supabase migration up --local                → 1 new migration applied
SELECT count(*) FROM menu_participants       → 3 backfill rows (= legacy menus)
```

## Files

New:
- `packages/supabase/supabase/migrations/20260527000100_tbl_create_menu_participants.sql`
- `packages/constraint-engine/src/__tests__/slots-frequency-override.test.ts`
- `apps/web/app/(app)/menu/_components/participants-frequency-panel.tsx`
- `prompts/34-menu-participants-and-frequency-override.txt`
- `agent-log/34-menu-participants-and-frequency-override.md` (this file)

Edited:
- `packages/constraint-engine/src/types.ts`
- `packages/constraint-engine/src/slots.ts`
- `packages/supabase/src/module/menus.ts`
- `apps/web/lib/api/menu-overlay.ts`
- `apps/web/lib/api/menu-persistence.ts`
- `apps/web/lib/api/menu-build.ts`
- `apps/web/app/api/workspaces/[id]/menus/route.ts`
- `apps/web/lib/hooks/use-generate-menu.ts`
- `apps/web/lib/hooks/use-custom-menu.ts`
- `apps/web/app/(app)/menu/_components/generate-menu-dialog.tsx`
- `apps/web/app/(app)/menu/_components/menu-view.tsx`
- `apps/web/integration/end-to-end.integration.test.ts`
- `apps/web/lib/api/__tests__/menu-overlay.test.ts`
- `docs/PRD/PRODUCT_PRD.md`
- `docs/PRD/DATABASE_PRD.md`
- `docs/PRD/ARCHITECTURE_PRD.md`

## Not touched on purpose

- **`inputs_hash`**: still computed from the canonical engine input, which
  now sees a filtered `members` array and the override entries in
  `options`. So changing either the participant set or the override list
  produces a different hash — no separate hashing layer needed.
- **`accepted_seed`**: unchanged. Acceptance still hashes over slot tuples,
  which already reflect overrides indirectly (overrides change which slots
  exist).
- **History modified badge**: still purely about `is_overridden` slots.
  Participants/overrides are part of the menu identity, not a post-hoc
  modification, so they don't move the "modified" flag.
- **Phase 4 (servings scaling)** and **Phase 5 (shop-for-subset filter)**
  will consume `menu_participants` next — schema is ready.

## Follow-ups still open from MVP 1.5

- Phase 3: add-slot operation on an existing draft.
- Phase 4: servings-aware grocery scaling (engine + recompute, uses
  `COUNT(menu_participants)`).
- Phase 5: shop-for-subset filter on the grocery view.
- Migration: default `meal_frequency` per `age_category` (carried from
  Phase 1).
- Carried from earlier steps: history row drill-down, draft↔accept
  grocery unification, dedupe `isMenuStillUpcoming`.
