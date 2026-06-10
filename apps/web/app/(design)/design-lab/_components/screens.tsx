import type { ReactNode } from 'react'
import { SearchMock } from './search-mock'
import { RecipeCookMock } from './recipe-cook-mock'
import { RecipeCreateMock } from './recipe-create-mock'
import { MenuMock } from './menu-mock'
import { MenuCreateMock } from './menu-create-mock'
import { GroceryMock } from './grocery-mock'
import { ProfileMock } from './profile-mock'

// Single source of truth for the design-lab screen set. Shared by the control
// surface (page.tsx) and the chrome-less render target (frame/page.tsx), so the
// viewport-toggle iframe and the inline preview always show the same screens.
export type Screen = { key: string; label: string; render: () => ReactNode }

export const SCREENS: Screen[] = [
  // 'dashboard' promoted to the live /dashboard screen (v1.8 Phase 3) — mock retired.
  { key: 'search', label: 'Search', render: () => <SearchMock /> },
  // 'recipes' + 'recipe' (detail) promoted to live (v1.8 Phase 3) — mocks retired.
  { key: 'recipe-cook', label: 'Cook mode', render: () => <RecipeCookMock /> },
  { key: 'recipe-create', label: 'New recipe', render: () => <RecipeCreateMock /> },
  { key: 'menu', label: 'Weekly menu', render: () => <MenuMock /> },
  { key: 'menu-create', label: 'Generate menu', render: () => <MenuCreateMock /> },
  { key: 'grocery', label: 'Grocery', render: () => <GroceryMock /> },
  // 'members' promoted to the live /members screen (v1.8 Phase 3) — mock retired.
  { key: 'profile', label: 'Profile', render: () => <ProfileMock /> },
]

export const findScreen = (key: string | null): Screen =>
  SCREENS.find((s) => s.key === key) ?? SCREENS[0]!
