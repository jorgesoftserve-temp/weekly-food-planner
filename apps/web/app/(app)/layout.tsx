import type { ReactNode } from 'react'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppHeader } from '@/components/app-shell/app-header'
import { AppSidebar } from '@/components/app-shell/app-sidebar'
import { WorkspaceProvider } from '@/components/workspace-provider'

// Authenticated route group. Middleware redirects unauthenticated users to
// /login before they ever reach this layout, so we can assume a session here.
const AppLayout = ({ children }: { children: ReactNode }) => {
  return (
    <WorkspaceProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </WorkspaceProvider>
  )
}

export default AppLayout
