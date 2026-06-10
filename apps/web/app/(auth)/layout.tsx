import type { ReactNode } from 'react'
import { ChefHat } from 'lucide-react'

// Cozy auth shell (v1.9). Two flat surfaces only (no gradient) so light and dark
// each read as exactly two colors — the muted surround/brand panel and the card:
//   • Phone (<md): full-bleed — the form fills the whole viewport on bg-card, no
//     card chrome or outer margin.
//   • Tablet/desktop (md+): a contained, centered two-pane card that covers more
//     of the viewport without filling it — a muted brand panel beside the form.
const AuthLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-card md:items-center md:justify-center md:bg-muted md:p-6 lg:p-10">
      <div className="flex w-full flex-1 flex-col bg-card md:max-w-2xl md:flex-none md:flex-row md:overflow-hidden md:rounded-2xl md:border md:border-border md:shadow-md lg:max-w-4xl">
        {/* Brand panel — part of the single bg-card surface, set off by a divider */}
        <aside className="hidden p-8 md:flex md:w-1/2 md:flex-col md:justify-between md:border-r md:border-border lg:p-10">
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <ChefHat className="size-5" aria-hidden />
            </div>
            <span className="text-sm font-semibold">Weekly Food Planner</span>
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold leading-tight">
              Plan cozy weekly menus, together.
            </h2>
            <p className="text-sm text-muted-foreground">
              Deterministic menus, smart grocery lists, and a calm place to cook
              from.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            Made for households.
          </span>
        </aside>

        {/* Form column */}
        <div className="flex flex-1 flex-col justify-center gap-6 px-6 py-10 sm:px-10 md:w-1/2 md:px-10 lg:px-12">
          {/* Brand mark — phone only; the md+ brand panel carries it otherwise */}
          <div className="flex flex-col items-center gap-2.5 text-center md:hidden">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <ChefHat className="size-6" aria-hidden />
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              Weekly Food Planner
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

export default AuthLayout
