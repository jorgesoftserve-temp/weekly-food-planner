'use client'

import { useState } from 'react'
import { Plus, Users } from 'lucide-react'
import { useMembersList } from '@weekly-food-planner/supabase/react'
import type { MemberRecord } from '@weekly-food-planner/supabase'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { useActiveWorkspace } from '@/components/workspace-provider'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { DeleteMemberDialog } from './_components/delete-member-dialog'
import { MemberFormDialog } from './_components/member-form-dialog'
import { MemberCard } from './_components/member-card'

type EditTarget = { mode: 'create' } | { mode: 'edit'; memberId: string }

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 w-full rounded-2xl" />
          ))}
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              canManage={canManage}
              onEdit={({ memberId }) => setEditTarget({ mode: 'edit', memberId })}
              onDelete={({ member: target }) => setPendingDelete(target)}
            />
          ))}
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
