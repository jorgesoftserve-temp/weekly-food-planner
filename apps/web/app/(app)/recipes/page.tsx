'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ChefHat, Plus } from 'lucide-react'
import { useRecipesList } from '@weekly-food-planner/supabase/react'
import type { RecipeRecord } from '@weekly-food-planner/supabase'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { useActiveWorkspace } from '@/components/workspace-provider'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { useExclusiveOverlay } from '@/hooks/use-exclusive-overlay'
import { DeleteRecipeDialog } from './_components/delete-recipe-dialog'
import { EditRecipeDrawer } from './_components/edit-recipe-drawer'
import {
  RecipeDetailDialog,
  type RecipeDetailSection,
} from './_components/recipe-detail-dialog'
import { RecipeCard } from './_components/recipe-card'
import { RecipeGridSkeleton } from './_components/recipe-grid-skeleton'
import {
  RecipeFilterBar,
  type RecipeFilter,
} from './_components/recipe-filter-bar'

// One overlay at a time — opening any of these implicitly closes the others, so
// the detail dialog and edit drawer can never co-exist.
type RecipeOverlay =
  | { kind: 'detail'; recipeId: string; section: RecipeDetailSection }
  | { kind: 'edit'; recipeId: string }
  | { kind: 'delete'; recipe: RecipeRecord }

const RecipesPage = () => {
  const supabase = useSupabase()
  const { workspace, isLoading: workspaceLoading } = useActiveWorkspace()
  const recipesQuery = useRecipesList({
    supabase,
    workspaceId: workspace?.id ?? null,
    enabled: !!workspace,
  })

  const { overlay, open, onOpenChange } = useExclusiveOverlay<RecipeOverlay>()

  // Filter + search state (ephemeral UI — Zustand not needed for single-page state)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<RecipeFilter>('All')

  const isLoading = workspaceLoading || recipesQuery.isLoading
  const recipes = recipesQuery.data ?? []

  // Admin / creator role — matches the existing page's behaviour: admins can
  // add, edit and delete; plain members see cards but no mutations.
  const isAdmin =
    workspace?.role === 'admin' || workspace?.role === 'creator'

  const openDetail = ({
    recipeId,
    section,
  }: {
    recipeId: string
    section: RecipeDetailSection
  }) => open({ kind: 'detail', recipeId, section })

  // Client-side filter — no extra network round-trip needed.
  // v2.1: meal_type scalar replaced by meal_types array; filter matches any entry.
  const filteredRecipes = useMemo(() => {
    let result = recipes
    if (activeFilter !== 'All') {
      const filterLower = activeFilter.toLowerCase()
      result = result.filter((r) =>
        r.meal_types.some((mt) => mt.toLowerCase() === filterLower),
      )
    }
    if (search.trim()) {
      const lower = search.toLowerCase()
      result = result.filter((r) => r.name.toLowerCase().includes(lower))
    }
    return result
  }, [recipes, activeFilter, search])

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title="Recipes"
        description="The pool the menu generator picks from."
        actions={
          isAdmin ? (
            <Button asChild>
              <Link href="/recipes/new">
                <Plus className="size-4" />
                New recipe
              </Link>
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <RecipeGridSkeleton />
      ) : recipesQuery.error ? (
        <EmptyState
          icon={ChefHat}
          title="Couldn't load recipes"
          description={
            recipesQuery.error instanceof Error
              ? recipesQuery.error.message
              : 'Unknown error.'
          }
        />
      ) : recipes.length === 0 ? (
        <EmptyState
          icon={ChefHat}
          title="No recipes yet"
          description="Add the first recipe to start building the pool the menu generator picks from."
          action={
            isAdmin ? (
              <Button asChild>
                <Link href="/recipes/new">
                  <Plus className="size-4" />
                  Add a recipe
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Search + filter chips */}
          <RecipeFilterBar
            search={search}
            activeFilter={activeFilter}
            onSearch={({ value }) => setSearch(value)}
            onFilter={({ filter }) => setActiveFilter(filter)}
          />

          {filteredRecipes.length === 0 ? (
            <EmptyState
              icon={ChefHat}
              title="No matching recipes"
              description="Try a different search term or filter."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  isAdmin={isAdmin}
                  onViewDetail={openDetail}
                  onEdit={({ recipeId }) => open({ kind: 'edit', recipeId })}
                  onDelete={({ recipe: r }) =>
                    open({ kind: 'delete', recipe: r })
                  }
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Overlays — identical wiring to the original page */}
      {workspace && overlay?.kind === 'delete' ? (
        <DeleteRecipeDialog
          workspaceId={workspace.id}
          recipeId={overlay.recipe.id}
          recipeName={overlay.recipe.name}
          open
          onOpenChange={onOpenChange}
        />
      ) : null}

      {workspace ? (
        <EditRecipeDrawer
          workspaceId={workspace.id}
          recipeId={overlay?.kind === 'edit' ? overlay.recipeId : null}
          open={overlay?.kind === 'edit'}
          onOpenChange={onOpenChange}
        />
      ) : null}

      {workspace ? (
        <RecipeDetailDialog
          workspaceId={workspace.id}
          recipeId={overlay?.kind === 'detail' ? overlay.recipeId : null}
          initialSection={
            overlay?.kind === 'detail' ? overlay.section : 'ingredients'
          }
          open={overlay?.kind === 'detail'}
          onOpenChange={onOpenChange}
        />
      ) : null}
    </div>
  )
}

export default RecipesPage
