'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { findScreen } from '../_components/screens'
import { LabNavProvider } from '../_components/lab-nav'

// Chrome-less render target for the viewport-toggle iframe: just the mock, in the
// theme requested via ?dark, with NO control bar. Loaded in an <iframe> sized to a
// device width so Tailwind's sm:/md:/lg: breakpoints evaluate against that width
// (they key off the iframe viewport, not a container). Inherits the cozy skin +
// prod gate from design-lab/layout.tsx. Honors ?screen=<key>&dark=<0|1>.
//
// The frame owns a LOCAL screen state seeded from ?screen, so in-mock navigation
// (LabNavProvider) makes the device preview a self-contained clickable prototype
// without round-tripping to the parent control surface.
const FrameContent = () => {
  const params = useSearchParams()
  const dark = params.get('dark') === '1'
  const [screen, setScreen] = useState<string>(
    () => findScreen(params.get('screen'))?.key ?? '',
  )
  const active = findScreen(screen)

  return (
    <LabNavProvider value={setScreen}>
      <div className={cn('min-h-screen bg-muted/40 p-4', dark ? 'dark' : 'theme-light')}>
        {active ? (
          active.render()
        ) : (
          <p className="p-6 text-sm text-muted-foreground">
            No mocks registered.
          </p>
        )}
      </div>
    </LabNavProvider>
  )
}

const FramePage = () => (
  <Suspense fallback={null}>
    <FrameContent />
  </Suspense>
)

export default FramePage
