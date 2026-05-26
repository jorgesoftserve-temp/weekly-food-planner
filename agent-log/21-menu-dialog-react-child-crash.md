# Step 21 — Crash fix: React-child of object in GenerateMenuDialog

## Prompt used

See [/prompts/21-menu-dialog-react-child-crash.txt](../prompts/21-menu-dialog-react-child-crash.txt).

Summary: user pasted a runtime error — "Objects are not valid as a React child (found: object with keys {day, mealKey})" — pointing at `<GenerateMenuDialog>` in the menu page. Two-line fix; landed bundled into [step 22's commit](./22-ongoing-week-and-member-name.md) ([0633034](https://github.com/jorgesoftserve-temp/weekly-food-planner/commit/0633034)) since the user added a related ask immediately after, before I'd committed standalone.

## Context files provided

- The error stack itself (pointed at `apps/web/app/(app)/menu/page.tsx:135` — but that's the parent component; the actual bug was inside `generate-menu-dialog.tsx`).
- The engine type for `GenerationError.affectedMeal` ([types.ts:171](../packages/constraint-engine/src/types.ts)) — `{ day: DayOfWeek; mealKey: string }`.

## Expected output

Two edits:

- [apps/web/lib/hooks/use-generate-menu.ts](../apps/web/lib/hooks/use-generate-menu.ts): the local error type claimed `affectedMeal?: string | null`. Engine has always returned an object. Fixed the type to `{ day: string; mealKey: string } | null`.
- [apps/web/app/(app)/menu/_components/generate-menu-dialog.tsx](../apps/web/app/(app)/menu/_components/generate-menu-dialog.tsx) line 151-155: rendered the object directly as `{failure.error.affectedMeal}`. Replaced with `{day}/{mealKey}` text.

Verified `pnpm --filter @weekly-food-planner/web typecheck` clean post-fix.

## Observed issue

- **The type lie hid the bug from CI.** The runtime crash had been present since the affectedMeal field was added — typecheck couldn't see it because the local type contradicted the engine type. The fact that `affectedMeal` is only populated on failure (NO_SLOTS, NO_CANDIDATES) meant the typical happy-path tests never exercised it. The user only saw it because they hit a real generation failure during their demo prep.
- **Related drift, not the crash but worth flagging in the same pass**: the dialog reads `failure.error.message`, but the engine ships `humanMessage` — so the explanation paragraph was always invisible. I noted this to the user and deferred to [step 22](./22-ongoing-week-and-member-name.md) (they wanted to wire member-name display in the same touchpoint).
- **The dialog's `reasonLabel` switch matched lowercase keys (`no_slots`, `no_valid_recipe`) but the engine emits UPPERCASE_SNAKE (`NO_SLOTS`, `NO_CANDIDATES`).** So the friendly-label header was always "Generation failed" rather than the right label. Same fix in [step 22](./22-ongoing-week-and-member-name.md).

## Follow-up fixes

- **Class of bug**: a type narrowed at the consumer that contradicts the producer. tsc can't catch this when the producer and consumer use different declared types (the engine's `GenerationError` is in a different package). A linter rule that flags `Pick<EngineType, K>` re-declarations vs. inline rewrites would help — out of scope here.
- The pre-existing `humanMessage` / `reasonLabel` issues rolled into [step 22](./22-ongoing-week-and-member-name.md).
- No new test added for this rendering case. A snapshot test or render assertion at the dialog level would have caught it; the project doesn't yet have RTL or Playwright wired up.
