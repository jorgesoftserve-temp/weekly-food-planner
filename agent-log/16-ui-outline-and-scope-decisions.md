# Step 16 — UI work outlined; scope cuts agreed before coding

## Prompt used

See [/prompts/16-ui-outline-request.txt](../prompts/16-ui-outline-request.txt).

Summary: with the API + tests + CI + initial commit landed, the user asked for an outline of the UI tasks required to deliver the basic-flow pages (register/login → recipe CRUD → menu CRUD → grocery listing → export). No code in this cycle — pure planning.

## Context files provided

- The conversation history through step 15, plus the on-disk state of [apps/web/](../apps/web/) (Next.js shell, auth pages from step 09, no UI components installed yet, plain Tailwind home page).
- The API surface delivered through step 15 — 14+ route handlers covering workspaces, members, recipes, menus, grocery, export (markdown + CSV), labels, admin seeds.
- [.cursor/rules/query-patterns.md](../.cursor/rules/query-patterns.md) — the documented `xxx.ts` + `xxx.react.ts` CRUD/hook pairing that step 12 deferred.

## Expected output

A six-phase outline (delivered as a chat reply, not a checked-in document):

1. **Phase 0 — Foundation**: install shadcn primitives via the CLI; add `react-hook-form` + `zod` + `@hookform/resolvers`; build the `.react.ts` query/mutation hooks deferred in step 12; create the authenticated app shell; add a workspace context provider that picks the user's first workspace; add cross-cutting UI primitives (loading skeleton, empty state, toast helper).
2. **Phase 1 — Auth polish**: verify the existing login/signup pages end-to-end, add a logout action, wire route protection in the middleware, redirect post-login to the dashboard.
3. **Phase 2 — Recipe CRUD**: recipe list page, create form, ingredient picker, label combobox, edit + soft-delete.
4. **Phase 3 — Menus**: generation form, active menu view, regenerate (replace flow), failure-handling for `empty_workspace` + `no_valid_recipe`.
5. **Phase 4 — Grocery list**: aggregated view for the active menu, handles shared + per-member shapes and the always-null `scheduled_purchase_day`.
6. **Phase 5 — Export**: markdown + CSV download buttons hitting the existing export route.
7. **Phase 6 — Verify, document, ship**: walk the flow in a real browser via the `/verify` skill, add empty states + loading skeletons + toast feedback, update docs, commit.

Three open decisions surfaced for the user to call when reached:

- **Layout pattern** — header + sidebar vs. header-only with top tabs.
- **CRUD form pattern** — modal dialogs vs. full-page routes.
- **MVP scope cuts** — overlay UI, member-management UI, password reset, multi-workspace switcher.

User answer (in [prompts/17-start-ui-basic-flow.txt](../prompts/17-start-ui-basic-flow.txt)): **defer all four scope cuts** — overlay UI, member management, password reset, multi-workspace switcher. Decisions on layout and CRUD form pattern to be made when those tasks are reached.

## Observed issue

- **No code changes in this cycle by design**, but the cycle is still load-bearing for future agents: it pins the scope cuts (the four deferred items) so a later cycle that "adds member management because the engine supports it" can be cross-checked against this decision.
- **Outline lives in chat, not in [docs/](../docs/)**. Considered checking in a `docs/UI_PLAN.md` but the [agentic-rules.md](../.cursor/rules/agentic-rules.md) prompt-as-`.txt` + per-cycle agent-log convention already preserves the plan inside this file. A separate doc would duplicate without adding value.
- **Granularity choice**: kept the outline at task-granularity (numbered work units) rather than file-granularity (paths + contracts), per the user's "show me an outline" framing. File-level specifics will land inside the per-phase cycle logs that follow.

## Follow-up fixes

- Phase 0 begins in step 17 with shadcn primitive install, deps, `.react.ts` companions, UI primitives, and workspace context — paused at the app-shell task to surface the layout decision per the user's "I'll input the decision when we reach it" instruction.
- Open decisions still to be made when each task is reached:
  - Layout pattern (Phase 0, app shell task).
  - CRUD form pattern (Phase 2, recipe create task).
- The four deferred items remain in the API surface (engine supports them, route handlers exist) so re-enabling any of them is a UI-only addition. Re-evaluate after the basic flow ships.
