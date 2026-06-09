# 2026-06-08 — design-system-architect agent + design docs

## What changed

- **`.claude/agents/design-system-architect.md`** (new) — a build-capable agent that owns the visual
  design system: the color tokens in `apps/web/app/globals.css`, the Tailwind theme + gradient/accent
  utilities, font wiring, the per-user accent mechanism, and `docs/design/*.md` as source of truth.
- **`docs/design/color-palette.md`** (new) — base palette (strawberry-red brand), light + dark token
  tables, the subtle-gradient gallery, and the visual restrictions.
- **`docs/design/user-accent-colors.md`** (new) — the curated per-user accent set + the SSR
  `data-accent` mechanism.
- **`docs/design/v1.8-ui-mockups.md`** (new) — per-screen wireframes for the v1.8 UI rework.
- **`CLAUDE.md`** + **`docs/agentic/agents.md`** — registered the new agent in the agent tables.

## Why

v1.8 rebrands the app around strawberry-red `#fb4b4e` with a comfy/minimalistic white-first look and
introduces a per-user accent color (Drive/Monday style) in light + dark. That work needs a single
owner so the token layer and the design docs never drift, and so the other UI agents have an authority
to defer to on visual language. `ui-component-builder` builds components but should not be inventing
color decisions; `ux-reviewer` checks product flow and `accessibility-auditor` checks contrast —
neither owns the palette. The new agent fills that gap and is build-capable because the token rewrite
+ gradient utilities + accent CSS are real code it must author, not just review.

## Cross-references

- Agent catalog: [`docs/agentic/agents.md`](../agents.md) → "Daily-edit agents".
- Plan of record: [`.claude/plans/v1.8.md`](../../../.claude/plans/v1.8.md).
- Conventions for adding agents: [`docs/agentic/extending.md`](../extending.md).

## Forward-looking notes

- The agent is the entry point for any future theme work (additional accents, seasonal themes,
  high-contrast mode). Dark-mode tuning of every accent is in v1.8 scope.
- `accessibility-auditor` co-signs all contrast decisions — the brand red is bright, so primary-fill
  and accent-fill contrast must be verified on every palette change.
