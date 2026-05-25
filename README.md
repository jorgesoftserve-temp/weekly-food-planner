# Weekly Food Planner

[![CI](https://github.com/example-org/weekly-food-planner/actions/workflows/ci.yml/badge.svg)](https://github.com/example-org/weekly-food-planner/actions/workflows/ci.yml)

> Badge URL uses placeholder org `example-org` — swap to the real GitHub owner/org when one exists.

Constraint-based weekly menu planner with reproducible, deterministic generation.

A Turborepo monorepo for the Recipe Manager & Constraint-Based Weekly Menu Planner. See [`docs/PRD/`](./docs/PRD/) for the product, architecture, technical, and database specifications.

## Stack

- **Frontend & backend**: Next.js (App Router) + React + TypeScript + Tailwind CSS + shadcn/ui
- **Server-state cache**: TanStack Query (React Query) — see [`.cursor/rules/query-patterns.md`](./.cursor/rules/query-patterns.md)
- **UI state**: Zustand (ephemeral state only — modals, drawers, form drafts)
- **Database**: PostgreSQL via Supabase (Auth + RLS + Storage)
- **Constraint engine**: pure TypeScript, deterministic — greedy assignment + local-search refinement
- **Testing**: Vitest (Playwright optional for E2E)
- **Orchestration**: Turborepo + PNPM
- **Local infrastructure**: Docker Compose

## Layout

```
apps/
  web/                  Next.js app (UI + server components + route handlers + server actions)
packages/
  constraint-engine/    Deterministic menu generator (pure TS, no I/O)
  supabase/             Migrations, generated types, shared DB utilities
  test-utils/           Fixtures, factories, seeded RNG helpers
infrastructure/
  docker/               docker-compose for local Supabase + web
docs/PRD/               Product, architecture, technical, database PRDs
prompts/                Raw agent prompts (.txt)
agent-log/              Generation logs per major step (.md)
.cursor/rules/          Project rules (Cursor + Claude)
```

## Getting started

```sh
# Install pnpm if not already present
npm install -g pnpm@9.12.3

# Install dependencies
pnpm install

# Bring up local infrastructure (Postgres + Supabase services)
docker compose -f infrastructure/docker/docker-compose.yml up -d

# Start the web app
pnpm dev
```

## Project rules

The [`.cursor/rules/`](./.cursor/rules/) directory contains rules consumed by Cursor and Claude:

- [`global-rules.md`](./.cursor/rules/global-rules.md) — TypeScript / React / Supabase / SQL conventions
- [`agentic-rules.md`](./.cursor/rules/agentic-rules.md) — Agent collaboration: required folders, prompt + log format
- [`query-patterns.md`](./.cursor/rules/query-patterns.md) — TanStack Query + Next.js hydration patterns
