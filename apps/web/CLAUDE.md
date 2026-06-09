# apps/web CLAUDE.md

Conventions for editing the Next.js application. Load when working under [`apps/web/`](./).

## Layout

```
apps/web/
  app/
    (app)/              authenticated app — wrapped by app/(app)/layout.tsx
    (auth)/             public auth pages
    api/                route handlers (resource-oriented)
    layout.tsx          root layout with HTML + viewport
  components/
    ui/                 shadcn/ui primitives (CLI-generated)
    forms/              composite form widgets (LabelCombobox, IngredientPicker)
    app-shell/          sidebar + header
    *.tsx               app-level shared components
  hooks/                cross-feature client hooks
  lib/
    api/                server-side helpers used by route handlers
    hooks/              app-level hooks
    react-query/        QueryClient factory + query-key catalogues
    grocery-filter.ts   shop-for subset transform
  utils/supabase/       the three clients (client/server/admin)
  middleware.ts         route protection (sanitized redirect)
  integration/          E2E-style tests at the package boundary
```

## Component conventions

- Single export per file, fat-arrow components, kebab-case file names.
- Props always typed; RO-RO for callbacks (`onSubmit: ({ values, slot }) => void`).
- Controlled where state is shared; otherwise stay uncontrolled to minimize re-renders.
- Composition over inheritance. Use shadcn `Sheet` / `Dialog` / `Popover` — never roll your own.
- Co-locate feature components under `app/(app)/<feature>/_components/`. App-wide reusables go in [`components/`](./components/).
- Tailwind: `flex` + `gap-*` over `margin-*` / `space-*`. Use `cn(...)` from [`lib/utils.ts`](./lib/utils.ts) for conditional class merging.

## Forms

- shadcn `Form` + react-hook-form + Zod. Schema lives next to the form (`<feature>.schema.ts`).
- For extensible labels (cuisine, dietary restriction, dietary tag, food allergy) use [`components/forms/multi-label-combobox.tsx`](./components/forms/multi-label-combobox.tsx) — never re-implement the dropdown.
- For ingredients use [`components/forms/ingredient-picker.tsx`](./components/forms/ingredient-picker.tsx).
- Don't auto-rewrite user input; the combobox is suggestion-only by design — see [PRODUCT_PRD §11.1](../../docs/PRD/PRODUCT_PRD.md).

## TanStack Query

Detailed pattern in [`.cursor/rules/query-patterns.md`](../../.cursor/rules/query-patterns.md). Summary:

- **Server prefetch** uses a static array query key (`["recipes", "list", workspaceId]`).
- **Client `useQuery`** uses the function-form key from the catalogue under [`lib/react-query/`](./lib/react-query/).
- Hooks return the **full** `useQuery` / `useMutation` result so callers can read `isFetching`, `error`, `refetch`.
- Wrap hydrated client components in `HydrationBoundary` with `dehydrate(queryClient)`.
- Mutations live in [`packages/supabase/src/module/`](../../packages/supabase/src/module/) and **throw** on error (no toast at the data layer); the component/feature layer surfaces feedback via [`lib/toast.ts`](./lib/toast.ts) (`notifySuccess` / `notifyError`) — never inline `toast(...)` or `react-hot-toast`.

## Zustand

- One slim store per feature (e.g. menu draft, member form draft), never a global store.
- Only ephemeral UI state — open/closed drawers, multi-step form drafts, transient flags. **Never** server data; that's React Query's job.

## Route handlers

See [`apps/web/CLAUDE.md` → Route Handlers](#) — actually delegated: use the `route-handler-engineer` agent for non-trivial work. Quick rules:

- `export const GET = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => { const { id } = await params; ... }`
- Authorize first, validate second, mutate third. Errors return structured JSON (`{ error: { code, message, ... } }`).
- Use `supabaseServerClient` for caller-context reads, `supabaseAdminClient` only when you genuinely need to bypass RLS (workspace bootstrap, generation pipeline persistence, overlay dedup).
- Hand `await cookies()` and `await headers()` to the Supabase SSR client.

## Middleware

[`middleware.ts`](./middleware.ts) gates protected routes. Add new protected prefixes to the matcher and to the redirect list. `next` query parameter is sanitized against open-redirect — keep that sanitization in place.

## Testing

- Unit tests colocated as `<thing>.test.ts(x)` under `__tests__/` directories.
- Integration tests as `<feature>.integration.test.ts`. Use [`createIntegrationFixture`](../../packages/test-utils/src/integration/fixture.ts) and the `INTEGRATION_ENABLED` env gate.
- E2E walks through [`scripts/verify-flow.mjs`](../../scripts/verify-flow.mjs).

## Things this app deliberately does NOT do

- No `next-auth`; Supabase Auth is the only identity layer.
- No `next-auth-helpers`; the three clients above are the only Supabase entry points.
- No client-side authorization decisions — UI hides controls based on role, but the server re-checks before mutating.
- No PDF export yet (post-MVP). The menu and grocery views are designed PDF-ready so the future export reuses the template.

## Related areas (load only what your task needs)

- Root non-negotiables + agent/skill/MCP index → [`CLAUDE.md`](../../CLAUDE.md)
- Data layer this app consumes (modules, hooks, migrations, RLS) → [`packages/supabase/CLAUDE.md`](../../packages/supabase/CLAUDE.md)
- The deterministic generator behind menu pages → [`packages/constraint-engine/CLAUDE.md`](../../packages/constraint-engine/CLAUDE.md)
- TanStack Query specifics → [`.cursor/rules/query-patterns.md`](../../.cursor/rules/query-patterns.md); design tokens → [`docs/design/`](../../docs/design/)
- Specialist agents for this area: `ui-component-builder`, `route-handler-engineer`, `design-system-architect`, `ux-reviewer`, `accessibility-auditor` (see [`docs/agentic/agents.md`](../../docs/agentic/agents.md)).
