'use client'

import { useCallback, useState } from 'react'

// Single source of truth for "which overlay is open" in a feature, so two
// dialogs/sheets can never co-exist or stack. Model the feature's overlays as a
// discriminated union and pass it as T; opening one implicitly closes any other.
//
//   type RecipeOverlay =
//     | { kind: 'detail'; recipeId: string }
//     | { kind: 'edit'; recipeId: string }
//   const { overlay, open, close } = useExclusiveOverlay<RecipeOverlay>()
export const useExclusiveOverlay = <T>(): {
  overlay: T | null
  open: (next: T) => void
  close: () => void
  // `onOpenChange` adapter for shadcn Dialog/Sheet `open`/`onOpenChange`: closes
  // when the primitive reports `false`, ignores `true` (open is driven by `open`).
  onOpenChange: (next: boolean) => void
  isOpen: boolean
} => {
  const [overlay, setOverlay] = useState<T | null>(null)

  const open = useCallback((next: T) => setOverlay(next), [])
  const close = useCallback(() => setOverlay(null), [])
  const onOpenChange = useCallback((next: boolean) => {
    if (!next) setOverlay(null)
  }, [])

  return { overlay, open, close, onOpenChange, isOpen: overlay !== null }
}
