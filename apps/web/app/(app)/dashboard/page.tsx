'use client'

import { useMemo, useState } from 'react'
import { CalendarRange, ShoppingCart } from 'lucide-react'
import {
  useActiveMenu,
  useActiveGroceryLists,
  useDraftMenu,
  useMembersList,
  useRecipesList,
} from '@weekly-food-planner/supabase/react'
import type { RecipeRecord } from '@weekly-food-planner/supabase'
import { Skeleton } from '@/components/ui/skeleton'
import { useActiveWorkspace } from '@/components/workspace-provider'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { HeroCard } from './_components/hero-card'
import { MemberSelector } from './_components/member-selector'
import { StatCard } from './_components/stat-card'
import { WeekPreview } from './_components/week-preview'
import { DashboardEmpty } from './_components/dashboard-empty'

const DashboardPage = () => {
  const supabase = useSupabase()
  const { workspace, isLoading: workspaceLoading } = useActiveWorkspace()

  // ── Member selector (presentational; deeper per-member filtering is a follow-up) ──
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)

  // ── Data queries ─────────────────────────────────────────────────────────────
  const membersQuery = useMembersList({
    supabase,
    workspaceId: workspace?.id ?? null,
    enabled: !!workspace,
  })

  const activeMenuQuery = useActiveMenu({
    supabase,
    workspaceId: workspace?.id ?? null,
    enabled: !!workspace,
  })

  const draftMenuQuery = useDraftMenu({
    supabase,
    workspaceId: workspace?.id ?? null,
    enabled: !!workspace,
  })

  const groceryQuery = useActiveGroceryLists({
    supabase,
    workspaceId: workspace?.id ?? null,
    enabled: !!workspace && !!activeMenuQuery.data,
  })

  const recipesQuery = useRecipesList({
    supabase,
    workspaceId: workspace?.id ?? null,
    enabled: !!workspace && !!activeMenuQuery.data,
  })

  // ── Derived values ────────────────────────────────────────────────────────────
  const activeMenu = activeMenuQuery.data
  const hasDraft = !!draftMenuQuery.data
  const members = membersQuery.data ?? []

  const recipesById = useMemo<Record<string, RecipeRecord>>(() => {
    const map: Record<string, RecipeRecord> = {}
    for (const r of recipesQuery.data ?? []) map[r.id] = r
    return map
  }, [recipesQuery.data])

  // "Days this menu" — count of distinct days that have at least one slot.
  const distinctDayCount = useMemo(() => {
    if (!activeMenu) return null
    const days = new Set(
      activeMenu.menu_slots.map((s) => s.day_of_week.toLowerCase()),
    )
    return days.size
  }, [activeMenu])

  // "Items to buy" — total grocery_items across all lists.
  const groceryItemCount = useMemo(() => {
    if (!groceryQuery.data) return null
    return groceryQuery.data.lists.reduce(
      (acc, list) => acc + list.grocery_items.length,
      0,
    )
  }, [groceryQuery.data])

  // Hero summary is day-based (distinct planned days of the menu's span) so it
  // stays coherent on multi-member households where slots are per member×day×meal.
  const durationDays = activeMenu?.duration_days ?? null

  const isLoading =
    workspaceLoading || activeMenuQuery.isLoading || membersQuery.isLoading

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      {/* Hero */}
      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : (
        <HeroCard
          workspaceName={workspace?.name ?? null}
          isLoading={isLoading}
          daysPlanned={distinctDayCount}
          durationDays={durationDays}
          hasDraft={hasDraft}
        />
      )}

      {/* Member selector */}
      {isLoading ? (
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
      ) : members.length > 0 ? (
        <MemberSelector
          members={members}
          selectedMemberId={selectedMemberId}
          onSelect={({ memberId }) => setSelectedMemberId(memberId)}
        />
      ) : null}

      {/* Active menu content */}
      {!isLoading && activeMenu ? (
        <div className="flex flex-col gap-4">
          {/* Bento stat cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Days this menu */}
            {distinctDayCount !== null ? (
              <StatCard
                icon={CalendarRange}
                value={distinctDayCount}
                label="Days this menu"
                href="/menu"
                variant="accent"
              />
            ) : null}

            {/* Items to buy — only rendered once grocery data has loaded */}
            {groceryItemCount !== null ? (
              <StatCard
                icon={ShoppingCart}
                value={groceryItemCount}
                label="Items to buy"
                href="/grocery"
                variant="accent"
              />
            ) : groceryQuery.isLoading ? (
              <Skeleton className="h-[130px] w-full rounded-2xl" />
            ) : null}

            {/* Week preview spans full grid width */}
            <WeekPreview
              menu={activeMenu}
              recipesById={recipesById}
              isLoadingRecipes={recipesQuery.isLoading}
            />
          </div>
        </div>
      ) : null}

      {/* No active menu → cozy onboarding / empty state */}
      {!isLoading && !activeMenu && !activeMenuQuery.error ? (
        <DashboardEmpty />
      ) : null}

      {/* Error state */}
      {!isLoading && activeMenuQuery.error ? (
        <p className="text-sm text-muted-foreground">
          {activeMenuQuery.error instanceof Error
            ? activeMenuQuery.error.message
            : 'Could not load your menu.'}
        </p>
      ) : null}
    </div>
  )
}

export default DashboardPage
