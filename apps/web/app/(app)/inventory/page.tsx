'use client'

import { Package } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { useActiveWorkspace } from '@/components/workspace-provider'
import { InventoryList } from './_components/inventory-list'

const InventoryPage = () => {
  const { workspace, isLoading } = useActiveWorkspace()

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title="Inventory"
        description="Track what's in your pantry and manage expiring items."
      />

      {!isLoading && !workspace ? (
        <EmptyState
          icon={Package}
          title="No workspace found"
          description="You need to be a member of a workspace to use the inventory."
        />
      ) : workspace ? (
        <InventoryList workspaceId={workspace.id} />
      ) : null}
    </div>
  )
}

export default InventoryPage
