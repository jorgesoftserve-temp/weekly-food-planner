# Worked example — promote the Members mock into the live Members screen

Concrete promotion: graduate [members-mock.tsx](../../../../../apps/web/app/(design)/design-lab/_components/members-mock.tsx) into the live [app/(app)/members/page.tsx](../../../../../apps/web/app/(app)/members/page.tsx). The mock renders warm member cards (avatar + accent ring, accent-tinted role badge, dietary/allergy chips) inside `CozyShell`, off `MOCK_MEMBERS`, with in-card clicks via `useLabNav()`. The live page today is a desktop-first `Table` off `useMembersList()` with real loading/empty/error/role gating.

This example shows what a good promotion plan looks like. Use it as the output template. Annotations in `> blockquotes` call out *why* each choice was made — they are not part of the emitted plan.

> **Why Members first?** It is the cleanest promotion in the lab: it exercises every stage (tokens, data, nav, shell/imagery/a11y, retire) yet has a real `useMembersList()` hook already, so Stage B is mostly field-reconciliation rather than a blocking data-layer prerequisite. The one genuinely interesting gap — `MockMember.accent` vs. `profiles.accent_color` — is exactly the kind of Stage-B gap the skill exists to surface.

---

## Promote: `members-mock.tsx` → `apps/web/app/(app)/members/page.tsx`

### Summary

Graduate the cozy member-card grid from the design lab into the live Members page, replacing the desktop-first `Table` with the approved image-forward card layout. The live `useMembersList()` hook already exists, so the data swap is mostly field reconciliation; the one real dependency is the per-member accent, which the mock fakes from `MockMember.accent` but the live app must source from each member's owner `profiles.accent_color`. Blocks on the coordinated cozy token move (Stage A) if it has not landed yet.

### Prerequisites

1. **Token move (Stage A)** — the `[data-skin="cozy"]` tokens (`--radius` `1rem`, `--radius-pill`, `--shadow-{sm,md,lg}`, `--success`/`--warning` + tints, `.cozy-card`/`.cozy-lift`) must already be promoted into [globals.css](../../../../../apps/web/app/globals.css) + [tailwind.config.ts](../../../../../apps/web/tailwind.config.ts) and the shadcn `card`/`button` restyled. **Owner: `design-system-architect`** — one coordinated move, not per-screen. If undone, this is prerequisite #1 and blocks the screen.
2. **Real hooks (Stage B)** — `useMembersList()` exists ([members.react.ts](../../../../../packages/supabase/src/module/members.react.ts)); ✅ no new list hook needed. **But** the member's accent color is not on `MemberRecord` — see Gap 1. That accent join/lookup is a Stage-B prerequisite owned by the data layer.

> The skill forces both prerequisites to the top because either one, if missing, makes the rest of the plan unrunnable. Naming the owner (`design-system-architect` / data layer) keeps the promotion from silently absorbing work that belongs to another agent.

### Mock-element → live mapping

| Mock element (file:area) | Cozy source (class / inline style) | Live token / class | Data / route source |
|---|---|---|---|
| Page shell | `<CozyShell active="members" title="Members">` | none — drop it; `app/(app)/layout.tsx` already wraps live pages | n/a (Stage D) |
| Page header + "Add member" | bare `<button … bg-primary … cozy-shadow-sm>` | `PageHeader` + shadcn `Button` (now pill + `shadow-sm` after restyle) | role-gated: `canManage` from `useActiveWorkspace()` |
| Member card | `.cozy-card .cozy-lift … bg-card` | restyled shadcn `Card` (`rounded-2xl` + `shadow-md`) + hover-lift variant (reduced-motion-safe) | one `MemberRecord` from `useMembersList()` |
| Avatar + accent ring | `MockImage` + `style={memberRingStyle(m.accent)}` (inline HSL) | `next/image` (circle, `object-cover`) + `ring-user-accent` / `--user-accent` token | `member.avatar` (real upload) + owner `profiles.accent_color` (Gap 1) |
| Name dot | `style={memberDotStyle(m.accent)}` (inline HSL) | accent dot via `--user-accent` token utility | owner `accent_color` (Gap 1) |
| Role badge | `style={memberAccentStyle(m.accent)}` (inline HSL) | accent-tinted badge via `--user-accent-tint` / `text-accent-strong` tokens | `member.role` (real); accent from owner (Gap 1) |
| Dietary chips | `bg-muted … text-muted-foreground` | same (already tokens) | `member.member_dietary_restrictions` |
| Allergy chips | `bg-warning-tint … text-warning` (lab utilities) | promoted `bg-warning-tint` / `text-warning` semantic classes (Stage A) | `member.member_allergies` |
| Card click | `onClick={() => navigate('profile')}` (`useLabNav`) | `useRouter().push('/members/[id]')` or edit `Sheet`/`Dialog` via `useExclusiveOverlay` | matches existing live edit affordance |

> The table is the load-bearing artifact. Every inline `style={...}` in the right-hand columns is flagged because the non-negotiable is "tokens only" — except the per-member accent, which is *allowed* on these member-tied surfaces but must still route through the `--user-accent*` token family, never a literal HSL string baked into the component.

### Stage-by-stage deltas

- **`[A] Tokens`** — screen consumes: restyled `Card` (`rounded-2xl` + `shadow-md` + hover-lift), `Button` (pill + `shadow-sm`), `bg-warning-tint` / `text-warning`, and the `--user-accent*` family for the accent ring/dot/badge. No per-screen token edits — the values come from the coordinated `design-system-architect` move. If that move is undone, Stage A is prerequisite #1.
- **`[B] Data`** — the live page already reads `useMembersList({ supabase, workspaceId, enabled: !!workspace })`; **keep it**. Replace the `Table` body with the card grid. Field reconciliation vs. the mock: `MockMember.dietary` → `member.member_dietary_restrictions`; `MockMember.allergies` → `member.member_allergies`; `MockMember.ageCategory` → `member.age_category` (snake→display via the existing `.replace(/_/g, ' ')`); `MockMember.initials` → derive from `member.name`; `MockMember.accent` → owner `profiles.accent_color` (**Gap 1**). Keep the existing loading `Skeleton`, `EmptyState` (error + empty), and `canManage` gating — the mock has none of these and must not lose them.
- **`[C] Navigation`** — `navigate('profile')` on a card → the live edit affordance the page already has (`setEditTarget({ mode: 'edit', memberId })` opening `MemberFormDialog`), routed through `useExclusiveOverlay` so it never coexists with the delete dialog. Drop the `useLabNav` import. The lab sidebar nav (`navigate('recipes')` etc.) disappears with `CozyShell`.
- **`[D] Shell / imagery / responsive / a11y`** — drop `CozyShell`; the promoted page returns the existing `<div className="mx-auto flex w-full max-w-6xl flex-col gap-6">` body. `MockImage` → `next/image` (circle avatar, `object-cover`, remote pattern for the avatar host + initials fallback preserved). Responsive: keep the mock's `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`; this *replaces* the table's horizontal-scroll problem, so no `md:hidden` reconciliation needed. A11y: each card becomes a real actionable control with an accessible name (`aria-label={`Edit ${member.name}`}` — the mock uses a bare `<button>`); preserve the token focus ring and the `motion-reduce` guard on the hover-lift.
- **`[E] Retire`** — after verification: delete [members-mock.tsx](../../../../../apps/web/app/(design)/design-lab/_components/members-mock.tsx); remove its entry from the lab screen registry ([screens.tsx](../../../../../apps/web/app/(design)/design-lab/_components/screens.tsx)) and the `members` `lab-nav` key; prune `MOCK_MEMBERS` + the `memberAccentStyle`/`memberDotStyle`/`memberRingStyle` helpers from [mock-data.ts](../../../../../apps/web/app/(design)/design-lab/_components/mock-data.ts) **only if** no other mock still imports them (the dashboard mock does use members — verify before pruning). Do **not** tear down the whole `/design-lab` route here — that is the final step after the *last* screen promotes.

> Stage E is deliberately conservative: it prunes shared `mock-data.ts` exports only after confirming no sibling mock consumes them, because deleting `MOCK_MEMBERS` while `dashboard-mock.tsx` still imports it would break the lab for the not-yet-promoted screens — a "never regress live styling mid-flight" sibling violation, applied to the lab itself.

### Gaps + risks

1. **`MockMember.accent` has no live source on `MemberRecord`.** The mock assigns each member one of six accents from static data; live, the accent belongs to the member's *owner user* via `profiles.accent_color`, which is not joined into the members read. **Resolution:** decide the product rule first — does a non-owner member even *have* an accent? If yes, extend the members read (or a lightweight profiles lookup) to surface it; if the accent is only the logged-in user's, render other members' rings/badges in a neutral token and reserve accent for the current user. Either way it is a data-layer decision. **Owner: data layer (`add-module-and-hooks` / `supabase-module-author`) + a product call from `ux-reviewer`.** Until resolved, render member accents from a neutral token so the screen ships.
2. **Avatar host not in `next/image` remote patterns.** The mock uses `pravatar.cc`; real avatars come from Supabase Storage. **Resolution:** the live screen must point at the real avatar URL and add that host to `next.config` remote patterns; keep the initials fallback. **Owner: `ui-component-builder` (+ a config edit).**
3. **Inline-style leakage.** `memberAccentStyle` / `memberDotStyle` / `memberRingStyle` return inline HSL `style` objects — deliberate in the lab, disallowed live. **Resolution:** replace all three with `--user-accent*` token utilities (`ring-user-accent`, `bg-accent-tint`, `text-accent-strong`); no `style={...}` survives except where a genuinely per-member dynamic value must be set, and even then via a CSS custom property, not a literal hex. **Owner: this promotion (`ui-component-builder`).**
4. **Card as a button vs. nested actions.** The mock makes the whole card a `<button>` that navigates; live, the card also needs an edit/delete menu (existing `DropdownMenu`). A button-inside-button is invalid. **Resolution:** make the card a `<div>` (or `next/link`) with a distinct actions control, mirroring the live page's per-row `DropdownMenu`. **Owner: this promotion; a11y verified by `accessibility-auditor`.**

### Files touched

- **Modified:** [apps/web/app/(app)/members/page.tsx](../../../../../apps/web/app/(app)/members/page.tsx) (table → card grid; keep hook + states + gating), and likely a new [members/_components/member-card.tsx](../../../../../apps/web/app/(app)/members/) for the card.
- **Deleted (Stage E):** [members-mock.tsx](../../../../../apps/web/app/(design)/design-lab/_components/members-mock.tsx); its registry entry in [screens.tsx](../../../../../apps/web/app/(design)/design-lab/_components/screens.tsx); pruned `MOCK_MEMBERS` + accent helpers in [mock-data.ts](../../../../../apps/web/app/(design)/design-lab/_components/mock-data.ts) *(only if unused elsewhere)*.
- **Token layer (prerequisite, if undone):** [globals.css](../../../../../apps/web/app/globals.css), [tailwind.config.ts](../../../../../apps/web/tailwind.config.ts) — **owned by `design-system-architect`**, not this promotion.
- **Data layer (Gap 1, if accent surfaced):** members read or a profiles lookup — **owned by the data-layer skill/agent**, not this promotion.

### Verification

- `pnpm typecheck && pnpm test` green.
- Playwright MCP screenshots of the live `/members` at 390 / 820 / 1440px match the approved mock (card grid, no horizontal scroll).
- Light + dark parity: accent ring/badge, `shadow-md`, and `bg-warning-tint`/`text-warning` all render correctly in both modes.
- Reduced-motion: the card hover-lift is suppressed under `prefers-reduced-motion`.
- `accessibility-auditor` AA sign-off (focus rings, accessible names on cards + actions, contrast of accent-tinted badges). `ux-reviewer` confirms the edit/delete flow is at least as discoverable as the table's.

### Proposed promotion order

1. **`design-system-architect`** — coordinated token move (Stage A) into `globals.css` + `tailwind.config.ts` + shadcn `card`/`button` restyle, **if not already done**. Output: promoted tokens + semantic classes. Blocks everything below.
2. **Data layer (`add-module-and-hooks` / `supabase-module-author`)** — resolve Gap 1: surface the member accent (or decide it is current-user-only). Output: read shape + the product rule. Blocks the accent UI; the rest of the card can proceed with a neutral accent.
3. **`ui-component-builder`** — rebuild [members/page.tsx](../../../../../apps/web/app/(app)/members/page.tsx) as the card grid (new `member-card.tsx`), keep `useMembersList()` + loading/empty/error + `canManage`, swap `useLabNav` → existing edit affordance via `useExclusiveOverlay`, `MockImage` → `next/image`, replace inline accent styles with `--user-accent*` token utilities. Output: live screen.
4. **`accessibility-auditor`** + **`ux-reviewer`** — AA + flow sign-off. Output: pass/fixes.
5. **Retire (Stage E)** — delete the mock + deregister + prune shared mock data (verified unused). Output: lab no longer lists Members. Owner: this promotion, gated on step 4 green.

> The order is runnable end-to-end: no step depends on a later one. Step 2's accent gap is allowed to lag because step 3 can ship with a neutral accent and backfill the real one — the skill notes that explicitly so the promotion is not held hostage to a product decision.

### Out of scope (deferred)

- The other lab screens (Dashboard, Recipes, Menu, Grocery) — each is its own single-screen promotion plan.
- The final `/design-lab` route + `design-lab.css` teardown — only after the **last** screen promotes.
- Mock-only functionality with no schema (grocery per-line note, Cook-mode) — not part of Members; deferred pending `supabase-migration-author` schema sign-off.
- Authoring the cozy tokens themselves (`design-system-architect`) and the accent data shape (data layer) — prerequisites, not this promotion's work.
