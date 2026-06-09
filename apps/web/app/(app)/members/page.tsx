'use client'

import { useState } from 'react'
import {
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Users,
} from 'lucide-react'
import { useMembersList } from '@weekly-food-planner/supabase/react'
import type { MemberRecord } from '@weekly-food-planner/supabase'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { useActiveWorkspace } from '@/components/workspace-provider'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { DeleteMemberDialog } from './_components/delete-member-dialog'
import { MemberFormDialog } from './_components/member-form-dialog'

type EditTarget = { mode: 'create' } | { mode: 'edit'; memberId: string }

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

const summarise = (member: MemberRecord): string => {
  const parts: string[] = []
  if (member.member_dietary_restrictions.length > 0) {
    parts.push(`${member.member_dietary_restrictions.length} dietary`)
  }
  if (member.member_allergies.length > 0) {
    parts.push(`${member.member_allergies.length} allergy`)
  }
  if (member.member_ingredient_dislikes.length > 0) {
    parts.push(`${member.member_ingredient_dislikes.length} dislike`)
  }
  return parts.length > 0 ? parts.join(' · ') : '—'
}

const MembersPage = () => {
  const supabase = useSupabase()
  const { workspace, isLoading: workspaceLoading } = useActiveWorkspace()
  const canManage = workspace?.role === 'creator' || workspace?.role === 'admin'
  const membersQuery = useMembersList({
    supabase,
    workspaceId: workspace?.id ?? null,
    enabled: !!workspace,
  })

  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)
  const [pendingDelete, setPendingDelete] = useState<MemberRecord | null>(null)

  const isLoading = workspaceLoading || membersQuery.isLoading
  const members = membersQuery.data ?? []

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title="Household members"
        description="The household the planner builds meals for."
        actions={
          canManage ? (
            <Button onClick={() => setEditTarget({ mode: 'create' })}>
              <Plus className="size-4" />
              Add member
            </Button>
          ) : null
        }
      />

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : membersQuery.error ? (
        <EmptyState
          icon={Users}
          title="Couldn't load members"
          description={
            membersQuery.error instanceof Error
              ? membersQuery.error.message
              : 'Unknown error.'
          }
        />
      ) : members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No members yet"
          description="Add someone the planner should build meals for."
          action={
            canManage ? (
              <Button onClick={() => setEditTarget({ mode: 'create' })}>
                <Plus className="size-4" />
                Add the first member
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Role</TableHead>
                <TableHead className="hidden sm:table-cell">Age</TableHead>
                <TableHead className="hidden md:table-cell">Calories/day</TableHead>
                <TableHead className="hidden md:table-cell">Meals</TableHead>
                <TableHead className="hidden lg:table-cell">Profile</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const isCreator = member.role === 'creator'
                return (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      <button
                        type="button"
                        onClick={() =>
                          setEditTarget({ mode: 'edit', memberId: member.id })
                        }
                        className="text-left hover:underline underline-offset-4"
                      >
                        {member.name}
                      </button>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span
                        className={`rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                          ROLE_CLASS[member.role] ?? ROLE_CLASS.member
                        }`}
                      >
                        {ROLE_LABEL[member.role] ?? member.role}
                      </span>
                    </TableCell>
                    <TableCell className="hidden capitalize text-muted-foreground sm:table-cell">
                      {member.age_category.replace(/_/g, ' ')}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {member.daily_calorie_target ?? '—'}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {member.meal_frequency
                        ? `${member.meal_frequency.length} custom`
                        : 'inherits'}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {summarise(member)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Actions for ${member.name}`}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={(event) => {
                              event.preventDefault()
                              setEditTarget({
                                mode: 'edit',
                                memberId: member.id,
                              })
                            }}
                          >
                            <Pencil className="mr-2 size-4" />
                            Edit
                          </DropdownMenuItem>
                          {canManage && !isCreator ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                onSelect={(event) => {
                                  event.preventDefault()
                                  setPendingDelete(member)
                                }}
                              >
                                <Trash2 className="mr-2 size-4" />
                                Remove
                              </DropdownMenuItem>
                            </>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {workspace && editTarget ? (
        <MemberFormDialog
          workspaceId={workspace.id}
          mode={editTarget.mode}
          memberId={editTarget.mode === 'edit' ? editTarget.memberId : null}
          open={!!editTarget}
          onOpenChange={(open) => {
            if (!open) setEditTarget(null)
          }}
        />
      ) : null}

      {workspace && pendingDelete ? (
        <DeleteMemberDialog
          workspaceId={workspace.id}
          memberId={pendingDelete.id}
          memberName={pendingDelete.name}
          open={!!pendingDelete}
          onOpenChange={(open) => {
            if (!open) setPendingDelete(null)
          }}
        />
      ) : null}
    </div>
  )
}

export default MembersPage
