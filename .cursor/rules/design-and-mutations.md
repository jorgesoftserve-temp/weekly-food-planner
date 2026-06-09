---
description: v1.8 design-system + member-writable mutation invariants
globs: 
alwaysApply: true
---
# Design system & member-writable mutations (v1.8)

Concise, always-on invariants introduced by v1.8. Detail lives in [`docs/design/`](mdc:docs/design/), the PRDs, and the relevant agents — this file is just the rules.

## Design tokens

- **Tokens only — no raw color literals in app components.** In `apps/web/app/(app)/**` and `apps/web/components/**`, colors and gradients come from the semantic Tailwind / CSS tokens in `apps/web/app/globals.css` + the Tailwind theme. No `#hex` / `rgb()` / `hsl()` literals in component code. The `design-system-architect` agent owns tokens; everyone else consumes them. (The `/design-lab` mocks use inline HSL deliberately for per-member accent — that exception does **not** carry into live code.)
- **Theme + motion parity.** Any new UI must work in light AND dark (`next-themes`) and honor `prefers-reduced-motion`. Tokens carry both themes — never branch on theme with a hardcoded color.
- **Accent scoping.** The per-member accent (`workspace_members.accent_color`) renders only on member-tied surfaces (selector chips, role badges, name dots) — never as the global chrome accent. The per-user accent (`profiles.accent_color`) is the chrome accent and follows the user across workspaces.

## Member-writable mutations

A small, fixed set of menu/grocery columns are writable by **any workspace member** — authorize on **membership, not role**: `menu_slots.cooked_at` / `cooked_by` (cook mode) and `grocery_items.note` (shopper note). Their handlers:

- touch **only** their narrow column set;
- must **never** trigger menu generation, grocery recompute, or mutate `accepted_seed` / `accepted_at`;
- everything else that mutates a menu or grocery list stays creator/admin-gated.

Mechanics are scaffolded by the `add-route-handler` skill. See [DATABASE_PRD §8](mdc:docs/PRD/DATABASE_PRD.md) and [PRODUCT_PRD §§7.2/13](mdc:docs/PRD/PRODUCT_PRD.md).
