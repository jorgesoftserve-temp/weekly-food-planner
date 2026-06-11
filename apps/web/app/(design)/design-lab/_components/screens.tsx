import type { ReactNode } from 'react'
import { InventoryScreen } from './screens/inventory-screen'
import { ShoppingScreen } from './screens/shopping-screen'
import { MenuExecScreen } from './screens/menu-exec-screen'
import { GroceryPantryScreen } from './screens/grocery-pantry-screen'

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
]

export const findScreen = (key: string | null): Screen | undefined =>
  SCREENS.find((s) => s.key === key) ?? SCREENS[0]
