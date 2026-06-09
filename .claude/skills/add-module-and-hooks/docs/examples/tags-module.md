# Worked example — new module pair for `tags`

Scenario: a `tags` table has already been migrated and is present in `database.types.ts`, but has no TypeScript data layer. It's a workspace-scoped, soft-deletable lookup table users attach to recipes. We promote it to a full module pair.

Input spec:

```yaml
table: tags
scope: workspace
softDelete: true
columns:
  - name: name
    type: text
    nullable: false
    inCreate: true
    inUpdate: true
  - name: color
    type: text
    nullable: true
    inCreate: true
    inUpdate: true
children: []
extraInvalidations: []
```

Derived `Row` shape (read from `database.types.ts`):

```ts
tags: {
  Row: {
    id: string
    workspace_id: string
    name: string
    color: string | null
    is_deleted: boolean
    created_at: string
    updated_at: string
  }
  // Insert / Update omitted for brevity
}
```

---

## New data-layer module pair for `tags`

### Preconditions verified
- `tags` present in `database.types.ts`: yes (under `Tables`).
- No existing `module/tags.ts`: confirmed via `Glob`.
- Scope: workspace; soft-delete: true.

### `packages/supabase/src/module/tags.ts` (new)

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

export type TagRecord = {
  id: string
  name: string
  color: string | null
}

export type CreateTagPayload = {
  name: string
  color?: string | null
}

export type UpdateTagPatch = Partial<{
  name: string
  color: string | null
}>

// Static-array form — for server-component prefetch (cannot call functions during render).
export const tagQueryKeys = {
  list: (workspaceId: string) => ['tags', 'list', workspaceId] as const,
  detail: (workspaceId: string, tagId: string) =>
    ['tags', 'detail', workspaceId, tagId] as const,
}

// Function form — for client-side invalidation. Produces the same array shape.
export const tagKeys = {
  list: (workspaceId: string) => ['tags', 'list', workspaceId] as const,
  detail: (workspaceId: string, tagId: string) =>
    ['tags', 'detail', workspaceId, tagId] as const,
}

const TAG_SELECT = 'id, name, color'

export const listTags = async ({
  supabase,
  workspaceId,
}: {
  supabase: SupabaseClient
  workspaceId: string
}): Promise<TagRecord[]> => {
  const { data, error } = await supabase
    .from('tags')
    .select(TAG_SELECT)
    .eq('workspace_id', workspaceId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as TagRecord[]
}

export const getTag = async ({
  supabase,
  workspaceId,
  tagId,
}: {
  supabase: SupabaseClient
  workspaceId: string
  tagId: string
}): Promise<TagRecord | null> => {
  const { data, error } = await supabase
    .from('tags')
    .select(TAG_SELECT)
    .eq('id', tagId)
    .eq('workspace_id', workspaceId)
    .eq('is_deleted', false)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as TagRecord | null) ?? null
}

export const createTag = async ({
  supabase,
  workspaceId,
  payload,
}: {
  supabase: SupabaseClient
  workspaceId: string
  payload: CreateTagPayload
}): Promise<{ id: string }> => {
  const { data: row, error } = await supabase
    .from('tags')
    .insert({
      workspace_id: workspaceId,
      name: payload.name,
      color: payload.color ?? null,
    })
    .select('id')
    .single()
  if (error || !row) {
    throw new Error(error?.message ?? 'failed to create tag')
  }
  return { id: (row as { id: string }).id }
}

export const updateTag = async ({
  supabase,
  workspaceId,
  tagId,
  patch,
}: {
  supabase: SupabaseClient
  workspaceId: string
  tagId: string
  patch: UpdateTagPatch
}): Promise<void> => {
  if (Object.keys(patch).length === 0) throw new Error('no fields to update')
  const { error } = await supabase
    .from('tags')
    .update(patch)
    .eq('id', tagId)
    .eq('workspace_id', workspaceId)
  if (error) throw new Error(error.message)
}

export const softDeleteTag = async ({
  supabase,
  workspaceId,
  tagId,
}: {
  supabase: SupabaseClient
  workspaceId: string
  tagId: string
}): Promise<void> => {
  const { error } = await supabase
    .from('tags')
    .update({ is_deleted: true })
    .eq('id', tagId)
    .eq('workspace_id', workspaceId)
  if (error) throw new Error(error.message)
}
```

Notes on the choices:

- `TAG_SELECT` is an explicit constant — `is_deleted`, `workspace_id`, `created_at`, `updated_at` are intentionally **not** selected; they're plumbing, not part of the record the UI renders. `TagRecord` matches the select field-for-field.
- Soft delete is `update({ is_deleted: true })`, not a hard `DELETE`, because the spec says `softDelete: true`. Reads filter `.eq('is_deleted', false)`.
- Every function is RO-RO and fat-arrow. One concern per function.
- Both `tagQueryKeys` (static) and `tagKeys` (function) are emitted — the static form is for server prefetch, the function form for client invalidation, and both produce `['tags', 'list', workspaceId]`.

### `packages/supabase/src/module/tags.react.ts` (new)

```ts
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createTag,
  getTag,
  listTags,
  softDeleteTag,
  tagKeys,
  updateTag,
  type CreateTagPayload,
  type TagRecord,
  type UpdateTagPatch,
} from './tags.js'

export const useTagsList = ({
  supabase,
  workspaceId,
  enabled = true,
}: {
  supabase: SupabaseClient
  workspaceId: string | null
  enabled?: boolean
}): UseQueryResult<TagRecord[]> =>
  useQuery({
    queryKey: tagKeys.list(workspaceId ?? ''),
    queryFn: () => listTags({ supabase, workspaceId: workspaceId! }),
    enabled: enabled && !!workspaceId,
  })

export const useTagDetail = ({
  supabase,
  workspaceId,
  tagId,
  enabled = true,
}: {
  supabase: SupabaseClient
  workspaceId: string | null
  tagId: string | null
  enabled?: boolean
}): UseQueryResult<TagRecord | null> =>
  useQuery({
    queryKey: tagKeys.detail(workspaceId ?? '', tagId ?? ''),
    queryFn: () =>
      getTag({ supabase, workspaceId: workspaceId!, tagId: tagId! }),
    enabled: enabled && !!workspaceId && !!tagId,
  })

const invalidateTagCaches = ({
  queryClient,
  workspaceId,
  tagId,
}: {
  queryClient: ReturnType<typeof useQueryClient>
  workspaceId: string
  tagId?: string
}) => {
  void queryClient.invalidateQueries({ queryKey: tagKeys.list(workspaceId) })
  if (tagId) {
    void queryClient.invalidateQueries({
      queryKey: tagKeys.detail(workspaceId, tagId),
    })
  }
}

export const useCreateTag = ({
  supabase,
  workspaceId,
}: {
  supabase: SupabaseClient
  workspaceId: string
}): UseMutationResult<{ id: string }, Error, CreateTagPayload> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateTagPayload) =>
      createTag({ supabase, workspaceId, payload }),
    onSuccess: () => invalidateTagCaches({ queryClient, workspaceId }),
  })
}

export const useUpdateTag = ({
  supabase,
  workspaceId,
  tagId,
}: {
  supabase: SupabaseClient
  workspaceId: string
  tagId: string
}): UseMutationResult<void, Error, UpdateTagPatch> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: UpdateTagPatch) =>
      updateTag({ supabase, workspaceId, tagId, patch }),
    onSuccess: () => invalidateTagCaches({ queryClient, workspaceId, tagId }),
  })
}

export const useSoftDeleteTag = ({
  supabase,
  workspaceId,
}: {
  supabase: SupabaseClient
  workspaceId: string
}): UseMutationResult<void, Error, { tagId: string }> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ tagId }: { tagId: string }) =>
      softDeleteTag({ supabase, workspaceId, tagId }),
    onSuccess: (_data, variables) =>
      invalidateTagCaches({
        queryClient,
        workspaceId,
        tagId: variables.tagId,
      }),
  })
}
```

Notes on the choices:

- Hooks key off the **function** form (`tagKeys.list(...)`), matching `members.react.ts`.
- The shared `invalidateTagCaches` helper centralises the cache-bust so every mutation stays consistent. There are no `extraInvalidations` here because `tags` doesn't feed another module's read model; if it did (e.g. a dashboard card reading through `workspaces`), this helper would also invalidate `workspaceKeys.detail(workspaceId)` — exactly what `invalidateMemberCaches` does.
- Each hook is RO-RO; `useSoftDeleteTag` takes `{ tagId }` as the mutation variable so the caller doesn't bind it at hook-construction time (it varies per row).

### Barrel edits

`packages/supabase/src/index.ts` — add alongside the other module exports:

```ts
export * from './module/tags.js'
```

`packages/supabase/src/react.ts` — add alongside the other react exports:

```ts
export * from './module/tags.react.js'
```

### Commands to run

```sh
# Types are already current (tags is in database.types.ts) — no regen needed.
# Sanity-check the new files compile against the package:
pnpm --filter @weekly-food-planner/supabase typecheck
```

### Hand-offs

- Route handler exposing tags CRUD over HTTP → `route-handler-engineer` agent (Zod schemas for `CreateTagPayload` / `UpdateTagPatch`, role re-check on mutations).
- CRUD feature folder at `apps/web/app/(app)/tags/` → [`feature-folder-scaffold`](../../../feature-folder-scaffold/SKILL.md) skill (it imports `useTagsList` / `useCreateTag` / … from `@weekly-food-planner/supabase/react`).
- Integration test (CRUD + RLS + role matrix) → `vitest-integration-author` agent.

### Flags

- **No CRUD-layer toasts.** Following the live convention in `members.ts` / `recipes.ts` / `profiles.ts`, the CRUD functions throw `Error` and let the consuming component surface the toast — `tags.ts` does not import `sonner`. If you want toasts at this layer, say so and they can be added.
- **No child relations.** `tags` is a flat scalar table, so there are no `set*` junction helpers and no `sys_save_label` routing. If a future migration adds, say, a `tag_dietary_restrictions` junction storing an extensible label, add a `setTagDietaryRestrictions` helper modelled on `setMemberDietaryRestrictions` and a matching `useSetTagDietaryRestrictions` hook.
- **`color` is free-form text.** It is not an extensible label (no enum_metadata backing), so it is written directly with no `sys_save_label` call — correct for an arbitrary hex/string value.
```

