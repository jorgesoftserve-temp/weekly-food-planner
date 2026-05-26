# Step 22 — Menu generation: ongoing-week filter + member-name in errors

## Prompt used

See [/prompts/22-ongoing-week-and-member-name.txt](../prompts/22-ongoing-week-and-member-name.txt).

Summary: two related asks bundled into one commit ([0633034](https://github.com/jorgesoftserve-temp/weekly-food-planner/commit/0633034)) alongside the crash fix from [step 21](./21-menu-dialog-react-child-crash.md). (1) The engine should skip meals that have already passed when generating for an ongoing week. (2) The dialog should render the member's name in error messages, not their UUID. The user also shared the offending error text — "Slot monday/breakfast for member 9b42c00a-…" — making the rendering gap concrete.

## Context files provided

- The engine modules: [types.ts](../packages/constraint-engine/src/types.ts), [slots.ts](../packages/constraint-engine/src/slots.ts), [generate.ts](../packages/constraint-engine/src/generate.ts), [assign.ts](../packages/constraint-engine/src/assign.ts).
- The menu API route: [menus/route.ts](../apps/web/app/api/workspaces/[id]/menus/route.ts) — where the engine input is built.
- The dialog + hook surface left over from [step 21](./21-menu-dialog-react-child-crash.md).
- Persistence layer: [menu-persistence.ts](../apps/web/lib/api/menu-persistence.ts) — needed to confirm partial-week menus (fewer than 14 slots) persist cleanly.

## Expected output

### Engine

- **`GenerateMenuInput.now?: string`** (optional ISO timestamp). When set, [buildSlots](../packages/constraint-engine/src/slots.ts) filters out any slot whose `(dayOfWeek, defaultHour)` is before `now`. Omitted in unit tests → existing 14-slot behavior preserved. Including `now` in the hashed input keeps determinism intact (same `(now, seed, inputs)` tuple → same menu).
- **`GenerationError.affectedMemberName?: string`** — added to [types.ts](../packages/constraint-engine/src/types.ts) and populated in [assign.ts](../packages/constraint-engine/src/assign.ts) on the two error branches that have the member snapshot in hand (`FILTER_CONTEXT_MISSING`, `NO_CANDIDATES`). The `MEMBER_NOT_FOUND` branch can't fill it — by definition no member object — and is left undefined.
- **New reasonCode `ALL_MEALS_PASSED`** in [generate.ts](../packages/constraint-engine/src/generate.ts): distinguishes "frequency never configured" (existing `NO_SLOTS`) from "every slot got filtered as past". Detected by re-running `buildSlots` without `now`: if the unfiltered count was > 0, filtering ate everything.

### API route

- [menus/route.ts](../apps/web/app/api/workspaces/[id]/menus/route.ts) always passes `now: new Date().toISOString()` when building the engine input.

### UI + hook

- [use-generate-menu.ts](../apps/web/lib/hooks/use-generate-menu.ts): renamed `message?: string` → `humanMessage?: string` (engine's actual field name), added `affectedMemberName?: string | null`, opened `reasonCode` to `string` (the old narrow union never matched engine's UPPERCASE codes — pre-existing latent bug from [step 17](./17-ui-basic-flow.md)).
- [generate-menu-dialog.tsx](../apps/web/app/(app)/menu/_components/generate-menu-dialog.tsx): renders `humanMessage` (which carries `for ${member.name}` from the engine), falls back to `affectedMemberName ?? affectedMemberId` on the affected-slot line. `reasonLabel` switch updated to match the engine's actual UPPERCASE codes plus the new `ALL_MEALS_PASSED`.

### Tests

- [slots.test.ts](../packages/constraint-engine/src/__tests__/slots.test.ts): +3 cases for `now`-based filtering — before-week (all 14 kept), mid-week (5 dropped for Mon/Tue + Wed breakfast at noon Wednesday), after-week (0 remain).
- [generate.test.ts](../packages/constraint-engine/src/__tests__/generate.test.ts): +2 cases for `ALL_MEALS_PASSED` reasonCode and `affectedMemberName` population on the `no_valid_recipe` branch.

All 36 engine tests + 8 turbo tasks green.

## Observed issue

- **Timezone naivety.** Engine compares `now` and slot-time using server-local Date math (`new Date(y, m-1, d+offset, defaultHour, 0)`). The single-tenant MVP assumes user-and-server are in the same zone; multi-zone support would require carrying a tz on the workspace or member. Flagged in the engine comments, not currently a real concern.
- **Member name interpretation vs. user prompt.** The prompt said "show member name not id or at least member email if name is not present". The engine has the name in `MemberSnapshot.name` but no concept of email — emails live in `auth.users`, separate from the workspace `members` table. The fallback in the dialog is `affectedMemberName ?? affectedMemberId` (name → ID). Adding an "email if no name" tier would mean enriching the engine error in the API route via an admin-client lookup against `auth.users`. Skipped because the signup trigger always names creator members (the member's `name` is non-null in practice for new users); flagged as a follow-up if non-creator members without names start appearing.
- **The reasonLabel + humanMessage drifts had been present since [step 17](./17-ui-basic-flow.md)** but were latent — the dialog's error path was never exercised by a non-fatal failure until this cycle (the demo prep hit it).

## Follow-up fixes

- **Member email tier** in the error display: enrich the menu route's error response with `affectedMemberEmail` via admin-client lookup on `auth.users` when `affectedMemberName` is empty. Defer until the case actually arises.
- **Pre-existing latent bugs found in this pass** (`reasonLabel` case mismatch, `humanMessage` rename) are fixed but could have been caught earlier with a render-level test for the dialog's failure path. RTL/Playwright still not wired up.
- **NO_SLOTS legacy** — even after this fix, the signup trigger still leaves `shared_meal_frequency = null`. The user request that triggered this cycle started from "Slot monday/breakfast for member …" which means the engine got past `NO_SLOTS` (meal frequency was already set, probably by [scripts/demo-stage.mjs](../scripts/demo-stage.mjs)). The actual upstream root cause was `NO_CANDIDATES` — they had no valid recipe for a slot. The new `affectedMemberName` makes that diagnosis obvious in the UI.
- **Carried open**: workspace-settings UI + member-management UI from [step 16](./16-ui-outline-and-scope-decisions.md) — these would let users avoid hitting [scripts/demo-stage.mjs](../scripts/demo-stage.mjs) at all. Still pending.
