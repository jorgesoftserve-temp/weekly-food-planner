import type { ReactNode } from 'react'
import { ChefHat } from 'lucide-react'

// Cozy auth shell (v1.9): gradient-hero wash behind a soft-rounded card with a
// ChefHat brand mark. Shared by every (auth) page so login / signup / verify /
// forgot / reset all read as one branded surface.
const AuthLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-hero p-4">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-2xl border border-border bg-card p-8 shadow-lg">
        <div className="flex flex-col items-center gap-2.5 text-center">
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
  )
}

export default AuthLayout
