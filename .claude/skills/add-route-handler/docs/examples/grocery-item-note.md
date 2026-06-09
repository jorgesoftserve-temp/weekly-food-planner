# Worked example — `PATCH /api/workspaces/[id]/grocery/items/[itemId]` (set/clear shopper note)

A v1.8 **membership-gated** mutation. Any workspace member (not just creator/admin) may attach a free-text note to a grocery item — e.g. "buy the oat one" — per [PRODUCT_PRD §7.2](../../../../docs/PRD/PRODUCT_PRD.md). It touches **only** `grocery_items.note`: no engine run, no grocery recompute, no `accepted_seed` change. This is the canonical shape for the narrow member-writable PATCH.

Input spec:

```yaml
endpoint: /api/workspaces/[id]/grocery/items/[itemId]
methods: [PATCH]
auth: member                          # any workspace member — annotation, not a plan edit
resource:
  table: grocery_items
  module: "@weekly-food-planner/supabase"
  moduleFns: [getGroceryItem, updateGroceryItemNote]
client: server                        # caller RLS context; RLS already scopes to the member's workspace
writeColumns: [note]                  # the ONLY column this handler may write
body:
  - name: note
    zod: "z.string().trim().max(280).nullable()"   # null clears the note
```

> Flags surfaced by the skill while scaffolding this: `updateGroceryItemNote` is not yet in the barrel, and `grocery_items.note` may not exist as a column. Both are routed below.

---

## Route handler `PATCH /api/workspaces/[id]/grocery/items/[itemId]`

### Files emitted

#### `apps/web/lib/api/grocery-items.ts` (sibling Zod schema)

```ts
import { z } from 'zod'

// A shopper note is free text up to 280 chars; null clears it. The handler
// authorizes on membership and writes ONLY grocery_items.note — see
// PRODUCT_PRD §7.2 and the route-handler-engineer "Member-writable" rules.
export const updateGroceryItemNoteBodySchema = z.object({
  note: z.string().trim().max(280).nullable(),
})

export type UpdateGroceryItemNoteBody = z.infer<
  typeof updateGroceryItemNoteBodySchema
>

// Single-line error message for the badRequest() detail — keeps the 400
// response shape consistent with the rest of the API.
export const formatZodError = (error: z.ZodError): string =>
  error.issues
    .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
    .join('; ')
```

> The repo already exports a `formatZodError` from [`apps/web/lib/api/members.ts`](../../../../apps/web/lib/api/members.ts). Prefer importing the existing one rather than redefining it; it is reproduced here only so the example reads standalone. In real output, `import { formatZodError } from '@/lib/api/members'`.

#### `apps/web/app/api/workspaces/[id]/grocery/items/[itemId]/route.ts`

```ts
import { type NextRequest } from 'next/server'
import {
  getGroceryItem,
  updateGroceryItemNote,
} from '@weekly-food-planner/supabase'
import {
  getAuthenticatedUser,
  getWorkspaceRole,
} from '@/lib/api/auth-helpers'
import { formatZodError } from '@/lib/api/members'
import { updateGroceryItemNoteBodySchema } from '@/lib/api/grocery-items'
import {
  badRequest,
  forbidden,
  jsonOk,
  notFound,
  unauthorized,
} from '@/lib/api/responses'
import { runWithErrorHandler } from '@/lib/api/route-helpers'

type RouteParams = { id: string; itemId: string }

// PATCH sets or clears the free-text shopper note on a single grocery item.
// Member-writable (v1.8): ANY workspace member may annotate — this is the one
// place "member is enough" is correct. It writes ONLY grocery_items.note;
// it never edits quantities, ingredients, or the plan, and never triggers a
// grocery recompute. Note preservation across an unrelated recompute is the
// recompute path's job, not this handler's. See PRODUCT_PRD §7.2.
export const PATCH = async (
  request: NextRequest,
  { params }: { params: Promise<RouteParams> },
) => {
  const { id: workspaceId, itemId } = await params
  const user = await getAuthenticatedUser()
  if (!user) return unauthorized()

  // Membership gate, NOT hasAdminRole: creator | admin | member all pass;
  // only a non-member (role === null) is rejected.
  const role = await getWorkspaceRole({
    supabase: user.supabase,
    userId: user.id,
    workspaceId,
  })
  if (!role) return forbidden()

  const raw = await request.json().catch(() => null)
  const parsed = updateGroceryItemNoteBodySchema.safeParse(raw)
  if (!parsed.success) return badRequest(formatZodError(parsed.error))

  return runWithErrorHandler(async () => {
    // Caller-context (RLS) client: the read confirms the item belongs to this
    // workspace and is visible to the member before we write.
    const item = await getGroceryItem({
      supabase: user.supabase,
      workspaceId,
      itemId,
    })
    if (!item) return notFound()

    // Narrow write: ONLY the note column. The module function must not accept
    // any other field — keeping the back-door closed is a module-level
    // guarantee, re-asserted here by the call shape.
    await updateGroceryItemNote({
      supabase: user.supabase,
      workspaceId,
      itemId,
      note: parsed.data.note,
    })
    return jsonOk({ updated: true, note: parsed.data.note })
  })
}
```

### Auth & client

- Gate: **member** (`if (!role) return forbidden()`). A shopper note is an annotation any participant should be able to add; per the v1.8 member-writable rule this is one of exactly two membership-gated menu/grocery mutations.
- Client: **`user.supabase`** (caller RLS context). No admin bypass — RLS already scopes the read and the write to the member's own workspace. There is no legitimate reason to reach for `supabaseAdminClient()` here.

### Status codes this handler can return

- 401 `unauthorized` — no authenticated user.
- 403 `forbidden` — caller is not a member of the workspace (`role === null`).
- 404 `not_found` — item missing, soft-deleted, or belongs to another workspace.
- 400 `bad_request` — body failed Zod validation (note > 280 chars, wrong type).
- 500 `server_error` — uncaught throw, via `runWithErrorHandler`.

(No 412 — there are no preconditions; a note can be set whether the menu is draft or accepted.)

### Hand-offs

- **Module functions** `getGroceryItem` + `updateGroceryItemNote` don't exist yet → `supabase-module-author` agent (or [`add-module-and-hooks`](../../../add-module-and-hooks/SKILL.md) if the grocery module is being scaffolded fresh). `updateGroceryItemNote` must accept only `{ supabase, workspaceId, itemId, note }` and update only the `note` column — no general-purpose `updateGroceryItem` that could touch quantity.
- **`grocery_items.note` column** must exist with the matching RLS allowing member writes scoped to that single column → [`supabase-add-column`](../../../supabase-add-column/SKILL.md) for the column, `supabase-migration-author` agent for the member-write RLS policy.
- **Integration test** → `vitest-integration-author`, file `apps/web/integration/grocery-item-note.integration.test.ts`. Cover: a plain `member` can set and clear the note (happy path + null clears); a non-member gets 403; a note on another workspace's item gets 404; an over-length note gets 400; and a subsequent unrelated recompute preserves the note (keyed by list scope + ingredient_id).

### Flags

- **Schema dependency.** This handler cannot ship until `grocery_items.note` exists and its RLS allows member writes to just that column. The migration must land first.
- **Module narrowness.** Insist `updateGroceryItemNote` is note-only. If a generic `updateGroceryItem` is authored instead, the member-writable back-door rule is violated — the column set must stay narrow at the data layer too.
- **No recompute.** Confirm nothing in the write path calls `recomputeGroceryListsForMenu`. Notes are annotation; recompute is a separate, service-role concern.
