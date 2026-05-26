# Step 26 — Six-item enhancement plan + scope decisions

## Prompt used

See [/prompts/26-enhancement-plan-six-items.txt](../prompts/26-enhancement-plan-six-items.txt).

Summary: the user took the [step 25](./25-review-prd-gaps-and-roadmap.md) gap analysis and turned it into a six-item enhancement plan, swapping two MVP2 items (Playwright MCP, Postgres MCP) for two MVP1 polish items (recipe list improvements, grocery list improvements + dashboard improvements). Still planning-only — no code in this step. The output is a written plan plus three architectural decisions captured via `AskUserQuestion`.

## Context files provided

- All five PRDs (re-loaded from step 25 context — same set: OVERVIEW, PRODUCT, ARCHITECTURE, TECHNICAL, DATABASE).
- The current UI surface read in this step to ground the plans: [apps/web/app/(app)/recipes/page.tsx](../apps/web/app/(app)/recipes/page.tsx), [apps/web/app/(app)/grocery/page.tsx](../apps/web/app/(app)/grocery/page.tsx), [apps/web/app/(app)/dashboard/page.tsx](../apps/web/app/(app)/dashboard/page.tsx), [apps/web/app/(auth)/signup/signup-form.tsx](../apps/web/app/(auth)/signup/signup-form.tsx), [apps/web/app/(auth)/login/login-form.tsx](../apps/web/app/(auth)/login/login-form.tsx), [apps/web/app/(auth)/verify-email/page.tsx](../apps/web/app/(auth)/verify-email/page.tsx), [apps/web/app/auth/callback/route.ts](../apps/web/app/auth/callback/route.ts), [apps/web/app/(app)/menu/_components/active-menu-view.tsx](../apps/web/app/(app)/menu/_components/active-menu-view.tsx), [apps/web/components/app-shell/app-sidebar.tsx](../apps/web/components/app-shell/app-sidebar.tsx).
- Existing CRUD surface used by the plans: [apps/web/app/api/workspaces/[id]/members/route.ts](../apps/web/app/api/workspaces/[id]/members/route.ts), [packages/supabase/src/module/workspaces.ts](../packages/supabase/src/module/workspaces.ts).

## Expected output

A scoped plan for each of the six items — Auth completion, Recipe list improvements, Menu review, Mobile pass, Grocery list improvements, Dashboard improvements — with file paths, acceptance criteria, and call-outs for risk and dependencies. Three decisions captured before drafting detailed plans:

1. **Menu review approach** → *Lock-then-regenerate*. User pins slots; pins become part of `inputsHash`; determinism contract preserved. Engine pre-assigns pinned slots, greedy fills the rest, refinement skips pinned slots. New table `menu_slot_pins`. New endpoint `PATCH /api/workspaces/:id/menus/active/slots/:slotId`.
2. **Mobile nav** → *Sheet drawer* below `md:` breakpoint, hamburger in the header. Desktop keeps the existing collapsible icon sidebar.
3. **Recipe view** → *Read-only detail modal* + per-column "View" buttons (Dietary / Ingredients / Instructions). The existing EditRecipeDrawer stays as the edit surface; the new modal is browse-only.

Suggested execution order presented to the user: #6 Dashboard → #1 Auth → #2 Recipe list → #5 Grocery → #4 Mobile → #3 Menu review (largest, schema + engine + tests).

## Observed issue

- **Plan only — no code yet.** All six items shipped as a written deliverable; the user picks the starting point in the next step.
- **"Lock-then-regenerate" determinism implication needs regression-fixture updates.** Flagged in the plan as a risk: when pins enter `inputsHash`, the existing determinism golden snapshots in [packages/test-utils](../packages/test-utils/) must grow a pinned-slot scenario or the engine boundary contract loses coverage.
- **Recipe-detail modal needs a "View by section" param** so each column button can scroll to the right section on open. Trivial — flagged so it's not forgotten when the work lands.
- **Mobile audit list at 375px** documents an assumption (same URL, responsive layout) that was not re-confirmed with the user. If a separate `/m` prefix or `m.` subdomain was intended, this plan misses.
- **Members-card on the dashboard** is scoped as "visual only, no New Member action" intentionally — wiring it to the still-deferred members module would prematurely pull that work in.

## Follow-up fixes

- [Step 27](./27-dashboard-and-auth-completion.md) implements items #6 (Dashboard) and #1 (Auth completion) in one pass, following the order recommended here.
- Items #2 (Recipe list), #3 (Menu review), #4 (Mobile pass), #5 (Grocery improvements) remain queued in this order — none picked up yet.
- The `menu_slot_pins` schema + engine boundary change for #3 needs its own scoped plan + agent-log step before any code lands; flagged here so it doesn't get smuggled in alongside other UI-only work.
