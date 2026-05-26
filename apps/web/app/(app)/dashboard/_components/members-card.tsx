'use client'

import { Plus, UserPlus, Users } from 'lucide-react'
import { useWorkspaceWithMembers } from '@weekly-food-planner/supabase/react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useActiveWorkspace } from '@/components/workspace-provider'
import { useSupabase } from '@/lib/hooks/use-supabase'

const ROLE_LABEL: Record<string, string> = {
  creator: 'Creator',
  admin: 'Admin',
  member: 'Member',
}

const ROLE_CLASS: Record<string, string> = {
  creator: 'bg-primary/10 text-primary',
  admin: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  member: 'bg-muted text-muted-foreground',
}

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter((p) => p.length > 0)
  const first = parts[0]
  if (!first) return '?'
  if (parts.length === 1) return first.slice(0, 2).toUpperCase()
  const last = parts[parts.length - 1] ?? first
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase() || '?'
}

export const MembersCard = () => {
  const supabase = useSupabase()
  const { workspace } = useActiveWorkspace()
  const canManage = workspace?.role === 'creator' || workspace?.role === 'admin'
  const detailQuery = useWorkspaceWithMembers({
    supabase,
    workspaceId: workspace?.id ?? null,
    enabled: !!workspace,
  })

  const members = detailQuery.data?.workspace_members ?? []
  const isLoading = detailQuery.isLoading

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-muted p-2 text-muted-foreground">
            <Users className="size-5" />
          </div>
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base">Household members</CardTitle>
            <CardDescription>
              Everyone the planner builds meals for in this workspace.
            </CardDescription>
          </div>
        </div>
        {canManage ? (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled
                    aria-disabled
                  >
                    <Plus className="size-4" />
                    New member
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Coming soon — member management lands in the next iteration.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-16 w-40" />
            <Skeleton className="h-16 w-40" />
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-border bg-card/40 p-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <UserPlus className="size-4" />
              <span className="font-medium text-foreground">
                Just you for now
              </span>
            </div>
            <p>
              Add household members later to plan meals for everyone with their
              own dietary profile.
            </p>
          </div>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {members.map((member) => (
              <li
                key={member.id}
                className="flex min-w-[12rem] items-center gap-3 rounded-md border border-border bg-card/60 p-3"
              >
                <div
                  aria-hidden
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
                >
                  {getInitials(member.name)}
                </div>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">
                    {member.name}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      className={`rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                        ROLE_CLASS[member.role] ?? ROLE_CLASS.member
                      }`}
                    >
                      {ROLE_LABEL[member.role] ?? member.role}
                    </span>
                    <span className="truncate capitalize">
                      {member.age_category.replace(/_/g, ' ')}
                    </span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
