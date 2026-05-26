# Demo recording script

Target length: **2:30 ± 0:15**. Six narrative beats plus a 5-second outro card.

The constraint here is honesty: the workspace-settings and member-management UIs were scope-cut in [step 16](../../agent-log/16-ui-outline-and-scope-decisions.md), so per-member dietary restrictions can't be set through clicks today. The demo handles that with one off-screen script call ([scripts/demo-stage.mjs](../../scripts/demo-stage.mjs)) and the narrator names it out loud — viewers learn what's UI vs. API rather than seeing a polished lie.

---

## Preflight (do this once, before you hit record)

```sh
# 1. Local stack up (Docker required)
pnpm --filter @weekly-food-planner/supabase db:start

# 2. Dev server up — wait for "Ready" in the log
pnpm dev

# 3. One-time ingredient catalog seed (idempotent; safe to re-run)
curl -X POST http://127.0.0.1:3000/api/admin/seed-ingredients \
  -H "x-admin-key: admin_key" -H "content-type: application/json" -d '{}'
```

Layout before recording:

- **Window A** (full screen): browser at `http://127.0.0.1:3000`, signed out, fresh incognito profile so the auth cookie is clean.
- **Window B** (small, off-camera): terminal in the repo root with `scripts/demo-stage.mjs` pre-typed in the prompt but not yet run.
- **Window C** (small, off-camera): VS Code with the repo open, Claude Code panel visible.

Recording tools — anything with a "switch source" hotkey works. On Windows: OBS Studio (free, scriptable scene switching) or ShareX (lighter, less control). The built-in Game Bar (`Win + G`) works in a pinch but can't switch sources mid-recording.

Demo credentials:

- Email: `demo+<short timestamp>@example.test` (e.g. `demo+0530@example.test`) — picking a unique one per take avoids "user already exists" errors on retakes.
- Password: `demo-pass-2026`

---

## Beat 1 — Sign up (0:00 → 0:20)

**On screen:** browser at `/`. Click "Sign up". Fill email + password. Submit. Page redirects to `/verify-email`.

**Narration:**
> "This is the Weekly Food Planner — a constraint-based menu planner. I'll start by signing up a brand-new user. Email, password, submit."

---

## Beat 2 — Confirm + log in (0:20 → 0:40)

**On screen:** switch briefly to Window B. Run:

```sh
node scripts/demo-stage.mjs demo+0530@example.test demo-pass-2026
```

Wait for the `[demo-stage] all set` line (under 2 seconds). Switch back to the browser, click "Log in", paste credentials, submit. Land on `/dashboard`.

**Narration:**
> "Normally the user clicks an email confirmation link. For a self-contained demo, I run a small staging script — it confirms the email through an admin endpoint, sets up the workspace's meal frequency, and marks the user as vegetarian. None of those have a UI yet — they're on the roadmap. Now I log in."

**Why this lives off-screen:** the workspace-settings and member-management screens are scope-cut ([step 16](../../agent-log/16-ui-outline-and-scope-decisions.md)). Doing the setup through curl in the foreground would take 40 seconds and look uglier than naming it once.

---

## Beat 3 — Create two recipes (0:40 → 1:20)

**On screen:** click "Recipes" in the sidebar. Click "New recipe". Fill:

- Name: `Oatmeal`
- Meal type: `Breakfast`
- Difficulty: `Easy`
- Servings: `1`
- Add one ingredient: `Oats`, quantity `0.5`, unit `cup`

Submit. Land back on `/recipes` — Oatmeal in the list.

Click "New recipe" again. Fill:

- Name: `Tomato pasta`
- Meal type: `Dinner`
- Difficulty: `Easy`
- Servings: `2`
- Cuisine: `Italian`
- Add one ingredient: `Pasta`, quantity `200`, unit `g`
- Add a second ingredient: `Tomato`, quantity `3`, unit `piece`

Submit. Two recipes in the list.

**Narration (over the form-filling):**
> "Two recipes — one breakfast, one dinner. Both vegetarian. The form covers ingredients, instructions, and dietary tags; I'll keep it minimal for time."

---

## Beat 4 — Generate the menu with constraints (1:20 → 1:50)

**On screen:** click "Menu" in the sidebar. Click "Generate menu". The dialog shows a week-start date (defaults to next Monday). Click "Generate menu".

A few hundred ms later: the 14-slot grid appears (7 days × breakfast + dinner). Every slot is filled with either `Oatmeal` or `Tomato pasta`.

**Narration:**
> "Now I generate the menu. The dialog asks for a week-start date — the engine handles the rest. Note that the constraint we set on the user — vegetarian — is what the engine respected when assigning recipes. If I'd added a non-vegetarian recipe, the engine would have excluded it. Same seed, same input, same menu every time — it's deterministic."

---

## Beat 5 — Export the grocery list (1:50 → 2:10)

**On screen:** click "Grocery" in the sidebar. The aggregated list appears (oats + pasta + tomato + any other ingredients used).

Click the "Export" dropdown → "Download CSV". The browser downloads `grocery-2026-XX-XX.csv` (or similar — depends on the route's filename logic).

Open the downloaded file in a quick preview (VS Code, Notepad, Excel — whatever opens fastest). Show the `## Menu` and `## Grocery list` sections.

**Narration:**
> "The grocery list aggregates every ingredient the menu needs across the week. Export to markdown or CSV — same single-rectangle layout, both consumable by spreadsheets or a markdown renderer."

---

## Beat 6 — Invoke the Claude skill (2:10 → 2:40)

**On screen:** switch to Window C (VS Code). Open the Claude Code panel.

Type, slowly so the viewer can read:

```
/constraint-menu-generator-life-cycle-test
Use the spec at .claude/skills/constraint-menu-generator-life-cycle-test/docs/examples/basic-flow.yaml
```

Claude reads the spec, emits two files. Show one of them briefly — open the new `scripts/flow-basic-flow.mjs` or the Vitest test, scroll through it for 2-3 seconds.

**Narration:**
> "To make sure this flow can be regression-tested going forward, I invoke the project's custom Claude skill. It reads a recipe-plus-constraints spec — we shipped a basic-flow example with the skill — and emits both a Vitest integration test and a standalone HTTP driver, both matching the flow you just saw. So the demo becomes the test."

---

## Outro (2:40 → 2:45)

**On screen:** static card or just hold on the emitted test file.

**Narration:**
> "That's the basic flow — signup, recipes, deterministic menu, grocery export, and a skill that captures the whole thing as a regression test. Repo's on GitHub."

---

## Common gotchas

| Symptom | Cause | Fix mid-recording |
|---|---|---|
| `/api/me` returns 401 after login | The session cookie didn't land — usually a stale incognito session from a previous take | Hard-refresh, log out, log back in. Or use a fresh incognito profile per take. |
| Menu generation returns "no_slots" | The staging script wasn't run, or hit a different user than the one you signed up as | Re-run `node scripts/demo-stage.mjs <email> <password>` with the exact email you just signed up with |
| Menu generation returns "no_valid_recipe" | One of your two recipes doesn't match a meal-type slot (e.g. both are breakfast) | Make sure recipe 1 is breakfast and recipe 2 is dinner |
| Recipe form's ingredient picker is empty | Ingredient catalog wasn't seeded | Run the seed-ingredients curl from the Preflight section (idempotent, safe) |
| "User already exists" on signup | You re-used an email from a previous take | Use a fresh email — `demo+<timestamp>@example.test` |

## Retake notes

A take that mostly works but has one beat fumbled is usually rescuable in post — record beats as separate clips if your tool supports scene cuts, then stitch. Beat 3 (recipe form) is the most fumble-prone; consider recording it twice and picking the better take.

If the dev server crashes mid-recording (the webpack `.js`-suffix bug from [agent-log/18](../../agent-log/18-edit-mode-drawer-and-verify.md) is fixed but you might hit a different one): kill `pnpm dev`, restart, and resume from the beat you were on. Don't try to power through a broken stack on camera.
