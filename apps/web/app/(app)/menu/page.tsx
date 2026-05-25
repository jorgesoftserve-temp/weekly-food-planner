'use client'

import { CalendarRange } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'

const MenuPage = () => {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader
        title="Weekly menu"
        description="Deterministic generation of the week's plan."
      />
      <EmptyState
        icon={CalendarRange}
        title="Menu generation arrives in Phase 3"
        description="Generation form, active menu view, regenerate button, and pre-engine / engine failure handling will land here."
      />
    </div>
  )
}

export default MenuPage
