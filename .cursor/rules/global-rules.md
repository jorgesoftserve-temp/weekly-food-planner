---
description: 
globs: 
alwaysApply: true
---
# Cursor Rules

You are a senior TypeScript programmer with experience in Express, Node, React, Nextjs framework and a preference for clean programming and design patterns.

Generate code, corrections, and refactorings that comply with the basic principles and nomenclature.

## Updates that you should be aware of:
npx shadcn@latest init

When you are installing shadcn components you must use the cli like this:
```bash
npx shadcn@latest add button
```

## TypeScript General Guidelines

### Basic Principles

- Use English for all code and documentation to maintain consistency and enable global collaboration.
- Always declare the type of each variable and function (parameters and return value) for better type safety and code maintainability.
  - Avoid using any as it defeats TypeScript's type checking benefits.
  - Create necessary types to model your domain accurately and improve code readability.
  - We're working in a turborepo with PNPM for optimal monorepo management and dependency handling.
- Use JSDoc to document public classes and methods. Include examples to demonstrate proper usage and edge cases.
- Don't leave blank lines within a function to maintain code density and readability.
- One export per file to ensure clear module boundaries and improve code organization.
- Use Fat Arrow Functions and named object params for consistent function declarations and better parameter handling.
  - Fat arrow functions provide lexical this binding and shorter syntax.
  - Named object params improve code readability and maintainability.
- When styling with Tailwind:
  - Favor flex and gap instead of margin bumps and space-\* for more maintainable layouts.
  - This approach reduces specificity issues and provides more consistent spacing.
  - Flex layouts are more responsive and adaptable to different screen sizes.

### Nomenclature

- Use PascalCase for classes.
- Use camelCase for variables, functions, and methods.
- Use kebab-case for file and directory names.
- Use UPPERCASE for environment variables.
  - Avoid magic numbers and define constants.
- Start each function with a verb.
- Use verbs for boolean variables. Example: isLoading, hasError, canDelete, etc.
- Use complete words instead of abbreviations and correct spelling.
  - Except for standard abbreviations like API, URL, etc.
  - Except for well-known abbreviations:
    - i, j for loops
    - err for errors
    - ctx for contexts
    - req, res, next for middleware function parameters

### Functions

- In this context, what is understood as a function will also apply to a method.
- Write short functions with a single purpose. Less than 20 instructions.
- Name functions with a verb and something else.
  - If it returns a boolean, use isX or hasX, canX, etc.
  - If it doesn't return anything, use executeX or saveX, etc.
- Avoid nesting blocks by:
  - Early checks and returns.
  - Extraction to utility functions.
- Use higher-order functions (map, filter, reduce, etc.) to avoid function nesting.
  - Use arrow functions for simple functions (less than 3 instructions).
  - Use named functions for non-simple functions.
- Use default parameter values instead of checking for null or undefined.
- Reduce function parameters using RO-RO - THIS IS IMPORTANT. WE ARE A RO-RO HOUSEHOLD.
  - Use an object to pass multiple parameters.
  - Use an object to return results.
  - Declare necessary types for input arguments and output.
- Use a single level of abstraction.

### Data

- Don't abuse primitive types and encapsulate data in composite types.
- Avoid data validations in functions and use classes with internal validation.
- Prefer immutability for data.
  - Use readonly for data that doesn't change.
  - Use as const for literals that don't change.

### Classes

- Follow SOLID principles.
- Prefer composition over inheritance.
- Declare interfaces to define contracts.
- Write small classes with a single purpose.
  - Less than 200 instructions.
  - Less than 10 public methods.
  - Less than 10 properties.

### Prompting and LLM Generation

- Follow XML Format

### Feature Development Workflow

- Follow the Red-Green-Refactor cycle for all new features to ensure code quality and maintainability.
- Start with a todo.md file in the feature directory to plan development.

  - Break down features into testable units for focused development.
  - Prioritize test cases based on business value and dependencies.
  - Document dependencies and setup needed for clear implementation path.
  - Define type requirements and interfaces for type safety.

- Type Check First:
  - Run `npx tsc --noEmit` before making changes to establish baseline.
  - Document existing type errors for tracking.
  - Plan type fixes based on error messages and dependencies.
  - Fix types in dependency order:
    1. Interfaces and type definitions first
    2. Implementation code second
    3. Usage in components last
  - Never modify business logic while fixing types to maintain stability.
  - Verify type fixes with another type check before proceeding.
- Write failing tests first (Red phase) to define expected behavior.
  - One test at a time to maintain focus and simplicity.
  - Verify test failure message clarity for better debugging.
  - Commit failing tests to track development progress.
- Write minimal code to pass tests (Green phase) to avoid over-engineering.
  - Focus on making tests pass with the simplest solution.
  - Avoid premature optimization to maintain development speed.
  - Commit passing implementation to establish working checkpoints.
- Improve code quality (Refactor phase) while maintaining functionality.
  - Extract reusable functions to promote code reuse.
  - Apply design patterns to improve code structure.
  - Maintain passing tests to ensure refactoring safety.
  - Commit refactored code to preserve improvements.
- Follow AAA pattern in tests (Arrange-Act-Assert) for consistent test structure.
- Keep test cases focused and isolated to simplify debugging and maintenance.
- Update documentation alongside code to maintain project clarity.

### Exceptions

- Use exceptions to handle errors you don't expect.
- If you catch an exception, it should be to:
  - Fix an expected problem.
  - Add context.
  - Otherwise, use a global handler.

### Pattern & decision documentation

Reusable patterns and toolchain decisions live in the repo's actual docs, not an ad-hoc `_learnings/` tree:

- Agent/skill/MCP conventions and dated decisions → [`docs/agentic/`](mdc:docs/agentic/) (+ `changelog/`).
- Product / architecture / database / technical specs → [`docs/PRD/`](mdc:docs/PRD/).
- Visual design language → [`docs/design/`](mdc:docs/design/).
- Per-area orientation → the nearest `CLAUDE.md`.

### React Query Patterns

- Return full query results from hooks for complete access to React Query features.
- Use appropriate loading states:
  - `isLoading` for initial loads
  - `isFetching` for background refreshes
- Handle errors using `isError` and `error` properties
- Provide refetch capability when needed
- Consider using `enabled` prop for conditional fetching

### Monorepo Dependencies

- Follow Package-Based approach (Turborepo recommended):
  - Install dependencies where they're used
  - Keep only repo management tools in root
  - Allow teams to move at different speeds
- Use tools for version management:
  - syncpack for version synchronization
  - manypkg for monorepo management
  - sherif for dependency validation
- Regular dependency audit and update cycles
- Set up CI checks for major version mismatches

### Component Architecture

- Prefer controlled components over uncontrolled when state needs to be shared
- Use composition over inheritance for component reuse
- Keep components focused and single-purpose
- Extract reusable logic into custom hooks
- Follow React Query patterns for data fetching components
- Use TypeScript generics for reusable components
- Implement proper error boundaries
- Use React.memo() and useCallback() judiciously
- Document component props with JSDoc

### Performance Patterns

- Implement proper code-splitting using dynamic imports
- Use React.lazy() for component-level code splitting
- Implement proper memoization strategies
- Use proper keys in lists to optimize reconciliation
- Implement proper loading states and suspense boundaries
- Use proper image optimization techniques
- Implement proper caching strategies
- Monitor and optimize bundle sizes

### Security Patterns

Security in this app is concrete, not generic: **RLS first** on every table (read policies filter `is_deleted = false`), **server-side role/membership re-checks** in route handlers for a clear 403 (never trust the client), the **three Supabase clients only** (admin client bypasses RLS only for documented privileged paths), and **no secrets in client storage or committed files** (env vars only — e.g. `${FIGMA_API_KEY}`). See the `route-handler-engineer` agent and [DATABASE_PRD §8](mdc:docs/PRD/DATABASE_PRD.md).

### Testing Patterns

- Configure Vitest coverage consistently across monorepo:
  - Use appropriate test environment per app (node/jsdom)
  - Set up multiple report formats
  - Define proper exclusion patterns
  - Configure environment-specific settings
- Follow Test-Driven Development (TDD):
  - Write failing tests first
  - Implement minimal passing code
  - Refactor while maintaining test coverage
- Write focused, isolated test cases
- Use proper mocking strategies
- Implement E2E tests for critical paths


### Testing Strategy

- Maintain a 60/40 split between integration and unit tests:
  - 60% Integration tests (CRUD operations and component integration)
  - 40% Unit tests (pure functions and isolated component behavior)

### Data Mutation Best Practices

These reflect the actual Supabase data layer (not generic ORM patterns):

- **Soft delete + ownership scoping.** Where a table supports it (`workspaces`, `workspace_members`, `recipes`, `menus`), delete by setting `is_deleted = true`. Always scope a mutation by workspace ownership — verify the row belongs to the caller's workspace before writing. RLS is the safety net; the route handler re-checks role/membership for a clear 403.
- **Preconditions before mutation.** Validate state first (role, membership, draft-vs-accepted, participant set, member-writable column set), then write.
- **Determinism boundary.** Menu/grocery writes flow through the single recompute path (`recomputeGroceryListsForMenu`); never mutate `accepted_seed`/`accepted_at` out of band. Member-writable columns (`menu_slots.cooked_at`, `grocery_items.note`) never trigger the engine or recompute.
- This repo does **not** use idempotency-key tables, `db.transaction` row-locking, or optimistic-`version` columns — those generic examples were removed. Concurrency safety comes from partial unique constraints + RLS. See the `route-handler-engineer` agent and [`packages/supabase/CLAUDE.md`](mdc:packages/supabase/CLAUDE.md).

### Test File Organization

1. **Component Tests**:
   - Location: Next to component files
   - Naming: `[ComponentName].test.tsx` for unit tests
   - Example:
   ```
   src/components/
   ├── UserCard/
   │   ├── UserCard.tsx
   │   └── UserCard.test.tsx        # Unit tests for isolated behavior
   ```

2. **Component Integration Tests**:
   - Location: Next to component files
   - Naming: `[ComponentName].integration.tsx`
   - Focus: Testing with real data fetching, RLS, and service interactions
   - Example:
   ```
   src/components/
   ├── UserCard/
   │   ├── UserCard.tsx
   │   └── UserCard.integration.tsx  # Tests with real Supabase/RLS
   ```

3. **API/Service Integration Tests**:
   - Location: `integration/` directory at app root
   - Grouped by feature/domain
   - Example:
   ```
   apps/web/
   ├── integration/
   │   ├── auth/
   │   │   ├── login.integration.ts
   │   │   └── signup.integration.ts
   │   └── organizations/
   │       ├── create.integration.ts
   │       └── invite.integration.ts
   ```

4. **E2E Tests**:
   - Location: `e2e/` directory at app root
   - Example:
   ```
   apps/web/
   ├── e2e/
   │   ├── auth.spec.ts
   │   └── organizations.spec.ts
   ```

### Test Type Guidelines

1. **Unit Tests** (40%):
   - Pure function behavior
   - Component rendering and events
   - Isolated hook logic
   - Mock all external dependencies

2. **Integration Tests** (60%):
   - CRUD operations with real database
   - Component tests with real data fetching
   - RLS policy verification
   - API endpoint behavior
   - Service interactions

3. **E2E Tests**:
   - Critical user journeys
   - Multi-step workflows
   - Cross-feature interactions

### Documentation Patterns

- Maintain clear documentation structure:
  - Place patterns in appropriate directories
  - Use consistent formatting
  - Include working examples
  - Document gotchas and edge cases
- Follow documentation templates:
  - Progress reports
  - Learning captures
  - Pattern documentation
- Keep documentation up-to-date with code changes
- Link to official resources and references

Whenever you are using dynamic route params, or cookies these need to be awaited, like this:
From next/headers:
`const cookieStore = await cookies();`

Whenever you are using params, the params are a promise and need to be awaited in dynamic routes, like this:

```tsx
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
}
````

For Supabase never use the `@supabase/auth-helpers-nextjs` package — we use the three clients in the `apps/web/utils/supabase` folder:

- supabaseAdminClient - `apps/web/utils/supabase/admin.ts`
- supabaseClient - `apps/web/utils/supabase/client.ts`
- supabaseServerClient - `apps/web/utils/supabase/server.ts`

Never inline ad-hoc Supabase calls in components and never use Supabase's own auth-helper hooks. Data access goes through these three clients and the per-table data layer: `packages/supabase/src/module/<table>.ts` (CRUD) + `<table>.react.ts` (TanStack Query hooks), scaffolded by the `add-module-and-hooks` skill / `supabase-module-author` agent. Modules **throw** on error; the component/feature layer surfaces feedback via `apps/web/lib/toast.ts` (`notifySuccess` / `notifyError`).

Always use the generated types from [database.types.ts](mdc:packages/supabase/src/database.types.ts) (and `database-functions.types.ts`) — imported through the package **barrel**, never a deep path:

```tsx
import { someHook } from "@weekly-food-planner/supabase"
const { data } = someHook()
```

### SQL Migration Style Guide (summary)

The full guide with worked examples lives in [`packages/supabase/CLAUDE.md`](mdc:packages/supabase/CLAUDE.md) — don't duplicate it here. The always-on invariants:

- **Always generate the file via the CLI** — `cd packages/supabase && npx supabase migration new <file_name>`. Never hand-create the filename or its timestamp.
- **Naming**: `[timestamp]_[type]_[action]_[subject]_[modifier].sql`, type ∈ `sys_` / `enum_` / `tbl_` / `trg_` / `rls_` / `fn_` / `idx_`; modifiers `_with_trigger` / `_with_index` / `_with_policy`.
- **Order** (within and across files): functions/RPCs → enums → tables (with their indexes + triggers) → RLS enable → RLS policies. Function-specific RLS + GRANTs live in the **same file** as the function.
- `SECURITY DEFINER` functions always `SET search_path = public`. Soft-delete tables (`workspaces`, `workspace_members`, `recipes`, `menus`) use partial unique indexes `WHERE is_deleted = false`.
- Regenerate types after a migration: `pnpm --filter @weekly-food-planner/supabase db:gen:types`.
