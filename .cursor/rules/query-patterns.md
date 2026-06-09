---
description: How to use tanstack-query with our NextJS setup
globs: 
---
# Tanstack Query and Next.js Patterns

## Hydration and Server/Client Data Flow

The data flow from server to client involves three key steps:

1. **Server Prefetching**: Server components prefetch data using static query keys
2. **Dehydration**: The query cache is serialized into the HTML/JSON response
3. **Client Hydration**: The client rehydrates the prefetched data using matching query keys

### Example Implementation:

```typescript
// Server Component (page.tsx)
export default async function Page() {
  const queryClient = createQueryClient();
  const supabase = await createClient();

  // 1. Prefetch data on server
  await queryClient.prefetchQuery({
    queryKey: ["teams", "list"],
    queryFn: () => getTeams({ supabase }),
  });

  // 2. Dehydrate the cache
  const dehydratedState = dehydrate(queryClient);

  // 3. Pass to client component
  return (
    <ClientComponent state={dehydratedState} />
  );
}

// Client Component
function ClientComponent({ state }: { state: DehydratedState }) {
  return (
    // 4. Hydrate the cache on client
    <HydrationBoundary state={state}>
      <YourComponent />
    </HydrationBoundary>
  );
}

// Child component automatically gets access to prefetched data
function YourComponent() {
  // Uses the same data prefetched on server
  const { data } = useQuery({
    queryKey: teamKeys.lists(),
    queryFn: () => getTeams({ supabase }),
  });
}
```

### Best Practices:

1. **Always wrap client components** with `HydrationBoundary` when using prefetched data
2. **Match query keys** between server and client to ensure data is found
3. **Handle loading states** while hydration is occurring
4. **Use Suspense boundaries** around hydrated components for better loading UX

## Why Static Query Keys for Server Components?

Server components in Next.js cannot execute functions during rendering because:

1. Server components are rendered once on the server
2. The output is static HTML/JSON
3. Function calls could be unpredictable or have side effects

This means we need two patterns for query keys:

```typescript
// ❌ Won't work in server components (function call)
queryKey: teamKeys.lists();

// ✅ Works in server components (static value)
queryKey: ["teams", "list"];
// or
queryKey: teamQueryKeys.lists;
```

### Example Implementation:

```typescript
// Client-side: Functions for dynamic values
export const teamKeys = {
  lists: () => ["teams", "list"] as QueryKey, // Function for client components
  list: (filters) => ["teams", "list", filters],
};

// Server-side: Static arrays
export const teamQueryKeys = {
  lists: ["teams", "list"], // Static array for server components
  list: (filters) => ["teams", "list", filters],
};

// Usage in server component (page.tsx)
await queryClient.prefetchQuery({
  queryKey: teamQueryKeys.lists,
  queryFn: () => getTeams({ supabase }),
});

// Usage in client component
const { data } = useQuery({
  queryKey: teamKeys.lists(),
  queryFn: () => getTeams({ supabase }),
});
```

Both patterns generate the same array structure, allowing React Query to match prefetched data between server and client.

We have CRUD layer and custom hooks like this (the `teams` names above are illustrative — the real canonical examples are `recipes` and `members`):
[recipes.react.ts](mdc:packages/supabase/src/module/recipes.react.ts)
[recipes.ts](mdc:packages/supabase/src/module/recipes.ts)

Each postgres table has custom hooks within the packages/supabase/module folder. New module pairs are scaffolded by the `add-module-and-hooks` skill / `supabase-module-author` agent.

**Error + toast convention (matches the live code):** the data-layer `module/<table>.ts` functions **throw** on error (`throw new Error(error.message)`) and never import a toast library. The `<table>.react.ts` hooks return the raw query/mutation result. User-facing success/error toasts are the **component/feature layer's** job, via `notifySuccess` / `notifyError` from `apps/web/lib/toast.ts` (a `sonner` wrapper) — never inline `toast(...)`, never `react-hot-toast`, never toast at the data layer.


