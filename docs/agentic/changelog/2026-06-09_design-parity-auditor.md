# 2026-06-09 — design-parity-auditor agent + design-lab-parity-check skill (Phase-3 promotion fidelity)

## What changed

Adds the missing review pass for v1.8 **Phase 3**: verifying that a promoted live screen actually
matches the approved `/design-lab` mock it came from. Until now `ux-reviewer` covered product flow
and `accessibility-auditor` covered a11y, but **nothing owned visual/structural fidelity to the
mock** — the `promote-design-lab-mock` skill even named a "live screen matches the mock" Playwright
check with no agent to run it. This closes that gap as an agent + skill combo.

### NEW agent — [`design-parity-auditor`](../../../.claude/agents/design-parity-auditor.md) (sonnet, read-only)
The judgment layer. Tool-scoped to read-only Playwright (the same set as `ux-reviewer` /
`accessibility-auditor`) plus `Skill`. It anchors on one promoted screen, invokes the capture skill,
greps the live source for promoted-token usage + inline-color leaks, then judges each delta as a
**regression** (wrong radius/shadow/spacing, lost responsive reflow, light-only/motion-only) vs.
**acceptable** (live-only loading/empty/error/role-gated states the static mock lacks). Emits a
`PASS` / `PASS WITH NITS` / `BLOCK` verdict that gates retiring the mock. **Method: structural +
visual heuristic, not pixel-diff baselines** (no baseline PNGs to maintain; robust to font/AA/OS
rendering noise).

### NEW skill — [`design-lab-parity-check`](../../../.claude/skills/design-lab-parity-check/SKILL.md)
The deterministic capture mechanics. Drives Playwright to the chrome-less lab frame
(`/design-lab/frame?screen=<key>&dark=<0|1>`) and the live route, at a **fixed matrix** of 390 / 820
/ 1440px × light/dark for both surfaces, snapshotting the DOM/a11y tree + screenshots and tabulating
the structural inventory diff + token-usage table. It **captures and labels candidates; it does not
verdict** — that is the auditor's. Reusable by `ux-reviewer` / `accessibility-auditor` too (they have
Playwright tools but had no standard capture recipe). Worked example:
[members-parity-check.md](../../../.claude/skills/design-lab-parity-check/docs/examples/members-parity-check.md).

### Rules + wiring
- [`.cursor/rules/design-and-mutations.md`](../../../.cursor/rules/design-and-mutations.md) — new "Design-lab promotion (Phase 3)" section: a promoted screen must pass `design-parity-auditor` **before its mock is retired**; the cozy token move stays one coordinated `design-system-architect` step.
- [`.cursor/rules/agentic-rules.md`](../../../.cursor/rules/agentic-rules.md) — added `design-parity-auditor` to the route-to-specialists list.
- [`promote-design-lab-mock`](../../../.claude/skills/promote-design-lab-mock/SKILL.md) — Verification step + retire-gate now name the auditor + capture skill.
- [`ux-reviewer`](../../../.claude/agents/ux-reviewer.md) / [`accessibility-auditor`](../../../.claude/agents/accessibility-auditor.md) — one-line cross-references: mock-fidelity is the new agent's pass; the capture skill is reusable for their own browser-driving.
- Registered in [root `CLAUDE.md`](../../../CLAUDE.md), [root `README.md`](../../../README.md), [`agents.md`](../agents.md), [`skills.md`](../skills.md).

## Why

The combo (rather than one bigger agent or a bare skill) keeps the existing pattern: review *passes*
are agents (`ux-reviewer`, `accessibility-auditor`), and the *capture ritual* — which widths, which
themes, which evidence streams — is exactly the kind of easily-skipped checklist that belongs in a
skill, where all three review agents can reuse it. Heuristic-over-pixel-diff was chosen to avoid a
flaky baseline-PNG store; the auditor's judgment absorbs sub-pixel/font noise that a threshold can't.

## Cross-references

- The promotion plan this verifies: [`promote-design-lab-mock`](../../../.claude/skills/promote-design-lab-mock/SKILL.md).
- The token contract it checks against: [docs/design/cozy-restyle-spec.md](../../../docs/design/cozy-restyle-spec.md).
- Companion v1.8 entries: [`2026-06-08_design-system-architect.md`](./2026-06-08_design-system-architect.md), [`2026-06-08_design-lab-review-pass.md`](./2026-06-08_design-lab-review-pass.md).

## Forward-looking

- This unblocks v1.8 **Phase 3** (promote approved mocks into the live app): each promoted screen now has a defined fidelity gate before its mock is retired.
- If a future change moves to committed visual baselines (pixel-diff), the skill's "No baselines" non-negotiable and the auditor's method section must be revised together.
- The capture matrix is pinned to 390/820/1440 to match the other reviewers + the v1.8 plan; the lab control surface's own device presets (430/834) are intentionally not used for parity so lab and live compare at identical widths.
