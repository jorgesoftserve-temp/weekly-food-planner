'use client'

import { MoreHorizontal, Pencil, Trash2, Eye } from 'lucide-react'
import type { RecipeRecord } from '@weekly-food-planner/supabase'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { resolveRecipeIcon } from '@/lib/recipe-icon'

// Difficulty badge tint mapping — uses only semantic token classes.
const DIFFICULTY_CLASS: Record<string, string> = {
  easy: 'bg-success-tint text-success',
  medium: 'bg-warning-tint text-warning',
  hard: 'bg-destructive/10 text-destructive',
}

type RecipeCardProps = {
  recipe: RecipeRecord
  isAdmin: boolean
  onViewDetail: ({ recipeId, section }: { recipeId: string; section: 'dietary' | 'ingredients' | 'instructions' }) => void
  onEdit: ({ recipeId }: { recipeId: string }) => void
  onDelete: ({ recipe }: { recipe: RecipeRecord }) => void
}

export const RecipeCard = ({
  recipe,
  isAdmin,
  onViewDetail,
  onEdit,
  onDelete,
}: RecipeCardProps) => {
  const icon = resolveRecipeIcon({
    name: recipe.name,
    cuisine: recipe.cuisine ?? undefined,
    tags: recipe.recipe_dietary_tags.map((t) => t.tag),
    meal: recipe.meal_type,
  })

  const totalMinutes =
    (recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0)

  const difficultyClass =
    DIFFICULTY_CLASS[recipe.difficulty.toLowerCase()] ??
    'bg-muted text-muted-foreground'

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-md hover-lift',
      )}
    >
      {/* Image / icon area — 4:3 aspect ratio per cozy spec */}
      <button
        type="button"
        aria-label={`View details for ${recipe.name}`}
        onClick={() => onViewDetail({ recipeId: recipe.id, section: 'ingredients' })}
        className="flex h-36 w-full items-center justify-center bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <span
          className="select-none text-5xl leading-none"
          aria-hidden="true"
          role="img"
        >
          {icon}
        </span>
      </button>

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => onViewDetail({ recipeId: recipe.id, section: 'ingredients' })}
            className="text-left text-sm font-semibold leading-tight hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm"
          >
            {recipe.name}
          </button>

          {/* Actions menu — only visible to admins */}
          {isAdmin ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={`Actions for ${recipe.name}`}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    onViewDetail({ recipeId: recipe.id, section: 'dietary' })
                  }}
                >
                  <Eye className="mr-2 size-4" />
                  View details
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    onEdit({ recipeId: recipe.id })
                  }}
                >
                  <Pencil className="mr-2 size-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                  onSelect={(e) => {
                    e.preventDefault()
                    onDelete({ recipe })
                  }}
                >
                  <Trash2 className="mr-2 size-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        {/* Meta chips */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="rounded-pill bg-muted px-2 py-0.5 capitalize text-muted-foreground">
            {recipe.meal_type}
          </span>
          {recipe.cuisine ? (
            <span className="rounded-pill bg-muted px-2 py-0.5 text-muted-foreground">
              {recipe.cuisine}
            </span>
          ) : null}
          <span
            className={cn(
              'rounded-pill px-2 py-0.5 capitalize font-medium',
              difficultyClass,
            )}
          >
            {recipe.difficulty}
          </span>
          {totalMinutes > 0 ? (
            <span className="rounded-pill bg-muted px-2 py-0.5 text-muted-foreground">
              {totalMinutes}m
            </span>
          ) : null}
        </div>

        {/* Dietary tags — show up to 2, then "+N more" */}
        {recipe.recipe_dietary_tags.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1">
            {recipe.recipe_dietary_tags.slice(0, 2).map((t) => (
              <span
                key={t.tag}
                className="rounded-pill bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
              >
                {t.tag.replace(/_/g, ' ')}
              </span>
            ))}
            {recipe.recipe_dietary_tags.length > 2 ? (
              <span className="text-xs text-muted-foreground">
                +{recipe.recipe_dietary_tags.length - 2} more
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
