# Step 25 — PRD gap review and post-MVP roadmap

## Prompt used

See [/prompts/25-review-prd-gaps-and-roadmap.txt](../prompts/25-review-prd-gaps-and-roadmap.txt).

Summary: planning-only pass. The user asked for a six-item review covering (1) email confirmation screens, (2) member registration UI, (3) menu review (replace / reorganize / per-member views), (4) Playwright MCP for MVP2, (5) Postgres MCP + DB audit skill for MVP2, (6) bonus — mobile-friendly version of the site. No code changes in this step.

## Context files provided

- [/.cursor/rules/agentic-rules.md](../.cursor/rules/agentic-rules.md), [/.cursor/rules/global-rules.md](../.cursor/rules/global-rules.md), [/.cursor/rules/query-patterns.md](../.cursor/rules/query-patterns.md) — repo conventions.
- All five PRDs under [/docs/PRD/](../docs/PRD/): OVERVIEW, PRODUCT, ARCHITECTURE, TECHNICAL, DATABASE.
- Surveyed the live codebase to compare PRD spec vs. shipped reality: [apps/web/app/(auth)/**](../apps/web/app/(auth)/), [apps/web/app/auth/callback/route.ts](../apps/web/app/auth/callback/route.ts), [apps/web/app/(app)/menu/_components/active-menu-view.tsx](../apps/web/app/(app)/menu/_components/active-menu-view.tsx), [apps/web/app/api/workspaces/[id]/members/route.ts](../apps/web/app/api/workspaces/[id]/members/route.ts), [apps/web/components/app-shell/app-sidebar.tsx](../apps/web/components/app-shell/app-sidebar.tsx), [apps/web/app/layout.tsx](../apps/web/app/layout.tsx).

## Expected output

A structured findings report — what exists vs. what's missing for each of the six topics — with concrete file/line references and a suggested execution order. No edits.

Topic-by-topic summary:

1. **Auth screens** — signup form, "check your email" landing, and Supabase callback all exist. Missing: password-reset flow (`/forgot-password`, `/reset-password`), resend-verification action, post-verify success acknowledgement, and `email_not_confirmed` handling on the login form. PRD §1 explicitly requires all four.
2. **Member registration UI** — API surface complete (`POST /api/workspaces/:id/members`, child routes for dietary/allergy/dislikes). No `/members` page, no sidebar entry. Settings page only edits the current user's own profile.
3. **Menu review** — current view is read-only cards; no per-member view, no slot replace, no reorder, no slot detail. Determinism contract (`inputs_hash + seed → menu` in ARCHITECTURE §6) complicates "manual edit" — two design options: lock-then-regenerate (preferred) vs. manual override layer.
4. **Playwright MCP (MVP2)** — no `.mcp.json`, no `playwright.config.*`. PRD lists Playwright as optional; safe MVP2 scope (project-level `.mcp.json` + `apps/web/e2e/` smoke specs).
5. **Postgres MCP + DB audit (MVP2)** — no MCP wiring, no analytics/events schema (`generation_runs` and `enum_metadata.usage_count` are the only existing usage signals). An audit skill needs an `auth_events` / `user_activity` table plus a "incomplete data" view/RPC.
6. **Mobile** — app already uses Tailwind responsive prefixes and `Sidebar collapsible="icon"`, but root layout has no `viewport` export, sidebar has no mobile-drawer mode, and the 4-col menu grid cramps at 375px. Recommendation: same URL with responsive layout (one codebase, one auth session), not a separate `m.` subdomain.

Execution-order recommendation: Auth → Members page → Menu review (after lock/override decision) → Mobile pass → MVP2 MCP work.

## Observed issue

- **Recipe list, grocery, dashboard, settings** were not part of the user's six-item ask; they only surfaced in step 26 as add-ons after this review. No gap analysis done for them in this step.
- **Member management UI gap was already known** from [step 16](./16-ui-outline-and-scope-decisions.md) and revisited in [step 24](./24-dietary-and-meal-frequency-editors.md); confirmed it has not been picked up since.
- **MVP2 items (#4, #5)** described at a conceptual level only — concrete tool / table designs are deferred until those items get scheduled.
- **Mobile-friendly URL phrasing** ("a url that is user friendly for mobile devices") was interpreted as same URL with responsive layout. Worth confirming with the user if they meant a separate `/m` or subdomain — flagged in the response, not in this log.

## Follow-up fixes

- The six findings became the input for [step 26](./26-enhancement-plan-six-items.md), where the user converted the gap list into a concrete enhancement plan and added recipe/grocery/dashboard items.
- The "lock-then-regenerate vs. manual override" decision raised here was resolved in step 26 (lock-then-regenerate).
- The mobile-URL ambiguity carries forward — no clarification asked in step 26, so the assumption stands and is documented again in the step-27 mobile-pass scope.
