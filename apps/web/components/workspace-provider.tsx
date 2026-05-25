'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useWorkspacesForUser } from '@weekly-food-planner/supabase/react'
import type { WorkspaceListEntry } from '@weekly-food-planner/supabase'
import { useAuthUser } from '@/lib/hooks/use-auth-user'
import { useSupabase } from '@/lib/hooks/use-supabase'

export type ActiveWorkspace = {
  id: string
  name: string
  type: 'individual' | 'group'
  role: string
}

type WorkspaceContextValue = {
  workspace: ActiveWorkspace | null
  workspaces: WorkspaceListEntry[]
  isLoading: boolean
  error: Error | null
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

// MVP picks the user's first workspace and exposes it via `useActiveWorkspace`.
// Multi-workspace switching is deferred per step 16 scope cuts; the API and
// hooks already support it, so a future <WorkspaceSwitcher /> can replace the
// "pick the first one" line below without changes elsewhere.
export const WorkspaceProvider = ({ children }: { children: ReactNode }) => {
  const supabase = useSupabase()
  const authUser = useAuthUser()
  const workspacesQuery = useWorkspacesForUser({
    supabase,
    userId: authUser.data?.id ?? null,
    enabled: !!authUser.data,
  })

  const value = useMemo<WorkspaceContextValue>(() => {
    const workspaces = workspacesQuery.data ?? []
    const first = workspaces[0]
    const workspace: ActiveWorkspace | null = first
      ? {
          id: first.workspace.id,
          name: first.workspace.name,
          type: first.workspace.type,
          role: first.role,
        }
      : null
    return {
      workspace,
      workspaces,
      isLoading: authUser.isLoading || workspacesQuery.isLoading,
      error:
        (authUser.error as Error | null) ??
        (workspacesQuery.error as Error | null) ??
        null,
    }
  }, [authUser, workspacesQuery])

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export const useActiveWorkspace = (): WorkspaceContextValue => {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) {
    throw new Error(
      'useActiveWorkspace must be used inside <WorkspaceProvider>',
    )
  }
  return ctx
}
