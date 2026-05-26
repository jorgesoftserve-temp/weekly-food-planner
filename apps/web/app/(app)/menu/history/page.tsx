'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { ArrowLeft, CalendarRange, History } from 'lucide-react'
import { useMenuHistory } from '@weekly-food-planner/supabase/react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { useActiveWorkspace } from '@/components/workspace-provider'
import { useSupabase } from '@/lib/hooks/use-supabase'

const formatDate = (iso: string): string => {
  // ISO date or full timestamp; render the date part in a friendly format
  // without pulling in date-fns just for this. Locale defaults to user's.
  try {
    const date = new Date(iso)
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso.slice(0, 10)
  }
}

const MenuHistoryPage = () => {
  const supabase = useSupabase()
  const { workspace, isLoading: workspaceLoading } = useActiveWorkspace()
  const historyQuery = useMenuHistory({
    supabase,
    workspaceId: workspace?.id ?? null,
    enabled: !!workspace,
  })

  const entries = useMemo(() => historyQuery.data ?? [], [historyQuery.data])
  const isLoading = workspaceLoading || historyQuery.isLoading

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title="Menu history"
        description="Every accepted menu, with its engine seed and the final accepted seed for reproducibility."
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/menu">
              <ArrowLeft className="size-4" />
              Back to menu
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : historyQuery.error ? (
        <EmptyState
          icon={History}
          title="Couldn't load menu history"
          description={
            historyQuery.error instanceof Error
              ? historyQuery.error.message
              : 'Unknown error.'
          }
        />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="No accepted menus yet"
          description="Once you accept a generated menu it'll appear here with its seed for reproducibility."
          action={
            <Button asChild>
              <Link href="/menu">Generate one</Link>
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
                  <div className="flex flex-col gap-1">
                    <CardTitle className="text-base">
                      Week of {entry.week_start_date}
                    </CardTitle>
                    <CardDescription>
                      Accepted {formatDate(entry.accepted_at)}
                      {entry.is_modified ? (
                        <>
                          {' '}·{' '}
                          <span className="font-medium text-amber-700 dark:text-amber-300">
                            Modified
                          </span>
                        </>
                      ) : (
                        <>
                          {' '}·{' '}
                          <span className="font-medium text-emerald-700 dark:text-emerald-300">
                            Pristine
                          </span>
                        </>
                      )}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span>
                      <span className="font-medium text-foreground">
                        Engine seed:
                      </span>{' '}
                      <code className="rounded bg-muted px-1 py-0.5 text-xs">
                        {entry.seed}
                      </code>
                    </span>
                    <span>
                      <span className="font-medium text-foreground">
                        Inputs hash:
                      </span>{' '}
                      <code className="rounded bg-muted px-1 py-0.5 text-xs">
                        {entry.inputs_hash.slice(0, 12)}…
                      </code>
                    </span>
                    <span>
                      <span className="font-medium text-foreground">
                        Accepted seed:
                      </span>{' '}
                      <code className="rounded bg-muted px-1 py-0.5 text-xs">
                        {entry.accepted_seed.slice(0, 12)}…
                      </code>
                    </span>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default MenuHistoryPage
