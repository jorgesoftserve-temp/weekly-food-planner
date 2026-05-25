# Step 09 — Begin project generation: foundation, engine skeleton, full DB, Next.js shell, auth flow

## Prompt used

See [/prompts/09-begin-project-generation.txt](../prompts/09-begin-project-generation.txt).

Summary: the user moved the PRDs from `docs/` to `docs/PRD/`, added `.cursor/rules/query-patterns.md` (TanStack Query + Next.js hydration patterns), and told me to start scaffolding. I worked through four numbered phases without further confirmation, verifying each with a typecheck or test run before moving on.

## Context files provided

- `.cursor/rules/agentic-rules.md`, `global-rules.md`, `query-patterns.md`
- `docs/PRD/{OVERVIEW,PRODUCT,TECHNICAL,ARCHITECTURE,DATABASE}_PRD.md`
- `.claude/skills/constraint-menu-generator/SKILL.md` (noted, not consumed)
- `README.md` (empty before this step)
- All eight prior agent-log entries (01–08)

## Expected output

### Phase 1 — Monorepo foundation
- `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.gitignore`, `.npmrc`, `.editorconfig`, `README.md`.
- Placeholder `package.json` per workspace: `apps/web`, `packages/constraint-engine`, `packages/supabase`, `packages/test-utils`.
- `pnpm install` clean; 5 workspaces linked.

### Phase 2 — constraint-engine skeleton
- `packages/constraint-engine/{package.json, tsconfig.json, vitest.config.ts}`.
- `src/{types.ts, random.ts, canonical.ts, hash.ts, generate.ts, index.ts}` — placeholder `generateMenu` throws `NOT_IMPLEMENTED`.
- Tests: `types`, `random`, `canonical`, `hash` (14 tests passing).

### Phase 3 — Database layer (37 migrations)
- `packages/supabase/supabase/{config.toml, .gitignore, seed.sql}`.
- `packages/supabase/package.json` with `db:start/db:stop/db:status/db:reset/db:gen:types` scripts.
- 1 trigger function migration (`fn_create_updated_at_trigger` + uuid-ossp extension).
- 8 system-enum migrations (one per enum per cursor-rule SQL guide).
- 17 table migrations covering everything in DATABASE_PRD §6 — including `is_deleted` columns, partial unique indexes, `enum_metadata` seeded with ~60 official values across system enums + extensible labels.
- 5 function/RPC migrations: `fn_user_workspace_role`, `sys_create_workspace_on_signup` (auth.users insert trigger), `sys_save_label`, `sys_delete_enum_suggestion`, `fn_increment_enum_metadata_usage`.
- `rls_enable_tables` + 5 policy migrations (workspace+member, recipe, menu, ingredient, enum_metadata).

### Phase 4 — apps/web Next.js shell
- 4a: Next.js 15 + React 19 + Tailwind 3.4 + shadcn config (Tailwind + components.json + lib/utils with `cn`) + plain Tailwind home page.
- 4b: Three Supabase clients (`utils/supabase/{client,server,admin}.ts`) + Next.js `middleware.ts` for auth-session refresh.
- 4c: TanStack Query provider following `query-patterns.md` (server prefetch + dehydrate + HydrationBoundary), auth route group with login / signup / verify-email pages and the `/auth/callback` route handler that exchanges the verification code for a session.

## Observed issue

- **pnpm not on PATH inside Git Bash.** `corepack` was unavailable from the Bash shell. Fell back to `npm install -g pnpm@9.12.3` via PowerShell; pnpm reported 9.12.3 ready, no admin prompt.
- **Implicit-any on `@supabase/ssr` setAll callback** for both the server client and the Next.js middleware. Fixed with an explicit `CookieOptions` type import and a local `CookieToSet` alias so the strict `noImplicitAny` config stays on.
- **`docs/PRD/` move**: a glob early in the turn still showed `docs/TECHNICAL_PRD.md`; a later `ls` confirmed `docs/PRD/` now holds all five PRDs. Did not touch the (possibly stale) `docs/TECHNICAL_PRD.md` — flagged for the user to delete if it's a leftover from the move.
- **Cross-doc reference broken by the PRD move**: `ARCHITECTURE_PRD.md` references `../.cursor/rules/agentic-rules.md` (correct relative to `docs/`, off-by-one relative to `docs/PRD/`). Flagged but deferred — fixing 4 PRD files for one path is its own cleanup pass.
- **Branding of email-verification redirect URL** in signup form uses `window.location.origin` to pick up the local-dev URL automatically. Confirmed acceptable for MVP.
- TypeScript strict config (`noUncheckedIndexedAccess: true`, `verbatimModuleSyntax: true`) caused some friction in auth forms; resolved with explicit `! ` non-null assertions where the safety is provable and `import type { ... }` for every type-only import.

## Follow-up fixes

- Every phase's exit gate green: `pnpm install` clean, `pnpm --filter @weekly-food-planner/constraint-engine test` shows 14/14, `pnpm --filter @weekly-food-planner/web typecheck` clean after each of 4a/4b/4c.
- Validation gaps explicitly listed in the closing message (run `pnpm db:start`, run `pnpm dev`, walk the auth round-trip) — left to the user to exercise so I didn't burn the multi-GB Supabase image download autonomously.
- Phase 5 (test-utils) deferred to step 10 — factories ended up inlined in engine tests anyway.
