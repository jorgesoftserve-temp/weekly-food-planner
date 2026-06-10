'use client'

import { useEffect, useRef, useState } from 'react'
import { Monitor, Moon, Smartphone, Sun, Tablet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SCREENS } from './_components/screens'
import { LabNavProvider } from './_components/lab-nav'

// Device presets for the viewport toggle. `fit` renders the mock inline at the
// page width (today's behavior). The three device widths render the mock inside a
// width-locked iframe (frame/page.tsx) so responsive breakpoints fire correctly.
const VIEWPORTS = [
  { key: 'fit', label: 'Fit', icon: Monitor, width: 0, height: 0 },
  // Real device logical sizes: iPhone 15 Pro Max, iPad Pro 11" (portrait), Mac.
  { key: 'phone', label: 'iPhone', icon: Smartphone, width: 430, height: 932 },
  { key: 'tablet', label: 'iPad', icon: Tablet, width: 834, height: 1194 },
  { key: 'desktop', label: 'Mac', icon: Monitor, width: 1440, height: 900 },
] as const

type ViewportKey = (typeof VIEWPORTS)[number]['key']

// Design lab control surface. The preview canvas declares its theme explicitly
// (`theme-light` or `dark`) so it is self-contained: the root layout's
// next-themes "system" mode may put `.dark` on <html>, and a bare wrapper would
// inherit those dark tokens. `.theme-light` (design-lab.css) re-asserts the
// light token set locally, so both previews are correct regardless of OS theme.
const DesignLabPage = () => {
  const [screen, setScreen] = useState<string>(SCREENS[0]?.key ?? '')
  const [dark, setDark] = useState(false)
  const [viewport, setViewport] = useState<ViewportKey>('fit')
  const active = SCREENS.find((s) => s.key === screen) ?? SCREENS[0]

  // Measure the available width so device frames wider than the page scale down
  // to fit (the iframe keeps its real px width, so breakpoints stay honest).
  const canvasRef = useRef<HTMLDivElement>(null)
  const [canvasWidth, setCanvasWidth] = useState(0)
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setCanvasWidth(el.clientWidth))
    ro.observe(el)
    setCanvasWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const vp = VIEWPORTS.find((v) => v.key === viewport)!
  const scale = vp.width && canvasWidth ? Math.min(1, canvasWidth / vp.width) : 1
  const frameSrc = `/design-lab/frame?screen=${screen}&dark=${dark ? '1' : '0'}`

  // The harness is kept permanently but the registry is empty between releases
  // (all mocks promoted + retired). Show a calm placeholder instead of crashing.
  if (!active) {
    return (
      <div className="mx-auto flex min-h-[60dvh] max-w-2xl flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-lg font-semibold tracking-tight">Design lab</h1>
        <p className="text-sm text-muted-foreground">
          No mocks are registered right now — every screen has been promoted to
          the live app. The harness (layout, viewport toggle, frame, and the
          shared mock toolkit) is kept for the next version. Add screens in{' '}
          <code className="rounded bg-muted px-1 py-0.5">_components/screens.tsx</code>.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 sm:p-6">
      {/* Control bar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Design lab</h1>
            <p className="text-sm text-muted-foreground">
              Reviewable mock harness — Airbnb-warm, card-forward, soft-rounded. Mock data only.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Viewport segmented control */}
            <div className="flex items-center gap-1 rounded-full bg-muted p-1">
              {VIEWPORTS.map((v) => {
                const Icon = v.icon
                const isActive = v.key === viewport
                return (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => setViewport(v.key)}
                    title={v.width ? `${v.label} — ${v.width}px` : v.label}
                    aria-pressed={isActive}
                    className={cn(
                      'inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition',
                      isActive ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
                    )}
                  >
                    <Icon className="size-4" />
                    <span className="hidden sm:inline">{v.label}</span>
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={() => setDark((d) => !d)}
              className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium"
              aria-pressed={dark}
            >
              {dark ? <Moon className="size-4" /> : <Sun className="size-4" />}
              <span className="hidden sm:inline">{dark ? 'Dark' : 'Light'}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {SCREENS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setScreen(s.key)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium transition',
                s.key === screen
                  ? 'bg-accent-tint text-accent-strong'
                  : 'border border-border text-muted-foreground hover:bg-muted',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mock canvas */}
      <div ref={canvasRef}>
        {viewport === 'fit' ? (
          // Inline: explicit theme class scopes the token set to the preview only,
          // overriding any ancestor `.dark` from the OS/app theme. The nav provider
          // lets in-mock clicks switch screens like a Figma prototype.
          <LabNavProvider value={setScreen}>
            <div className={cn('rounded-2xl', dark ? 'dark' : 'theme-light')}>{active.render()}</div>
          </LabNavProvider>
        ) : (
          // Device frame: real-width iframe, scaled to fit. width/height are the
          // device's true px; transform only changes how big it looks.
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {vp.label} · {vp.width}px{scale < 1 ? ` · ${Math.round(scale * 100)}%` : ''}
            </span>
            <div
              className="mx-auto overflow-hidden rounded-[1.75rem] border-4 border-border bg-background shadow-lg"
              style={{ width: vp.width * scale, height: vp.height * scale }}
            >
              <iframe
                title={`${active.label} — ${vp.label} preview`}
                src={frameSrc}
                style={{
                  width: vp.width,
                  height: vp.height,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                  border: 0,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DesignLabPage
