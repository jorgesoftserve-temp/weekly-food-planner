'use client'

import { useState } from 'react'
import { useSoftDeleteMember } from '@weekly-food-planner/supabase/react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { notifyError, notifySuccess } from '@/lib/toast'

export type DeleteMemberDialogProps = {
  workspaceId: string
  memberId: string
  memberName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const DeleteMemberDialog = ({
  workspaceId,
  memberId,
  memberName,
  open,
  onOpenChange,
}: DeleteMemberDialogProps) => {
  const supabase = useSupabase()
  const deleteMutation = useSoftDeleteMember({ supabase, workspaceId })
  const [isWorking, setIsWorking] = useState(false)

  const handleConfirm = async () => {
    setIsWorking(true)
    try {
      await deleteMutation.mutateAsync({ memberId })
      notifySuccess('Member removed', memberName)
      onOpenChange(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not remove the member.'
      notifyError('Removal failed', message)
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove &ldquo;{memberName}&rdquo;?</DialogTitle>
          <DialogDescription>
            Soft-deleted: the member is hidden from new menus and the grocery
            list, but past menus that referenced them still render correctly.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isWorking}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={isWorking}
          >
            {isWorking ? 'Removing…' : 'Remove member'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
