import type { ReactNode } from 'react'
import { RecipeCookMock } from './recipe-cook-mock'

// Single source of truth for the design-lab screen set. Shared by the control
// surface (page.tsx) and the chrome-less render target (frame/page.tsx), so the
// viewport-toggle iframe and the inline preview always show the same screens.
export type Screen = { key: string; label: string; render: () => ReactNode }

export const SCREENS: Screen[] = [
  // All v1.8 screens were promoted to the live app (Phase 3) and their mocks
  // retired: dashboard, recipes, recipe (detail), recipe-create, menu,
  // menu-create, grocery, members, profile (→ live /settings).
  //
  // Search was promoted to the live /search route (v1.9) and its mock retired.
  // Cook mode is also live (/menu cook Sheet); its mock is kept here only until
  // the live feature is reviewed against it, then it too retires.
  { key: 'recipe-cook', label: 'Cook mode', render: () => <RecipeCookMock /> },
]

export const findScreen = (key: string | null): Screen =>
  SCREENS.find((s) => s.key === key) ?? SCREENS[0]!
