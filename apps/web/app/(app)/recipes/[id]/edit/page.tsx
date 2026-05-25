'use client'

import Link from 'next/link'
import { use } from 'react'
import { ArrowLeft, ChefHat } from 'lucide-react'
import { useRecipeDetail } from '@weekly-food-planner/supabase/react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { useActiveWorkspace } from '@/components/workspace-provider'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { RecipeForm } from '../../_components/recipe-form'

type PageParams = { id: string }

const EditRecipePage = ({ params }: { params: Promise<PageParams> }) => {
  const { id: recipeId } = use(params)
  const supabase = useSupabase()
  const { workspace, isLoading: workspaceLoading } = useActiveWorkspace()
  const recipeQuery = useRecipeDetail({
    supabase,
    workspaceId: workspace?.id ?? null,
    recipeId,
    enabled: !!workspace,
  })

  const isLoading = workspaceLoading || recipeQuery.isLoading

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit text-muted-foreground"
      >
        <Link href="/recipes">
          <ArrowLeft className="size-4" />
          Back to recipes
        </Link>
      </Button>

      <PageHeader
        title={recipeQuery.data ? `Edit ${recipeQuery.data.name}` : 'Edit recipe'}
        description="Update the recipe's details. Ingredients and steps stay as-is."
      />

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : recipeQuery.error ? (
        <EmptyState
          icon={ChefHat}
          title="Couldn't load recipe"
          description={
            recipeQuery.error instanceof Error
              ? recipeQuery.error.message
              : 'Unknown error.'
          }
        />
      ) : !workspace || !recipeQuery.data ? (
        <EmptyState
          icon={ChefHat}
          title="Recipe not found"
          description="It may have been deleted, or it belongs to a different workspace."
          action={
            <Button asChild variant="outline">
              <Link href="/recipes">Back to recipes</Link>
            </Button>
          }
        />
      ) : (
        <RecipeForm
          mode="edit"
          workspaceId={workspace.id}
          recipe={recipeQuery.data}
        />
      )}
    </div>
  )
}

export default EditRecipePage
