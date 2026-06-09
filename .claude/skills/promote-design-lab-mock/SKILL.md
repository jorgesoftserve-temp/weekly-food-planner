---
name: promote-design-lab-mock
description: Produce the deterministic, screen-by-screen promotion plan to graduate an approved /design-lab mock into the live app — map the scoped cozy tokens to the promoted real tokens, swap mock-data.ts for the real TanStack Query hooks, replace lab-nav context navigation with real Next.js routing, apply responsive + a11y, and retire the mock. Invoke when promoting an approved design-lab screen or component into apps/web/app/(app); this is v1.8 "Phase 3" work. Do NOT invoke to author a brand-new component with no mock (use ui-component-builder), to change the design tokens or cozy spec itself (use design-system-architect), for a11y sign-off (use accessibility-auditor), for product-UX review (use ux-reviewer), or to write new data-layer hooks (use supabase-module-author / add-module-and-hooks).
---

# promote-design-lab-mock

Given one approved screen mock under [apps/web/app/(design)/design-lab/_components/](../../../apps/web/app/(design)/design-lab/_components/), produce a structured **promotion plan** that graduates it into the real live screen under [apps/web/app/(app)/](../../../apps/web/app/(app)/). This is exactly v1.8 **Phase 3** (see [.claude/plans/v1.8.md](../../../.claude/plans/v1.8.md) "Phase 3"): the cozy direction has been approved in the lab and now lands in the live app.

Output is a markdown plan plus concrete, deterministic file targets and token/hook mappings — like [menu-generation-impact-review](../menu-generation-impact-review/SKILL.md), this is primarily a **planning + scaffolding** skill, not a code-only generator. It walks a fixed five-stage mapping and emits the file-by-file diff list so the parent session (or the right agent) can execute each piece. It does not itself write the design tokens (that is `design-system-architect`) or new data hooks (that is the data-layer skill/agent) — it sequences and targets the promotion.

## When to invoke

- **Promoting one approved mock screen** (e.g. the Members, Dashboard, Recipes, Menu, or Grocery mock) into its live counterpart.
- **Promoting one approved mock component** (e.g. a cozy member card) into a live `_components/` folder.
- **Pre-flighting a promotion** to see the full token + data + routing + a11y surface before any code is written.
- **Resuming a stalled promotion** — re-run to find the remaining mapping gap (usually a mock element with no live token or hook yet).

## When NOT to invoke

- Authoring a brand-new component that has **no** mock → use the [`ui-component-builder`](../../agents/ui-component-builder.md) agent.
- Changing the design tokens, the cozy spec, the gradient utilities, or the per-user accent mechanism itself → use the [`design-system-architect`](../../agents/design-system-architect.md) agent. (This skill *consumes* the promoted tokens; it does not author them.)
- Accessibility sign-off on the promoted screen → use the [`accessibility-auditor`](../../agents/accessibility-auditor.md) agent.
- Product-UX review of the promoted flow → use the [`ux-reviewer`](../../agents/ux-reviewer.md) agent.
- A pure data-layer change (a new table module + hooks the mock needs but that does not exist yet) → use the `supabase-module-author` agent / `add-module-and-hooks` skill, then come back here.
- The `design-lab` direction has **not** been approved yet → it is still Phase 2; do nothing live.

## Input

The user names the mock to promote. If underspecified, ask **one** batched clarification covering all unknowns at once — never loop. Useful clarifications:

- **Which mock?** The `_components/<name>-mock.tsx` file (e.g. `members-mock.tsx`).
- **Token move already done?** Have the cozy tokens already been promoted into `globals.css` by `design-system-architect`, or does this promotion need to depend on that move first? (The token move is **one coordinated step**, not per-screen — see Non-negotiables.)
- **Real hooks exist?** Does the target table already have a `packages/supabase/src/module/<table>.react.ts` with the list/detail/mutation hooks the screen needs, or is a data-layer prerequisite outstanding?
- **Component or full screen?** Promoting the whole screen, or just one card/widget out of it.

If the user just names a mock in prose, anchor on that one mock. Do not promote more than one screen per plan — promotion is screen-by-screen by design.

## Authoritative repo references

Read these before producing the plan. If a referenced file's shape differs from this skill's snippets, **follow the live file**.

| Reference | Why it matters |
|---|---|
| [.claude/plans/v1.8.md](../../../.claude/plans/v1.8.md) "Phase 3" | The promotion intent + sequencing (tokens → primitives → live screens → retire the lab). |
| [docs/design/cozy-restyle-spec.md](../../../docs/design/cozy-restyle-spec.md) | The Phase-2→3 contract: the cozy token deltas (radius `1rem`, pill radius, soft warm shadow scale, roomier padding), per-primitive deltas, status palette, motion, guardrails. The single coordinated token move comes from here. |
| [docs/design/color-palette.md](../../../docs/design/color-palette.md) | Base color tokens (unchanged by the cozy move — shape/depth/density only). |
| [docs/design/v1.8-ui-mockups.md](../../../docs/design/v1.8-ui-mockups.md) | Per-screen wireframe intent the mock realizes. |
| [docs/design/user-accent-colors.md](../../../docs/design/user-accent-colors.md) | The six per-user accents + the rule that accent appears **only** on member-tied surfaces. |
| [apps/web/app/(design)/design-lab/design-lab.css](../../../apps/web/app/(design)/design-lab/design-lab.css) | The SCOPED `[data-skin="cozy"]` tokens (`--shadow-*`, `--success`/`--warning` + `*-tint`, `.cozy-card` / `.cozy-lift` / `.cozy-shadow-*`). The source the promotion maps FROM. |
| [apps/web/app/globals.css](../../../apps/web/app/globals.css) | Where the promoted real tokens land (`:root` + `.dark`, gradients, per-user accent helpers). The target the promotion maps TO. |
| [apps/web/tailwind.config.ts](../../../apps/web/tailwind.config.ts) | Where promoted tokens become semantic classes (`boxShadow.{sm,md,lg}`, `borderRadius.pill`, `success`/`warning` colors). |
| [apps/web/app/(design)/design-lab/_components/mock-data.ts](../../../apps/web/app/(design)/design-lab/_components/mock-data.ts) | The static seed data the live hooks replace. Note the `MockRecipe`/`MockMember` shapes vs. the real `*Record` types. |
| [apps/web/app/(design)/design-lab/_components/lab-nav.tsx](../../../apps/web/app/(design)/design-lab/_components/lab-nav.tsx) | The `useLabNav()` context navigation the live `next/link` + `useRouter()` replace. |
| [apps/web/app/(design)/design-lab/_components/cozy-shell.tsx](../../../apps/web/app/(design)/design-lab/_components/cozy-shell.tsx) | The presentational shell the mock renders inside. The live screen drops it — the real `app/(app)/layout.tsx` shell already wraps live pages. |
| [apps/web/app/(design)/design-lab/_components/mock-image.tsx](../../../apps/web/app/(design)/design-lab/_components/mock-image.tsx) | Plain `<img>` + fallback. Phase 3 swaps to `next/image` with remote patterns + real upload/persistence. |
| [apps/web/app/(app)/](../../../apps/web/app/(app)/) | The live screens the mocks map onto (dashboard / menu / recipes / grocery / members / settings). The promotion target. |
| [apps/web/CLAUDE.md](../../../apps/web/CLAUDE.md) | App conventions: single export per file, fat-arrow, kebab-case, `cn()`, `flex`+`gap-*`, shadcn via CLI, co-located `_components/`. |
| [.cursor/rules/query-patterns.md](../../../.cursor/rules/query-patterns.md) | Server-prefetch static key + client function-key hydration, hooks return full query result, mutations toast at the module layer. |
| [packages/supabase/src/module/](../../../packages/supabase/src/module/) | The real `<table>.ts` + `<table>.react.ts` hooks (e.g. [members.react.ts](../../../packages/supabase/src/module/members.react.ts)) the mock data is swapped for. |

## Steps

1. **Anchor.** Restate which mock is being promoted in one sentence and name its live target page. If vague, ask one batched clarification.
2. **Read the mock + its target.** Read the `_components/<name>-mock.tsx`, the slice of [mock-data.ts](../../../apps/web/app/(design)/design-lab/_components/mock-data.ts) it consumes, and the live page under `app/(app)/<feature>/`. Note what the live page already does (loading skeleton, empty state, error state, role gating) — the promotion must preserve those.
3. **Walk the five-stage mapping** (next section) end-to-end. For each stage, emit the concrete deltas with file paths.
4. **Build the mock-element → live mapping table.** One row per visually-distinct mock element: the cozy class/inline style it uses → the promoted token/class it becomes → the data/route source. This is the load-bearing artifact.
5. **Identify gaps + risks.** Anything with no live token, no real hook, or new functionality the schema doesn't support yet (e.g. grocery per-line note, Cook-mode). Name it and route it to the owning agent. These block the promotion.
6. **Sequence the promotion.** Smallest runnable order; the coordinated token move precedes any screen that depends on the promoted tokens.
7. **Emit the retire step.** How to remove the mock + its `/design-lab` entry — and the gate that must pass first (live screen verified).
8. **Report** in the structure below.

## The five-stage mapping — walk all five

### Stage A — Tokens: scoped cozy → promoted real

The cozy skin lives under `[data-skin="cozy"]` in [design-lab.css](../../../apps/web/app/(design)/design-lab/design-lab.css). Promotion moves these into [globals.css](../../../apps/web/app/globals.css) `:root` + `.dark` and exposes them in [tailwind.config.ts](../../../apps/web/tailwind.config.ts) as semantic classes — owned by `design-system-architect`, performed as **one coordinated move** per the [cozy-restyle-spec](../../../docs/design/cozy-restyle-spec.md), NOT re-derived per screen.

- `--radius: 0.65rem` → `1rem`; add `--radius-pill: 9999px` → Tailwind `borderRadius.pill` (`rounded-pill`).
- `--shadow-sm/md/lg` (warm-tinted, layered; dark variants) → `:root`/`.dark`; Tailwind `boxShadow.{sm,md,lg}` → `shadow-sm`/`shadow-md`/`shadow-lg`.
- `--success` (moss) / `--warning` (tuscan) + `*-tint`, light + dark → `:root`/`.dark`; Tailwind `colors.success`/`colors.warning` (+ tint). The lab's bare `.bg-success-tint` / `.text-success` / `.bg-warning-tint` / `.text-warning` utilities become semantic Tailwind classes.
- `.cozy-card` (radius + `shadow-md`) → the restyled shadcn `card` `cva`/wrapper; `.cozy-lift` hover → card hover variant (reduced-motion-safe); `.cozy-shadow-sm/lg` → `shadow-sm`/`shadow-lg`.
- The per-screen plan **lists which promoted tokens the screen consumes**; it does not redefine them. If the token move has not happened, Stage A is a **prerequisite dependency** owned by `design-system-architect`, sequenced first.

### Stage B — Data: mock-data.ts → real TanStack Query hooks

The mock imports static arrays/types from [mock-data.ts](../../../apps/web/app/(design)/design-lab/_components/mock-data.ts). The live screen reads from `packages/supabase/src/module/<table>.react.ts` hooks per [query-patterns.md](../../../.cursor/rules/query-patterns.md).

- Map each mock collection → its real hook (e.g. `MOCK_MEMBERS` → `useMembersList({ supabase, workspaceId })`).
- Map each mock type → its real record type from the barrel (`MockMember` → `MemberRecord` imported from `@weekly-food-planner/supabase`). Reconcile field deltas (mock `dietary: string[]` vs. real `member_dietary_restrictions`, `accent: AccentKey` vs. `profiles.accent_color`).
- Wire **loading** (skeleton), **empty** (`EmptyState`), and **error** states — the mock has none; the live page must (mirror the existing live page).
- Get `workspaceId` from `useActiveWorkspace()` and `supabase` from `useSupabase()` — never thread mock props.
- If a hook does not exist, that is a Stage-B gap → `supabase-module-author` / `add-module-and-hooks` skill prerequisite. This skill never writes the hook.

### Stage C — Navigation: lab-nav context → real Next.js routing

The mock calls `useLabNav()` (a context that swaps mock screens like a Figma prototype — [lab-nav.tsx](../../../apps/web/app/(design)/design-lab/_components/lab-nav.tsx)). The live screen uses real routing.

- `navigate('recipes')` (sidebar) → the live sidebar already routes; the promoted screen drops the lab sidebar entirely (see Stage E).
- `navigate('profile')` / `navigate('recipe-detail')` (in-content clicks) → `next/link` `href` or `useRouter().push('/recipes/[id]')` against the real route map.
- Card/row clicks that open a mock screen → the live equivalent (a route, or a `Sheet`/`Dialog` via `useExclusiveOverlay` if the live screen models it as an overlay — see [apps/web/hooks/use-exclusive-overlay.ts](../../../apps/web/hooks/use-exclusive-overlay.ts)).
- Drop the `LabNavProvider`/`useLabNav` import entirely from the promoted file.

### Stage D — Shell, imagery, responsive, a11y

- **Shell:** the mock wraps itself in `CozyShell`; the live page does **not** — `app/(app)/layout.tsx` already provides the real sidebar + header. The promoted screen returns just the page body (mirror the existing live page's root `<div className="mx-auto … max-w-… flex flex-col gap-…">`).
- **Imagery:** mock `MockImage` (plain `<img>` + offline fallback) → `next/image` with remote patterns configured + the deterministic icon fallback (`recipe-icon.ts` logic) preserved; real upload/persistence per the spec. Aspect ratios from the cozy-restyle-spec (recipe card 4:3, detail hero 16:9, thumbs square, avatar circle).
- **Responsive:** keep the mock's `sm:`/`md:`/`lg:` grid intent; ensure the live screen still has its phone reflow (the mock often *is* the reflow target). Verify at 390 / 820 / 1440px per v1.8.
- **A11y:** real buttons/links get accessible names (the mock sometimes uses bare `<button>`); preserve focus rings (token-based), `aria-label`s on icon-only controls, reduced-motion on `cozy-lift`. Final sign-off is `accessibility-auditor` — this plan lists the checks, it does not certify them.

### Stage E — Retire the mock

Only **after** the live screen is verified (typecheck + test + visual at the three widths):

- Delete `_components/<name>-mock.tsx`.
- Remove its entry from the lab screen registry ([_components/screens.tsx](../../../apps/web/app/(design)/design-lab/_components/screens.tsx)) and any `lab-nav` key referencing it.
- Prune any now-unused slice of [mock-data.ts](../../../apps/web/app/(design)/design-lab/_components/mock-data.ts) **only if** no remaining mock uses it.
- When the **last** mock is promoted, retire the whole `(design)/design-lab/` route + `design-lab.css` and remove the scoped-token block — but that is a final, separate step, not part of a single-screen promotion.

## Report structure

Emit a single markdown document with these sections in this order:

```markdown
## Promote: <mock file> → <live page path>

### Summary
2–4 sentences. Which screen, what it unlocks live, what it depends on (token move? new hook?).

### Prerequisites
- Token move (Stage A) done? If not → `design-system-architect` first.
- Real hooks (Stage B) exist? If not → data-layer skill/agent first.
- (Each prerequisite names the owner and blocks the rest.)

### Mock-element → live mapping
Table. One row per visually-distinct element:

| Mock element (file:area) | Cozy source (class/inline) | Live token/class | Data / route source |
|---|---|---|---|
| Member card | `.cozy-card .cozy-lift`, `memberRingStyle()` | `rounded-pill`/restyled `Card` + hover-lift; accent ring via `--user-accent` token | `useMembersList()` → `MemberRecord`; click → `/members/[id]` overlay |
| ... | ... | ... | ... |

### Stage-by-stage deltas
For each of A–E, the concrete file changes with paths. Skip a stage only if it genuinely doesn't apply (say so).

- `[A] Tokens` — screen consumes: `shadow-md`, `rounded-pill`, `bg-success-tint`/`text-success`. Token move owned by `design-system-architect` (one coordinated move). No per-screen token edits.
- `[B] Data` — replace `MOCK_MEMBERS` with `useMembersList({ supabase, workspaceId })` in [members/page.tsx](apps/web/app/(app)/members/page.tsx). Add loading/empty/error. Field reconciliation: `<list>`.
- `[C] Navigation` — `navigate('profile')` → `useRouter().push(...)` / `Sheet`. Drop `useLabNav`.
- `[D] Shell/imagery/responsive/a11y` — drop `CozyShell`; `MockImage` → `next/image`; accessible names on `<list>`; reduced-motion preserved.
- `[E] Retire` — delete `<mock>`, deregister from `screens.tsx`, prune unused `mock-data` slice. Gate: live screen verified.

### Gaps + risks
Numbered. Each: one-line title + 1–3 sentences + concrete resolution + owning agent.

1. **<Mock element> has no live token/hook/schema.** ... Resolution: ... Owner: `<agent>`.

### Files touched
- New / modified: `apps/web/app/(app)/<feature>/page.tsx`, `_components/*`.
- Deleted (Stage E): `_components/<name>-mock.tsx`, registry entry.
- Token layer (prerequisite, if not done): `globals.css`, `tailwind.config.ts` — owned by `design-system-architect`.

### Verification
- `pnpm typecheck && pnpm test`.
- **`design-parity-auditor` sign-off** (runs the [`design-lab-parity-check`](../design-lab-parity-check/SKILL.md) skill): live vs. mock at 390 / 820 / 1440px × light/dark — structural + token fidelity. This gates retiring the mock.
- Light + dark + reduced-motion parity preserved.
- `accessibility-auditor` AA sign-off; `ux-reviewer` flow check.

### Proposed promotion order
Numbered. Each step: owning agent, output, what the next depends on. Token move first if outstanding; retire last after verification.

### Out of scope (deferred)
Mock-only functionality with no schema yet (grocery per-line note, Cook-mode data model), other screens, the final lab teardown.
```

## Non-negotiables

- **Tokens only — no inline hex or raw radii in live components.** The design-lab used inline HSL deliberately (per-member accent on *other* members via `memberAccentStyle()` etc.); live code uses tokens, Tailwind semantic classes, and `cn()`. The one carve-out — per-member accent on member-tied surfaces — still goes through the `--user-accent*` token family, never a literal hex.
- **The token move is one coordinated step, not per-screen.** Do not promote `--success` / `--warning` / cozy radii / shadows ad hoc inside a screen promotion. They come from the [cozy-restyle-spec](../../../docs/design/cozy-restyle-spec.md) as a single `design-system-architect` move. A screen plan *consumes* them and lists Stage A as a prerequisite if undone.
- **Promote screen-by-screen; never regress live styling mid-flight.** One mock per plan. While a mock is mid-promotion the other live screens keep working — the scoped `[data-skin="cozy"]` lab and the live app coexist until the last screen lands.
- **Dark-mode + reduced-motion parity must survive promotion.** Every promoted surface keeps its `.dark` token values and its `motion-reduce:` guards (the `cozy-lift` hover especially). No light-only or motion-only regressions.
- **Per-member accent stays only on member-tied surfaces.** Selectors, role badges, dots, member-card rings — never CTAs, never destructive, never global chrome. Promotion must not spread accent beyond where the mock used it.
- **Retire the mock only after the live screen is verified.** Delete `_components/<name>-mock.tsx` + its `/design-lab` registry entry only once typecheck + test + the `design-parity-auditor` three-width × light/dark pass are green. The lab is the fallback reference until then.
- **No new data hooks, no new tokens authored here.** This skill sequences and targets; it does not write `globals.css` tokens (→ `design-system-architect`) or `<table>.react.ts` hooks (→ data-layer skill/agent). If either is missing, it is a prerequisite, not part of this plan.
- **No code.** Like `menu-generation-impact-review`, the skill emits a plan + concrete targets, not the component file. The owning agents write the code.

## What to flag in the report

- **Outstanding token move.** If `[data-skin="cozy"]` tokens are not yet in `globals.css`, the entire promotion blocks on the coordinated `design-system-architect` move. Flag it as prerequisite #1.
- **Missing real hook or record field.** A mock element backed by data the real module does not expose yet (e.g. `MockMember.accent` before `profiles.accent_color` is joined into the members read) is a Stage-B gap. Name the field and the owning data-layer task.
- **Mock-only functionality with no schema.** Grocery per-line note/substitution and Cook-mode were explicitly deferred to Phase 3 pending schema sign-off (v1.8 plan). If the mock shows them, flag that the live promotion cannot ship them until the schema lands → `supabase-migration-author`.
- **Inline-style leakage.** Any `style={...}` in the mock that is NOT the deliberate per-member accent must become a token/class on promotion. Flag each one.
- **Shell double-wrap.** If the promoted screen accidentally keeps `CozyShell`, it nests inside the live shell. Flag to ensure the promoted file returns only the page body.
- **Responsive regression.** If the mock's grid breakpoints differ from the live page's existing phone reflow, reconcile them — do not silently drop the live `md:hidden` card-list variant.

## Example

See [docs/examples/members-screen-promotion.md](./docs/examples/members-screen-promotion.md) for a worked promotion plan for the Members screen (`members-mock.tsx` → `app/(app)/members/page.tsx`), with the full mock-element → live-token/hook/component mapping table, the stage-by-stage deltas, the gaps, and the retire step. Use it as the template for the report shape.
