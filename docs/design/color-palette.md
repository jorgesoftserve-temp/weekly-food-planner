# Color palette — Weekly Food Planner (v1.8)

> **Source of truth for the visual language.** Owned by the `design-system-architect` agent. Code
> (`apps/web/app/globals.css`, `apps/web/tailwind.config.ts`) and this doc move **together** — never
> change one without the other. Per-user accents live in [`user-accent-colors.md`](./user-accent-colors.md).
>
> **Guiding principle:** white-first, comfy, minimalistic. Color shows up as small, warm accents and
> *subtle* gradient tints — never heavy full-bleed gradients. **UX over prettier screens.**

## 1. Brand palette (verbatim source)

| Name | HEX | HSL | RGB | Role |
|---|---|---|---|---|
| **Strawberry red** | `#fb4b66` | `hsl(351, 96%, 64%)` | `251, 75, 102` | **Brand.** Active brand moments, gradient stops, default accent. *(Was `#fb4b4e`/359° — rosied to 351° on 2026-06-08; see §4.3.)* |
| Moss green | `#5fad56` | `hsl(114, 35%, 51%)` | `95, 173, 86` | Success / positive / default app accent surface. |
| Jungle teal | `#4d9078` | `hsl(159, 30%, 43%)` | `77, 144, 120` | Secondary / calm info. |
| Tuscan sun | `#f2c14e` | `hsl(42, 86%, 63%)` | `242, 193, 78` | Warning / highlight / gradient warmth. |
| Pastel petal | `#ffcbdd` | `hsl(339, 100%, 90%)` | `255, 203, 221` | **Decoration only** — soft backgrounds, badge fills, gradient stops. Never text or a text-bearing fill. |

## 2. Semantic tokens

These map the brand palette onto shadcn's variable names. They are HSL channel triplets (no `hsl()`
wrapper) to match the shadcn convention in `globals.css`. Edit `:root` and `.dark` **together**.

### Light (`:root`)

| Token | HSL | Notes |
|---|---|---|
| `--background` | `0 0% 100%` | White base. |
| `--foreground` | `0 0% 12%` | Warm near-black. |
| `--card` / `--popover` | `0 0% 100%` | |
| `--card-foreground` / `--popover-foreground` | `0 0% 12%` | |
| `--primary` | `359 79% 56%` | Strawberry **tuned down** so white text hits AA (see §4.2). |
| `--primary-foreground` | `0 0% 100%` | |
| `--secondary` | `159 30% 43%` | Jungle teal. |
| `--secondary-foreground` | `0 0% 100%` | |
| `--accent` | `114 35% 51%` | Moss green — default app accent surface (overridden per-user). |
| `--accent-foreground` | `0 0% 100%` | |
| `--muted` | `339 60% 97%` | Faint pastel-petal tint (warm, not gray). |
| `--muted-foreground` | `0 0% 42%` | |
| `--destructive` | `0 72% 41%` | **Deep crimson** — distinct from brand red (see §4.1). |
| `--destructive-foreground` | `0 0% 100%` | |
| `--border` / `--input` | `0 0% 90%` | |
| `--ring` | `359 79% 56%` | Focus ring = brand (overridden per-user accent). |
| `--radius` | `1rem` | Cozy Phase 3 bump (was `0.65rem`). Cascades to `lg/md/sm` border-radius tokens. |
| `--radius-pill` | `9999px` | Full pill — buttons, chips, badges, segmented controls. |
| `--shadow-sm` | `0 1px 2px hsl(20 30% 12% / 0.04), 0 1px 3px hsl(20 30% 12% / 0.06)` | Inputs, ghost surfaces. |
| `--shadow-md` | `0 2px 6px hsl(20 30% 12% / 0.05), 0 6px 16px hsl(20 30% 12% / 0.08)` | Cards default. |
| `--shadow-lg` | `0 8px 24px hsl(20 30% 12% / 0.10), 0 16px 40px hsl(20 30% 12% / 0.10)` | Modals, popovers, card hover. |
| `--success` | `114 40% 32%` | Moss — Accepted / done states. |
| `--success-tint` | `114 40% 94%` | Soft background for success badges. |
| `--warning` | `34 70% 30%` | Tuscan — Draft / Modified badges. |
| `--warning-tint` | `42 90% 90%` | Soft background for warning badges. |
| `--card-padding` | `1.25rem` | Uniform card inner padding (CardHeader / CardContent / CardFooter). |

### Dark (`.dark`)

| Token | HSL | Notes |
|---|---|---|
| `--background` | `20 6% 10%` | Warm near-black (not slate-blue). |
| `--foreground` | `0 0% 96%` | |
| `--card` / `--popover` | `20 6% 13%` | Raised surface. |
| `--card-foreground` / `--popover-foreground` | `0 0% 96%` | |
| `--primary` | `359 84% 64%` | Strawberry **lightened** for dark-surface contrast. |
| `--primary-foreground` | `0 0% 100%` | |
| `--secondary` | `159 28% 42%` | |
| `--secondary-foreground` | `0 0% 100%` | |
| `--accent` | `114 32% 48%` | |
| `--accent-foreground` | `0 0% 100%` | |
| `--muted` | `20 6% 16%` | |
| `--muted-foreground` | `0 0% 64%` | |
| `--destructive` | `0 65% 50%` | Lighter crimson; still ≠ brand. |
| `--destructive-foreground` | `0 0% 100%` | |
| `--border` / `--input` | `0 0% 20%` | |
| `--ring` | `359 84% 64%` | |
| `--shadow-sm` | `0 1px 2px hsl(0 0% 0% / 0.30)` | Dark depth — pure black, higher opacity. |
| `--shadow-md` | `0 4px 12px hsl(0 0% 0% / 0.35)` | |
| `--shadow-lg` | `0 12px 32px hsl(0 0% 0% / 0.45)` | |
| `--success` | `114 45% 68%` | Lightened for dark-surface contrast. |
| `--success-tint` | `114 28% 20%` | Dark tinted surface. |
| `--warning` | `42 90% 70%` | Lightened for dark-surface contrast. |
| `--warning-tint` | `38 45% 20%` | Dark tinted surface. |

The `--sidebar-*` family inherits these (warm-dark sidebar in dark, near-white sidebar in light).

## 3. Gradient gallery — subtle tints only

Defined as CSS vars + Tailwind utilities. **Rule: ≤12% color opacity in light, ≤6% in dark.** A
gradient is a *whisper* of warmth over the surface, never a saturated wash.

| Utility | Light | Dark | Where it's allowed |
|---|---|---|---|
| `bg-gradient-hero` | `linear-gradient(135deg, hsl(351 96% 64% / 0.08), hsl(42 86% 63% / 0.08))` | same hues @ `0.05` | Page-header band, dashboard welcome. One per screen, top only. |
| `bg-gradient-empty` | `linear-gradient(135deg, hsl(114 35% 51% / 0.08), hsl(159 30% 43% / 0.06))` | @ `0.05` | Empty-state cards. |
| `bg-gradient-selected` | `linear-gradient(90deg, hsl(339 100% 90% / 0.45), transparent)` | `hsl(359 84% 64% / 0.10)` | Active/selected row or chip. |
| `border-gradient-feature` | 2px top border `strawberry → pastel-petal` | strawberry → muted | Featured/“new” card edge only. |

**Never:** stack two gradients on one element, apply a gradient behind body text below AA, or use the
full 5-color rainbow gradient anywhere in product UI (it exists only as a brand asset).

## 4. Visual restrictions (the hard rules)

### 4.1 Brand red ≠ destructive red
The brand **is** red, so destructive actions must not also be bright red or users can't distinguish
"delete" from "primary".
- **Destructive = deep crimson** (`0 72% 41%` light / `0 65% 50%` dark) **and always paired with an
  icon + an explicit verb** ("Delete recipe", trash icon).
- **Bright strawberry is reserved** for primary / positive / neutral CTAs. Never style a destructive
  action strawberry, and never style a primary action crimson.

### 4.2 `#fb4b66` fails AA for white text
At `64%` lightness the literal strawberry gives ~3:1 against white — below the 4.5:1 body-text
threshold.
- `--primary` is therefore tuned to `359 79% 56%` (light) for any **fill that carries text**.
- The literal `#fb4b66` is allowed only for **large text (≥24px/≥18px bold), borders, icons, and
  gradient stops** — never small text on it, never small text of it on white.

### 4.3 Brand hue (351°) vs primary-fill hue (359°)
On 2026-06-08 the **brand strawberry was rosied** `#fb4b4e → #fb4b66` (359° → 351°). This moved the
**decorative brand literal** (hero gradient stop) and the **default `strawberry` per-user accent** to
351°. `--primary` / `--ring` / `--sidebar-primary` were **deliberately left at 359°** (the AA-tuned
fill) — the product decision was "change strawberry, keep primary." The ~8° gap is imperceptible at
these values; primary CTAs stay on 359°, brand washes/accents on 351°. `--secondary` (`159 30% 43%`)
unchanged.

### 4.4 Pastel-petal is decoration only
Background tints, badge fills, gradient stops — yes. Text, or any fill that carries text — no (it's
90% L, nothing readable sits on it).

### 4.5 Tokens only
No hex / `rgb()` / `hsl()` literals in component files. Every color resolves to a token here. Need a
color a token doesn't cover? Add the token; don't inline it.

## 5. Do / Don't

| ✅ Do | ❌ Don't |
|---|---|
| Primary button = `bg-primary text-primary-foreground` | Hardcode `bg-[#fb4b66]` in a component |
| Delete button = `variant="destructive"` + trash icon + "Delete" | Make delete a bright-red primary-looking button |
| One subtle `bg-gradient-hero` band at the top of a page | Full-page saturated gradient background |
| Pastel-petal as a badge background with dark text | Pastel-petal text on white |
| Raise lightness for dark-mode accents | Reuse the exact light HSL in `.dark` |
