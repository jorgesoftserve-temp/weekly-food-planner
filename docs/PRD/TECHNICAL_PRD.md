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
