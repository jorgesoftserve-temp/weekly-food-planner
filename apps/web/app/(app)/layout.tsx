import type { ReactNode } from 'react'
import { getProfile, type AccentColor } from '@weekly-food-planner/supabase'
import { supabaseServerClient } from '@/utils/supabase/server'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppHeader } from '@/components/app-shell/app-header'
import { AppSidebar } from '@/components/app-shell/app-sidebar'
import { AccentProvider } from '@/components/app-shell/accent-provider'
import { WorkspaceProvider } from '@/components/workspace-provider'

// Reads the signed-in user's accent server-side so `data-accent` is correct on
// first paint (no flash). Falls back to the default accent if anything is off.
const resolveAccent = async (): Promise<AccentColor> => {
  try {
    const supabase = await supabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return 'strawberry'
    const profile = await getProfile({ supabase, userId: user.id })
    return profile?.accent_color ?? 'strawberry'
  } catch {
    return 'strawberry'
  }
}

// Authenticated route group. Middleware redirects unauthenticated users to
// /login before they ever reach this layout, so we can assume a session here.
const AppLayout = async ({ children }: { children: ReactNode }) => {
  const accent = await resolveAccent()

  return (
    <AccentProvider initialAccent={accent}>
      <WorkspaceProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <AppHeader />
            <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
          </SidebarInset>
        </SidebarProvider>
      </WorkspaceProvider>
    </AccentProvider>
  )
}

export default AppLayout
