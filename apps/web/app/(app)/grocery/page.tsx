'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { CalendarRange, ShoppingCart } from 'lucide-react'
import {
  useActiveGroceryLists,
  useIngredients,
  useWorkspaceWithMembers,
} from '@weekly-food-planner/supabase/react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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

const capitalize = (s: string): string =>
  s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)

const formatQuantity = (n: number): string => {
  const rounded = Math.round(n * 1000) / 1000
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toString()
}

const GroceryPage = () => {
  const supabase = useSupabase()
  const { workspace, isLoading: workspaceLoading } = useActiveWorkspace()
  const groceryQuery = useActiveGroceryLists({
    supabase,
    workspaceId: workspace?.id ?? null,
    enabled: !!workspace,
  })
  const ingredientsQuery = useIngredients({
    supabase,
    enabled: !!groceryQuery.data,
  })
  const workspaceQuery = useWorkspaceWithMembers({
    supabase,
    workspaceId: workspace?.id ?? null,
    enabled: !!workspace && !!groceryQuery.data,
  })

  const ingredientNamesById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const ing of ingredientsQuery.data ?? []) {
      map[ing.id] = ing.name
    }
    return map
  }, [ingredientsQuery.data])

  const memberNamesById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const m of workspaceQuery.data?.workspace_members ?? []) {
      map[m.id] = m.name
    }
    return map
  }, [workspaceQuery.data])

  const isLoading = workspaceLoading || groceryQuery.isLoading
  const grocery = groceryQuery.data

  // Shared list first, then per-member sorted alphabetically — same order as
  // the markdown / CSV exporter so the UI matches the downloads.
  const sortedLists = useMemo(() => {
    if (!grocery) return []
    return [...grocery.lists].sort((a, b) => {
      if (a.target_member_id === null && b.target_member_id !== null) return -1
      if (a.target_member_id !== null && b.target_member_id === null) return 1
      const na = a.target_member_id
        ? memberNamesById[a.target_member_id] ?? ''
        : ''
      const nb = b.target_member_id
        ? memberNamesById[b.target_member_id] ?? ''
        : ''
      return na.localeCompare(nb)
    })
  }, [grocery, memberNamesById])

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader
        title="Grocery list"
        description={
          grocery
            ? `Aggregated for the week of ${grocery.weekStartDate}.`
            : 'Aggregated shopping list for the active menu.'
        }
      />

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : groceryQuery.error ? (
        <EmptyState
          icon={ShoppingCart}
          title="Couldn't load the grocery list"
          description={
            groceryQuery.error instanceof Error
              ? groceryQuery.error.message
              : 'Unknown error.'
          }
        />
      ) : !grocery ? (
        <EmptyState
          icon={CalendarRange}
          title="No active menu"
          description="Generate a menu first — the grocery list comes from the active menu's recipes."
          action={
            <Button asChild>
              <Link href="/menu">Go to menu</Link>
            </Button>
          }
        />
      ) : sortedLists.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No grocery items"
          description="The active menu didn't produce a grocery list. This usually means no slots were filled — check the menu page."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {sortedLists.map((list) => {
            const heading =
              list.target_member_id === null
                ? 'Shared'
                : `Per member: ${
                    memberNamesById[list.target_member_id] ??
                    `[unknown:${list.target_member_id.slice(0, 6)}]`
                  }`
            const sortedItems = [...list.grocery_items].sort((a, b) => {
              const na = ingredientNamesById[a.ingredient_id] ?? a.ingredient_id
              const nb = ingredientNamesById[b.ingredient_id] ?? b.ingredient_id
              return na.localeCompare(nb)
            })
            return (
              <Card key={list.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{heading}</CardTitle>
                  <CardDescription>
                    {sortedItems.length}{' '}
                    {sortedItems.length === 1 ? 'item' : 'items'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ingredient</TableHead>
                        <TableHead className="w-28 text-right">
                          Quantity
                        </TableHead>
                        <TableHead className="w-20">Unit</TableHead>
                        <TableHead className="hidden w-32 sm:table-cell">
                          Day
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedItems.map((item) => {
                        const name =
                          ingredientNamesById[item.ingredient_id] ??
                          `[unknown:${item.ingredient_id.slice(0, 6)}]`
                        const qty =
                          typeof item.quantity === 'string'
                            ? Number.parseFloat(item.quantity)
                            : item.quantity
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">
                              {name}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatQuantity(qty)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {item.unit}
                            </TableCell>
                            <TableCell className="hidden text-muted-foreground sm:table-cell">
                              {item.scheduled_purchase_day
                                ? capitalize(item.scheduled_purchase_day)
                                : '—'}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default GroceryPage
