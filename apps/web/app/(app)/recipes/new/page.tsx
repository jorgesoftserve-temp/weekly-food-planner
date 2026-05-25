'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { useActiveWorkspace } from '@/components/workspace-provider'
import { RecipeForm } from '../_components/recipe-form'

const NewRecipePage = () => {
  const { workspace, isLoading } = useActiveWorkspace()

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
        title="New recipe"
        description="Define a dish the menu generator can pick from."
      />

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : workspace ? (
        <RecipeForm mode="create" workspaceId={workspace.id} />
      ) : (
        <EmptyState
          title="No workspace yet"
          description="Sign in and let the workspace trigger run before adding recipes."
        />
      )}
    </div>
  )
}

export default NewRecipePage
