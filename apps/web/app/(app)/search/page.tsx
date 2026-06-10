'use client'

import { useMemo, useState } from 'react'
import { Search as SearchIcon } from 'lucide-react'
import { useRecipesList } from '@weekly-food-planner/supabase/react'
import type { RecipeRecord } from '@weekly-food-planner/supabase'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { useActiveWorkspace } from '@/components/workspace-provider'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { useExclusiveOverlay } from '@/hooks/use-exclusive-overlay'
import { RecipeCard } from '../recipes/_components/recipe-card'
import { RecipeGridSkeleton } from '../recipes/_components/recipe-grid-skeleton'
import { DeleteRecipeDialog } from '../recipes/_components/delete-recipe-dialog'
import { EditRecipeDrawer } from '../recipes/_components/edit-recipe-drawer'
import {
  RecipeDetailDialog,
  type RecipeDetailSection,
} from '../recipes/_components/recipe-detail-dialog'
import { SearchModuleBar, type SearchModule } from './_components/search-module-bar'
import {
  RecipeSearchControls,
  EMPTY_RECIPE_FILTERS,
  hasActiveRecipeFilters,
  type RecipeSearchFilters,
} from './_components/recipe-search-controls'

// Same single-overlay discipline the recipes page uses — opening any overlay
// closes the others, so detail / edit / delete can never stack.
type RecipeOverlay =
  | { kind: 'detail'; recipeId: string; section: RecipeDetailSection }
  | { kind: 'edit'; recipeId: string }
  | { kind: 'delete'; recipe: RecipeRecord }

const SearchPage = () => {
  const supabase = useSupabase()
  const { workspace, isLoading: workspaceLoading } = useActiveWorkspace()
  const recipesQuery = useRecipesList({
    supabase,
    workspaceId: workspace?.id ?? null,
    enabled: !!workspace,
  })

  const { overlay, open, onOpenChange } = useExclusiveOverlay<RecipeOverlay>()

  // Recipes-first (v1.9). The module bar can switch later; for now only recipes
  // is selectable so the state is fixed but the surface is built to extend.
  const [activeModule, setActiveModule] = useState<SearchModule>('recipes')
  const [filters, setFilters] = useState<RecipeSearchFilters>(
    EMPTY_RECIPE_FILTERS,
  )

  const isLoading = workspaceLoading || recipesQuery.isLoading
  const recipes = recipesQuery.data ?? []

  const isAdmin =
    workspace?.role === 'admin' || workspace?.role === 'creator'

  // Facet option lists, derived from the loaded recipes so the dropdowns only
  // ever offer values that can actually match something.
  const cuisines = useMemo(() => {
    const set = new Set<string>()
    for (const r of recipes) if (r.cuisine) set.add(r.cuisine)
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [recipes])

  const dietaryTags = useMemo(() => {
    const set = new Set<string>()
    for (const r of recipes) for (const t of r.recipe_dietary_tags) set.add(t.tag)
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [recipes])

  const results = useMemo(() => {
    const keyword = filters.keyword.trim().toLowerCase()
    return recipes.filter((r) => {
      if (keyword && !r.name.toLowerCase().includes(keyword)) return false
      if (filters.meal !== 'all' && r.meal_type !== filters.meal) return false
      if (filters.cuisine !== 'all' && r.cuisine !== filters.cuisine) return false
      if (filters.difficulty !== 'all' && r.difficulty !== filters.difficulty)
        return false
      if (
        filters.dietaryTag !== 'all' &&
        !r.recipe_dietary_tags.some((t) => t.tag === filters.dietaryTag)
      )
        return false
      return true
    })
  }, [recipes, filters])

  const isFiltering = hasActiveRecipeFilters(filters)

  const openDetail = ({
    recipeId,
    section,
  }: {
    recipeId: string
    section: RecipeDetailSection
  }) => open({ kind: 'detail', recipeId, section })

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title="Search"
        description="Find recipes across your workspace. More modules coming soon."
      />

      <SearchModuleBar
        active={activeModule}
        onSelect={({ module }) => setActiveModule(module)}
      />

      <RecipeSearchControls
        filters={filters}
        cuisines={cuisines}
        dietaryTags={dietaryTags}
        onChange={({ filters: next }) => setFilters(next)}
      />

      {isLoading ? (
        <RecipeGridSkeleton />
      ) : recipesQuery.error ? (
        <EmptyState
          icon={SearchIcon}
          title="Couldn't load recipes"
          description={
            recipesQuery.error instanceof Error
              ? recipesQuery.error.message
              : 'Unknown error.'
          }
        />
      ) : results.length === 0 ? (
        <EmptyState
          icon={SearchIcon}
          title={isFiltering ? 'No matching recipes' : 'Search your recipes'}
          description={
            isFiltering
              ? 'Try a different keyword or loosen the filters.'
              : 'Type a keyword or pick a filter above to find recipes.'
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {results.length} {results.length === 1 ? 'recipe' : 'recipes'} match
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                isAdmin={isAdmin}
                onViewDetail={openDetail}
                onEdit={({ recipeId }) => open({ kind: 'edit', recipeId })}
                onDelete={({ recipe: r }) => open({ kind: 'delete', recipe: r })}
              />
            ))}
          </div>
        </div>
      )}

      {/* Overlays — same wiring as the recipes page */}
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

export default SearchPage
