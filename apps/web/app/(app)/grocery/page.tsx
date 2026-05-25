'use client'

import { ShoppingCart } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'

const GroceryPage = () => {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader
        title="Grocery list"
        description="Aggregated shopping list for the active menu."
      />
      <EmptyState
        icon={ShoppingCart}
        title="Grocery view arrives in Phase 4"
        description="Reads /api/workspaces/[id]/grocery and renders the shared + per-member sections from the active menu."
      />
    </div>
  )
}

export default GroceryPage
