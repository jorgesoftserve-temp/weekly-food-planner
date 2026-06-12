# Technical PRD

# 1. Technical goals

The architecture must prioritize:
- Deterministic behavior
- Testability
- Modularity
- Easy local setup

---

# 2. Recommended Stack

## Frontend & backend (unified — Next.js)

- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS
- **shadcn/ui** — component primitives copied into the codebase via the official CLI. Initialize once per app (`npx shadcn@latest init`); add components individually (`npx shadcn@latest add button`). Components live under `apps/web/components/ui/`.
- React Query for server-state cache on the client
- Zustand for ephemeral UI state (modals, drawers, multi-step form drafts — never server data)
- **(v1.8)** `next-themes` for class-based light/dark/system theming, and `next/font` (Inter body + Fraunces headings) for self-hosted fonts with no layout shift. Brand tokens, gradients, and the per-user/per-member accent palettes live as CSS variables in `globals.css` + the Tailwind theme, owned by the `design-system-architect`; components reference tokens only (no hex literals). See [`docs/design/`](../design/).
- **(v2.0)** `@anthropic-ai/sdk` — **server-only**. First Anthropic SDK use in the repo, introduced by Phase 0 (food-group classification). Used in `apps/web/lib/api/food-group-classify.ts` to classify user-created ingredients that lack a `food_group` value; result cached on the `ingredients` row via `supabaseAdminClient`. Prompt caching is enabled to minimize token cost on repeated classification calls. **Never imported in the constraint engine or any client-side bundle.** Further AI dependencies remain **[v3](../../.claude/plans/v3.md)** (AI menu & recipe import + i18n), including `next-intl` for full ES/EN localization. Hosted deployment is **[v2.4](../../.claude/plans/v2.4.md)** — the Anthropic API key is an environment secret on Vercel from that point.
- **(v2.1)** No new dependencies. The v2.1 tracks (inclusive preferences + multi-timeframe engine work, addons, bulk recipe-create) are implemented entirely within the existing stack. No new npm packages are required.

All backend logic lives inside the Next.js app: server components, route handlers (`app/api/**/route.ts`), and server actions. There is no separate Express service. This aligns with the project's cursor rules, which expect Supabase clients to be consumed directly from `apps/web/utils/supabase/`.

---

## Database & storage

- PostgreSQL
- Supabase (Auth + Postgres + RLS + Storage)
- Supabase Storage for recipe and ingredient images
- Supabase CLI for migrations (run from `packages/supabase`)

---

## Testing

- Vitest for unit and integration tests (aligns with the cursor-rule monorepo conventions)
- Playwright (optional) for critical-path E2E

---

## Infrastructure

- Docker / docker compose for the local stack
- Turborepo + PNPM for monorepo orchestration

---

# 3. Repository structure

```
/apps
  /web                  → Next.js app (UI + server components + route handlers + server actions)
                          shadcn/ui primitives live under components/ui/
/packages
  /constraint-engine    → Pure TypeScript deterministic menu generator
  /supabase             → Supabase migrations, generated types, shared DB utilities
  /test-utils           → Fixtures, factories, seeded RNG helpers
/infrastructure
  /docker               → docker-compose for local Supabase + web stack
/docs                   → PRDs and architectural documents
/prompts                → LLM and agent prompts (raw .txt per agentic rules)
/agent-log              → Agent run history (.md per major generation step)
```
