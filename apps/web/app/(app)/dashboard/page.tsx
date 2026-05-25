'use client'

import Link from 'next/link'
import {
  CalendarRange,
  ChefHat,
  ShoppingCart,
  Sparkles,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PageHeader } from '@/components/page-header'
import { useActiveWorkspace } from '@/components/workspace-provider'

const QUICK_LINKS = [
  {
    href: '/recipes',
    title: 'Recipes',
    description: 'Build the pool the generator picks from.',
    icon: ChefHat,
  },
  {
    href: '/menu',
    title: 'Weekly menu',
    description: 'Generate a deterministic plan for the week.',
    icon: CalendarRange,
  },
  {
    href: '/grocery',
    title: 'Grocery list',
    description: 'See the aggregated shopping list for the active menu.',
    icon: ShoppingCart,
  },
] as const

const DashboardPage = () => {
  const { workspace, isLoading } = useActiveWorkspace()

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader
        title={
          workspace ? `Welcome back to ${workspace.name}` : 'Welcome back'
        }
        description={
          isLoading
            ? 'Loading your workspace…'
            : 'Start by adding recipes, then generate a weekly menu and export the grocery list.'
        }
      />

      <Card className="border-dashed bg-card/40">
        <CardHeader className="flex flex-row items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2 text-primary">
            <Sparkles className="size-4" />
          </div>
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base">Deterministic generation</CardTitle>
            <CardDescription>
              Same recipes + same seed = byte-identical menu. The exporter
              writes Markdown or CSV with menu and grocery list in one
              document.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_LINKS.map((link) => {
          const Icon = link.icon
          return (
            <Link
              key={link.href}
              href={link.href}
              className="group focus:outline-none"
            >
              <Card className="h-full transition-colors group-hover:border-primary/60 group-focus-visible:border-primary">
                <CardHeader className="flex flex-row items-start gap-3">
                  <div className="rounded-md bg-muted p-2 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary">
                    <Icon className="size-5" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <CardTitle className="text-base">{link.title}</CardTitle>
                    <CardDescription>{link.description}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  Open →
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default DashboardPage
