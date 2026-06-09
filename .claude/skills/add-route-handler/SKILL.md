---
name: add-route-handler
description: Scaffold a standard Next.js 15 App Router route handler (or server action) for the Weekly Food Planner with the project's required shape — the correct one of the three Supabase clients, awaited params/cookies(), a sibling Zod schema, workspace authorization (admin-role-gated OR any-member-gated), the structured { error, detail } envelope with correct status codes, and a pointer to the integration test that should cover it. Invoke when adding a REST-ish handler under apps/web/app/api/... or a server action whose auth/validation shape is standard CRUD on a workspace sub-resource, a read endpoint, or a narrow member-writable PATCH. Do NOT invoke for the menu-generation pipeline orchestration (multi-mode weekly/custom/clone, engine + grocery recompute) — that goes to the route-handler-engineer agent; schema/RPC/RLS go to supabase-migration-author; the CRUD module the handler calls goes to supabase-module-author / add-module-and-hooks.
---

# add-route-handler

Authoring a route handler in this repo is the same mechanical walk every time: await the params, pick the right Supabase client, authorize against the workspace, parse the body with a Zod schema that lives in a sibling file, run the work inside `runWithErrorHandler`, and return the structured error envelope with the right status code. Get one of those wrong — a forgotten `await params`, a 200 where a 403 belongs, an admin client where the caller's RLS context was correct — and the handler ships a security or correctness bug that looks fine in review. This skill emits a boilerplate-complete handler plus its `schema.ts` so the engineer fills in only the real logic. The `route-handler-engineer` agent is the judgement layer; this skill is the scaffolder it delegates the standard cases to.

## When to invoke

- A new CRUD sub-resource under [`apps/web/app/api/workspaces/[id]/...`](../../../apps/web/app/api/workspaces/) (e.g. a new `GET`/`POST`/`PATCH`/`DELETE` on a workspace-scoped table).
- A new read endpoint (`GET`) whose only job is authorize → load → return.
- A narrow **member-writable** `PATCH` — the v1.8 progress/annotation mutations (`menus/[menuId]/slots/[slotId]/cooked`, `grocery/items/[itemId]` note) where any member may write a tiny column set.
- A server action with the same authorize → validate → mutate shape.

## When NOT to invoke

- The menu-generation pipeline orchestration (multi-mode `weekly`/`custom`/`clone`, draft → accept → supersede, engine run + `recomputeGroceryListsForMenu`) → use the [`route-handler-engineer`](../../agents/route-handler-engineer.md) agent. Too much judgement for a scaffold.
- A schema change the handler depends on — new table, column, enum, RLS policy, RPC, trigger, index → [`supabase-migration-author`](../../agents/supabase-migration-author.md) agent (or [`supabase-add-column`](../supabase-add-column/SKILL.md) for a column).
- The CRUD module function the handler calls doesn't exist yet → [`supabase-module-author`](../../agents/supabase-module-author.md) agent / `add-module-and-hooks`. This skill **consumes** module functions; it never inlines new queries.
- A handler whose authorization isn't "any member" or "admin/creator" (e.g. cross-workspace, public, or per-row owner-only logic that isn't covered by the two standard gates) — hand to `route-handler-engineer` for the bespoke check.

If the change is mostly standard but has one non-standard wrinkle, the skill emits the standard scaffold and flags the wrinkle for the agent in the report.

## Input

The user supplies (or the skill asks for, one round of clarification only):

```yaml
endpoint: /api/workspaces/[id]/<resource>          # the route path, App Router bracket style
methods: [GET, POST, PATCH, DELETE]                # which verbs this route file exports
auth: admin | member                               # admin = creator/admin only; member = any workspace member
resource:
  table: snake_case_plural                         # the table the handler reads/writes, e.g. grocery_items
  module: "@weekly-food-planner/supabase"          # barrel import; name the module functions it calls
  moduleFns: [listX, getX, createX, updateX, softDeleteX]
client: server | admin                             # server = caller RLS context (DEFAULT); admin = bypass RLS (justify why)
writeColumns?: [col, col]                          # for member-writable PATCH: the ONLY columns it may touch
preconditions?:                                    # 412-worthy pre-engine / pre-mutate gates
  - code: menu_not_accepted
    when: "cooked toggle only valid on an accepted menu"
body?:                                             # the Zod body shape (omit for GET / DELETE with no body)
  - name: note
    zod: "z.string().trim().max(280).nullable()"
```

If the user describes the change in prose, ask **once** for: (a) the endpoint path + methods, (b) `admin` or `member` auth, (c) the table + module functions it calls, (d) for a member-writable PATCH, the exact narrow column set, (e) the body shape. Then proceed.

## Authoritative repo references

Read before generating; if a shape has changed since this skill was written, follow the live file.

| Reference | Why |
|---|---|
| [`.claude/agents/route-handler-engineer.md`](../../agents/route-handler-engineer.md) | The judgement layer this skill scaffolds for. Three-client table, the handler skeleton, error codes (401/403/404/412/422/500), and the v1.8 "Member-writable menu/grocery mutations" rules. This skill must not contradict it. |
| [`apps/web/app/api/workspaces/[id]/members/route.ts`](../../../apps/web/app/api/workspaces/[id]/members/route.ts) | Canonical CRUD route — `GET` (member-gated read) + `POST` (admin-gated create). Mirror its import order, helper names, and `runWithErrorHandler` wrapping. |
| [`apps/web/app/api/workspaces/[id]/members/[memberId]/route.ts`](../../../apps/web/app/api/workspaces/[id]/members/[memberId]/route.ts) | Canonical nested route with `GET`/`PATCH`/`DELETE`, awaited multi-param `params`, and a load-then-authorize-detail pattern. |
| [`apps/web/lib/api/auth-helpers.ts`](../../../apps/web/lib/api/auth-helpers.ts) | The auth primitives: `getAuthenticatedUser()` (returns `{ id, email, supabase }`), `getWorkspaceRole({ supabase, userId, workspaceId })` (returns `'creator' \| 'admin' \| 'member' \| null`), `hasAdminRole(role)`. Never re-query `workspace_members` inline. |
| [`apps/web/lib/api/responses.ts`](../../../apps/web/lib/api/responses.ts) | The envelope helpers: `jsonOk`, `jsonError(status, code, detail?)`, `unauthorized()`, `forbidden()`, `notFound()`, `badRequest(detail)`, `serverError(detail)`. The envelope is `{ error, detail? }`. |
| [`apps/web/lib/api/route-helpers.ts`](../../../apps/web/lib/api/route-helpers.ts) | `runWithErrorHandler(fn)` — wrap the mutate/read body so uncaught throws become a 500 `server_error`. |
| [`apps/web/lib/api/members.ts`](../../../apps/web/lib/api/members.ts) | Canonical sibling schema module: Zod body schemas + `formatZodError(error)` for the `badRequest` detail string. New schema files mirror this shape. |
| [`apps/web/app/api/workspaces/[id]/menus/[menuId]/slots/[slotId]/route.ts`](../../../apps/web/app/api/workspaces/[id]/menus/[menuId]/slots/[slotId]/route.ts) | A handler that uses the admin client (RLS bypass) with a `// why` comment, loads-then-validates, and returns precondition errors. |
| [`apps/web/CLAUDE.md`](../../../apps/web/CLAUDE.md) — Route handlers | App Router conventions: single export per file, fat-arrow, awaited async APIs. |
| [`docs/PRD/ARCHITECTURE_PRD.md`](../../../docs/PRD/ARCHITECTURE_PRD.md) §9 | The API surface / resource layout — where the new route belongs in the tree. |

## Steps

1. **Confirm the route doesn't already exist.** `Glob` for `apps/web/app/api/<path>/route.ts`. If it exists, this is a modify, not a create — read it first and edit in place rather than overwriting.
2. **Confirm the module functions exist.** `Grep` the barrel ([`packages/supabase/src/index.ts`](../../../packages/supabase/src/index.ts)) for the named `moduleFns`. If any are missing, emit the scaffold against the expected names and **hand the module authoring to `supabase-module-author`** in the report — do not inline a query.
3. **Pick the auth gate.**
   - `admin` → `const role = await getWorkspaceRole(...)` then `if (!hasAdminRole(role)) return forbidden()`.
   - `member` → same lookup then `if (!role) return forbidden()` (any of `creator | admin | member` passes; only non-members are rejected). This is the **one** correct place for "member is enough" — the v1.8 cooked-toggle and grocery-note mutations.
   - Mixed within a file (e.g. `GET` member-gated, `POST` admin-gated): apply the gate per verb, as `members/route.ts` does.
4. **Pick the Supabase client.** Default `user.supabase` (caller RLS context). Use `supabaseAdminClient()` **only** when the work genuinely must bypass RLS (generation persistence, overlay dedup, soft-delete override) — and emit a `// why` comment above the call. A standard CRUD read/write uses the caller context.
5. **Emit the sibling `schema.ts`.** Path: next to the route, named for the resource (e.g. `apps/web/lib/api/<resource>.ts` following the `members.ts` precedent, OR a colocated `schema.ts` in the route folder). Export one Zod schema per body shape, a `z.infer` type alias, and reuse `formatZodError` for the `badRequest` detail. PATCH schemas `.refine(...)` to require at least one field.
6. **Emit the handler.** Order inside every verb, no exceptions:
   1. `const { id: workspaceId, ... } = await params` — **always await**.
   2. `const user = await getAuthenticatedUser(); if (!user) return unauthorized()`.
   3. Authorize (step 3 gate). **Before** parsing the body.
   4. Parse body with `safeParse`; on failure `return badRequest(formatZodError(parsed.error))` (422-class invalid body — see status note below).
   5. `return runWithErrorHandler(async () => { ... })` wrapping load + precondition checks + mutate. Return `notFound()` for a missing/soft-deleted/cross-workspace row, the relevant `jsonError(412, code, ...)` for a failed precondition, and `jsonOk(...)` on success.
7. **Enforce the narrow column set** for member-writable PATCH. The update payload touches **only** the `writeColumns`. Never let it become a back door to recipe/slot/quantity edits. No engine run, no `recomputeGroceryListsForMenu`, no `accepted_seed` change — these columns are progress/annotation only.
8. **Point at the integration test.** `Glob` `apps/web/integration/*.integration.test.ts`. Name the test that should cover the handler (happy path + the role/membership matrix + each precondition) and hand authoring to `vitest-integration-author`.
9. **Report** in the structure below.

## Report structure

```markdown
## Route handler `<METHODS> <endpoint>`

### Files emitted

- `apps/web/app/api/<path>/route.ts` — the handler.
- `apps/web/lib/api/<resource>.ts` (or `.../route folder/schema.ts`) — the Zod schema(s).

### Auth & client

- Gate: <admin (hasAdminRole) | member (any role)>. Why: <one line>.
- Client: <user.supabase (caller RLS) | supabaseAdminClient (bypass — reason)>.

### Status codes this handler can return

- 401 unauthorized — no authenticated user.
- 403 forbidden — <not a member | not admin/creator>.
- 404 not_found — row missing / soft-deleted / cross-workspace.
- 412 <precondition_code> — <when> (omit if none).
- 422/400 bad_request — Zod validation failed.
- 500 server_error — uncaught throw (via runWithErrorHandler).

### Hand-offs

- Missing module functions → `supabase-module-author`.
- Schema / RLS the handler relies on → `supabase-migration-author`.
- Integration test → `vitest-integration-author` (file: `apps/web/integration/<name>.integration.test.ts`).
- Anything non-standard flagged below → `route-handler-engineer` agent.

### Flags

- <e.g. admin client used — confirm the RLS bypass is intended>
- <e.g. precondition needs a column that doesn't exist yet>
```

## Non-negotiables

- **Never import `@supabase/auth-helpers-nextjs`.** The three clients ([client.ts](../../../apps/web/utils/supabase/client.ts), [server.ts](../../../apps/web/utils/supabase/server.ts), [admin.ts](../../../apps/web/utils/supabase/admin.ts)) are the only Supabase entry points. Route handlers use `user.supabase` (server context) by default or `supabaseAdminClient()` with a justifying comment.
- **Always `await params` and `await cookies()`.** Next.js 15 makes them async — forgetting is a runtime error. Destructure at the top of every verb.
- **Authorize before validate before mutate.** No body parse before the role check; no mutation before both pass.
- **Validate with Zod in a sibling file.** The schema never lives inline in the handler. Reuse `formatZodError` for the `badRequest` detail string.
- **Structured envelope, correct status.** Errors return `{ error, detail? }` via the `responses.ts` helpers. 401 no user, 403 wrong role/non-member, 404 not found, 412 precondition failed, 422/400 invalid body, 500 unexpected. Never a bare 200 on a rejected request.
- **Member-writable handlers authorize on membership (`if (!role)`), not role.** They touch only their narrow column set and never trigger the engine, a grocery recompute, or an `accepted_seed` change. Note preservation on recompute is the recompute path's job, not these handlers'.
- **Consume modules; never inline CRUD.** If a needed module function is absent, name it and hand off to `supabase-module-author`.
- **Wrap the body in `runWithErrorHandler`.** Loads and mutations go inside it so an uncaught throw becomes a clean 500 instead of leaking a stack trace.
- **No drive-by changes.** The skill emits the handler + schema only. Surface unrelated issues in the report; do not fix them here.

## What to flag in the report

- **Admin client usage.** Any `supabaseAdminClient()` call gets a `// why` comment and a report flag — confirm the RLS bypass is genuinely required and isn't masking a missing policy.
- **Missing module functions.** If `moduleFns` aren't in the barrel, the scaffold references names that don't exist yet. Flag and route to `supabase-module-author` so the handler compiles.
- **Preconditions that need a column or RPC that doesn't exist.** E.g. a cooked toggle needs `menu_slots.cooked_at`/`cooked_by`; a note needs `grocery_items.note`. If the schema isn't there, the handler can't ship — flag and route to `supabase-migration-author`.
- **Member-writable scope creep.** If the requested `writeColumns` include anything beyond progress/annotation (recipe, slot assignment, quantities, plan), stop — that's not a standard member-writable mutation. Flag it for `route-handler-engineer`.
- **Anything that looks like pipeline orchestration.** If the handler would run the engine or recompute grocery lists, it's out of scope — hand the whole thing to `route-handler-engineer`.
- **Cross-workspace or owner-only auth.** If the standard `admin`/`member` gates don't capture the real rule, scaffold the closest gate and flag the bespoke check.

## Example

See [`docs/examples/grocery-item-note.md`](./docs/examples/grocery-item-note.md) for a worked output: the v1.8 **membership-gated** `PATCH /api/workspaces/[id]/grocery/items/[itemId]` that sets/clears `grocery_items.note`. It shows the `if (!role)` membership gate, the narrow single-column write, the Zod schema, the structured envelope, and the integration-test pointer. Use it as the template for the handler + schema shape.
