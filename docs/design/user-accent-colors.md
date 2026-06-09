# Per-user accent colors (v1.8)

> A user picks one **accent** that follows them across every workspace (Google Drive / Monday model).
> It recolors a **constrained, safe set of surfaces only** and never touches brand or safety colors.
> Stored per account in `profiles.accent_color`. Base palette: [`color-palette.md`](./color-palette.md).

## What the accent recolors (and what it never touches)

| Recolored ✅ | Untouched ❌ |
|---|---|
| Active sidebar / nav item (tint bg + accent text) | Primary CTAs — stay **strawberry** brand |
| Focus ring | Destructive actions — stay **crimson** |
| Selected row / chip highlight | Body text, borders, surfaces |
| Links & inline emphasis | Success/warning semantics |
| Avatar ring / initials | The brand logo |
| The subtle header gradient wash | |

This keeps the brand consistent and the destructive signal unambiguous, while still letting the app
feel personal — exactly how Drive/Monday scope their themes.

## Mechanism (SSR-set, no FOUC)

Each accent is a set of CSS variables. We map them by a `data-accent` attribute on the shell, with a
separate dark-mode block:

```css
/* in globals.css */
[data-accent="moss"]        { --user-accent: 114 38% 45%; --user-accent-strong: 114 40% 32%; --user-accent-tint: 114 40% 95%; }
.dark [data-accent="moss"]  { --user-accent: 114 45% 58%; --user-accent-strong: 114 45% 68%; --user-accent-tint: 114 45% 55%; } /* tint applied at /0.16 */
```

- **`apps/web/app/(app)/layout.tsx`** reads `profiles.accent_color` server-side and renders
  `data-accent={accent}` on the shell wrapper → correct on first paint, no flash.
- **`AccentProvider`** (`apps/web/components/app-shell/accent-provider.tsx`) is a thin client context
  that lets the settings picker set `data-accent` **optimistically** for instant preview before the
  `useUpdateAccentColor` mutation resolves; on error it reverts.
- Application classes use the vars, e.g. active nav = `bg-[hsl(var(--user-accent-tint))]
  text-[hsl(var(--user-accent-strong))]`, ring = `ring-[hsl(var(--user-accent))]`.

### The three vars per accent
- `--user-accent` — the **solid**: focus ring, link, avatar ring, small indicators (mid-L, AA on white as a 3:1 non-text UI element).
- `--user-accent-strong` — **text on the pale tint** (darkened for ≥4.5:1 on `--user-accent-tint`).
- `--user-accent-tint` — **soft background** for active/selected surfaces (very light in light mode; applied at `/0.16` opacity in dark mode).

> We deliberately use **tint-bg + colored-text** for active surfaces (like Todoist), not a solid
> white-on-color fill. This sidesteps the white-text-contrast problem on light hues (amber) and keeps
> every accent legible without per-accent special-casing.

## The accent set

Curated to avoid "breaking" colors — nothing too dark (unreadable as text) or too light
(invisible as a fill). **Pastel-petal is excluded** (90% L, decoration only).

| Key | Name | Light `--user-accent` / `strong` / `tint` | Dark `--user-accent` / `strong` / `tint`(@0.16) | From palette |
|---|---|---|---|---|
| `strawberry` *(default)* | Strawberry | `351 79% 56%` / `351 70% 45%` / `351 90% 96%` | `351 84% 66%` / `351 85% 75%` / `351 40% 22%` | brand (351° since 2026-06-08; color-palette §4.3) |
| `moss` | Moss | `114 38% 45%` / `114 40% 32%` / `114 40% 95%` | `114 45% 58%` / `114 45% 68%` / `114 45% 55%` | moss-green |
| `teal` | Teal | `159 35% 40%` / `159 38% 28%` / `159 35% 94%` | `159 42% 52%` / `159 42% 64%` / `159 42% 50%` | jungle-teal |
| `amber` | Amber | `38 80% 44%` / `34 75% 33%` / `42 90% 94%` | `42 88% 60%` / `42 90% 70%` / `42 85% 58%` | tuscan-sun (darkened) |
| `ocean` | Ocean | `205 75% 43%` / `205 70% 33%` / `205 80% 95%` | `205 80% 62%` / `205 80% 72%` / `205 80% 58%` | safe addition |
| `plum` | Plum | `285 45% 48%` / `285 45% 36%` / `290 50% 96%` | `288 55% 66%` / `288 55% 76%` / `288 55% 64%` | safe addition |

> Values above are the starting set. **`accessibility-auditor` co-signs** every one: `--user-accent`
> ≥3:1 as a non-text UI indicator, `--user-accent-strong` on `--user-accent-tint` ≥4.5:1, in **both**
> modes, before they ship.

## Persistence

- Enum `accent_color`: `strawberry | moss | teal | amber | ocean | plum` (default `strawberry`).
- `profiles (id uuid pk → auth.users(id) on delete cascade, accent_color accent_color not null
  default 'strawberry', created_at, updated_at)`, `updated_at` trigger, **RLS self-only**
  (`id = auth.uid()`), row created at signup (extend `sys_create_workspace_on_signup`).
- Module `packages/supabase/src/module/profiles.ts` (+ `.react.ts` with `useUpdateAccentColor`),
  exported from the barrel.

## Settings UI
A swatch picker (`apps/web/app/(app)/settings/_components/accent-picker.tsx`): six color dots with
labels, selected ring, keyboard-navigable radio group; selecting one calls the mutation and previews
instantly via `AccentProvider`. Sits beside the light/dark/system theme toggle.
