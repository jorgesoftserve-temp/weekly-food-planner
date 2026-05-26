'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  ChefHat,
  Eye,
  ListChecks,
  MoreHorizontal,
  Pencil,
  Plus,
  Salad,
  Trash2,
  Utensils,
} from 'lucide-react'
import { useRecipesList } from '@weekly-food-planner/supabase/react'
import type { RecipeRecord } from '@weekly-food-planner/supabase'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { useActiveWorkspace } from '@/components/workspace-provider'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { DeleteRecipeDialog } from './_components/delete-recipe-dialog'
import { EditRecipeDrawer } from './_components/edit-recipe-drawer'
import {
  RecipeDetailDialog,
  type RecipeDetailSection,
} from './_components/recipe-detail-dialog'

type DetailTarget = {
  recipeId: string
  section: RecipeDetailSection
}

const RecipesPage = () => {
  const supabase = useSupabase()
  const { workspace, isLoading: workspaceLoading } = useActiveWorkspace()
  const recipesQuery = useRecipesList({
    supabase,
    workspaceId: workspace?.id ?? null,
    enabled: !!workspace,
  })

  const [pendingDelete, setPendingDelete] = useState<RecipeRecord | null>(null)
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null)
  const [detailTarget, setDetailTarget] = useState<DetailTarget | null>(null)

  const openDetail = (recipeId: string, section: RecipeDetailSection) =>
    setDetailTarget({ recipeId, section })

  const isLoading = workspaceLoading || recipesQuery.isLoading
  const recipes = recipesQuery.data ?? []

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title="Recipes"
        description="The pool the menu generator picks from."
        actions={
          <Button asChild>
            <Link href="/recipes/new">
              <Plus className="size-4" />
              New recipe
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
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
            <Button asChild>
              <Link href="/recipes/new">
                <Plus className="size-4" />
                Add a recipe
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Meal</TableHead>
                <TableHead className="hidden sm:table-cell">Difficulty</TableHead>
                <TableHead className="hidden md:table-cell">Servings</TableHead>
                <TableHead className="hidden md:table-cell">Cuisine</TableHead>
                <TableHead className="hidden lg:table-cell">Dietary</TableHead>
                <TableHead className="hidden lg:table-cell">Ingredients</TableHead>
                <TableHead className="hidden lg:table-cell">Instructions</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {recipes.map((recipe) => {
                const dietaryCount = recipe.recipe_dietary_tags.length
                const ingredientCount = recipe.recipe_ingredients.length
                const instructionCount = recipe.recipe_instructions.length
                return (
                  <TableRow key={recipe.id}>
                    <TableCell className="font-medium">
                      <button
                        type="button"
                        onClick={() => setEditingRecipeId(recipe.id)}
                        className="text-left hover:underline underline-offset-4"
                      >
                        {recipe.name}
                      </button>
                    </TableCell>
                    <TableCell className="hidden capitalize text-muted-foreground sm:table-cell">
                      {recipe.meal_type}
                    </TableCell>
                    <TableCell className="hidden capitalize text-muted-foreground sm:table-cell">
                      {recipe.difficulty}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {recipe.servings}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {recipe.cuisine ?? '—'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-2 h-auto px-2 py-1 text-muted-foreground hover:text-foreground"
                        onClick={() => openDetail(recipe.id, 'dietary')}
                        aria-label={`View dietary tags for ${recipe.name}`}
                        disabled={dietaryCount === 0}
                      >
                        <Salad className="size-3.5" />
                        {dietaryCount === 0 ? 'None' : `${dietaryCount} tags`}
                      </Button>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-2 h-auto px-2 py-1 text-muted-foreground hover:text-foreground"
                        onClick={() => openDetail(recipe.id, 'ingredients')}
                        aria-label={`View ingredients for ${recipe.name}`}
                        disabled={ingredientCount === 0}
                      >
                        <Utensils className="size-3.5" />
                        {ingredientCount === 0
                          ? 'None'
                          : `${ingredientCount} items`}
                      </Button>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-2 h-auto px-2 py-1 text-muted-foreground hover:text-foreground"
                        onClick={() => openDetail(recipe.id, 'instructions')}
                        aria-label={`View instructions for ${recipe.name}`}
                        disabled={instructionCount === 0}
                      >
                        <ListChecks className="size-3.5" />
                        {instructionCount === 0
                          ? 'None'
                          : `${instructionCount} steps`}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Actions for ${recipe.name}`}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={(event) => {
                              event.preventDefault()
                              openDetail(recipe.id, 'dietary')
                            }}
                          >
                            <Eye className="mr-2 size-4" />
                            View details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={(event) => {
                              event.preventDefault()
                              setEditingRecipeId(recipe.id)
                            }}
                          >
                            <Pencil className="mr-2 size-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                            onSelect={(event) => {
                              event.preventDefault()
                              setPendingDelete(recipe)
                            }}
                          >
                            <Trash2 className="mr-2 size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {workspace && pendingDelete ? (
        <DeleteRecipeDialog
          workspaceId={workspace.id}
          recipeId={pendingDelete.id}
          recipeName={pendingDelete.name}
          open={!!pendingDelete}
          onOpenChange={(open) => {
            if (!open) setPendingDelete(null)
          }}
        />
      ) : null}

      {workspace ? (
        <EditRecipeDrawer
          workspaceId={workspace.id}
          recipeId={editingRecipeId}
          open={!!editingRecipeId}
          onOpenChange={(open) => {
            if (!open) setEditingRecipeId(null)
          }}
        />
      ) : null}

      {workspace ? (
        <RecipeDetailDialog
          workspaceId={workspace.id}
          recipeId={detailTarget?.recipeId ?? null}
          initialSection={detailTarget?.section ?? 'ingredients'}
          open={!!detailTarget}
          onOpenChange={(open) => {
            if (!open) setDetailTarget(null)
          }}
        />
      ) : null}
    </div>
  )
}

export default RecipesPage
