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
      {/* Back affordance */}
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

      {/* Gradient hero band — consistent with other promoted screens */}
      <PageHeader
        title="New recipe"
        description="Add it to the pool the menu generator picks from."
      />

      {isLoading ? (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-md">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-10 w-full" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-20 w-full" />
          </div>
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-md">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-md">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-14 w-full" />
          </div>
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
