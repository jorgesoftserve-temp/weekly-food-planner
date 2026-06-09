# Figma Make AI brief — Weekly Food Planner (alternate design exploration)

> **How to use this.** Paste the **PROMPT** block below into Figma Make AI to generate an *alternate*
> design direction to compare against our in-repo `/design-lab` "cozy" mocks. The brand palette,
> product semantics, and accessibility rules are **fixed constraints** (keep the app on-brand); the
> layout system, composition, and visual treatment are **open for Figma Make to reinterpret** following
> the reference sites and current (2025–26) UI trends. Everything below is grounded in
> [`color-palette.md`](./color-palette.md), [`user-accent-colors.md`](./user-accent-colors.md), and
> [`cozy-restyle-spec.md`](./cozy-restyle-spec.md).

---

## PROMPT (copy everything below this line)

You are designing a fresh, modern visual direction for an existing web app called **Weekly Food
Planner**. Generate a high-fidelity, responsive design system + key screens. This is an *alternative*
proposal — interpret the references and trends in your own way, but respect the fixed brand and
accessibility constraints listed under "Hard constraints."

### 1. What the product is
A web app that helps individuals and households **manage recipes, generate reproducible weekly meal
plans, and produce organized grocery lists**. Its core differentiator is a **deterministic
constraint-based menu engine** that respects each household member's dietary restrictions, allergies,
age group, and calorie needs — "same inputs always produce the same plan." It is a *food* product, so
the feel should be **warm, appetizing, calm, and trustworthy**, not clinical or corporate.

Two audiences:
- **Individuals** — store recipes, plan their week, get a grocery list.
- **Families / households** — shared meals across members with different restrictions; roles
  (creator/admin/member); per-member dietary profiles.

### 2. Screens to design (priority order)
1. **Dashboard** — warm welcome/greeting, a "Generate this week's menu" primary action, quick stats
   (recipes count, this week's menu status), recent activity. Bento-style overview of differently
   sized cards is welcome.
2. **Recipes (browse)** — the pool the generator picks from. **Image-forward card grid** as the
   default on wide screens (cover photo, title, meta chips: meal type · servings · difficulty ·
   dietary tags), with a cards/table density toggle. Filter chips. Mobile = single-column card list.
3. **Recipe detail** — hero food image, title + meta, tabbed or sectioned content
   (Dietary / Ingredients / Instructions), ingredients as a **checkable list**, numbered step cards.
4. **Create / edit recipe** — single full-page form (no modal): cover-photo dropzone, rounded fields,
   meal/servings/difficulty, pill dietary-tag chips, repeatable ingredient rows, repeatable steps.
5. **Generate menu (wizard)** — "who's eating" member chips, duration segmented control (3/5/7 days),
   an optional "just for this menu" extra-restrictions section, one clear **Generate draft** CTA.
6. **Weekly menu (view)** — strong 7-day grid on desktop, day-picker on mobile. Clear **draft vs.
   accepted** state; per-slot meal cards with a way to replace/add a slot. "Modified" badges.
7. **Grocery list** — Todoist-style **checkable, dense rows** grouped by category, inside calm cards;
   shared list + per-member items; a "shop for [subset of members]" picker.
8. **Members** — warm member cards (avatar, name, role, dietary summary), add/edit member form.
9. **Settings / profile** — account fields, an **accent-color picker** (6 swatches, see below), and a
   **Light / Dark / System** theme toggle. Dietary preference chips.

### 3. Reference sites (match the *spirit*, do not copy)
- **Recipe / food content & cards** — cookpad.com/mx, kiwilimon.com, recetasnestle.com.mx →
  image-first recipe cards, appetizing hero photos, ingredient checklists, numbered steps.
- **Product look-and-feel & interaction** —
  - **Airbnb** → warm neutrals, image-forward cards, generous whitespace, soft rounded corners, calm.
  - **Spotify** → confident left sidebar navigation, strong content hierarchy, full dark-mode parity.
  - **Todoist** → calm, scannable, dense working lists; satisfying checkable rows; quiet chrome.

### 4. Hard constraints (must follow — keeps it on-brand & accessible)
**Brand palette (fixed):**
| Role | Color | Hex |
|---|---|---|
| **Primary / brand** | Strawberry red | `#fb4b4e` (for large text/icons/borders/gradients). For **fills that carry text**, use a slightly deeper strawberry `#E5383B` to pass AA on white. |
| Secondary | Jungle teal | `#4D9078` |
| Success / positive | Moss green | `#5FAD56` |
| Warning / highlight | Tuscan sun | `#F2C14E` |
| Decoration only (never text) | Pastel petal | `#FFCBDD` |
| **Destructive / delete** | Deep crimson | `#B41D1D` — must be **visibly different from brand red**, always paired with a trash icon + the word "Delete". |

**Neutrals:** white-first in light mode (`#FFFFFF` surfaces, `#1F1F1F` text). Dark mode uses a **warm
near-black** (`#1B1917`), not slate-blue; raised surfaces `#211E1C`; text `#F5F5F5`.

**Per-user accent colors** (a Google-Drive/Monday-style personal accent that recolors only nav-active,
focus rings, selected chips, links, avatar, and a subtle header wash — **never** primary CTAs or
destructive). Provide swatches for: Strawberry `#E5383B` (default) · Moss `#509E47` · Teal `#428E72` ·
Amber `#CA8A16` · Ocean `#1B82C0` · Plum `#8A47B1`. Each needs a light and a dark variant.

**Typography:** body in a clean geometric sans (**Inter**); headings in a warm display serif
(**Fraunces**) for a recipe-magazine feel.

**Gradients:** only *subtle* tints (≤12% color opacity in light, ≤6% in dark) — e.g. a soft
strawberry→amber wash at the top of a page header, or a faint moss→teal empty-state. **Never** a heavy
full-bleed or rainbow gradient.

**Accessibility:** all text ≥ 4.5:1 contrast (large text ≥ 3:1). Visible focus rings. Touch targets
≥ 44px. Full dark-mode parity for every screen. Respect reduced-motion (subtle hover lift only).

### 5. Visual direction to explore
Modern friendly-SaaS for 2025–26: **larger corner radii** (cards ~16–20px, pill buttons/chips), **soft
layered low-opacity shadows** (warm-tinted, not hard gray), **generous padding**, **image-forward
cards**, **bento dashboard grids**, **calm scannable working lists**, restrained motion. Warm neutrals
over cold grays. You may propose your own take on density, navigation shell, and card composition — we
want a genuine *alternative* to compare, as long as it honors the constraints above.

### 6. Deliverables
- A color + type style set (light **and** dark).
- The 9 screens above, **responsive** at phone (~390px), tablet (~820px), and desktop (~1440px).
- Reusable components: button (primary/secondary/destructive/ghost), input/select, card, recipe card,
  member card, chip/badge, tabs/segmented control, checkable list row, dialog/bottom-sheet, sidebar
  nav, page header with gradient band, accent-swatch picker, theme toggle, empty state.

### 7. Guiding principle (most important)
**UX over prettier screens** — a simple screen with a simple interaction beats a beautiful one that
demands a complex interaction. Never add an interaction step purely for visual effect. Avoid stacked
modals (one overlay at a time). On phones, prefer bottom-sheets over center dialogs.

## PROMPT (end — copy everything above this line)

---

## Notes for us (not part of the prompt)
- Figma Make takes hex, not HSL — the hex values above are converted from our `globals.css` HSL
  triplets and are the canonical equivalents. If Make rounds them, re-pin from the table here.
- This brief intentionally leaves **layout/shell/composition open** so Make produces a true
  alternative to the `/design-lab` cozy direction. To instead have Make *match* the cozy spec, append
  the per-primitive deltas from [`cozy-restyle-spec.md`](./cozy-restyle-spec.md) §"Per-primitive deltas".
- After Make generates, we can pull frames back via the **figma MCP** (`get_figma_data`) once
  `FIGMA_API_KEY` is set, and compare side-by-side with `/design-lab`.
</content>
</invoke>
