'use client'

import { ChefHat } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'

const RecipesPage = () => {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader
        title="Recipes"
        description="The pool the menu generator picks from."
      />
      <EmptyState
        icon={ChefHat}
        title="Recipe CRUD lands in the next phase"
        description="The list, create form, ingredient picker, and label combobox arrive once you pick the CRUD form pattern (modal vs full-page route)."
      />
    </div>
  )
}

export default RecipesPage
