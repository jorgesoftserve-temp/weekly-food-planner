import type { ReactNode } from 'react'
import { SearchMock } from './search-mock'
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
  // The two below are NET-NEW features with no live screen yet — they remain
  // here as the reviewable mocks for v1.9 (cross-module search + cook mode).
  { key: 'search', label: 'Search', render: () => <SearchMock /> },
  { key: 'recipe-cook', label: 'Cook mode', render: () => <RecipeCookMock /> },
]

export const findScreen = (key: string | null): Screen =>
  SCREENS.find((s) => s.key === key) ?? SCREENS[0]!
