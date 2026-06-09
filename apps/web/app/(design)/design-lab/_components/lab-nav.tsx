'use client'

import { createContext, useContext } from 'react'

// Lets a mock screen request a jump to another mock screen, so the lab behaves
// like a clickable Figma prototype (click a recipe card → recipe detail, a
// sidebar item → that screen, "Generate" → the wizard, etc.). The control
// surface (page.tsx) and the chrome-less iframe target (frame/page.tsx) each
// provide their own setter, so navigation works in both the inline "Fit" preview
// and the device-frame previews. Default is a no-op so a screen can render
// standalone without a provider.
type LabNavigate = (screenKey: string) => void

const LabNavContext = createContext<LabNavigate>(() => {})

export const LabNavProvider = LabNavContext.Provider

export const useLabNav = (): LabNavigate => useContext(LabNavContext)
