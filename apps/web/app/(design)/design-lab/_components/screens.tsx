import type { ReactNode } from 'react'
import { InventoryScreen } from './screens/inventory-screen'
import { ShoppingScreen } from './screens/shopping-screen'
import { MenuExecScreen } from './screens/menu-exec-screen'
import { GroceryPantryScreen } from './screens/grocery-pantry-screen'
// v2.1 mocks — Smarter generation + Addons (design-lab gate, Part 2.0)
import { RecipeFormScreen } from './screens/recipe-form-screen'
import { MemberProfileScreen } from './screens/member-profile-screen'
import { MenuGenOverrideScreen } from './screens/menu-gen-override-screen'
import { MenuAddonScreen } from './screens/menu-addon-screen'
import { GroceryAddonsScreen } from './screens/grocery-addons-screen'
import { RecipeDetailScreen } from './screens/recipe-detail-screen'

// Single source of truth for the design-lab screen set. Shared by the control
// surface (page.tsx) and the chrome-less render target (frame/page.tsx), so the
// viewport-toggle iframe and the inline preview always show the same screens.
export type Screen = { key: string; label: string; render: () => ReactNode }

// v2.0 mocks — Execution & Pantry (Phase 8, design-first).
// All four screens are presentational only: mock data, no live hooks, no DB.
export const SCREENS: Screen[] = [
  {
    key: 'inventory',
    label: 'Inventory',
    render: () => <InventoryScreen />,
  },
  {
    key: 'shopping',
    label: 'Shopping',
    render: () => <ShoppingScreen />,
  },
  {
    key: 'menu-exec',
    label: 'Menu (exec)',
    render: () => <MenuExecScreen />,
  },
  {
    key: 'grocery-pantry',
    label: 'Grocery (pantry)',
    render: () => <GroceryPantryScreen />,
  },
  // ── v2.1 mocks — design-lab gate (Part 2.0) ─────────────────────────────
  // MOCKS ONLY. Live promotion is pending sign-off via the promote-design-lab-mock
  // skill. Do NOT edit live (app)/.../_components/ until each mock is approved.
  {
    key: 'v21-recipe-form',
    label: 'v2.1 Recipe form',
    render: () => <RecipeFormScreen />,
  },
  {
    key: 'v21-member-profile',
    label: 'v2.1 Member profile',
    render: () => <MemberProfileScreen />,
  },
  {
    key: 'v21-menu-gen-override',
    label: 'v2.1 Menu gen override',
    render: () => <MenuGenOverrideScreen />,
  },
  {
    key: 'v21-menu-addons',
    label: 'v2.1 Menu addons',
    render: () => <MenuAddonScreen />,
  },
  {
    key: 'v21-grocery-addons',
    label: 'v2.1 Grocery addons',
    render: () => <GroceryAddonsScreen />,
  },
  {
    key: 'v21-recipe-detail',
    label: 'v2.1 Recipe detail',
    render: () => <RecipeDetailScreen />,
  },
]

export const findScreen = (key: string | null): Screen | undefined =>
  SCREENS.find((s) => s.key === key) ?? SCREENS[0]
