'use client'

import { Users } from 'lucide-react'
import { useMemberDetail } from '@weekly-food-planner/supabase/react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { EmptyState } from '@/components/empty-state'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { MemberForm } from './member-form'

export type MemberFormDialogProps = {
  workspaceId: string
  // null = create mode; string = edit mode for that member id.
  memberId: string | null
  // open=true triggers fetch for edit; create mode doesn't fetch.
  open: boolean
  mode: 'create' | 'edit'
  onOpenChange: (open: boolean) => void
}

// Right-side sheet hosting the MemberForm in both create + edit modes. Edit
// gates its detail fetch on `open` so the query doesn't refire after close.
export const MemberFormDialog = ({
  workspaceId,
  memberId,
  open,
  mode,
  onOpenChange,
}: MemberFormDialogProps) => {
  const supabase = useSupabase()
  const memberQuery = useMemberDetail({
    supabase,
    workspaceId,
    memberId,
    enabled: open && mode === 'edit' && !!memberId,
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
      >
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle>
            {mode === 'create'
              ? 'Add household member'
              : memberQuery.data
                ? `Edit ${memberQuery.data.name}`
                : 'Edit member'}
          </SheetTitle>
          <SheetDescription>
            Profile fields, meal schedule, and dietary preferences in one go.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {mode === 'create' ? (
            <MemberForm
              mode="create"
              workspaceId={workspaceId}
              onClose={() => onOpenChange(false)}
            />
          ) : !memberId ? null : memberQuery.isLoading ? (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : memberQuery.error ? (
            <EmptyState
              icon={Users}
              title="Couldn't load member"
              description={
                memberQuery.error instanceof Error
                  ? memberQuery.error.message
                  : 'Unknown error.'
              }
            />
          ) : !memberQuery.data ? (
            <EmptyState
              icon={Users}
              title="Member not found"
              description="It may have been removed, or it belongs to a different workspace."
            />
          ) : (
            <MemberForm
              mode="edit"
              workspaceId={workspaceId}
              member={memberQuery.data}
              onClose={() => onOpenChange(false)}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
