import type { ReactNode } from 'react'

// Single source of truth for the design-lab screen set. Shared by the control
// surface (page.tsx) and the chrome-less render target (frame/page.tsx), so the
// viewport-toggle iframe and the inline preview always show the same screens.
export type Screen = { key: string; label: string; render: () => ReactNode }

// All v1.8 + v1.9 mocks have been promoted to the live app and retired:
// dashboard, recipes, recipe (detail/create), menu, menu-create, grocery,
// members, profile (→ /settings), search, cook mode, and the auth screens
// (login / signup / confirm-email). The registry is intentionally EMPTY now —
// /design-lab is kept as a permanent, reusable harness (its layout, control
// surface, chrome-less frame, and the shared mock toolkit under _components/),
// ready for the next version's mocks. Add new mocks here to bring it back.
export const SCREENS: Screen[] = []

export const findScreen = (key: string | null): Screen | undefined =>
  SCREENS.find((s) => s.key === key) ?? SCREENS[0]
