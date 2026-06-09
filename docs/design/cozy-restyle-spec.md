# Cozy restyle spec (v1.8 Phase 2 → Phase 3 contract)

> The visual language that breaks the app out of the default-shadcn look: **Airbnb-warm, card-forward,
> soft-rounded "cozy."** Owned by `design-system-architect`. **Demonstrated live in
> [`/design-lab`](../../apps/web/app/(design)/design-lab)** with the tokens scoped to `[data-skin="cozy"]`
> so the live app keeps its Phase-1 styling. **Phase 3** promotes these into `globals.css` + the real
> primitives once the direction is approved. Builds on [`color-palette.md`](./color-palette.md) — colors
> are unchanged; this is shape, depth, density, and motion.

## Why this look
Default shadcn reads as "developer default": `rounded-md` (6px), hairline borders, no shadow, flat.
The 2025–26 friendly-SaaS direction — and the reference sites (Airbnb, cookpad, kiwilimon) — is
**larger radii, soft layered shadows, generous padding, image-forward cards, pill controls, warm
neutrals.** It signals craft and is calmer to scan. We keep **UX over aesthetics**: no new interaction
steps, no hover-only affordances, motion is subtle and reduced-motion-safe.

## Scoped tokens (the cozy skin)
Applied under `[data-skin="cozy"]` in the design lab; promoted to `:root` / `.dark` in Phase 3.

```css
[data-skin="cozy"] {
  --radius: 1rem;              /* was 0.65rem — cards/popovers/inputs get noticeably rounder */
  --radius-pill: 9999px;       /* buttons, chips, badges, segmented controls */

  /* Soft, diffuse, warm-tinted shadow scale (low opacity, layered). */
  --shadow-sm: 0 1px 2px hsl(20 30% 12% / 0.04), 0 1px 3px hsl(20 30% 12% / 0.06);
  --shadow-md: 0 2px 6px hsl(20 30% 12% / 0.05), 0 6px 16px hsl(20 30% 12% / 0.08);
  --shadow-lg: 0 8px 24px hsl(20 30% 12% / 0.10), 0 16px 40px hsl(20 30% 12% / 0.10);

  --card-padding: 1.25rem;     /* roomier than the current p-4 default */
}
.dark [data-skin="cozy"] {
  /* On dark surfaces shadows read as depth + a faint glow; keep them subtle. */
  --shadow-sm: 0 1px 2px hsl(0 0% 0% / 0.30);
  --shadow-md: 0 4px 12px hsl(0 0% 0% / 0.35);
  --shadow-lg: 0 12px 32px hsl(0 0% 0% / 0.45);
}
```

Tailwind exposure (Phase 3): map `boxShadow.{sm,md,lg}` → the vars and add a `rounded-pill` /
`borderRadius.pill` token so components use semantic classes, never inline radii.

## Per-primitive deltas (Phase 3 targets)
All via the shadcn `cva` variant strings / wrapper classes — **never edit generated `ui/*.tsx` beyond
CLI output**; restyle through the variant definitions and tokens.

| Primitive | Default shadcn | Cozy target |
|---|---|---|
| `button` | `rounded-md`, flat | `rounded-pill`, `shadow-sm`, slightly taller (`h-10`), softer focus ring (brand) |
| `card` | `rounded-lg border`, no shadow | `rounded-2xl`, `--card-padding`, `shadow-md`, hairline border, hover-lift `shadow-lg` (reduced-motion-safe) |
| `input` / `textarea` / `select` | `rounded-md` | `rounded-xl`, `shadow-sm`, calmer border, larger touch height |
| `dialog` / `sheet` / `popover` | `rounded-lg` | `rounded-2xl`, `shadow-lg` |
| `badge` / chips | `rounded-full` already | keep pill; warm tint fills; use accent tint for "selected" |
| `dropdown` / `command` items | square hover | `rounded-lg` hover row, accent-tint active |
| `tabs` / segmented | underline | pill segmented control on a tinted track |
| `skeleton` | gray block | `rounded-xl`, warm-muted shimmer |
| table / lists | dense rows | roomier rows; on browse screens prefer **image cards** over tables |

## Layout language
- **Bento overview** on the dashboard: a few differently-sized rounded cards on a calm grid.
- **Image-forward cards** for recipes (cover image, title, meta chips) — Airbnb/cookpad density.
- **Calm working lists** (menu/grocery) — Todoist-style checkable rows inside cozy cards.
- Generous whitespace; one subtle `bg-gradient-hero` band per screen (from Phase 1).

## Imagery
Image-forward is core to the cozy look, so the lab uses real food photography (not icons). Aspect
ratios: recipe card **4:3**, recipe-detail hero **16:9**, menu-slot + dashboard tiles **square thumb**,
member avatar **circle**. Always `object-cover`, `rounded-*` to match the surface, `loading="lazy"`,
with a graceful fallback so a failed load never breaks layout. For food the fallback icon is **derived
deterministically** (`recipe-icon.ts`, no AI): explicit override → name keyword → cuisine → tag → meal
timeframe → generic plate; avatars fall back to initials. Lab uses a plain `<img>` (`mock-image.tsx`);
**Phase 3** swaps to `next/image` with remote patterns + real upload/persistence. AI-based icon/photo
inference stays out until v3.0.

## Status palette (scoped, lab-only until Phase 3)
Beyond brand/destructive, working screens need success/warning. Demoed via scoped tokens in
`design-lab.css`: `--success` (moss) for Accepted / done grocery checks, `--warning` (tuscan) for
Draft / Modified badges — each with a `*-tint` background + dark-mode variant. Tokens only, never
inline hex. Promote into `globals.css` (`--success`/`--warning` + Tailwind colors) in Phase 3.

## Motion
- Card hover: `transl-y-[-2px]` + `shadow-md → shadow-lg`, 150ms ease. Wrapped in
  `motion-reduce:transform-none motion-reduce:transition-none`.
- No autoplaying or attention-grabbing motion.

## Guardrails
- Colors/contrast unchanged from Phase 1 — `accessibility-auditor` re-checks focus rings + shadows
  don't reduce text contrast.
- Tokens only; no inline hex or raw radii in components.
- Promotion to live (`globals.css`) happens **only after** the `/design-lab` direction is approved.
