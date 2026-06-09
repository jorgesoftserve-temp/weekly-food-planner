'use client'

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import type { AccentColor } from '@weekly-food-planner/supabase'

type AccentContextValue = {
  accent: AccentColor
  // Optimistically set the accent for instant preview. Persistence (the
  // useUpdateAccentColor mutation) is the caller's responsibility; on mutation
  // error the caller calls setAccent again with the previous value to revert.
  setAccent: (next: AccentColor) => void
}

const AccentContext = createContext<AccentContextValue | null>(null)

// Renders a display:contents wrapper carrying `data-accent`, so the per-user
// accent CSS variables (see globals.css [data-accent="…"]) cascade to the whole
// app shell. The server layout seeds `initialAccent` for a correct first paint.
export const AccentProvider = ({
  initialAccent,
  children,
}: {
  initialAccent: AccentColor
  children: ReactNode
}) => {
  const [accent, setAccent] = useState<AccentColor>(initialAccent)

  return (
    <AccentContext.Provider value={{ accent, setAccent }}>
      <div data-accent={accent} className="contents">
        {children}
      </div>
    </AccentContext.Provider>
  )
}

export const useAccent = (): AccentContextValue => {
  const ctx = useContext(AccentContext)
  if (!ctx) {
    throw new Error('useAccent must be used inside <AccentProvider>')
  }
  return ctx
}
