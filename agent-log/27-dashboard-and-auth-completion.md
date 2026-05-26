# Step 27 — Dashboard polish + auth flow completion

## Prompt used

See [/prompts/27-dashboard-and-auth-completion.txt](../prompts/27-dashboard-and-auth-completion.txt).

Summary: first execution pass from the [step 26](./26-enhancement-plan-six-items.md) six-item plan. Ships items **#6 (Dashboard improvements)** and **#1 (Auth completion)** together because both are UI-only, no schema, and independent of every other queued item. The user also asked for prompt + agent-log backfill for the two prior planning steps that weren't logged yet ([step 25](./25-review-prd-gaps-and-roadmap.md), [step 26](./26-enhancement-plan-six-items.md)).

## Context files provided

- The plan itself ([step 26](./26-enhancement-plan-six-items.md)) defining acceptance for both items.
- [apps/web/app/(app)/dashboard/page.tsx](../apps/web/app/(app)/dashboard/page.tsx) — existing dashboard with the "Deterministic generation" copy the user flagged as not user-friendly.
- [packages/supabase/src/module/workspaces.ts](../packages/supabase/src/module/workspaces.ts) — `useWorkspaceWithMembers` already exists; the members card reuses it instead of adding a new hook.
- Existing auth pages and forms: [(auth)/signup/signup-form.tsx](../apps/web/app/(auth)/signup/signup-form.tsx), [(auth)/login/login-form.tsx](../apps/web/app/(auth)/login/login-form.tsx), [(auth)/verify-email/page.tsx](../apps/web/app/(auth)/verify-email/page.tsx), [auth/callback/route.ts](../apps/web/app/auth/callback/route.ts) — extended in this step rather than rewritten.
- [apps/web/components/ui/tooltip.tsx](../apps/web/components/ui/tooltip.tsx) — already wired (shadcn `Tooltip`); used for the disabled "New member" button's "Coming soon" hover.

## Expected output

### Dashboard (#6) — single commit

[apps/web/app/(app)/dashboard/page.tsx](../apps/web/app/(app)/dashboard/page.tsx) rewrite of the determinism card copy to "Reproducible weekly plans" — explains the value (compare weeks, share a plan, trust what you're shopping for) instead of the implementation detail (byte-identical menus, exporter writes MD/CSV).

New [apps/web/app/(app)/dashboard/_components/members-card.tsx](../apps/web/app/(app)/dashboard/_components/members-card.tsx):

- Uses `useWorkspaceWithMembers` (same hook as the grocery page) instead of a new fetch path.
- Renders avatar (initials) + name + role badge (`creator` / `admin` / `member` with colour) + age category per member.
- "New member" button shown only to `creator` / `admin`, **disabled** with a Tooltip hover: "Coming soon — member management lands in the next iteration." Matches the [step 26](./26-enhancement-plan-six-items.md) acceptance ("just a visual new menu button no usage until we build that module yet").
- Empty state (just the creator member): "Just you for now — add household members later…"

Mounted between the determinism card and the QUICK_LINKS grid.

### Auth completion (#1) — same commit

Four new screens / panels and three edits to existing files:

- [(auth)/forgot-password/page.tsx](../apps/web/app/(auth)/forgot-password/page.tsx) + [forgot-password-form.tsx](../apps/web/app/(auth)/forgot-password/forgot-password-form.tsx) — calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: <origin>/auth/callback?next=/reset-password })`. Confirmation state shows "If an account exists for X, we've sent it a link" to avoid email enumeration.
- [(auth)/reset-password/page.tsx](../apps/web/app/(auth)/reset-password/page.tsx) + [reset-password-form.tsx](../apps/web/app/(auth)/reset-password/reset-password-form.tsx) — checks `getSession()` on mount so an expired/pasted link surfaces a clear "request a new link" path rather than failing on `updateUser`. Password + confirm with min-length + match validation. On success redirects to `/login?reset=1`.
- [(auth)/verify-success/page.tsx](../apps/web/app/(auth)/verify-success/page.tsx) — post-verify success acknowledgement; "Continue to dashboard" CTA. Reached because signup now sends `?next=/verify-success` through the callback.
- [(auth)/verify-email/verify-email-panel.tsx](../apps/web/app/(auth)/verify-email/verify-email-panel.tsx) — client component embedded in the existing [(auth)/verify-email/page.tsx](../apps/web/app/(auth)/verify-email/page.tsx). Reads the email from `sessionStorage`, offers a one-click `supabase.auth.resend({ type: 'signup', email })` button with sent/error states.
- [(auth)/signup/signup-form.tsx](../apps/web/app/(auth)/signup/signup-form.tsx) — stashes the submitted email in `sessionStorage` under `wfp:pending-verify-email` before pushing to `/verify-email`. Wrapped in try/catch so private-browsing mode degrades to "sign up again" link rather than throwing.
- [(auth)/login/login-form.tsx](../apps/web/app/(auth)/login/login-form.tsx) — full rewrite of the error surface. Detects Supabase `email_not_confirmed` (via both `.code` and message substring for SDK-version safety) and renders an amber notice with an inline "Resend verification email" button. Adds a "Forgot?" link inside the password label. Renders an emerald "Password updated. Sign in with your new password." banner when `?reset=1` is present.
- [auth/callback/route.ts](../apps/web/app/auth/callback/route.ts) — hardened the `?next=` redirect with a `sanitizeNext` guard (same rule already used in `login-form.tsx`) so callback redirects can't be hijacked into off-origin URLs.

### Prompt + agent-log backfill

- [prompts/25-review-prd-gaps-and-roadmap.txt](../prompts/25-review-prd-gaps-and-roadmap.txt) + [agent-log/25-review-prd-gaps-and-roadmap.md](./25-review-prd-gaps-and-roadmap.md).
- [prompts/26-enhancement-plan-six-items.txt](../prompts/26-enhancement-plan-six-items.txt) + [agent-log/26-enhancement-plan-six-items.md](./26-enhancement-plan-six-items.md).
- [prompts/27-dashboard-and-auth-completion.txt](../prompts/27-dashboard-and-auth-completion.txt) + this file.

`pnpm turbo run typecheck` green across all 5 workspaces.

## Observed issue

- **`pnpm --filter @weekly-food-planner/web lint` is broken** — `next lint` is deprecated in Next.js 15 and now prompts for interactive setup, which fails under pnpm. Pre-existing; not caused by this step. Worth replacing with a direct ESLint CLI invocation in `apps/web/package.json` before the migration to Next.js 16 forces it.
- **`noUncheckedIndexedAccess` caught `getInitials`** — the initial `members-card.tsx` used `parts[0][0]` patterns that fail under that flag. Fixed in the same file with explicit `parts[0] ?? ''` guards. Same flag previously caught similar code in [step 23](./23-ingredient-creation-and-settings.md); the pattern is repeating because we don't have a shared `safeInitials` util.
- **IDE diagnostic flagged `'./verify-email-panel'` as missing for ~1s** after the panel file was written — TypeScript server cache lag, not a real error. Resolved by itself; turbo typecheck confirmed the resolution.
- **`FormEvent` is marked deprecated in React 19** — emitted as a hint by the IDE on `login-form.tsx`. Same import shape exists in [signup-form.tsx](../apps/web/app/(auth)/signup/signup-form.tsx), [forgot-password-form.tsx](../apps/web/app/(auth)/forgot-password/forgot-password-form.tsx), [reset-password-form.tsx](../apps/web/app/(auth)/reset-password/reset-password-form.tsx) — all kept consistent. A repo-wide migration to `React.FormEvent` (the non-deprecated re-export) belongs in its own step, not smuggled in here.
- **`sessionStorage` is tab-scoped** — if the user signs up in tab A, closes it, and opens `/verify-email` in tab B, the resend panel falls back to the "sign up again" link. Acceptable per the [step 26](./26-enhancement-plan-six-items.md) plan; documented inline in `verify-email-panel.tsx`.
- **Email enumeration mitigation on forgot-password is partial.** Supabase's `resetPasswordForEmail` already returns success regardless of whether the email exists; the confirmation copy ("If an account exists for X…") matches that behaviour. Supabase rate-limiting still applies.
- **Recovery-link landing assumes the callback exchange ran successfully.** If `auth/callback` errored out the user lands on `/login?error=verification_failed`, not `/reset-password` — surfaced via the existing generic error path. Worth a friendlier "your reset link expired" copy in a later polish pass.
- **Members card needs Supabase env vars to render.** On the signup-only state where no workspace exists yet, `useWorkspaceWithMembers` is `enabled: false` via the `workspace?.id` guard; the card renders the skeleton then the empty state. Verified mentally; not yet smoke-tested in the browser.

## Follow-up fixes

- **Replace `next lint`** with direct ESLint CLI per Next.js 15's migration note. Blocks the auth and dashboard work from being verified by lint in CI.
- **Shared `getInitials` util** somewhere in [apps/web/lib](../apps/web/lib/) so future avatar implementations (members page, settings page) don't re-derive it under `noUncheckedIndexedAccess`.
- **Smoke-test the reset flow against a real Supabase project** — needs the recovery-redirect URL whitelisted in `Auth → URL Configuration`. The repo doesn't document this requirement yet; a `.env.example` note + README line are owed.
- **Reset link expiry copy** — `auth/callback/route.ts` redirects to `/login?error=verification_failed` on any callback failure. A reset-specific landing (`/reset-password/expired`) with a "Request a new reset link" button would be more user-friendly. Defer until the next auth polish pass.
- **Members card → members page link** — when the deferred members module ships (still queued from [step 16](./16-ui-outline-and-scope-decisions.md)), the card's disabled "New member" button + the avatar row should both link out to `/members`.
- **Pick up items #2 (Recipe list), #5 (Grocery improvements), #4 (Mobile pass), #3 (Menu review)** in this order — same recommendation as in [step 26](./26-enhancement-plan-six-items.md). Each is independent enough to ship as its own commit/step.
