---
name: design-lab-parity-check
description: Deterministically capture the Playwright evidence needed to compare a promoted live screen against its approved /design-lab mock — drive the running app to both the lab frame (/design-lab/frame?screen=<key>) and the live route, at 390/820/1440px in light and dark, snapshotting the DOM/a11y tree + screenshots, then tabulate the structural and token deltas. Invoke when verifying a v1.8 Phase-3 promotion (usually run BY the design-parity-auditor agent, but the parent or ux-reviewer/accessibility-auditor may run it too). Do NOT invoke to plan the promotion (use promote-design-lab-mock), to author/fix the screen (ui-component-builder), to author tokens (design-system-architect), or to render the final pass/fail verdict — this skill captures and tabulates evidence; the judgment is the auditor's.
---

# design-lab-parity-check

Given one promoted screen, this skill runs a **fixed Playwright capture-and-tabulate walk** so the comparison between the live screen and its `/design-lab` mock is the same every time: same viewports, same themes, same evidence streams, same delta table. It is the **mechanics** layer of the parity review — it captures structure (DOM/a11y tree), token usage, and screenshots; it does **not** decide pass/fail. The verdict belongs to the [`design-parity-auditor`](../../agents/design-parity-auditor.md) agent (or whoever invokes this skill).

It exists because "verify the promoted screen matches the mock" is otherwise a remembered, easily-skipped ritual (which widths? which themes? did anyone check dark? did the phone reflow survive?). Pinning the capture to a checklist makes the parity pass repeatable and reusable by all three review agents — they have Playwright tools but no standard capture recipe.

## When to invoke

- Verifying a single **v1.8 Phase-3 promotion** — a mock screen graduated into `apps/web/app/(app)/<feature>/`.
- Re-capturing after a fix, to confirm a flagged regression is resolved.
- Producing the responsive/theme evidence the `design-parity-auditor` (or `ux-reviewer` / `accessibility-auditor`) then judges.

## When NOT to invoke

- Planning the promotion (token/data/route/a11y mapping) → use [`promote-design-lab-mock`](../promote-design-lab-mock/SKILL.md).
- Authoring or fixing the live screen → use the [`ui-component-builder`](../../agents/ui-component-builder.md) agent.
- Authoring or re-tuning the tokens themselves → use the [`design-system-architect`](../../agents/design-system-architect.md) agent.
- Rendering the final **PASS / BLOCK** verdict → that is the [`design-parity-auditor`](../../agents/design-parity-auditor.md)'s judgment; this skill stops at the evidence table.
- The mock direction is not approved yet (still Phase 2) → nothing to compare against live; do nothing.

## Input

The user (or invoking agent) names the screen to check. If underspecified, ask **one** batched clarification covering all unknowns — never loop. Useful clarifications:

- **Which screen?** The lab frame key (one of `dashboard`, `search`, `recipes`, `recipe`, `recipe-cook`, `recipe-create`, `menu`, `menu-create`, `grocery`, `members`, `profile` — see [screens.tsx](../../../apps/web/app/(design)/design-lab/_components/screens.tsx)).
- **Live route?** The promoted target path (e.g. `/members`, `/recipes`). If omitted, infer from the screen key and confirm in one line.
- **Base URL?** Default `http://127.0.0.1:3000` (the repo dev server). The live route requires auth + a seeded workspace; the lab route does not.

If the dev server isn't reachable or a route 404s / redirects to auth, **report that and stop** — do not fabricate evidence.

## Authoritative repo references

Read these before capturing. If a referenced file's shape differs from this skill's notes, follow the live file.

| Reference | Why it matters |
|---|---|
| [apps/web/app/(design)/design-lab/frame/page.tsx](../../../apps/web/app/(design)/design-lab/frame/page.tsx) | The chrome-less per-screen render target. `/design-lab/frame?screen=<key>&dark=<0\|1>` renders ONE mock with no control bar — the canonical capture URL. `dark=1` adds `.dark`, else `.theme-light`. |
| [apps/web/app/(design)/design-lab/_components/screens.tsx](../../../apps/web/app/(design)/design-lab/_components/screens.tsx) | The valid screen keys + their labels + which mock component each renders. |
| [docs/design/cozy-restyle-spec.md](../../../docs/design/cozy-restyle-spec.md) | The cozy token deltas the live screen must consume (radius `1rem`, `rounded-pill`, soft warm `shadow-{sm,md,lg}`, `success`/`warning` + tints, `.cozy-card`/`.cozy-lift`). The token checklist. |
| [docs/design/v1.8-ui-mockups.md](../../../docs/design/v1.8-ui-mockups.md) | The per-screen wireframe intent — section/heading/action inventory the structural snapshot is compared against. |
| [apps/web/app/(app)/](../../../apps/web/app/(app)/) | The live routes. The promotion target captured as "live". |
| [.claude/skills/promote-design-lab-mock/SKILL.md](../promote-design-lab-mock/SKILL.md) | The promotion plan whose mock-element → live mapping this check verifies landed. |

## The capture matrix (fixed — do not improvise)

Three viewports × two themes = **six captures per surface**, for **two surfaces** (mock + live) = up to 12 captures.

| Viewport | Width × height | Why |
|---|---|---|
| Phone | 390 × 844 | v1.8 phone floor; confirms card-list / bottom-sheet reflow + no horizontal scroll. |
| Tablet | 820 × 1180 | mid-breakpoint; confirms the grid transitions, not just the extremes. |
| Desktop | 1440 × 900 | full layout. |

Themes: **light** and **dark** (mock via `?dark=0|1`; live via the app's `next-themes` toggle — set theme to `light` then `dark`).

> Use `browser_resize` to the exact width and `browser_navigate` straight to the frame URL (don't capture the lab control page's scaled iframe — navigate to `/design-lab/frame` directly so Tailwind breakpoints evaluate against the real viewport). The lab control surface's own device presets are 430/834px; this parity check standardizes on **390/820/1440** to match `ux-reviewer`, `accessibility-auditor`, and the v1.8 plan.

## Steps

1. **Anchor.** Restate the screen key + lab frame URL + live route in one line. If vague, ask one batched clarification.
2. **Read** the cozy spec token checklist + the mock component source + the live page source. Note the live-only states the mock lacks (skeleton, `EmptyState`, error, role-gating) so they aren't later mistaken for parity gaps.
3. **Token grep.** In the live promoted source, grep for the promoted tokens (e.g. `rounded-2xl`, `rounded-pill`, `shadow-md`, `bg-success-tint`, `text-warning`, `.cozy-card`) AND for leak patterns (`#`, `rgb(`, `hsl(`, raw `rounded-[`, inline `style={`). Record which are present.
4. **Capture the lab mock.** For each viewport × theme: `browser_resize` → `browser_navigate` to `/design-lab/frame?screen=<key>&dark=<0|1>` → `browser_wait_for` settle → `browser_snapshot` (structure) + `browser_take_screenshot`.
5. **Capture the live screen.** Same six combos against the live route (set `next-themes` to light/dark via the header toggle or `localStorage`). Capture `browser_console_messages` once on the live screen.
6. **Tabulate.** Build the structural inventory diff (sections/headings/primary actions/list semantics, mock vs live) and the token-usage table. Flag each delta as `structural`, `token`, `responsive`, `theme`, `motion`, or `console`. Do **not** verdict — label severity-candidates (`likely-regression` / `likely-acceptable`) and hand to the auditor.
7. **Report** in the structure below.

## Report structure

```markdown
## Parity evidence — <screen> (frame key: <key>) → <live route>

### Capture status
- Base URL, dev-server reachable? Live route required auth — reached? Any viewport/theme NOT captured (with reason).

### Token usage (live source)
| Promoted token | Expected (cozy spec) | Present in live? | Notes |
|---|---|---|---|
| card radius | `rounded-2xl` | yes/no | file:line |
| shadow scale | `shadow-md` (soft warm) | yes/no | ... |
| inline color/radii leak | none | found at file:line / none | ... |

### Structural inventory (mock vs live)
| Element / section | In mock | In live | Delta kind | Candidate |
|---|---|---|---|---|
| Page heading | yes | yes | — | ok |
| Loading skeleton | no | yes | structural | likely-acceptable (live-only state) |
| Density toggle | yes | no | structural | likely-regression |

### Per-viewport × theme notes
- 390 light — <observation: reflow ok? horizontal scroll? card vs table?>
- 390 dark — ...
- 820 light/dark — ...
- 1440 light/dark — ...

### Console (live)
- Clean / errors listed.

### Hand-off
Evidence ready for `design-parity-auditor` to verdict. Open questions: <list or none>.
```

## Non-negotiables

- **Capture, don't verdict.** This skill produces the evidence table and labels candidates; the PASS/BLOCK call is the [`design-parity-auditor`](../../agents/design-parity-auditor.md)'s. Never declare the promotion done.
- **Read-only.** No code edits, no token edits, no committing. Drive the browser; read source; tabulate.
- **The matrix is fixed.** Always 390/820/1440 × light/dark for BOTH mock and live. Don't drop dark, don't drop a width "because it looked fine" — a skipped capture is a silent gap; if one genuinely can't be captured, say so explicitly in Capture status.
- **Navigate to the frame URL directly.** Capture the mock at `/design-lab/frame?screen=<key>` resized to the real width — not the control page's scaled-down iframe (its breakpoints key off the iframe, and it carries a control bar that pollutes the structural snapshot).
- **Live-only states are expected, not gaps.** Skeleton / `EmptyState` / error / role-gated controls exist live and not in the static mock. Label them `likely-acceptable`, never `regression`.
- **Honest failure.** If the dev server is down, a route 404s, or auth blocks the live route, report it and stop — never fabricate a screenshot or a "looks fine".
- **No baselines.** This is structural + visual heuristic capture, not pixel-diff; do not write baseline PNGs into the repo.

## What to flag in the report

- **Default-shadcn leftovers** — live surface still `rounded-md` / hairline `shadow-sm` where the mock + cozy spec require `rounded-2xl` + soft `shadow-md`. The screen reads flat = the promotion's Stage A didn't fully land.
- **Inline color/radii leak** — any `#hex` / `rgb()` / `hsl()` / `rounded-[…px]` / non-accent `style={…}` in the promoted component. (The per-member accent carve-out via `--user-accent*` is the only allowed dynamic style.)
- **Theme gap** — a token/screenshot that only reads correctly in light (or only dark). Dark parity is mandatory.
- **Responsive regression** — phone width keeps a desktop table / loses the card-list reflow / scrolls horizontally; or the mid-breakpoint (820) doesn't transition.
- **Missing live state** — the promoted screen lacks the skeleton/empty/error state the live page is supposed to keep (the *opposite* of a mock-only addition — this one IS a gap).
- **Console noise** — hydration mismatch, missing-image, or failed-fetch errors on the live screen.

## Example

See [docs/examples/members-parity-check.md](./docs/examples/members-parity-check.md) for a worked capture report on the Members screen (`members-mock.tsx` / frame key `members` → `/members`), with the token table, structural inventory diff, per-viewport notes, and the hand-off to `design-parity-auditor`.
