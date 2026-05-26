# Step 20 — Demo recording script + off-screen staging helper

## Prompt used

See [/prompts/20-demo-recording-script.txt](../prompts/20-demo-recording-script.txt).

Summary: two messages. First the user asked whether I could help with a 3-4 min demo recording — I clarified I can prep but not record. They then sent the six-beat outline. One commit ([427e579](https://github.com/jorgesoftserve-temp/weekly-food-planner/commit/427e579)).

The demo covers signup → confirm + login → create 1-2 recipes → generate menu with constraints → export grocery list → invoke the Claude skill.

## Context files provided

- The state of the app after step 18: full basic flow shipping, recipe-edit drawer, deterministic menu, markdown + CSV exports.
- [scripts/verify-flow.mjs](../scripts/verify-flow.mjs) as the pattern for off-screen staging (cookie construction, admin-confirm-user endpoint, the API surface walk).
- The recipe form, menu dialog, and grocery export UIs were the actual on-screen surfaces.

## Expected output

Two artifacts:

- **[docs/demo/demo-script.md](../docs/demo/demo-script.md)** — beat-by-beat with timing budgets (2:30 target), preflight checklist, narration suggestions per beat, on-screen actions, and a gotchas table for the four most likely retake triggers (auth cookie stale, NO_SLOTS, no_valid_recipe, empty ingredient catalog, duplicate email).
- **[scripts/demo-stage.mjs](../scripts/demo-stage.mjs)** — one-shot post-signup helper. Confirms the email via `/api/admin/confirm-user`, sets `shared_meal_frequency = breakfast + dinner` (avoids the NO_SLOTS 422 from [step 18](./18-edit-mode-drawer-and-verify.md)), and sets the creator member's `dietary_restrictions = ['vegetarian']`. Verified all three endpoints against the real route handlers.

The demo runner does the on-screen work; the script runs off-screen between Beat 1 and Beat 2.

## Observed issue

- **The "create a menu with some constraints" beat is dishonest if interpreted literally.** The UI generation dialog only accepts a `weekStartDate` — there's no UI for setting member constraints or per-menu overlay (member-management was scope-cut in [step 16](./16-ui-outline-and-scope-decisions.md), overlay UI in [step 17](./17-ui-basic-flow.md)). The script handles this by setting the vegetarian constraint via [scripts/demo-stage.mjs](../scripts/demo-stage.mjs) off-screen and having the narrator name it out loud rather than hiding it. Demo viewers learn the architecture (`PUT /api/.../members/[id]/dietary-restrictions`) instead of seeing a polished lie.
- **Demo runner can't observe Beat 4's constraint enforcement directly** unless they add a non-vegetarian recipe and watch it get excluded. The script keeps the two recipes both vegetarian for time; the narrator names the implicit enforcement. A "constraint demo" variant with a meat recipe would be 30 more seconds.
- **No video produced.** I can write scripts and prep, but the actual recording requires screen-capture + mic + a human pressing record. The user runs the take; the artifacts in this cycle let them do that without thinking.

## Follow-up fixes

- The off-screen staging script is a code smell — these flows should be UI-driven. Building the workspace-settings + member-management UIs (still deferred from [step 16](./16-ui-outline-and-scope-decisions.md)) would let the demo be entirely on-screen.
- The NO_SLOTS workaround in [scripts/demo-stage.mjs](../scripts/demo-stage.mjs) should disappear once the signup trigger seeds a sensible default `shared_meal_frequency` OR the workspace-settings UI is built.
- A Playwright + `verifier-browser` skill (open from [step 18](./18-edit-mode-drawer-and-verify.md)) would let the demo's recipe-form beat be scripted instead of typed live.
- The `demo-script.md` references a 2:30 target; the actual recording could end up shorter or longer depending on how fast the runner moves through the recipe form (Beat 3 is the fumble-prone one).
